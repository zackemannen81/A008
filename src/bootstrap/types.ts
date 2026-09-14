import type { RegisteredProject } from '../../packages/protocol/src/index.js';
export type { ExistingProjectRegistration, ProjectBootstrapConfig, PlannedMutation, ProjectBootstrapPlan, RegisteredProject } from '../../packages/protocol/src/index.js';
export const PROJECT_REGISTRY_VERSION = 1 as const;
export const DEFAULT_MAX_WORKERS = 4;
export const MAX_WORKERS_CEILING = 5;

export interface ProjectRegistryDocument {
  readonly version: typeof PROJECT_REGISTRY_VERSION;
  readonly currentId: string | null;
  readonly projects: readonly RegisteredProject[];
}
