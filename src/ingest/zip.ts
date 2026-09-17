import { inflateRawSync } from "node:zlib";

import { SourceIngestError } from "./errors.js";

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP64_END_LOCATOR = 0x07064b50;
const CENTRAL_FILE_HEADER = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;

const EOCD_FIXED_SIZE = 22;
const CENTRAL_HEADER_FIXED_SIZE = 46;
const LOCAL_HEADER_FIXED_SIZE = 30;
const MAX_COMMENT_LENGTH = 0xffff;

const STORED = 0;
const DEFLATED = 8;

const ENCRYPTED_FLAG = 0x0001;

/**
 * Ceiling on one decompressed entry.
 *
 * A ZIP declares its uncompressed size in a header the archive itself controls,
 * so the declared size is not a bound. `maxOutputLength` is enforced by zlib
 * during inflation, which is the only place a compression bomb can be stopped
 * before it has already been allocated.
 */
export const MAX_ZIP_ENTRY_BYTES = 64 * 1024 * 1024;

export interface ZipEntry {
  readonly name: string;
  readonly compressionMethod: number;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly localHeaderOffset: number;
  readonly encrypted: boolean;
}

function invalid(message: string, cause?: unknown): SourceIngestError {
  return new SourceIngestError(
    "invalid_source",
    message,
    cause === undefined ? {} : { cause },
  );
}

function asBuffer(bytes: Uint8Array): Buffer {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  // The record is last, but a trailing comment of up to 65535 bytes may follow
  // it, so the signature has to be searched for backwards rather than read at a
  // fixed offset.
  const earliest = Math.max(
    0,
    buffer.length - EOCD_FIXED_SIZE - MAX_COMMENT_LENGTH,
  );
  for (
    let offset = buffer.length - EOCD_FIXED_SIZE;
    offset >= earliest;
    offset -= 1
  ) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) {
      return offset;
    }
  }
  return -1;
}

/**
 * Reads a ZIP central directory.
 *
 * This is deliberately a reader and not an archive library: it lists entries and
 * decompresses one by one. DOCX is a ZIP of XML parts, and the alternative was a
 * dependency tree an order of magnitude larger than the code it would replace.
 *
 * Unsupported shapes are refused by name rather than guessed at. ZIP64 and
 * encrypted entries raise `invalid_source`, because misreading either produces
 * plausible-looking bytes rather than an obvious failure.
 */
export function readZipDirectory(bytes: Uint8Array): readonly ZipEntry[] {
  const buffer = asBuffer(bytes);
  if (buffer.length < EOCD_FIXED_SIZE) {
    throw invalid("Source is too short to be a ZIP archive.");
  }

  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd < 0) {
    throw invalid("ZIP end-of-central-directory record was not found.");
  }

  if (eocd >= 20 && buffer.readUInt32LE(eocd - 20) === ZIP64_END_LOCATOR) {
    throw invalid("ZIP64 archives are not supported.");
  }

  const entryCount = buffer.readUInt16LE(eocd + 10);
  const directoryOffset = buffer.readUInt32LE(eocd + 16);
  if (entryCount === 0xffff || directoryOffset === 0xffffffff) {
    throw invalid("ZIP64 archives are not supported.");
  }

  const entries: ZipEntry[] = [];
  let offset = directoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + CENTRAL_HEADER_FIXED_SIZE > buffer.length) {
      throw invalid("ZIP central directory is truncated.");
    }
    if (buffer.readUInt32LE(offset) !== CENTRAL_FILE_HEADER) {
      throw invalid("ZIP central directory header signature is wrong.");
    }

    const flags = buffer.readUInt16LE(offset + 8);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nameStart = offset + CENTRAL_HEADER_FIXED_SIZE;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > buffer.length) {
      throw invalid("ZIP central directory is truncated.");
    }

    entries.push({
      name: buffer.toString("utf8", nameStart, nameEnd),
      compressionMethod: buffer.readUInt16LE(offset + 10),
      compressedSize: buffer.readUInt32LE(offset + 20),
      uncompressedSize: buffer.readUInt32LE(offset + 24),
      localHeaderOffset: buffer.readUInt32LE(offset + 42),
      encrypted: (flags & ENCRYPTED_FLAG) !== 0,
    });

    offset = nameEnd + extraLength + commentLength;
  }

  return entries;
}

export function findZipEntry(
  entries: readonly ZipEntry[],
  name: string,
): ZipEntry | undefined {
  return entries.find((entry) => entry.name === name);
}

/**
 * Decompresses one entry.
 *
 * The central directory's `compressedSize` is used, but the name and extra-field
 * lengths are re-read from the local header: the two headers are allowed to
 * disagree about those, and the local one is what the data actually follows.
 */
export function readZipEntry(bytes: Uint8Array, entry: ZipEntry): Uint8Array {
  if (entry.encrypted) {
    throw invalid(`ZIP entry ${entry.name} is encrypted.`);
  }

  const buffer = asBuffer(bytes);
  const header = entry.localHeaderOffset;
  if (header + LOCAL_HEADER_FIXED_SIZE > buffer.length) {
    throw invalid(
      `ZIP entry ${entry.name} points past the end of the archive.`,
    );
  }
  if (buffer.readUInt32LE(header) !== LOCAL_FILE_HEADER) {
    throw invalid(
      `ZIP entry ${entry.name} has a wrong local header signature.`,
    );
  }

  const nameLength = buffer.readUInt16LE(header + 26);
  const extraLength = buffer.readUInt16LE(header + 28);
  const start = header + LOCAL_HEADER_FIXED_SIZE + nameLength + extraLength;
  const end = start + entry.compressedSize;
  if (end > buffer.length) {
    throw invalid(`ZIP entry ${entry.name} is truncated.`);
  }

  const raw = buffer.subarray(start, end);
  if (entry.compressionMethod === STORED) {
    if (raw.length > MAX_ZIP_ENTRY_BYTES) {
      throw invalid(
        `ZIP entry ${entry.name} is larger than ${MAX_ZIP_ENTRY_BYTES} bytes.`,
      );
    }
    return new Uint8Array(raw);
  }
  if (entry.compressionMethod !== DEFLATED) {
    throw invalid(
      `ZIP entry ${entry.name} uses unsupported compression method ${entry.compressionMethod}.`,
    );
  }

  try {
    return new Uint8Array(
      inflateRawSync(raw, { maxOutputLength: MAX_ZIP_ENTRY_BYTES }),
    );
  } catch (error) {
    throw invalid(`ZIP entry ${entry.name} could not be decompressed.`, error);
  }
}
