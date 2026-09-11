import { useMemo, type UIEvent } from "react";
import { highlightCode } from "./highlight.js";
import "./highlight.css";

export function HighlightedEditor(props: {
  readonly value: string;
  readonly language?: string;
  readonly "aria-label"?: string;
  readonly onChange: (value: string) => void;
}) {
  const html = useMemo(
    () => highlightCode(props.value.endsWith("\n") ? props.value : `${props.value}\n`, props.language).html,
    [props.value, props.language],
  );
  function syncScroll(event: UIEvent<HTMLTextAreaElement>): void {
    const backdrop = event.currentTarget.previousElementSibling;
    if (backdrop instanceof HTMLElement) {
      backdrop.scrollTop = event.currentTarget.scrollTop;
      backdrop.scrollLeft = event.currentTarget.scrollLeft;
    }
  }
  return (
    <div className="a008-hl-editor">
      <pre className="a008-hl-backdrop" aria-hidden="true">
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
      <textarea
        aria-label={props["aria-label"]}
        spellCheck={false}
        value={props.value}
        onChange={(event) => props.onChange(event.currentTarget.value)}
        onScroll={syncScroll}
      />
    </div>
  );
}
