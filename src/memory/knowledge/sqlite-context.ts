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
  const lifecycle = new EvidenceLifecycleStore();
  const relations = new RelationIndex();

  const hydrate = (): void => {
    const snapshot = store.load();
    loadSnapshot(
      { entities, slots, state, evidence, labels, lifecycle, relations },
      snapshot,
    );
  };
  hydrate();

  let persistEnabled = false;
  const persist = (): void => {
    if (!persistEnabled) {
      return;
    }
    store.replaceNamespace(captureSnapshot(inner));
  };

  const inner: KnowledgeReadContext = {
    entities: persisting(entities, persist, ["register"]),
    slots: persisting(slots, persist, ["register", "widenToSet"]),
    state: persisting(state, persist, [
      "recordClaim",
      "recordEvent",
      "setClaimStatus",
      "applyConflict",
      "applyAtomicUpdate",
      "hydrate",
    ]),
    evidence: persisting(evidence, persist, [
      "addArtifact",
      "addUtterance",
      "addProvenance",
      "recordClaim",
      "applyAcceptance",
      "hydrate",
    ]),
    labels: persisting(labels, persist, ["attach", "hydrate"]),
    lifecycle: persisting(lifecycle, persist, [
      "attach",
      "reinforce",
      "weaken",
      "reactivate",
      "decay",
      "hydrate",
    ]),
    relations: persisting(relations, persist, ["link", "hydrate"]),
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
      persist();
      store.close();
    },
  };
}

function loadSnapshot(
  target: {
    readonly entities: EntityRegistry;
    readonly slots: SlotRegistry;
    readonly state: KnowledgeState;
    readonly evidence: EvidenceStore;
    readonly labels: KnowledgeLabelStore;
    readonly lifecycle: EvidenceLifecycleStore;
    readonly relations: RelationIndex;
  },
  snapshot: KnowledgeNamespaceSnapshot,
): void {
  target.entities.hydrate(snapshot.entities);
  target.slots.hydrate(snapshot.slots);
  target.state.hydrate(snapshot.state, snapshot.stateNextTransition);
  target.evidence.hydrate({
    artifacts: snapshot.artifacts,
    utterances: snapshot.utterances,
    claims: snapshot.claims,
    provenance: snapshot.provenance,
  });
  target.labels.hydrate(snapshot.labels);
  target.lifecycle.hydrate(
    snapshot.lifecycle,
    snapshot.lifecycleNextTransition,
  );
  target.relations.hydrate(snapshot.relations);
}

function captureSnapshot(
  context: KnowledgeReadContext,
): KnowledgeNamespaceSnapshot {
  const relations =
    context.relations instanceof RelationIndex
      ? context.relations.exportLinks()
      : [];
  return {
    entities: context.entities.list(),
    slots: context.slots.list(),
    state: context.state.snapshot(),
    stateNextTransition: context.state.transitionSequence(),
    artifacts: context.evidence.listArtifacts(),
    utterances: context.evidence.listUtterances(),
    claims: context.evidence.listClaims(),
    labels: context.labels.list(),
    provenance: context.evidence.listProvenance(),
    lifecycle: context.lifecycle.snapshot(),
    lifecycleNextTransition: context.lifecycle.transitionSequence(),
    relations,
  };
}

function persisting<T extends object>(
  target: T,
  persist: () => void,
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
        const result = (value as (...inner: unknown[]) => unknown).apply(
          source,
          args,
        );
        persist();
        return result;
      };
    },
  }) as T;
}
