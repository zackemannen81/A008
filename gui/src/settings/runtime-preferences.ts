/** Renderer-owned additive global settings contract, ADR 0027. */
export interface RuntimeBudgetField {
  key: string;
  label: string;
  unit: string;
  description: string;
  minimum: number;
  maximum: number;
}
export interface RuntimePreferences {
  instructions: string;
  budgets: Record<string, number>;
}
export interface RuntimePreferencesSnapshot {
  revision: string;
  settings: RuntimePreferences;
  defaults: RuntimePreferences;
  fields: readonly RuntimeBudgetField[];
  storagePath: string | null;
}
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
export function isRuntimePreferencesSnapshot(v: unknown): v is RuntimePreferencesSnapshot {
  if (!record(v) || typeof v.revision !== "string" ||
      !(v.storagePath === null || typeof v.storagePath === "string") ||
      !Array.isArray(v.fields) || !v.fields.length) return false;
  const keys = new Set<string>();
  for (const f of v.fields) {
    if (!record(f) || typeof f.key !== "string" || keys.has(f.key) ||
        ![f.label, f.unit, f.description].every(s => typeof s === "string") ||
        typeof f.minimum !== "number" || !Number.isSafeInteger(f.minimum) || f.minimum < 0 ||
        typeof f.maximum !== "number" || !Number.isSafeInteger(f.maximum) || f.maximum < f.minimum) return false;
    keys.add(f.key);
  }
  for (const p of [v.settings, v.defaults]) {
    if (!record(p) || typeof p.instructions !== "string" || !record(p.budgets) ||
        Object.keys(p.budgets).length !== keys.size) return false;
    for (const f of v.fields as unknown as RuntimeBudgetField[]) {
      const n = p.budgets[f.key];
      if (typeof n !== "number" || !Number.isSafeInteger(n) || n < f.minimum || n > f.maximum) return false;
    }
  }
  return true;
}
