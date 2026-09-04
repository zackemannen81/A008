import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import test from "node:test";
import { promisify } from "node:util";
import { deflateRawSync } from "node:zlib";

import {
  APPLICATION_DOCX,
  APPLICATION_PDF,
  APPLICATION_PPTX,
  APPLICATION_XLSX,
  APPLICATION_ZIP,
  DocxExtractor,
  MAX_ZIP_ENTRY_BYTES,
  PdfExtractor,
  SourceExtractorRegistry,
  SourceIngestError,
  TEXT_PLAIN,
  Utf8TextExtractor,
  decodeXmlText,
  extractWordText,
  findOfficeDocumentPart,
  findZipEntry,
  readZipDirectory,
  readZipEntry,
  scanXml,
  sniffSourceMediaType,
} from "../src/ingest/index.js";
import type { SourceExtractionInput, ZipEntry } from "../src/ingest/index.js";
import {
  buildDocx,
  buildPdf,
  buildZip,
  paragraph,
  wordDocument,
} from "./fixtures/documents.js";

const run = promisify(execFile);

function input(
  bytes: Uint8Array,
  mediaType: string,
  overrides: Partial<SourceExtractionInput> = {},
): SourceExtractionInput {
  return {
    bytes,
    mediaType,
    locator: "source:abc123/report",
    uploadedBy: "rickard",
    ...overrides,
  };
}

async function rejection(promise: Promise<unknown>): Promise<SourceIngestError> {
  try {
    await promise;
  } catch (error) {
    assert.ok(
      error instanceof SourceIngestError,
      `not a SourceIngestError: ${String(error)}`,
    );
    return error;
  }
  throw new Error("expected a SourceIngestError, but the call resolved");
}

function thrown(call: () => unknown): SourceIngestError {
  try {
    call();
  } catch (error) {
    assert.ok(
      error instanceof SourceIngestError,
      `not a SourceIngestError: ${String(error)}`,
    );
    return error;
  }
  throw new Error("expected a SourceIngestError, but the call returned");
}

function onlyEntry(archive: Uint8Array): ZipEntry {
  const entries = readZipDirectory(archive);
  const entry = entries[0];
  assert.ok(entry !== undefined, "archive had no entries");
  return entry;
}

// --- ZIP reader ------------------------------------------------------------

test("ZIP entries round-trip through both stored and deflated paths", () => {
  const archive = buildZip([
    { name: "stored.txt", content: "kept verbatim", stored: true },
    { name: "deflated.txt", content: "compressed ".repeat(64) },
  ]);
  const entries = readZipDirectory(archive);
  assert.deepEqual(
    entries.map((entry) => entry.name),
    ["stored.txt", "deflated.txt"],
  );
  assert.equal(entries[0]?.compressionMethod, 0);
  assert.equal(entries[1]?.compressionMethod, 8);

  const decoder = new TextDecoder();
  assert.equal(
    decoder.decode(readZipEntry(archive, entries[0] as ZipEntry)),
    "kept verbatim",
  );
  assert.equal(
    decoder.decode(readZipEntry(archive, entries[1] as ZipEntry)),
    "compressed ".repeat(64),
  );
});

test("the local header decides where entry data starts, not the central one", () => {
  // The two headers are allowed to disagree about the extra-field length, and
  // the data follows the local one. Reading the central directory's value here
  // would land four bytes into the payload and inflate garbage.
  const archive = buildZip([{ name: "a.txt", content: "payload", stored: true }]);
  const source = Buffer.from(archive.buffer, archive.byteOffset, archive.byteLength);
  const nameLength = source.readUInt16LE(26);
  const insertAt = 30 + nameLength;

  const grown = new Uint8Array(archive.length + 4);
  grown.set(archive.subarray(0, insertAt), 0);
  grown.set([0xaa, 0xbb, 0xcc, 0xdd], insertAt);
  grown.set(archive.subarray(insertAt), insertAt + 4);

  const patched = Buffer.from(grown.buffer, grown.byteOffset, grown.byteLength);
  patched.writeUInt16LE(4, 28); // local extra length; the central one still says 0
  const eocd = grown.length - 22;
  patched.writeUInt32LE(patched.readUInt32LE(eocd + 16) + 4, eocd + 16);

  const entry = onlyEntry(grown);
  assert.equal(entry.name, "a.txt");
  assert.equal(new TextDecoder().decode(readZipEntry(grown, entry)), "payload");
});

test("a truncated archive is refused rather than half-read", () => {
  const archive = buildZip([{ name: "a.txt", content: "x" }]);
  assert.match(
    thrown(() => readZipDirectory(archive.subarray(0, archive.length - 8))).message,
    /end-of-central-directory/,
  );
  assert.equal(
    thrown(() => readZipDirectory(new Uint8Array(4))).code,
    "invalid_source",
  );
});

