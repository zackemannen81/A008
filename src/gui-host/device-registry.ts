import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import Database from "better-sqlite3";
import {
  v2DeviceGrantSchema,
  type V2Capability,
  type V2DeviceGrant,
} from "../../packages/protocol/src/index.js";
import { assertPathOutsideRepo } from "../core/user-catalog.js";
import {
  findRepositoryRoot,
  moduleDirectory,
} from "../runtime/local-runtime-config.js";
import { canonicalStoragePath } from "../runtime/runtime-ownership.js";

export interface DevicePrincipal {
  readonly id: string;
  readonly name: string;
  readonly projects: readonly string[];
  readonly capabilities: readonly V2Capability[];
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly revoked: boolean;
}
interface Row {
  id: string;
  name: string;
  projects: string;
  capabilities: string;
  created: number;
  expires: number;
  revoked: number;
}
const view = (row: Row): DevicePrincipal => ({
  id: row.id,
  name: row.name,
  projects: JSON.parse(row.projects),
  capabilities: JSON.parse(row.capabilities),
  createdAt: row.created,
  expiresAt: row.expires,
  revoked: row.revoked === 1,
});
const digest = (secret: string) =>
  createHash("sha256").update(secret).digest("hex");
const COLUMNS = "id, name, projects, capabilities, created, expires, revoked";

/** Read operations never create storage. Every read observes external CLI revocation. */
export class DeviceRegistry {
  readonly path: string;
  constructor(
    env: NodeJS.ProcessEnv,
    readonly now: () => number = Date.now,
  ) {
    this.path = canonicalStoragePath(
      resolve(
        env.A008_DEVICES_PATH || join(homedir(), ".a008", "devices.sqlite"),
      ),
    );
    assertPathOutsideRepo(
      this.path,
      findRepositoryRoot(moduleDirectory(import.meta.url)),
      "A008_DEVICES_PATH",
    );
  }
  #read<T>(missing: T, read: (db: Database.Database) => T): T {
    if (!existsSync(this.path)) return missing;
    const db = new Database(this.path, { readonly: true, fileMustExist: true });
    try {
      return read(db);
    } finally {
      db.close();
    }
  }
  grant(input: V2DeviceGrant): { device: DevicePrincipal; credential: string } {
    const grant = v2DeviceGrantSchema.parse(input),
      now = this.now();
    const credential = `a008_device_${randomBytes(32).toString("base64url")}`;
    const device: DevicePrincipal = {
      id: `device_${randomUUID()}`,
      name: grant.name,
      projects: [...new Set(grant.projects)],
      capabilities: [...new Set(grant.capabilities)],
      createdAt: now,
      expiresAt: now + grant.expiresInDays * 86_400_000,
      revoked: false,
    };
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    const db = new Database(this.path);
    try {
      db.transaction(() => {
        db.exec(
          "CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, name TEXT NOT NULL, hash TEXT NOT NULL UNIQUE, projects TEXT NOT NULL, capabilities TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0)",
        );
        db.prepare("INSERT INTO devices VALUES (?, ?, ?, ?, ?, ?, ?, 0)").run(
          device.id,
          device.name,
          digest(credential),
          JSON.stringify(device.projects),
          JSON.stringify(device.capabilities),
          now,
          device.expiresAt,
        );
      }).immediate();
    } finally {
      db.close();
    }
    return { device, credential };
  }
  list(): readonly DevicePrincipal[] {
    return this.#read([], (db) =>
      (
        db
          .prepare(`SELECT ${COLUMNS} FROM devices ORDER BY created, id`)
          .all() as Row[]
      ).map(view),
    );
  }
  current(id: string): DevicePrincipal | undefined {
    return this.#read(undefined, (db) => {
      const row = db
        .prepare(
          `SELECT ${COLUMNS} FROM devices WHERE id = ? AND revoked = 0 AND expires > ?`,
        )
        .get(id, this.now()) as Row | undefined;
      return row && view(row);
    });
  }
  authenticate(credential: string): DevicePrincipal | undefined {
    if (!/^a008_device_[A-Za-z0-9_-]{43}$/u.test(credential)) return undefined;
    return this.#read(undefined, (db) => {
      const row = db
        .prepare(
          `SELECT ${COLUMNS} FROM devices WHERE hash = ? AND revoked = 0 AND expires > ?`,
        )
        .get(digest(credential), this.now()) as Row | undefined;
      return row && view(row);
    });
  }
  revoke(id: string): boolean {
    if (!existsSync(this.path)) return false;
    const db = new Database(this.path);
    try {
      return (
        db
          .prepare(
            "UPDATE devices SET revoked = 1 WHERE id = ? AND revoked = 0",
          )
          .run(id).changes > 0
      );
    } finally {
      db.close();
    }
  }
}
