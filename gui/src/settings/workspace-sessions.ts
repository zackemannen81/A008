import {
  loadWorkspaceSettings as loadWorkspaceSettingsFromClient,
  saveWorkspaceSettings as saveWorkspaceSettingsFromClient,
} from "../../../packages/client/src/index.js";
import type { WorkspaceSettings } from "../../../packages/protocol/src/index.js";
import { guiHttp } from "../client.js";

export async function loadWorkspaceSettings(
  fetchImpl: typeof fetch = fetch,
): Promise<WorkspaceSettings> {
  return loadWorkspaceSettingsFromClient(guiHttp(fetchImpl));
}

export async function saveWorkspaceSettings(
  workspaceRoot: string,
  fetchImpl: typeof fetch = fetch,
): Promise<WorkspaceSettings> {
  return saveWorkspaceSettingsFromClient(guiHttp(fetchImpl), workspaceRoot);
}