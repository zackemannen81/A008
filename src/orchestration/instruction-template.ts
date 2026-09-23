import { existsSync } from "node:fs";
import { release } from "node:os";
import { dirname, join, resolve } from "node:path";
import { ChatError } from "../core/errors.js";
import { generationCapabilities } from "../core/generation-controls.js";
import type { ModelProfile } from "../core/types.js";

export type InstructionTemplateField =
  | "provider_model"
  | "model_capabilities"
  | "working_directory"
  | "is_git_repo"
  | "platform"
  | "os_version"
  | "today_date";

export type InstructionTemplateValues = Readonly<
  Record<InstructionTemplateField, string>
>;

const TEMPLATE_FIELD = /\{\{\s*([^{}]+?)\s*\}\}/gu;
const SUPPORTED_FIELDS = [
  "provider_model",
  "model_capabilities",
  "working_directory",
  "is_git_repo",
  "platform",
  "os_version",
  "today_date",
] as const;

function platformLabel(platform: NodeJS.Platform): string {
  if (platform === "win32") return "Windows";
  if (platform === "darwin") return "macOS";
  if (platform === "linux") return "Linux";
  return platform;
}

function localIsoDate(value: Date): string {
  const year = value.getFullYear().toString().padStart(4, "0");
  const month = (value.getMonth() + 1).toString().padStart(2, "0");
  const day = value.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isGitWorkingDirectory(directory: string): boolean {
  let current = resolve(directory);
  while (true) {
    if (existsSync(join(current, ".git"))) return true;
    const parent = dirname(current);
    if (parent === current) return false;
    current = parent;
  }
}

function providerModel(profile: ModelProfile): string {
  const provider = profile.executionProvider ?? profile.provider;
  return profile.id.startsWith(`${provider}/`)
    ? profile.id
    : `${provider}/${profile.id}`;
}

function modelCapabilities(profile: ModelProfile): string {
  const capabilities = generationCapabilities(profile.id);
  const reasoning =
    capabilities.reasoningEfforts.length === 0
      ? "not exposed"
      : capabilities.reasoningEfforts.join(", ");
  return [
    `Input modalities: ${profile.inputModalities.join(", ")}`,
    `max output tokens: ${capabilities.maxTokens}`,
    `reasoning efforts: ${reasoning}`,
    `thinking control: ${capabilities.thinking ? "available" : "not exposed"}`,
  ].join("; ");
}

export function createInstructionTemplateValues(input: {
  readonly profile: ModelProfile;
  readonly workingDirectory: string;
  readonly now?: Date;
  readonly platform?: NodeJS.Platform;
  readonly osVersion?: string;
}): InstructionTemplateValues {
  const platform = input.platform ?? process.platform;
  return {
    provider_model: providerModel(input.profile),
    model_capabilities: modelCapabilities(input.profile),
    working_directory: resolve(input.workingDirectory),
    is_git_repo: isGitWorkingDirectory(input.workingDirectory) ? "yes" : "no",
    platform: platformLabel(platform),
    os_version: input.osVersion ?? release(),
    today_date: localIsoDate(input.now ?? new Date()),
  };
}

export function renderInstructionTemplate(
  template: string,
  values: InstructionTemplateValues,
): string {
  return template.replace(TEMPLATE_FIELD, (_match, rawField: string) => {
    const field = rawField.trim();
    if (!SUPPORTED_FIELDS.includes(field as InstructionTemplateField)) {
      throw new ChatError(
        "configuration",
        `Unsupported Instructions template field "{{${field}}}". Supported fields: ${SUPPORTED_FIELDS.join(", ")}.`,
      );
    }
    return values[field as InstructionTemplateField];
  });
}
