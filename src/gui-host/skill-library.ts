import { ChatError } from "../core/errors.js";
import {
  loadUserCatalog,
  addUserSkill,
  removeUserSkill,
  saveUserCatalog,
  type UserSkill,
} from "../core/user-catalog.js";

export const SKILL_SOURCE_REPOSITORY = "anthropics/skills";
export const SKILL_SOURCE_BRANCH = "main";
const SKILL_SOURCE_API = `https://api.github.com/repos/${SKILL_SOURCE_REPOSITORY}/git/trees/${SKILL_SOURCE_BRANCH}?recursive=1`;
const SKILL_SOURCE_RAW = `https://raw.githubusercontent.com/${SKILL_SOURCE_REPOSITORY}/${SKILL_SOURCE_BRANCH}`;
const MAX_SKILLS = 128;
const MAX_SKILL_BYTES = 65_536;

export interface SkillCatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly sourcePath: string;
  readonly installed: boolean;
}

interface GitHubTreeEntry extends Record<string, unknown> {
  readonly path?: unknown;
  readonly type?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function skillIdFromPath(path: string): string | undefined {
  const matched = /^skills\/([a-z0-9][a-z0-9_-]{0,63})\/SKILL\.md$/u.exec(path);
  return matched?.[1];
}

function titleFromId(id: string): string {
  return id.replace(/[-_]+/gu, " ").replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function descriptionFromMarkdown(markdown: string): string {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/u.exec(markdown)?.[1];
  const description = frontmatter?.match(/^description:\s*["']?(.+?)["']?\s*$/mu)?.[1]?.trim();
  if (description) return description.slice(0, 240);
  const paragraph = markdown
    .replace(/^---[\s\S]*?---\s*/u, "")
    .split(/\r?\n\r?\n/u)
    .map((part) => part.replace(/^#+\s+/u, "").trim())
    .find(Boolean);
  return paragraph?.slice(0, 240) ?? "Imported skill instructions.";
}

export async function discoverSkills(fetchImpl: typeof fetch): Promise<readonly SkillCatalogEntry[]> {
  const response = await fetchImpl(SKILL_SOURCE_API, { headers: { accept: "application/vnd.github+json" } });
  if (!response.ok) throw new ChatError("configuration", "Skill catalog discovery failed.");
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.tree)) {
    throw new ChatError("configuration", "Skill catalog response is malformed.");
  }
  const paths = payload.tree
    .filter(isRecord)
    .filter((entry): entry is GitHubTreeEntry => entry.type === "blob" && typeof entry.path === "string")
    .map((entry) => entry.path as string)
    .filter((path) => skillIdFromPath(path) !== undefined)
    .sort();
  if (paths.length > MAX_SKILLS) throw new ChatError("configuration", "Skill catalog exceeds the supported size.");
  return paths.map((sourcePath) => {
    const id = skillIdFromPath(sourcePath)!;
    return { id, name: titleFromId(id), description: "Fetch to inspect and explicitly install.", sourcePath, installed: false };
  });
}

export async function importSkill(input: {
  readonly catalogPath: string;
  readonly sourcePath: string;
  readonly fetch: typeof fetch;
}): Promise<UserSkill> {
  const id = skillIdFromPath(input.sourcePath);
  if (!id) throw new ChatError("configuration", "Unsupported skill path.");
  const response = await input.fetch(`${SKILL_SOURCE_RAW}/${input.sourcePath}`);
  if (!response.ok) throw new ChatError("configuration", "Skill source could not be fetched.");
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > MAX_SKILL_BYTES) throw new ChatError("configuration", "Skill instructions exceed the supported size.");
  const instructions = await response.text();
  if (instructions.length === 0 || Buffer.byteLength(instructions, "utf8") > MAX_SKILL_BYTES) {
    throw new ChatError("configuration", "Skill instructions exceed the supported size.");
  }
  const skill: UserSkill = {
    id,
    name: titleFromId(id),
    description: descriptionFromMarkdown(instructions),
    instructions,
    sourcePath: input.sourcePath,
  };
  const catalog = loadUserCatalog(input.catalogPath);
  saveUserCatalog(input.catalogPath, addUserSkill(catalog, skill));
  return skill;
}

export function installedSkills(catalogPath: string): readonly UserSkill[] {
  return loadUserCatalog(catalogPath).skills;
}

export function removeInstalledSkill(catalogPath: string, id: string): void {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/u.test(id)) throw new ChatError("configuration", "Invalid skill id.");
  const catalog = loadUserCatalog(catalogPath);
  saveUserCatalog(catalogPath, removeUserSkill(catalog, id));
}
