/**
 * Just enough OOXML to read a Word document's visible text.
 *
 * Not an XML parser and not trying to be one. It walks the markup once,
 * recognising the handful of WordprocessingML elements that carry or break
 * text, and ignores everything else. Styling, numbering, images and revision
 * metadata are all out of scope: the consumer is a knowledge store that keeps
 * words, not a renderer.
 */

const NAMED_ENTITIES = new Map<string, string>([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
]);

export function decodeXmlText(value: string): string {
  return value.replace(
    /&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g,
    (match, body: string) => {
      if (body.startsWith("#x") || body.startsWith("#X")) {
        const code = Number.parseInt(body.slice(2), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      if (body.startsWith("#")) {
        const code = Number.parseInt(body.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return NAMED_ENTITIES.get(body) ?? match;
    },
  );
}

export interface XmlTag {
  readonly name: string;
  readonly closing: boolean;
  readonly selfClosing: boolean;
  /** Raw attribute text, unparsed. */
  readonly attributes: string;
}

export interface XmlVisitor {
  onTag?(tag: XmlTag): void;
  onText?(text: string): void;
}

/**
 * Finds the `>` that closes a tag, stepping over quoted attribute values.
 *
 * An unquoted `>` inside an attribute value is legal XML, so scanning for the
 * next `>` would cut a tag in half on exactly the documents that are hardest to
 * notice being wrong.
 */
function findTagEnd(xml: string, start: number): number {
  let quote = "";
  for (let index = start; index < xml.length; index += 1) {
    const character = xml[index] as string;
    if (quote !== "") {
      if (character === quote) {
        quote = "";
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === ">") {
      return index;
    }
  }
  return -1;
}

export function scanXml(xml: string, visitor: XmlVisitor): void {
  let index = 0;
  while (index < xml.length) {
    const next = xml.indexOf("<", index);
    if (next < 0) {
      visitor.onText?.(xml.slice(index));
      return;
    }
    if (next > index) {
      visitor.onText?.(xml.slice(index, next));
    }

    if (xml.startsWith("<!--", next)) {
      const end = xml.indexOf("-->", next + 4);
      index = end < 0 ? xml.length : end + 3;
      continue;
    }
    if (xml.startsWith("<![CDATA[", next)) {
      const end = xml.indexOf("]]>", next + 9);
      const stop = end < 0 ? xml.length : end;
      visitor.onText?.(xml.slice(next + 9, stop));
      index = end < 0 ? xml.length : end + 3;
      continue;
    }
    if (xml.startsWith("<?", next)) {
      const end = xml.indexOf("?>", next + 2);
      index = end < 0 ? xml.length : end + 2;
      continue;
    }

    const end = findTagEnd(xml, next + 1);
    if (end < 0) {
      return;
    }
    const body = xml.slice(next + 1, end);
    if (body.startsWith("!")) {
      index = end + 1;
      continue;
    }

    const closing = body.startsWith("/");
    const withoutSlash = closing ? body.slice(1) : body;
    const selfClosing = withoutSlash.endsWith("/");
    const inner = selfClosing ? withoutSlash.slice(0, -1) : withoutSlash;
    const nameEnd = inner.search(/[\s/]/);
    const name = nameEnd < 0 ? inner : inner.slice(0, nameEnd);

    visitor.onTag?.({
      name,
      closing,
      selfClosing,
      attributes: nameEnd < 0 ? "" : inner.slice(nameEnd),
    });
    index = end + 1;
  }
}

function attributeValue(attributes: string, name: string): string | undefined {
  const pattern = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)')`);
  const match = pattern.exec(attributes);
  if (match === null) {
    return undefined;
  }
  return decodeXmlText(match[2] ?? match[3] ?? "");
}

const OFFICE_DOCUMENT_RELATIONSHIP =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument";

/**
 * Resolves the main document part from the package relationships.
 *
 * `word/document.xml` is the conventional name, not a required one. Reading the
 * relationship is a few lines here and avoids failing on a producer that names
 * the part differently.
 */
export function findOfficeDocumentPart(relsXml: string): string | undefined {
  let target: string | undefined;
  scanXml(relsXml, {
    onTag(tag) {
      if (target !== undefined || tag.closing || tag.name !== "Relationship") {
        return;
      }
      if (
        attributeValue(tag.attributes, "Type") !== OFFICE_DOCUMENT_RELATIONSHIP
      ) {
        return;
      }
      const value = attributeValue(tag.attributes, "Target");
      if (value === undefined || value === "") {
        return;
      }
      target = value.replace(/^\/+/, "");
    },
  });
  return target;
}

/**
 * Visible text of a WordprocessingML part, paragraph per line.
 *
 * Only text inside a `w:t` is captured, and that single rule is what keeps the
 * two dangerous neighbours out. `w:instrText` holds field instruction codes —
 * a hyperlink's target, a page reference — that the reader never sees, and
 * `w:delText` holds text a tracked revision has already removed. Both are
 * siblings of `w:t` inside a run, never children of one, so neither is ever
 * captured. An earlier draft carried an explicit suppression counter for them;
 * mutating it away changed nothing, which is how it was found to be decoration
 * on top of the rule that was already doing the work.
 *
 * Table structure is not reconstructed. Each cell's paragraphs become their own
 * lines, which is honest about the fact that this is a text extractor.
 */
export function extractWordText(xml: string): string {
  const pieces: string[] = [];
  let capturing = false;

  scanXml(xml, {
    onTag(tag) {
      switch (tag.name) {
        case "w:t":
          if (tag.selfClosing) {
            return;
          }
          capturing = !tag.closing;
          return;
        case "w:tab":
          if (!tag.closing) {
            pieces.push("\t");
          }
          return;
        case "w:br":
        case "w:cr":
          if (!tag.closing) {
            pieces.push("\n");
          }
          return;
        case "w:p":
          if (tag.closing || tag.selfClosing) {
            pieces.push("\n");
          }
          return;
        default:
          return;
      }
    },
    onText(text) {
      if (capturing) {
        pieces.push(decodeXmlText(text));
      }
    },
  });

  return pieces
    .join("")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
