import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { SourceIngestError } from "./errors.js";
import {
  APPLICATION_PDF,
  type ExtractedSource,
  type SourceExtractionInput,
  type SourceExtractor,
} from "./types.js";

/**
 * pdf.js verbosity level for errors only.
 *
 * Left at its default, pdf.js narrates ordinary documents — a rebuilt index, an
 * unusual font — on stderr, once per occurrence. For `A008-acp` that stream is
 * the host's log, so a fifteen-page PDF buries whatever the log was for. It is
 * noise rather than corruption: the JSON-RPC channel is stdout and pdf.js does
 * not write there. Errors still surface, as the `invalid_source` this raises.
 */
const VERBOSITY_ERRORS = 0;

function resourceDirectories(): {
  cMapUrl: string;
  standardFontDataUrl: string;
} {
  const packageJson = createRequire(import.meta.url).resolve(
    "pdfjs-dist/package.json",
  );
  const root = dirname(packageJson);
  return {
    cMapUrl: pathToFileURL(join(root, "cmaps/")).href,
    standardFontDataUrl: pathToFileURL(join(root, "standard_fonts/")).href,
  };
}

/**
 * PDF text, via Mozilla's pdf.js.
 *
 * The dependency is `pdfjs-dist` rather than any of the wrappers around it: it
 * is the reference implementation, it is Apache-2.0 like A008 itself, and the
 * lockfile records exactly which version of the PDF code is present, which a
 * wrapper that vendors its own build does not.
 *
 * It is imported lazily. A static import would load 35 MB of PDF machinery into
 * every A008 process, including the CLI turn that never uploads anything.
 */
export class PdfExtractor implements SourceExtractor {
  readonly id = "pdf";

  supports(mediaType: string): boolean {
    return mediaType === APPLICATION_PDF;
  }

  async extract(input: SourceExtractionInput): Promise<ExtractedSource> {
    input.signal?.throwIfAborted();

    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

    // pdf.js transfers the buffer it is given and leaves the caller holding a
    // detached one. The caller still owns these bytes — the upload path stores
    // the original — so it gets a copy and keeps its own.
    const task = getDocument({
      data: new Uint8Array(input.bytes),
      verbosity: VERBOSITY_ERRORS,
      // No system font lookup and no font-face registration: extraction reads
      // the text layer, and neither of those affects it. Both are filesystem
      // and DOM reach this path has no business having.
      useSystemFonts: false,
      disableFontFace: true,
      ...resourceDirectories(),
      cMapPacked: true,
    });

    try {
      const document = await task.promise;
      const pages: string[] = [];
      for (let number = 1; number <= document.numPages; number += 1) {
        input.signal?.throwIfAborted();
        const page = await document.getPage(number);
        try {
          pages.push(readPageText(await page.getTextContent()));
        } finally {
          page.cleanup();
        }
      }

      const content = pages
        .join("\n\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      if (content === "") {
        // Almost always a scan: pages of images with no text layer. Reporting it
        // is the difference between "A008 cannot read this" and silently storing
        // an empty document as a successful extraction.
        throw new SourceIngestError(
          "invalid_source",
          "PDF contained no extractable text layer; it is probably a scan.",
          { mediaType: input.mediaType },
        );
      }

      return {
        content,
        speaker: input.uploadedBy,
        relation: "appears_in",
      };
    } catch (error) {
      if (error instanceof SourceIngestError) {
        throw error;
      }
      if (input.signal?.aborted === true) {
        throw error;
      }
      throw new SourceIngestError(
        "invalid_source",
        `PDF could not be read: ${error instanceof Error ? error.message : String(error)}`,
        { mediaType: input.mediaType, cause: error },
      );
    } finally {
      await task.destroy().catch(() => undefined);
    }
  }
}

interface TextItemLike {
  readonly str?: unknown;
  readonly hasEOL?: unknown;
}

/**
 * Joins pdf.js text items into lines.
 *
 * `hasEOL` is the only line information pdf.js gives without laying the page out
 * geometrically. Dropping it concatenates every line of a page into one run,
 * which destroys paragraph structure the knowledge layer later needs.
 */
function readPageText(content: { readonly items: readonly unknown[] }): string {
  const lines: string[] = [];
  let line = "";
  for (const item of content.items) {
    const candidate = item as TextItemLike;
    if (typeof candidate.str !== "string") {
      continue;
    }
    line += candidate.str;
    if (candidate.hasEOL === true) {
      lines.push(line);
      line = "";
    }
  }
  if (line !== "") {
    lines.push(line);
  }
  return lines.join("\n");
}
