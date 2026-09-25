import { useEffect, useState } from "react";
import { discoverSkills, installSkill, loadInstalledSkills, removeSkill, type InstalledSkill } from "./skills.js";

export function SkillsPanel(props: { readonly onSelect: (skill: InstalledSkill | undefined) => void; readonly selected?: InstalledSkill }) {
  const [installed, setInstalled] = useState<readonly InstalledSkill[]>([]);
  const [found, setFound] = useState<Awaited<ReturnType<typeof discoverSkills>>["skills"]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = () => loadInstalledSkills().then((next) => { setInstalled(next); window.dispatchEvent(new Event("a008-skills-changed")); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Skills unavailable."));
  useEffect(() => { void refresh(); }, []);
  const visibleInstalled = installed.filter((skill) => `${skill.name} ${skill.description}`.toLowerCase().includes(search.toLowerCase()));
  const visibleFound = found.filter((skill) => `${skill.name} ${skill.description}`.toLowerCase().includes(search.toLowerCase()));
  const discover = () => { setBusy(true); setError(""); void discoverSkills().then((catalog) => setFound(catalog.skills)).catch((reason) => setError(reason instanceof Error ? reason.message : "Discovery failed.")).finally(() => setBusy(false)); };
  const install = (sourcePath: string) => { setBusy(true); setError(""); void installSkill(sourcePath).then(() => refresh()).then(() => discoverSkills()).then((catalog) => setFound(catalog.skills)).catch((reason) => setError(reason instanceof Error ? reason.message : "Install failed.")).finally(() => setBusy(false)); };
  const remove = (skill: InstalledSkill) => { setBusy(true); void removeSkill(skill.id).then(() => { if (props.selected?.id === skill.id) props.onSelect(undefined); return refresh(); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Remove failed.")).finally(() => setBusy(false)); };
  return <section className="a008-skills" aria-label="Skills"><h3>Skill library</h3><p>Instructions are imported explicitly from a fixed public catalog. They never execute code or grant tools.</p><input aria-label="Search skills" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search installed or discovered skills" /><div className="a008-skills-actions"><button type="button" disabled={busy} onClick={discover}>{busy ? "Working…" : "Search public catalog"}</button><span>{installed.length} installed</span></div><h4>Installed</h4><ul>{visibleInstalled.map((skill) => <li key={skill.id}><strong>{skill.name}</strong><p>{skill.description}</p><button type="button" onClick={() => props.onSelect(props.selected?.id === skill.id ? undefined : skill)}>{props.selected?.id === skill.id ? "Selected" : "Select"}</button><button type="button" disabled={busy} onClick={() => remove(skill)}>Remove</button></li>)}</ul>{found.length ? <><h4>Discovery</h4><ul>{visibleFound.map((skill) => <li key={skill.id}><strong>{skill.name}</strong><p>{skill.description}</p><button type="button" disabled={busy || skill.installed} onClick={() => install(skill.sourcePath)}>{skill.installed ? "Installed" : "Install"}</button></li>)}</ul></> : null}{error ? <p className="a008-parameter-error" role="alert">{error}</p> : null}</section>;
}
