import {
  UPLOAD_ENDPOINT,
  uploadSource as uploadSourceFromClient,
  uploadSourcePath as uploadSourcePathFromClient,
  type UploadableFile,
} from "../../../packages/client/src/index.js";
export {
  UploadError,
  type UploadedSource,
} from "../../../packages/protocol/src/index.js";
export { UPLOAD_ENDPOINT };
export type { UploadableFile };
import { guiHttp } from "../client.js";

export interface UploadSourceOptions {
  readonly fetch?: typeof globalThis.fetch;
  readonly endpoint?: string;
}

export async function uploadSource(
  file: UploadableFile,
  options: UploadSourceOptions = {},
) {
  void options.endpoint;
  return uploadSourceFromClient(guiHttp(options.fetch ?? fetch), file);
}

export async function uploadSourcePath(
  localPath: string,
  options: UploadSourceOptions = {},
) {
  void options.endpoint;
  return uploadSourcePathFromClient(guiHttp(options.fetch ?? fetch), localPath);
}
