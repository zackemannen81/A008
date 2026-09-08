import { engineHeaders } from "../session/engine-access.js";

export interface FrameCheck {
  readonly url: string;
  readonly embeddable: boolean;
  readonly reason?: string;
}

export async function checkFrame(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FrameCheck> {
  const response = await fetchImpl(
    `/v1/browser/frame-check?url=${encodeURIComponent(url)}`,
    {
      headers: { ...engineHeaders(), accept: "application/json" },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { url, embeddable: true };
  }
  const payload = (await response.json()) as FrameCheck;
  return {
    url: typeof payload.url === "string" ? payload.url : url,
    embeddable: payload.embeddable !== false,
    ...(typeof payload.reason === "string" ? { reason: payload.reason } : {}),
  };
}
