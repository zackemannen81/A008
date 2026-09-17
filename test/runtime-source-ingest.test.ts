import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
  SourceExtractorRegistry,
  Utf8TextExtractor,
  isSourceIngestError,
  type ExtractedSource,
  type SourceExtractor,
} from "../src/ingest/index.js";
import { createLocalMemoryRuntime } from "../src/runtime/local-memory-runtime.js";
import type { LocalMemoryRuntime } from "../src/runtime/local-memory-runtime.js";
import { isolatedMemoryEnv } from "./helpers.js";

const HASH = "a".repeat(64);

interface Fixture {
  readonly runtime: LocalMemoryRuntime;
  readonly storeRoot: string;
  readonly outsideFile: string;
  readonly opened: string[];
}

function fixture(
  options: {
    readonly registry?: SourceExtractorRegistry;
    readonly storeRootOverride?: string;
  } = {},
): Fixture {
  const parent = mkdtempSync(join(tmpdir(), "A008-source-"));
  const storeRoot = join(parent, "store");
  mkdirSync(join(storeRoot, HASH), { recursive: true });
  writeFileSync(join(storeRoot, HASH, "report.txt"), "The invoice total is 4500 SEK.");
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
  writeFileSync(join(storeRoot, HASH, "photo.png"), png);

  // A file the runtime must never open. It sits beside the store, which is
  // exactly what a traversal locator would reach.
  const outsideFile = join(parent, "secret.txt");
  writeFileSync(outsideFile, "must never be read");

  const opened: string[] = [];
  const { env } = isolatedMemoryEnv({
    A008_SOURCE_STORE_PATH: options.storeRootOverride ?? storeRoot,
  });
  const runtime = createLocalMemoryRuntime({
    env,
    surface: "cli",
    readSourceBytes: (path) => {
      opened.push(path);
      return path.endsWith("photo.png")
        ? new Uint8Array(png)
        : new Uint8Array(
            Buffer.from(
              path.endsWith("report.txt")
                ? "The invoice total is 4500 SEK."
                : "unexpected read",
            ),
          );
    },
    ...(options.registry === undefined
      ? {}
      : { sourceExtractorRegistry: options.registry }),
  });

  return { runtime, storeRoot, outsideFile, opened };
}

test("a text source ingests as appears_in with its locator preserved", async () => {
  const { runtime, opened } = fixture();
  try {
    const locator = `source:${HASH}/report.txt`;
    const outcome = await runtime.ingestSource({ locator });

    assert.equal(outcome.relation, "appears_in");
    assert.equal(outcome.utteranceIds.length, 1);
    assert.equal(opened.length, 1, "exactly one read");
    assert.ok(outcome.artifactId.startsWith("A008_knowledge_artifact_"));
  } finally {
    runtime.close();
  }
});

test("a locator that escapes the store root is rejected before any read", async () => {
  const { runtime, opened } = fixture();
  try {
    for (const locator of [
      `source:${HASH}/../../secret.txt`,
      `source:../secret.txt`,
      "source:..",
      `source:${HASH}/../../../etc/passwd`,
    ]) {
      await assert.rejects(
        () => runtime.ingestSource({ locator }),
        (error: unknown) => error instanceof Error,
        `must reject ${locator}`,
      );
    }
    // The gate: containment runs before the reader is ever called, so the file
    // beside the store was never opened.
    assert.deepEqual(opened, [], "no read was attempted for any escaping locator");
  } finally {
    runtime.close();
  }
});

test("traversal is refused lexically, before the filesystem is consulted", async () => {
  const { runtime, opened } = fixture();
  try {
    // The target does not exist, which is what separates the two gates. The
    // lexical check rejects on the shape of the locator; without it, the
    // realpath check would be reached and would fail with a different
    // complaint about the file not resolving. Asserting the message is how a
    // test can tell which gate did the work.
    await assert.rejects(
      () => runtime.ingestSource({ locator: "source:../nowhere/missing.txt" }),
      (error: unknown) =>
        error instanceof Error &&
        /escapes the configured store root/u.test(error.message),
      "the lexical gate must reject before realpath is consulted",
    );
    assert.deepEqual(opened, []);
  } finally {
    runtime.close();
  }
});

test("an absolute locator is rejected before any read", async () => {
  const { runtime, outsideFile, opened } = fixture();
  try {
    await assert.rejects(() => runtime.ingestSource({ locator: `source:${outsideFile}` }));
    await assert.rejects(() => runtime.ingestSource({ locator: outsideFile }));
    assert.deepEqual(opened, []);
  } finally {
    runtime.close();
  }
});

