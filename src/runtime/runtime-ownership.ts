import { createHash } from "node:crypto";
import { existsSync, mkdirSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import Database from "better-sqlite3";

export class RuntimeOwnershipError extends Error {
  readonly code = "PROJECT_BINDING_CONFLICT";
}

export function canonicalStoragePath(path: string): string {
  const absolute = resolve(path);
  if (existsSync(absolute)) return realpathSync(absolute);
  const parent = dirname(absolute);
  if (parent === absolute) throw new RuntimeOwnershipError("Storage path has no accessible filesystem root.");
  return join(canonicalStoragePath(parent), basename(absolute));
}

/** OS-backed local lifetime lease. Never unlink: replacing the inode bypasses locks. */
export function acquireRuntimeLease(path: string, namespace: string, timeout = 0): () => void {
  const suffix = createHash("sha256").update(namespace).digest("hex");
  const filename = `${path}.a008-owner-${suffix}.sqlite`;
  mkdirSync(dirname(filename), { recursive: true });
  const database = new Database(filename, { timeout });
  try {
    // No application state is written. The separate file keeps the knowledge
    // database available to other project namespaces while this owner lives.
    database.exec("BEGIN EXCLUSIVE");
  } catch (error) {
    database.close();
    if ((error as { code?: string }).code === "SQLITE_BUSY") {
      throw new RuntimeOwnershipError("The project memory namespace already has a process owner.");
    }
    throw error;
  }
  let closed = false;
  return () => { if (!closed) { database.close(); closed = true; } };
}
