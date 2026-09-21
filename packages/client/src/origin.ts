import {
  DEFAULT_GUI_HOST,
  GUI_SESSION_PATH,
} from "@a008/protocol";

export const V2_SESSION_PATH = "/v2/session";
export const V2_SESSION_SUBPROTOCOL = "a008.v2";

export interface ClientLocation {
  readonly protocol: string;
  readonly host: string;
  readonly href?: string;
  readonly origin?: string;
  readonly hash?: string;
}

export function resolveHttpOrigin(
  origin: string | undefined,
  location: ClientLocation | undefined,
): string {
  if (origin !== undefined && origin.length > 0) return origin.replace(/\/$/u, "");
  if (location && location.host.length > 0) {
    if (location.origin && location.origin.length > 0) return location.origin;
    return `${location.protocol}//${location.host}`;
  }
  return `http://${DEFAULT_GUI_HOST}`;
}

export function resolveHttpUrl(origin: string, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (origin.length === 0) return path;
  return new URL(path, `${origin}/`).toString();
}

export function resolveGuiSessionUrl(
  location: ClientLocation | undefined = undefined,
): string {
  if (location === undefined || location.host === "")
    return `ws://${DEFAULT_GUI_HOST}${GUI_SESSION_PATH}`;
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}${GUI_SESSION_PATH}`;
}

export function resolveV2SessionUrl(
  origin: string,
): string {
  const http = origin.length > 0 ? origin : `http://${DEFAULT_GUI_HOST}`;
  const url = new URL(V2_SESSION_PATH, `${http}/`);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}
