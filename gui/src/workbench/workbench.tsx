import { useState, type ReactNode } from "react";

export interface WorkbenchSurface {
  readonly id: string;
  readonly label: string;
  readonly render: () => ReactNode;
}

/**
 * The right-hand workbench (ADR 0021 D1).
 *
 * One surface is mounted at a time. That is the point rather than an
 * optimisation: the previous shell stacked terminal and upload in the same
 * column as the conversation, so both consumed fixed height whether or not
 * anyone was using them, and the transcript was left with 237px of a 720px
 * viewport.
 *
 * Surfaces are rendered lazily through `render` so an unselected tab does no
 * work and holds no state it has not earned.
 */
export function Workbench(props: {
  readonly surfaces: readonly WorkbenchSurface[];
  readonly label: string;
  readonly selectedId?: string;
  readonly onSelect?: (id: string) => void;
}) {
  const first = props.surfaces[0];
  const [internalId, setInternalId] = useState(first?.id);
  const selectedId = props.selectedId ?? internalId;
  const selected =
    props.surfaces.find((surface) => surface.id === selectedId) ?? first;

  if (first === undefined) {
    return null;
  }

  return (
    <section className="a008-workbench" aria-label={props.label}>
      <div className="a008-workbench-tabs" role="tablist" aria-label={props.label}>
        {props.surfaces.map((surface) => (
          <button
            key={surface.id}
            type="button"
            role="tab"
            id={`a008-workbench-tab-${surface.id}`}
            aria-selected={surface.id === selected?.id}
            aria-controls={`a008-workbench-pane-${surface.id}`}
            className="a008-workbench-tab"
            onClick={() => {
              setInternalId(surface.id);
              props.onSelect?.(surface.id);
            }}
          >
            {surface.label}
          </button>
        ))}
      </div>
      {selected === undefined ? null : (
        <div
          className="a008-workbench-pane"
          role="tabpanel"
          id={`a008-workbench-pane-${selected.id}`}
          aria-labelledby={`a008-workbench-tab-${selected.id}`}
        >
          {selected.render()}
        </div>
      )}
    </section>
  );
}
