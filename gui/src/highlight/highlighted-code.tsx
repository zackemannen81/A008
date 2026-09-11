import { highlightCode } from "./highlight.js";
import "./highlight.css";

export function HighlightedCode(props: {
  readonly code: string;
  readonly language?: string;
}) {
  const result = highlightCode(props.code, props.language);
  return (
    <pre className="a008-hl">
      <code
        className={`language-${result.language}`}
        dangerouslySetInnerHTML={{ __html: result.html }}
      />
    </pre>
  );
}
