import { SourceIngestError } from "./errors.js";
import {
  APPLICATION_DOCX,
  APPLICATION_OCTET_STREAM,
  APPLICATION_PDF,
  IMAGE_GIF,
  IMAGE_JPEG,
  IMAGE_PNG,
  IMAGE_WEBP,
  TEXT_PLAIN,
} from "./types.js";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const GIF87 = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61];
const GIF89 = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) {
    return false;
  }
  return signature.every((byte, index) => bytes[index] === byte);
}

function matchesAt(
  bytes: Uint8Array,
  offset: number,
  signature: readonly number[],
): boolean {
  if (bytes.length < offset + signature.length) {
    return false;
  }
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * Strict UTF-8 decode.
 *
 * `fatal: true` matters: the lenient decoder silently substitutes U+FFFD, which
 * would store a document full of replacement characters as though extraction
 * had succeeded.
 */
export function decodeUtf8Strict(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw new SourceIngestError(
      "invalid_source",
      "Source bytes are not valid UTF-8 text.",
      { cause: error },
    );
  }
}

function isProbablyUtf8Text(bytes: Uint8Array): boolean {
  if (bytes.length === 0) {
    return false;
  }
  // A NUL byte inside the sniff window is the cheapest binary tell, and no
  // plain-text source legitimately contains one.
  const window = bytes.subarray(0, Math.min(bytes.length, 8192));
  if (window.includes(0x00)) {
    return false;
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(window);
    return true;
  } catch {
    // A multi-byte sequence cut by the sniff window is not proof of binary, so
    // re-check the whole input before deciding.
    if (window.length === bytes.length) {
      return false;
    }
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Resolves a media type from the bytes themselves.
 *
 * A declared filename or extension never participates. An upload named
 * `report.txt` that is really a PDF is a PDF, and treating it as text would
 * store its binary object graph as though it were prose.
 */
export function sniffSourceMediaType(bytes: Uint8Array): string {
  if (startsWith(bytes, PNG)) {
    return IMAGE_PNG;
  }
  if (startsWith(bytes, JPEG)) {
    return IMAGE_JPEG;
  }
  if (startsWith(bytes, GIF87) || startsWith(bytes, GIF89)) {
    return IMAGE_GIF;
  }
  if (startsWith(bytes, RIFF) && matchesAt(bytes, 8, WEBP)) {
    return IMAGE_WEBP;
  }
  if (startsWith(bytes, PDF)) {
    return APPLICATION_PDF;
  }
  if (startsWith(bytes, ZIP)) {
    // DOCX, XLSX and PPTX are all ZIP containers. Distinguishing them needs a
    // ZIP reader, which this module deliberately does not have; reporting the
    // family is enough for the unsupported error to name something true.
    return APPLICATION_DOCX;
  }
  if (isProbablyUtf8Text(bytes)) {
    return TEXT_PLAIN;
  }
  return APPLICATION_OCTET_STREAM;
}
