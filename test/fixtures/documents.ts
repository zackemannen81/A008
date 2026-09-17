import { crc32, deflateRawSync } from "node:zlib";

/**
 * Synthetic PDF and DOCX fixtures.
 *
 * Written rather than committed as binaries on purpose. A checked-in `.docx` is
 * an opaque blob that a reviewer cannot diff and a later maintainer cannot
 * adjust; these are a few dozen readable lines whose every byte is accounted
 * for, and building the archive here exercises the same container the extractor
 * reads.
 */

const encoder = new TextEncoder();

function latin1(value: string): Uint8Array {
  const out = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    out[index] = value.charCodeAt(index) & 0xff;
  }
  return out;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export interface PdfFixtureOptions {
  /** One entry per rendered line. Empty produces a page with no text layer. */
  readonly lines?: readonly string[];
  readonly pages?: number;
}

/**
 * A minimal single-font PDF with a real cross-reference table.
 *
 * The offsets are computed rather than faked because pdf.js will silently
 * rebuild a broken xref, and a fixture that only passes through the recovery
 * path proves nothing about reading an ordinary file.
 */
export function buildPdf(options: PdfFixtureOptions = {}): Uint8Array {
  const lines = options.lines ?? ["Hello from A008.", "Second line."];
  const pageCount = options.pages ?? 1;

  const escaped = lines.map((line) =>
    line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"),
  );
  const stream =
    escaped.length === 0
      ? ""
      : [
          "BT",
          "/F1 12 Tf",
          "14 TL",
          "20 260 Td",
          ...escaped.map((line, index) =>
            index === 0 ? `(${line}) Tj` : `T* (${line}) Tj`,
          ),
          "ET",
        ].join("\n");

  const pageIds: number[] = [];
  for (let index = 0; index < pageCount; index += 1) {
    pageIds.push(3 + index * 2);
  }

  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`,
  ];
  for (const id of pageIds) {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents ${id + 1} 0 R ` +
        `/Resources << /Font << /F1 ${3 + pageCount * 2} 0 R >> >> >>`,
    );
    objects.push(
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
    void id;
  }
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  const trailer =
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`;

  return latin1(body + xref + trailer);
}

export interface ZipMember {
  readonly name: string;
  readonly content: string | Uint8Array;
  /** Store the entry uncompressed, exercising the ZIP method-0 path. */
  readonly stored?: boolean;
}

export function buildZip(members: readonly ZipMember[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const member of members) {
    const name = encoder.encode(member.name);
    const content =
      typeof member.content === "string"
        ? encoder.encode(member.content)
        : member.content;
    const stored = member.stored === true;
    const payload = stored ? content : new Uint8Array(deflateRawSync(content));

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(stored ? 0 : 8, 8);
    local.writeUInt32LE(crc32(content), 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    local.set(name, 30);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(stored ? 0 : 8, 10);
    central.writeUInt32LE(crc32(content), 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    central.set(name, 46);

    locals.push(new Uint8Array(local), payload);
    centrals.push(new Uint8Array(central));
    offset += local.length + payload.length;
  }

  const directory = concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(members.length, 8);
  end.writeUInt16LE(members.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);

  return concat([...locals, directory, new Uint8Array(end)]);
}

const RELATIONSHIPS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" ' +
  'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" ' +
  'Target="{{TARGET}}"/></Relationships>';

export interface DocxFixtureOptions {
  /** Body of `w:document`, so a test can supply exactly the markup it means. */
  readonly documentXml?: string;
  /** Part name to declare and store the document under. */
  readonly partName?: string;
  readonly omitRelationships?: boolean;
}

export function wordDocument(body: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${body}</w:body></w:document>`
  );
}

export function paragraph(...runs: readonly string[]): string {
  return `<w:p>${runs.map((run) => `<w:r><w:t xml:space="preserve">${run}</w:t></w:r>`).join("")}</w:p>`;
}

export function buildDocx(options: DocxFixtureOptions = {}): Uint8Array {
  const partName = options.partName ?? "word/document.xml";
  const documentXml =
    options.documentXml ??
    wordDocument(paragraph("Hello from A008.") + paragraph("Second line."));

  const members: ZipMember[] = [
    {
      name: "[Content_Types].xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    },
  ];
  if (options.omitRelationships !== true) {
    members.push({
      name: "_rels/.rels",
      content: RELATIONSHIPS.replace("{{TARGET}}", partName),
    });
  }
  members.push({ name: partName, content: documentXml });
  return buildZip(members);
}