test("ZIP64 and encrypted entries are refused by name", () => {
  const archive = buildZip([{ name: "a.txt", content: "x" }]);
  const zip64 = new Uint8Array(archive.length + 20);
  const tail = archive.length - 22;
  zip64.set(archive.subarray(0, tail), 0);
  Buffer.from(zip64.buffer, zip64.byteOffset, zip64.byteLength).writeUInt32LE(
    0x07064b50,
    tail,
  );
  zip64.set(archive.subarray(tail), tail + 20);
  assert.match(thrown(() => readZipDirectory(zip64)).message, /ZIP64/);

  const entry = onlyEntry(archive);
  assert.match(
    thrown(() => readZipEntry(archive, { ...entry, encrypted: true })).message,
    /encrypted/,
  );
});

test("an unsupported compression method names the method", () => {
  const archive = buildZip([{ name: "a.txt", content: "x" }]);
  const entry = onlyEntry(archive);
  assert.match(
    thrown(() => readZipEntry(archive, { ...entry, compressionMethod: 14 })).message,
    /compression method 14/,
  );
});

test("a stored entry larger than the ceiling is refused before it is copied", () => {
  // The deflated path is guarded by zlib. A stored entry never passes through
  // zlib at all, so it needs its own check or a large upload is copied into
  // memory whole.
  const oversized = new Uint8Array(MAX_ZIP_ENTRY_BYTES + 1);
  const archive = buildZip([{ name: "big.bin", content: oversized, stored: true }]);
  assert.match(
    thrown(() => readZipEntry(archive, onlyEntry(archive))).message,
    new RegExp(`larger than ${MAX_ZIP_ENTRY_BYTES} bytes`),
  );
});

test("a compression bomb is stopped during inflation, not after", () => {
  // The declared uncompressed size lives in a header the archive controls, so
  // it is not a bound. zlib's own ceiling is, and this proves it is the one in
  // force: 96 MiB of zeros deflates to a few hundred bytes.
  const bomb = new Uint8Array(MAX_ZIP_ENTRY_BYTES + 32 * 1024 * 1024);
  const archive = buildZip([{ name: "bomb.bin", content: bomb }]);
  assert.ok(archive.length < 200_000, `bomb fixture was not small: ${archive.length}`);
  assert.match(
    thrown(() => readZipEntry(archive, onlyEntry(archive))).message,
    /could not be decompressed/,
  );
});

// --- OOXML scanner ---------------------------------------------------------

test("an attribute containing a close bracket does not cut the tag in half", () => {
  // Legal XML: ">" needs no escaping inside an attribute value. Scanning for
  // the next ">" would end the tag early and emit the rest as document text.
  const names: string[] = [];
  const texts: string[] = [];
  scanXml('<w:t note="a > b">visible</w:t>', {
    onTag: (tag) => names.push(`${tag.closing ? "/" : ""}${tag.name}`),
    onText: (text) => texts.push(text),
  });
  assert.deepEqual(names, ["w:t", "/w:t"]);
  assert.deepEqual(texts, ["visible"]);
});

test("comments, processing instructions and CDATA are handled", () => {
  assert.equal(
    extractWordText(
      wordDocument(
        "<!-- <w:p><w:r><w:t>ignored</w:t></w:r></w:p> -->" +
          "<w:p><w:r><w:t><![CDATA[literal & raw]]></w:t></w:r></w:p>",
      ),
    ),
    "literal & raw",
  );
});

test("entities are decoded, named and numeric alike", () => {
  assert.equal(
    decodeXmlText("a &amp; b &lt;c&gt; &#65; &#x42; &nope;"),
    "a & b <c> A B &nope;",
  );
  assert.equal(
    extractWordText(wordDocument(paragraph("R&amp;D k&#xF6;r vidare"))),
    "R&D kör vidare",
  );
});

test("field codes and deleted text are dropped, not stored as content", () => {
  // w:instrText is a field instruction — a hyperlink target, a page reference —
  // that the reader never sees. w:delText is text a tracked revision removed.
  // Either one stored as document content records something the document does
  // not say.
  const xml = wordDocument(
    "<w:p><w:r><w:t>See </w:t></w:r>" +
      '<w:r><w:instrText> HYPERLINK "https://example.invalid/secret" </w:instrText></w:r>' +
      "<w:r><w:t>the site</w:t></w:r>" +
      "<w:r><w:delText> and the old wording</w:delText></w:r></w:p>",
  );
  assert.equal(extractWordText(xml), "See the site");
});

test("tabs and breaks survive, paragraphs become lines", () => {
  assert.equal(
    extractWordText(
      wordDocument(
        "<w:p><w:r><w:t>a</w:t><w:tab/><w:t>b</w:t><w:br/><w:t>c</w:t></w:r></w:p>" +
          paragraph("d"),
      ),
    ),
    "a\tb\nc\nd",
  );
});

