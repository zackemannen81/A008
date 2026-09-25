import { guiHttp } from "../client.js";
import { readErrorMessage, requestJson } from "../../../packages/client/src/index.js";

export interface InstalledSkill {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly instructions: string;
  readonly sourcePath: string;
}

export interface DiscoverableSkill {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly sourcePath: string;
  readonly installed: boolean;
}

async function request<T>(path: string, init: { readonly method?: string; readonly body?: string; readonly signal?: AbortSignal } = {}, fetchImpl: typeof fetch = fetch): Promise<T> {
  const requestOptions = {
    ...init,
    ...(init.body === undefined ? {} : { headers: { "content-type": "application/json" } }),
  };
  const { response, body } = await requestJson(guiHttp(fetchImpl), path, requestOptions);
  if (!response.ok) throw new Error(await readErrorMessage(response, "Skill request failed.", body));
  return body as T;
}

export async function loadInstalledSkills(signal?: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<readonly InstalledSkill[]> {
  return (await request<{ skills: readonly InstalledSkill[] }>("/v1/skills", signal === undefined ? {} : { signal }, fetchImpl)).skills;
}

export async function discoverSkills(fetchImpl: typeof fetch = fetch): Promise<{ readonly source: string; readonly skills: readonly DiscoverableSkill[] }> {
  return request("/v1/skills/discover", { method: "POST" }, fetchImpl);
}

export async function installSkill(sourcePath: string, fetchImpl: typeof fetch = fetch): Promise<InstalledSkill> {
  return (await request<{ skill: InstalledSkill }>("/v1/skills/install", {
    method: "POST",
    body: JSON.stringify({ sourcePath }),
  }, fetchImpl)).skill;
}

export async function removeSkill(id: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  await request(`/v1/skills/${encodeURIComponent(id)}`, { method: "DELETE" }, fetchImpl);
}
