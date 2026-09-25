import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Composer, displayNameFromPath, firstImageFile, imageFileFromTransfer } from "./composer.js";
import type { GuiSession } from "../session/types.js";

const session: GuiSession = {
  status: "idle",
  sessionId: undefined,
  model: "nvidia/nemotron-3.5-lightning-30b-a3b",
  thought: "",
  answer: "",
  error: undefined,
  async connect() {},
  async prompt() {},
  async cancel() {},
};

test("composer is a compact card with send action and session chips", () => {
  const html = renderToStaticMarkup(
    createElement(Composer, { session, onImage() {} }),
  );
  assert.match(html, /a008-composer-card/u);
  assert.match(html, /Ask anything, or describe a task/u);
  assert.match(html, />Send</u);
  assert.match(html, /aria-label="Add"/u);
  assert.match(html, /Choose image attachment/u);
  assert.match(html, /Attach image/u);
  assert.match(html, /Attach from path/u);
  assert.match(html, /Generate image/u);
  assert.match(html, /Selected skill/u);
  assert.match(html, /No skill/u);
  assert.match(html, /Commands/u);
  assert.match(html, /Enter to send/u);
});

test("clipboard/drop selection accepts only supported native image files", () => {
  const text = new File(["hello"], "notes.txt", { type: "text/plain" });
  const png = new File([new Uint8Array([1])], "shot.png", { type: "image/png" });
  const bmp = new File([new Uint8Array([2])], "old.bmp", { type: "image/bmp" });
  assert.equal(firstImageFile([text, png, bmp]), png);
  assert.equal(firstImageFile([text, bmp]), undefined);
});

test("clipboard image selection falls back to DataTransfer items", () => {
  const png = new File([new Uint8Array([1])], "", { type: "image/png" });
  const transfer = {
    files: [] as unknown as FileList,
    items: [{ kind: "file", type: "image/png", getAsFile: () => png }] as unknown as DataTransferItemList,
  };
  assert.equal(imageFileFromTransfer(transfer), png);
});

test("local path display name works for Windows and POSIX paths", () => {
  assert.equal(displayNameFromPath("C:\\shots\\photo.png"), "photo.png");
  assert.equal(displayNameFromPath("/tmp/photo.png"), "photo.png");
});