test("the office document part is read from the relationships", () => {
  const rels =
    '<Relationships><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/' +
    'officeDocument/2006/relationships/styles" Target="word/styles.xml"/>' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/' +
    '2006/relationships/officeDocument" Target="/word/main.xml"/></Relationships>';
  assert.equal(findOfficeDocumentPart(rels), "word/main.xml");
  assert.equal(findOfficeDocumentPart("<Relationships/>"), undefined);
});

// --- media type sniffing ---------------------------------------------------

test("the OOXML formats are told apart instead of all reported as Word", () => {
  assert.equal(sniffSourceMediaType(buildDocx()), APPLICATION_DOCX);
  assert.equal(
    sniffSourceMediaType(buildZip([{ name: "xl/workbook.xml", content: "<x/>" }])),
    APPLICATION_XLSX,
  );
  assert.equal(
    sniffSourceMediaType(buildZip([{ name: "ppt/presentation.xml", content: "<x/>" }])),
    APPLICATION_PPTX,
  );
  assert.equal(
    sniffSourceMediaType(buildZip([{ name: "notes.txt", content: "hello" }])),
    APPLICATION_ZIP,
  );
});

test("a ZIP that cannot be read is a ZIP, not a document that failed", () => {
  // Sniffing answers "what is this". Refusing to read it is the extractor's
  // decision, and reporting a broken archive as a Word file would send it to an
  // extractor guaranteed to fail.
  assert.equal(
    sniffSourceMediaType(Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14])),
    APPLICATION_ZIP,
  );
});

test("a Word document named .txt is still a Word document", () => {
  const docx = buildDocx();
  assert.equal(sniffSourceMediaType(docx), APPLICATION_DOCX);
  assert.notEqual(sniffSourceMediaType(docx), TEXT_PLAIN);
});

// --- DOCX extractor --------------------------------------------------------

test("the Word extractor claims Word and nothing else", () => {
  const extractor = new DocxExtractor();
  assert.ok(extractor.supports(APPLICATION_DOCX));
  assert.equal(extractor.supports(APPLICATION_ZIP), false);
  assert.equal(extractor.supports(APPLICATION_PDF), false);
  assert.equal(extractor.supports(APPLICATION_XLSX), false);
});

test("Word text carries appears_in provenance and the uploader as speaker", async () => {
  const extracted = await new DocxExtractor().extract(
    input(buildDocx(), APPLICATION_DOCX),
  );
  assert.equal(extracted.content, "Hello from A008.\nSecond line.");
  assert.equal(extracted.relation, "appears_in");
  assert.equal(extracted.speaker, "rickard");
});

test("a document part under a non-conventional name is still found", async () => {
  const extracted = await new DocxExtractor().extract(
    input(buildDocx({ partName: "word/main2.xml" }), APPLICATION_DOCX),
  );
  assert.equal(extracted.content, "Hello from A008.\nSecond line.");
});

test("a package with no relationships falls back to the conventional part", async () => {
  const extracted = await new DocxExtractor().extract(
    input(buildDocx({ omitRelationships: true }), APPLICATION_DOCX),
  );
  assert.equal(extracted.content, "Hello from A008.\nSecond line.");
});

test("a Word package with no text is a failure, not an empty success", async () => {
  const empty = await rejection(
    new DocxExtractor().extract(
      input(buildDocx({ documentXml: wordDocument("<w:p/>") }), APPLICATION_DOCX),
    ),
  );
  assert.equal(empty.code, "invalid_source");
  assert.match(empty.message, /no extractable text/);

  const missing = await rejection(
    new DocxExtractor().extract(
      input(buildZip([{ name: "word/styles.xml", content: "<x/>" }]), APPLICATION_DOCX),
    ),
  );
  assert.equal(missing.code, "invalid_source");
  assert.match(missing.message, /word\/document\.xml/);
});

// --- PDF extractor ---------------------------------------------------------

test("a PDF is read into lines and pages", async () => {
  const extractor = new PdfExtractor();
  assert.ok(extractor.supports(APPLICATION_PDF));
  assert.equal(extractor.supports(APPLICATION_DOCX), false);

  const single = await extractor.extract(input(buildPdf(), APPLICATION_PDF));
  assert.equal(single.content, "Hello from A008.\nSecond line.");
  assert.equal(single.relation, "appears_in");
  assert.equal(single.speaker, "rickard");

  const multi = await extractor.extract(
    input(buildPdf({ lines: ["Page text."], pages: 2 }), APPLICATION_PDF),
  );
  assert.equal(multi.content, "Page text.\n\nPage text.");
});

