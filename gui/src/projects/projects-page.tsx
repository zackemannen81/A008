import { useEffect, useState } from "react";
import {
  createProject,
  listProjects,
  openProject,
  previewProject,
  registerExistingProject,
  type ExistingProjectRegistration,
  type ProjectBootstrapConfig,
  type ProjectBootstrapPlan,
  type RegisteredProject,
} from "./bootstrap-client.js";
import "./projects.css";

function draftConfig(): ProjectBootstrapConfig {
  return {
    projectName: "",
    rootFolder: "",
    repository: { initialize: true, name: "" },
    continuity: {
      docsFirst: true,
      multiAgent: { enabled: false, maxWorkers: 4, workerCloneRoot: "" },
    },
    memory: { useGlobalA008Memory: true },
  };
}

function existingDraft(): ExistingProjectRegistration {
  return {
    projectName: "",
    rootFolder: "",
    memory: { useGlobalA008Memory: true },
  };
}

export function ProjectsPage(props: {
  readonly onOpened: () => void;
  readonly active?: boolean;
}) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [draft, setDraft] = useState(draftConfig);
  const [existing, setExisting] = useState(existingDraft);
  const [plan, setPlan] = useState<ProjectBootstrapPlan>();
  const [recent, setRecent] = useState<readonly RegisteredProject[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const multi = draft.continuity.multiAgent.enabled;
  useEffect(() => {
    void listProjects()
      .then((result) => setRecent(result.projects))
      .catch(() => undefined);
  }, [plan, props.active]);
  const update = (next: ProjectBootstrapConfig) => {
    setDraft(next);
    setPlan(undefined);
    setError("");
  };
  return (
    <section className="a008-projects" aria-label="Projects">
      <header>
        <p>PROJECT LIFECYCLE</p>
        <h1>Projects</h1>
      </header>
      <div className="a008-project-modes" role="group" aria-label="Project action">
        <button type="button" aria-pressed={mode === "new"} onClick={() => { setMode("new"); setError(""); }}>
          New project
        </button>
        <button type="button" aria-pressed={mode === "existing"} onClick={() => { setMode("existing"); setPlan(undefined); setError(""); }}>
          Add existing
        </button>
      </div>
      <div className="a008-projects-grid">
        {mode === "new" ? (
        <form
          className="a008-project-form"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            const payload: ProjectBootstrapConfig = {
              ...draft,
              continuity: {
                docsFirst: draft.continuity.docsFirst || multi,
                multiAgent: multi
                  ? draft.continuity.multiAgent
                  : { enabled: false },
              },
            };
            void (plan
              ? createProject(payload, plan.projectId)
                  .then(() => {
                    setPlan(undefined);
                    props.onOpened();
                  })
                  .catch((caught: unknown) =>
                    setError(caught instanceof Error ? caught.message : "Create failed."),
                  )
                  .finally(() => setBusy(false))
              : previewProject(payload)
                  .then(setPlan)
                  .catch((caught: unknown) =>
                    setError(caught instanceof Error ? caught.message : "Preview failed."),
                  )
                  .finally(() => setBusy(false)));
          }}
        >
          <h2>New project</h2>
          <label>
            Project name
            <input
              required
              value={draft.projectName}
              onChange={(event) => update({ ...draft, projectName: event.target.value })}
            />
          </label>
          <label>
            Project root folder
            <input
              required
              placeholder="C:\code\project001"
              value={draft.rootFolder}
              onChange={(event) => update({ ...draft, rootFolder: event.target.value })}
            />
          </label>
          <label className="a008-project-check">
            <input
              type="checkbox"
              checked={draft.repository.initialize}
              onChange={(event) =>
                update({
                  ...draft,
                  repository: { ...draft.repository, initialize: event.target.checked },
                })
              }
            />
            Initialize Git repository
          </label>
          {draft.repository.initialize ? (
            <label>
              Repository name
              <input
                value={draft.repository.name ?? ""}
                onChange={(event) =>
                  update({
                    ...draft,
                    repository: { ...draft.repository, name: event.target.value },
                  })
                }
              />
            </label>
          ) : null}
          <label className="a008-project-check">
            <input
              type="checkbox"
              checked={draft.continuity.docsFirst || multi}
              disabled={multi}
              onChange={(event) =>
                update({
                  ...draft,
                  continuity: { ...draft.continuity, docsFirst: event.target.checked },
                })
              }
            />
            Use Docs-First Continuity Protocol
          </label>
          <label className="a008-project-check">
            <input
              type="checkbox"
              checked={multi}
              onChange={(event) =>
                update({
                  ...draft,
                  continuity: {
                    docsFirst: event.target.checked ? true : draft.continuity.docsFirst,
                    multiAgent: { ...draft.continuity.multiAgent, enabled: event.target.checked },
                  },
                })
              }
            />
            Use Docs-First Multi-Agent Orchestrator Add-on
          </label>
          {multi ? (
            <>
              <label>
                Max worker agents
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={draft.continuity.multiAgent.maxWorkers ?? 4}
                  onChange={(event) =>
                    update({
                      ...draft,
                      continuity: {
                        ...draft.continuity,
                        multiAgent: {
                          ...draft.continuity.multiAgent,
                          maxWorkers: event.target.valueAsNumber,
                        },
                      },
                    })
                  }
                />
              </label>
              <label>
                Worker clone root folder
                <input
                  required
                  placeholder="C:\code\A008-workers\project001"
                  value={draft.continuity.multiAgent.workerCloneRoot ?? ""}
                  onChange={(event) =>
                    update({
                      ...draft,
                      continuity: {
                        ...draft.continuity,
                        multiAgent: {
                          ...draft.continuity.multiAgent,
                          workerCloneRoot: event.target.value,
                        },
                      },
                    })
                  }
                />
              </label>
            </>
          ) : null}
          <label className="a008-project-check">
            <input
              type="checkbox"
              checked={draft.memory.useGlobalA008Memory}
              onChange={(event) =>
                update({
                  ...draft,
                  memory: { useGlobalA008Memory: event.target.checked },
                })
              }
            />
            Use global A008 memory
          </label>
          {plan ? (
            <pre className="a008-project-preview" aria-label="Create project preview">
              {`Will create:\n${plan.mutations.map((item) => `${item.kind}  ${item.path}`).join("\n")}\n\nMemory:\n${plan.memory.useGlobalStore ? `A008 global store\nnamespace: ${plan.memory.namespace}` : "not attached"}`}
            </pre>
          ) : null}
          {error ? (
            <p className="a008-parameter-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="a008-project-actions">
            <button type="button" onClick={() => setPlan(undefined)} disabled={!plan}>
              Cancel
            </button>
            <button type="submit" disabled={busy}>
              {plan ? "Confirm" : "Create project"}
            </button>
          </div>
        </form>
        ) : (
        <form
          className="a008-project-form"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            void registerExistingProject(existing)
              .then(() => {
                setExisting(existingDraft());
                props.onOpened();
              })
              .catch((caught: unknown) =>
                setError(caught instanceof Error ? caught.message : "Add existing project failed."),
              )
              .finally(() => setBusy(false));
          }}
        >
          <h2>Add existing project</h2>
          <p className="a008-project-note">Register an existing folder without changing its files.</p>
          <label>
            Project name
            <input
              required
              value={existing.projectName}
              onChange={(event) => setExisting({ ...existing, projectName: event.target.value })}
            />
          </label>
          <label>
            Existing project root folder
            <input
              required
              placeholder="C:\\code\\existing-project"
              value={existing.rootFolder}
              onChange={(event) => setExisting({ ...existing, rootFolder: event.target.value })}
            />
          </label>
          <label className="a008-project-check">
            <input
              type="checkbox"
              checked={existing.memory.useGlobalA008Memory}
              onChange={(event) => setExisting({
                ...existing,
                memory: { useGlobalA008Memory: event.target.checked },
              })}
            />
            Use global A008 memory
          </label>
          <p className="a008-project-note">
            Global memory uses this registration's project namespace. Existing legacy memory is not guessed, merged or migrated.
          </p>
          {error ? <p className="a008-parameter-error" role="alert">{error}</p> : null}
          <div className="a008-project-actions">
            <button type="submit" disabled={busy}>Add project</button>
          </div>
        </form>
        )}
        <aside aria-label="Recent projects">
          <h2>Recent</h2>
          {recent.length === 0 ? <p>No registered projects yet.</p> : null}
          <ul>
            {recent.map((project) => (
              <li key={project.projectId}>
                <button
                  type="button"
                  onClick={() => {
                    setBusy(true);
                    void openProject(project.projectId)
                      .then(() => props.onOpened())
                      .catch((caught: unknown) =>
                        setError(caught instanceof Error ? caught.message : "Open failed."),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  <strong>{project.name}</strong>
                  <span>{project.rootFolder}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}
