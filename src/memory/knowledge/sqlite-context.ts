import { captureSnapshot, loadSnapshot } from "./knowledge-transaction.js";
import type { Database as BetterSqliteDatabase } from "better-sqlite3";
import type { ProjectId } from "../../identity/types.js";
import { EvidenceStore } from "./evidence.js";
import { RelationIndex } from "./expand.js";
import { KnowledgeLabelStore } from "./labels.js";
import { EvidenceLifecycleStore } from "./lifecycle.js";
import { EntityRegistry, SlotRegistry } from "./registry.js";
import type { KnowledgeReadContext } from "./read-types.js";
import { KnowledgeState } from "./state.js";
import {
  SqliteKnowledgeStore,
  type KnowledgeNamespaceSnapshot,
} from "./sqlite-store.js";

export interface SqliteKnowledgeContextOptions {
  readonly filename: string;
  readonly projectId: ProjectId;
  readonly database?: BetterSqliteDatabase;
  readonly migrateV0?: boolean;
  readonly clock?: () => string;
}

export interface SqliteKnowledgeContextHandle {
  readonly context: KnowledgeReadContext;
  readonly store: SqliteKnowledgeStore;
  persist(): void;
  reload(): void;
  close(): void;
}

const DEFAULT_PROJECT_ID =
  "A008_v1_project_40000000-0000-4000-8000-000000000028" as ProjectId;

export function sqliteKnowledgeTestProjectId(): ProjectId {
  return DEFAULT_PROJECT_ID;
}

export function createSqliteKnowledgeContext(
  options: SqliteKnowledgeContextOptions,
): SqliteKnowledgeContextHandle {
  const store = new SqliteKnowledgeStore({
    ...(options.clock === undefined ? {} : { clock: options.clock }),
    filename: options.filename,
    projectId: options.projectId,
    ...(options.database === undefined ? {} : { database: options.database }),
  });
  if (options.migrateV0 !== false) {
    store.migrateV0SupersedeChains();
  }

  const entities = new EntityRegistry();
  const slots = new SlotRegistry();
  const state = new KnowledgeState();
  const evidence = new EvidenceStore();
  const labels = new KnowledgeLabelStore();
  const lifecycle = new EvidenceLifecycleStore(options.clock);
  const relations = new RelationIndex();

  let loadedRevision = "";
  const hydrate = (): void => {
    const snapshot = store.load();
    loadSnapshot(
      { entities, slots, state, evidence, labels, lifecycle, relations },
      snapshot,
    );
    loadedRevision = store.revision();
  };
  try { hydrate(); } catch (error) { store.close(); throw error; }

  let persistEnabled = false;
  const persist = (): void => {
    if (!persistEnabled) {
      return;
    }
    store.atomic(() => {
      if (loadedRevision !== store.revision()) throw new Error("Knowledge changed before explicit persist; reload before retrying");
      store.replaceNamespace(captureSnapshot(inner));
      loadedRevision = store.revision();
    });
  };

  const atomic = <T>(operation: () => T): T => {
    if (!persistEnabled) return operation();
    return store.atomic(() => {
      persistEnabled = false;
      try {
        if (loadedRevision !== store.revision()) hydrate();
        const result = operation();
        store.replaceNamespace(captureSnapshot(inner));
        loadedRevision = store.revision();
        return result;
      } catch (error) {
        // Reload after SQLite has rolled back (the outer catch below).
        throw error;
      } finally { persistEnabled = true; }
    });
  };
  const safeAtomic = <T>(operation: () => T): T => {
    if (!persistEnabled) return operation();
    try { return atomic(operation); } catch (error) { hydrate(); throw error; }
  };
  const inner: KnowledgeReadContext = {
    atomic: safeAtomic,
    entities: persisting(entities, safeAtomic, ["register"]),
    slots: persisting(slots, safeAtomic, ["register", "widenToSet"]),
    state: persisting(state, safeAtomic, [
      "recordClaim",
      "recordEvent",
      "setClaimStatus",
      "applyConflict",
      "applyAtomicUpdate",
      "hydrate",
    ]),
    evidence: persisting(evidence, safeAtomic, [
      "addArtifact",
      "addUtterance",
      "addProvenance",
      "recordClaim",
      "applyAcceptance",
      "hydrate",
    ]),
    labels: persisting(labels, safeAtomic, ["attach", "hydrate"]),
    lifecycle: persisting(lifecycle, safeAtomic, [
      "attach",
      "reinforce",
      "reinforceOccurrence",
      "weaken",
      "reactivate",
      "decay",
      "hydrate",
    ]),
    relations: persisting(relations, safeAtomic, ["link", "hydrate"]),
  };
  persistEnabled = true;

  return {
    context: inner,
    store,
    persist,
    reload(): void {
      persistEnabled = false;
      hydrate();
      persistEnabled = true;
    },
    close(): void {
      store.close();
    },
  };
}

function persisting<T extends object>(
  target: T,
  atomic: <R>(operation: () => R) => R,
  mutating: readonly string[],
): T {
  const names = new Set(mutating);
  return new Proxy(target, {
    get(source, property, receiver) {
      const value = Reflect.get(source, property, receiver);
      if (typeof value !== "function" || typeof property !== "string") {
        return value;
      }
      if (!names.has(property)) {
        return value.bind(source);
      }
      return (...args: unknown[]) => {
        return atomic(() => (value as (...inner: unknown[]) => unknown).apply(
          source,
          args,
        ));
      };
    },
  }) as T;
}