test("the caller's bytes survive extraction", async () => {
  // pdf.js transfers the buffer it is handed and leaves the caller holding a
  // detached one. The upload path still owns these bytes, so the extractor
  // copies. Without the copy this reads back as length 0.
  const bytes = buildPdf();
  const before = bytes.length;
  await new PdfExtractor().extract(input(bytes, APPLICATION_PDF));
  assert.equal(bytes.length, before);
  assert.equal(bytes[0], 0x25);
});

test("a PDF with no text layer is reported as probably a scan", async () => {
  const error = await rejection(
    new PdfExtractor().extract(input(buildPdf({ lines: [] }), APPLICATION_PDF)),
  );
  assert.equal(error.code, "invalid_source");
  assert.match(error.message, /no extractable text layer/);
  assert.equal(error.mediaType, APPLICATION_PDF);
});

test("a corrupt PDF raises a source error, not a raw pdf.js exception", async () => {
  const error = await rejection(
    new PdfExtractor().extract(
      input(new TextEncoder().encode("%PDF-1.4\nnot really"), APPLICATION_PDF),
    ),
  );
  assert.equal(error.code, "invalid_source");
  assert.match(error.message, /PDF could not be read/);
});

test("an aborted signal stops the extractor before pdf.js is loaded", async () => {
  await assert.rejects(
    new PdfExtractor().extract(
      input(buildPdf(), APPLICATION_PDF, { signal: AbortSignal.abort() }),
    ),
    (error: unknown) => (error as { name?: string }).name === "AbortError",
  );
});

test("reading a PDF writes nothing to the process streams", async () => {
  // pdf.js narrates ordinary documents on stderr at its default verbosity, and
  // for A008-acp that stream is the host's log. Run in a child process: the
  // messages come from pdf.js's worker and never pass through this one, so an
  // in-process stub would pass whatever the setting was.
  const script = [
    "import { PdfExtractor } from './dist/src/ingest/index.js';",
    "import { buildPdf } from './dist/test/fixtures/documents.js';",
    "const good = buildPdf({ lines: ['Hi.'] });",
    // A broken startxref makes pdf.js rebuild the index, which it narrates.
    "const text = Buffer.from(good).toString('latin1')",
    "  .replace(/startxref\\n[0-9]+/, 'startxref\\n9');",
    "const broken = Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff);",
    "const out = await new PdfExtractor().extract({",
    "  bytes: broken, mediaType: 'application/pdf',",
    "  locator: 'source:a/b', uploadedBy: 'rickard' });",
    "if (out.content !== 'Hi.') { throw new Error('fixture did not recover: ' + out.content); }",
  ].join("\n");
  const { stdout, stderr } = await run(
    process.execPath,
    ["--input-type=module", "-e", script],
    { cwd: process.cwd() },
  );
  assert.equal(stdout, "");
  assert.equal(stderr, "");
});

// --- composition -----------------------------------------------------------

test("the same words in two container formats extract to the same text", async () => {
  const lines = ["Provenance is the point.", "Chunking comes later."];
  const fromPdf = await new PdfExtractor().extract(
    input(buildPdf({ lines }), APPLICATION_PDF),
  );
  const fromDocx = await new DocxExtractor().extract(
    input(
      buildDocx({
        documentXml: wordDocument(lines.map((line) => paragraph(line)).join("")),
      }),
      APPLICATION_DOCX,
    ),
  );
  assert.equal(fromPdf.content, lines.join("\n"));
  assert.equal(fromDocx.content, fromPdf.content);
});

test("a registry routes each sniffed type to its own extractor", async () => {
  const registry = new SourceExtractorRegistry([
    new Utf8TextExtractor(),
    new PdfExtractor(),
    new DocxExtractor(),
  ]);
  for (const bytes of [
    new TextEncoder().encode("plain words"),
    buildPdf({ lines: ["plain words"] }),
    buildDocx({ documentXml: wordDocument(paragraph("plain words")) }),
  ]) {
    const mediaType = sniffSourceMediaType(bytes);
    assert.ok(registry.supports(mediaType), `no extractor for ${mediaType}`);
    const extracted = await registry.extract(input(bytes, mediaType));
    assert.equal(extracted.content, "plain words");
    assert.equal(extracted.relation, "appears_in");
  }

  const spreadsheet = sniffSourceMediaType(
    buildZip([{ name: "xl/workbook.xml", content: "<x/>" }]),
  );
  assert.equal(registry.supports(spreadsheet), false);
  const refused = await rejection(
    registry.extract(input(new Uint8Array([1, 2, 3]), spreadsheet)),
  );
  assert.equal(refused.code, "unsupported_media_type");
  assert.match(refused.message, /spreadsheetml/);
});

test("the fixture builder produces a package the reader accepts", () => {
  assert.ok(deflateRawSync(Buffer.from("x")).length > 0);
  assert.ok(
    findZipEntry(readZipDirectory(buildDocx()), "word/document.xml") !== undefined,
  );
});
