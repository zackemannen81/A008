import assert from "node:assert/strict";
import test from "node:test";
import {
  APPLICATION_DOCX,
  APPLICATION_OCTET_STREAM,
  APPLICATION_PDF,
  DescribedImageExtractor,
  IMAGE_JPEG,
  IMAGE_PNG,
  IMAGE_WEBP,
  NvidiaImageDescriber,
  SourceExtractorRegistry,
  SourceIngestError,
  TEXT_PLAIN,
  Utf8TextExtractor,
  decodeUtf8Strict,
  isSourceIngestError,
  sniffSourceMediaType,
} from "../src/ingest/index.js";
import type {
  ImageDescriber,
  SourceExtractionInput,
} from "../src/ingest/index.js";

const SECRET = "nvapi-image-describer-secret-A008-0042";

function bytes(...values: number[]): Uint8Array {
  return Uint8Array.from(values);
}

function text(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function extraction(
  overrides: Partial<SourceExtractionInput> = {},
): SourceExtractionInput {
  return {
    bytes: text("A008 upload."),
    mediaType: TEXT_PLAIN,
    locator: "source:abc/report.txt",
    uploadedBy: "user",
    ...overrides,
  };
}

function fakeDescriber(
  description: string,
  model = "nvidia/fake-vision",
): ImageDescriber {
  return {
    async describe() {
      return { description, model };
    },
  };
}

test("media type comes from the bytes, never from the name", () => {
  assert.equal(
    sniffSourceMediaType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
    IMAGE_PNG,
  );
  assert.equal(sniffSourceMediaType(bytes(0xff, 0xd8, 0xff, 0xe0)), IMAGE_JPEG);
  assert.equal(sniffSourceMediaType(text("%PDF-1.7\n%stuff")), APPLICATION_PDF);
  assert.equal(sniffSourceMediaType(bytes(0x50, 0x4b, 0x03, 0x04, 0x14)), APPLICATION_DOCX);
  assert.equal(sniffSourceMediaType(text("plain prose")), TEXT_PLAIN);

  const webp = new Uint8Array(16);
  webp.set(text("RIFF"), 0);
  webp.set(text("WEBP"), 8);
  assert.equal(sniffSourceMediaType(webp), IMAGE_WEBP);
});

test("a PDF named .txt is still a PDF", () => {
  // The whole point of sniffing: the declared name is advisory and a mislabelled
  // upload must not be handed to the text extractor.
  const pdfBytes = text("%PDF-1.4\nbinary object graph");
  const mediaType = sniffSourceMediaType(pdfBytes);
  assert.equal(mediaType, APPLICATION_PDF);

  const registry = new SourceExtractorRegistry([new Utf8TextExtractor()]);
  assert.equal(registry.supports(mediaType), false);
});

test("binary that is not a known signature is not mistaken for text", () => {
  assert.equal(sniffSourceMediaType(bytes(0x00, 0x01, 0x02, 0x03)), APPLICATION_OCTET_STREAM);
  assert.equal(sniffSourceMediaType(bytes(0xc3, 0x28, 0xa0, 0xa1)), APPLICATION_OCTET_STREAM);
});

test("multi-byte UTF-8 survives sniffing", () => {
  assert.equal(sniffSourceMediaType(text("Fakturan är på 4 500 kr — höjd.")), TEXT_PLAIN);
});

test("text extraction records appears_in and the uploading speaker", async () => {
  const extracted = await new Utf8TextExtractor().extract(
    extraction({ bytes: text("The invoice total is 4500 SEK."), uploadedBy: "user" }),
  );

  assert.equal(extracted.content, "The invoice total is 4500 SEK.");
  assert.equal(extracted.relation, "appears_in");
  assert.equal(extracted.speaker, "user");
});

test("invalid UTF-8 fails rather than becoming replacement characters", () => {
  assert.throws(
    () => decodeUtf8Strict(bytes(0xff, 0xfe, 0xfd)),
    (error: unknown) =>
      isSourceIngestError(error) && error.code === "invalid_source",
  );
});

test("image extraction records derived_from and the describing model", async () => {
  const extracted = await new DescribedImageExtractor(
    fakeDescriber("The image shows an invoice totalling 4500 SEK.", "nvidia/vision-1"),
  ).extract(extraction({ mediaType: IMAGE_PNG, bytes: bytes(0x89, 0x50) }));

  // No text appeared in the image, and the account is the model's, not the
  // uploader's. Both facts have to reach the evidence store.
  assert.equal(extracted.relation, "derived_from");
  assert.equal(extracted.speaker, "nvidia/vision-1");
  assert.equal(extracted.content, "The image shows an invoice totalling 4500 SEK.");
});

test("an unattributable or empty description is refused", async () => {
  const empty = new DescribedImageExtractor(fakeDescriber("   "));
  await assert.rejects(
    () => empty.extract(extraction({ mediaType: IMAGE_PNG })),
    (error: unknown) =>
      isSourceIngestError(error) && error.code === "description_failed",
  );

  const anonymous = new DescribedImageExtractor(fakeDescriber("something", "  "));
  await assert.rejects(
    () => anonymous.extract(extraction({ mediaType: IMAGE_PNG })),
    (error: unknown) =>
      isSourceIngestError(error) && error.code === "description_failed",
  );
});

test("PDF and DOCX raise a named unsupported error and never fall through", async () => {
  const registry = new SourceExtractorRegistry([
    new Utf8TextExtractor(),
    new DescribedImageExtractor(fakeDescriber("unused")),
  ]);

  for (const mediaType of [APPLICATION_PDF, APPLICATION_DOCX]) {
    assert.equal(registry.supports(mediaType), false);
    await assert.rejects(
      () => registry.extract(extraction({ mediaType })),
      (error: unknown) =>
        isSourceIngestError(error) &&
        error.code === "unsupported_media_type" &&
        error.mediaType === mediaType &&
        error.message.includes(mediaType),
    );
  }
});

test("the registry picks the first extractor that claims the type", async () => {
  const registry = new SourceExtractorRegistry([
    new Utf8TextExtractor(),
    new DescribedImageExtractor(fakeDescriber("described")),
  ]);

  assert.equal(registry.extractorFor(TEXT_PLAIN)?.id, "utf8-text");
  assert.equal(registry.extractorFor(IMAGE_PNG)?.id, "image-description");

  const described = await registry.extract(extraction({ mediaType: IMAGE_PNG }));
  assert.equal(described.content, "described");
});

test("the NVIDIA describer sends the credential and keeps it out of the result", async () => {
  let sentAuthorization = "";
  let sentBody = "";
  const describer = new NvidiaImageDescriber({
    apiKey: SECRET,
    model: "nvidia/vision-test",
    endpoint: "http://127.0.0.1:1/v1/chat/completions",
    async fetch(_input, init) {
      const headers = init?.headers as Record<string, string> | undefined;
      sentAuthorization = headers?.authorization ?? "";
      sentBody = String(init?.body ?? "");
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "A whiteboard with three columns." } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  const described = await describer.describe({
    bytes: bytes(0x89, 0x50, 0x4e, 0x47),
    mediaType: IMAGE_PNG,
  });

  // The credential must reach the provider...
  assert.equal(sentAuthorization, `Bearer ${SECRET}`);
  assert.match(sentBody, /image_url/u);
  assert.match(sentBody, /data:image\/png;base64,/u);
  // ...and appear nowhere in what the caller gets back.
  assert.equal(described.description, "A whiteboard with three columns.");
  assert.equal(described.model, "nvidia/vision-test");
  assert.equal(JSON.stringify(described).includes(SECRET), false);
  assert.equal(/NVIDIA_API_KEY/u.test(JSON.stringify(described)), false);
});

test("the NVIDIA describer reports a failed call without leaking the credential", async () => {
  const describer = new NvidiaImageDescriber({
    apiKey: SECRET,
    model: "nvidia/vision-test",
    endpoint: "http://127.0.0.1:1/v1/chat/completions",
    async fetch() {
      return new Response("upstream said no", { status: 502 });
    },
  });

  await assert.rejects(
    () =>
      describer.describe({ bytes: bytes(0xff, 0xd8, 0xff), mediaType: IMAGE_JPEG }),
    (error: unknown) => {
      if (!(error instanceof SourceIngestError)) {
        return false;
      }
      return (
        error.code === "description_failed" &&
        !error.message.includes(SECRET) &&
        error.message.includes("502")
      );
    },
  );
});

test("the NVIDIA describer refuses to start without a credential or model", () => {
  assert.throws(
    () => new NvidiaImageDescriber({ apiKey: "  ", model: "nvidia/vision-test" }),
  );
  assert.throws(
    () => new NvidiaImageDescriber({ apiKey: SECRET, model: "   " }),
  );
});
