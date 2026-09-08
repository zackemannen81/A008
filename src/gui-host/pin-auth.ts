import { randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";

export const GUI_PIN_ENV = "A008_GUI_PIN";
export const GUI_PIN_LOGIN_PATH = "/auth/login";
const COOKIE_NAME = "a008_auth";
const MAX_FAILURES = 5;
const LOCKOUT_MS = 60_000;

interface AttemptState {
  failures: number;
  blockedUntil: number;
}

export interface PinAttemptResult {
  readonly ok: boolean;
  readonly retryAfterSeconds?: number;
}

export interface PinAuthGate {
  readonly enabled: boolean;
  authorized(request: IncomingMessage): boolean;
  attempt(request: IncomingMessage, candidate: string): PinAttemptResult;
  sessionCookie(request: IncomingMessage): string;
  loginPage(message?: string): string;
}
export function createPinAuthGate(
  pin: string | undefined,
  now: () => number = Date.now,
): PinAuthGate {
  if (pin === undefined) {
    return disabledGate;
  }
  const expected = Buffer.from(pin);
  const token = randomBytes(32).toString("hex");
  const attempts = new Map<string, AttemptState>();

  return {
    enabled: true,
    authorized(request) {
      const candidate = cookieValue(request, COOKIE_NAME);
      return candidate !== undefined && safeEqual(candidate, token);
    },
    attempt(request, candidate) {
      const key = clientKey(request);
      const currentTime = now();
      const state = attempts.get(key);
      if (state !== undefined && state.blockedUntil > currentTime) {
        return {
          ok: false,
          retryAfterSeconds: Math.ceil((state.blockedUntil - currentTime) / 1_000),
        };
      }
      if (safeEqual(candidate, pin)) {
        attempts.delete(key);
        return { ok: true };
      }
      const failures = (state?.failures ?? 0) + 1;
      if (failures >= MAX_FAILURES) {
        attempts.set(key, {
          failures: 0,
          blockedUntil: currentTime + LOCKOUT_MS,
        });
        return { ok: false, retryAfterSeconds: LOCKOUT_MS / 1_000 };
      }
      attempts.set(key, { failures, blockedUntil: 0 });
      return { ok: false };
    },
    sessionCookie(request) {
      const secure = forwardedProtocol(request) === "https" ? "; Secure" : "";
      return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${secure}`;
    },
    loginPage(message = "") {
      return renderLoginPage(message);
    },
  };
}

const disabledGate: PinAuthGate = {
  enabled: false,
  authorized: () => true,
  attempt: () => ({ ok: true }),
  sessionCookie: () => "",
  loginPage: () => "",
};

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function cookieValue(request: IncomingMessage, name: string): string | undefined {
  const header = request.headers.cookie;
  if (header === undefined) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

function clientKey(request: IncomingMessage): string {
  const cf = headerValue(request.headers["cf-connecting-ip"]);
  if (cf) return `cf:${cf}`;
  return `socket:${request.socket.remoteAddress ?? "unknown"}`;
}
function forwardedProtocol(request: IncomingMessage): string | undefined {
  return headerValue(request.headers["x-forwarded-proto"])?.split(",")[0]?.trim().toLowerCase();
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") return value;
  return Array.isArray(value) ? value[0] : undefined;
}

function renderLoginPage(message: string): string {
  const status = message ? `<p id="status">${escapeHtml(message)}</p>` : '<p id="status"></p>';
  return `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>A008 · Locked</title>
<style>
html,body{height:100%;margin:0;background:#0b0c0e;color:#eee;font:16px system-ui,sans-serif}
body{display:grid;place-items:center}.gate{width:min(360px,calc(100vw - 40px));text-align:center}
h1{font:600 28px ui-monospace,monospace;margin:0 0 8px}p{color:#999;min-height:24px}
input{box-sizing:border-box;width:100%;font:28px ui-monospace,monospace;letter-spacing:.35em;text-align:center;padding:14px;border:1px solid #34363b;border-radius:10px;background:#15171a;color:#fff}
button{width:100%;margin-top:12px;padding:13px;border:0;border-radius:10px;background:#eee;color:#111;font-weight:700}
</style>
</head>` + renderLoginBody(status);
}
function renderLoginBody(status: string): string {
  return `<body><main class="gate"><h1>A008</h1><p>Enter six-digit PIN</p>
<form id="gate"><input id="pin" name="pin" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" autofocus required>
<button type="submit">Unlock</button></form>${status}</main>
<script>
const form=document.getElementById('gate'),pin=document.getElementById('pin'),status=document.getElementById('status');
form.addEventListener('submit',async(e)=>{e.preventDefault();status.textContent='';
const response=await fetch('/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pin:pin.value})});
if(response.ok){location.replace('/');return;}const body=await response.json().catch(()=>({}));status.textContent=body.message||'Fel PIN';pin.select();});
</script></body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