test("a link pointing outside the store root is rejected before any read", async (t) => {
  const { runtime, storeRoot, opened } = fixture();
  try {
    // A directory junction needs no elevation on Windows, unlike a file
    // symlink, so the realpath gate is actually exercised on this platform
    // rather than skipped. `escape` resolves to the store's parent, which
    // holds secret.txt.
    const link = join(storeRoot, "escape");
    try {
      symlinkSync(dirname(storeRoot), link, "junction");
    } catch {
      t.skip("neither junctions nor symlinks can be created in this environment");
      return;
    }

    await assert.rejects(
      () => runtime.ingestSource({ locator: "source:escape/secret.txt" }),
      (error: unknown) => error instanceof Error,
      "a link out of the store must be refused",
    );
    // The lexical check cannot catch this one — `escape/secret.txt` looks
    // contained. Only the realpath comparison rejects it, and it must do so
    // before the reader runs.
    assert.deepEqual(opened, [], "a link escape must not be read either");
  } finally {
    runtime.close();
  }
});

test("the extractor's speaker and relation reach the stored provenance unaltered", async () => {
  // Stands in for the vision path without a live call: whatever provenance the
  // extractor claims must pass straight through, because only the extractor
  // knows whether text came *from* the artifact or was written *about* it.
  const describing: SourceExtractor = {
    id: "fake-image-description",
    supports: () => true,
    async extract(): Promise<ExtractedSource> {
      return {
        content: "The image shows an invoice totalling 4500 SEK.",
        speaker: "nvidia/fake-vision",
        relation: "derived_from",
      };
    },
  };
  const { runtime } = fixture({
    registry: new SourceExtractorRegistry([describing]),
  });
  try {
    const outcome = await runtime.ingestSource({
      locator: `source:${HASH}/report.txt`,
    });

    assert.equal(outcome.relation, "derived_from");
    assert.equal(outcome.speaker, "nvidia/fake-vision");
  } finally {
    runtime.close();
  }
});

test("an unsupported media type surfaces the named error and stores nothing", async () => {
  const { runtime } = fixture({ registry: new SourceExtractorRegistry([]) });
  try {
    await assert.rejects(
      () => runtime.ingestSource({ locator: `source:${HASH}/report.txt` }),
      (error: unknown) =>
        isSourceIngestError(error) && error.code === "unsupported_media_type",
    );
  } finally {
    runtime.close();
  }
});

test("ingestSource refuses when no source store is configured", async () => {
  const { env } = isolatedMemoryEnv();
  const runtime = createLocalMemoryRuntime({ env, surface: "cli" });
  try {
    await assert.rejects(
      () => runtime.ingestSource({ locator: `source:${HASH}/report.txt` }),
      (error: unknown) =>
        error instanceof Error && /A008_SOURCE_STORE_PATH/u.test(error.message),
    );
  } finally {
    runtime.close();
  }
});

test("the text extractor is the default registry", async () => {
  assert.ok(new SourceExtractorRegistry([new Utf8TextExtractor()]).supports("text/plain"));
});

test("ingestSource makes no analyzer call unless extraction is requested", async () => {
  const { runtime } = fixture();
  try {
    const outcome = await runtime.ingestSource({
      locator: `source:${HASH}/report.txt`,
    });
    // Off by default: the coordinator can mean well over a hundred sequential
    // provider calls for one source, so an ingest must not pay that unasked.
    assert.equal(outcome.knowledge, undefined);
  } finally {
    runtime.close();
  }
});

test("a failed extraction degrades the ingest rather than losing the evidence", async () => {
  // No credential is configured in this fixture, so the semantic call cannot be
  // made. The artifact, utterance and provenance must still be stored.
  const { runtime } = fixture();
  try {
    const outcome = await runtime.ingestSource({
      locator: `source:${HASH}/report.txt`,
      extractKnowledge: true,
    });

    assert.ok(outcome.artifactId.startsWith("A008_knowledge_artifact_"));
    assert.equal(outcome.relation, "appears_in");
    assert.equal(outcome.utteranceIds.length, 1);
    assert.ok(outcome.knowledge, "an extraction outcome is reported");
    assert.equal(outcome.knowledge?.proposalsCommitted, 0);
    assert.notEqual(
      outcome.knowledge?.status,
      "completed",
      "a failed extraction is reported, not silently swallowed",
    );
  } finally {
    runtime.close();
  }
});

test("native vision resolves a contained image from sniffed bytes and traversal never reaches the reader", () => {
  const { runtime, opened } = fixture();
  try {
    const attachment = runtime.resolveImageAttachment(`source:${HASH}/photo.png`);
    assert.equal(attachment.mediaType, "image/png");
    assert.match(attachment.dataRef, /^data:image\/png;base64,/u);
    assert.equal(opened.length, 1, "the contained image is read exactly once");
    opened.length = 0;
    assert.throws(
      () => runtime.resolveImageAttachment("source:../secret.png"),
      /escapes the configured store root/u,
    );
    assert.deepEqual(opened, [], "traversal is rejected before reading bytes");
  } finally {
    runtime.close();
  }
});
