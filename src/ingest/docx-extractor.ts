import { decodeUtf8Strict } from "./media-type.js";
import { SourceIngestError } from "./errors.js";
import { extractWordText, findOfficeDocumentPart } from "./ooxml.js";
import { findZipEntry, readZipDirectory, readZipEntry } from "./zip.js";
import {
  APPLICATION_DOCX,
  type ExtractedSource,
  type SourceExtractionInput,
  type SourceExtractor,
} from "./types.js";

const PACKAGE_RELATIONSHIPS = "_rels/.rels";
const CONVENTIONAL_DOCUMENT_PART = "word/document.xml";

/**
 * Word documents, read out of the OOXML package directly.
 *
 * A `.docx` is a ZIP of XML parts. Node's `zlib` already inflates the ZIP and
 * `ooxml.ts` reads the part, so this needs no dependency at all — the nearest
 * library brings ten transitive packages to do the same job.
 *
 * The relation is `appears_in` and the speaker is the uploader, for the same
 * reason as plain text: these are the characters that are in the file. No model
 * interpreted anything on this path.
 */
export class DocxExtractor implements SourceExtractor {
  readonly id = "docx";

  supports(mediaType: string): boolean {
    return mediaType === APPLICATION_DOCX;
  }

  async extract(input: SourceExtractionInput): Promise<ExtractedSource> {
    const entries = readZipDirectory(input.bytes);

    const relationships = findZipEntry(entries, PACKAGE_RELATIONSHIPS);
    let partName = CONVENTIONAL_DOCUMENT_PART;
    if (relationships !== undefined) {
      const declared = findOfficeDocumentPart(
        decodeUtf8Strict(readZipEntry(input.bytes, relationships)),
      );
      if (declared !== undefined) {
        partName = declared;
      }
    }

    const part =
      findZipEntry(entries, partName) ??
      findZipEntry(entries, CONVENTIONAL_DOCUMENT_PART);
    if (part === undefined) {
      throw new SourceIngestError(
        "invalid_source",
        `Word package has no ${partName} part.`,
        { mediaType: input.mediaType },
      );
    }

    const content = extractWordText(
      decodeUtf8Strict(readZipEntry(input.bytes, part)),
    );
    if (content === "") {
      // An empty result is a failure to read, not a document that says nothing.
      // Storing it would record a successful extraction of no knowledge.
      throw new SourceIngestError(
        "invalid_source",
        "Word document contained no extractable text.",
        { mediaType: input.mediaType },
      );
    }

    return {
      content,
      speaker: input.uploadedBy,
      relation: "appears_in",
    };
  }
}
