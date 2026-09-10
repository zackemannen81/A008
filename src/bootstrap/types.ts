export const PROJECT_REGISTRY_VERSION = 1 as const;
export const DEFAULT_MAX_WORKERS = 4;
export const MAX_WORKERS_CEILING = 5;

export interface ProjectBootstrapConfig {
  readonly projectName: string;
  readonly rootFolder: string;
  readonly repository: {
    readonly initialize: boolean;
    readonly name?: string;
  };
  readonly continuity: {
    readonly docsFirst: boolean;
    readonly multiAgent: {
      readonly enabled: boolean;
      readonly maxWorkers?: number;
      readonly workerCloneRoot?: string;
    };
  };
  readonly memory: {
    readonly useGlobalA008Memory: boolean;
  };
}

export type PlannedMutation =
  | { readonly kind: "mkdir"; readonly path: string }
  | { readonly kind: "write"; readonly path: string; readonly bytes: number }
  | { readonly kind: "git-init"; readonly path: string };

export interface ProjectBootstrapPlan {
  readonly projectId: string;
  readonly projectName: string;
  readonly rootFolder: string;
  readonly repositoryName: string;
  readonly mutations: readonly PlannedMutation[];
  readonly memory: {
    readonly useGlobalStore: boolean;
    readonly namespace: string;
  };
  readonly multiAgent:
    | { readonly enabled: false }
    | {
        readonly enabled: true;
        readonly maxWorkers: number;
        readonly workerCloneRoot: string;
      };
}

export interface RegisteredProject {
  readonly projectId: string;
  readonly name: string;
  readonly rootFolder: string;
  readonly createdAt: string;
  readonly repository: { readonly initialize: boolean; readonly name: string };
  readonly continuity: {
    readonly docsFirst: boolean;
    readonly multiAgent: ProjectBootstrapPlan["multiAgent"];
  };
  readonly memory: { readonly useGlobalA008Memory: boolean };
}

export interface ProjectRegistryDocument {
  readonly version: typeof PROJECT_REGISTRY_VERSION;
  readonly currentId: string | null;
  readonly projects: readonly RegisteredProject[];
}
