import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createStars, rotate4, STARFIELD_COUNT, startStarfield } from "./starfield-engine.js";
import { EmptyStarfield } from "./starfield.js";

test("4D rotation of a unit axis is a right angle in that plane", () => {
  const point: [number, number, number, number] = [1, 0, 0, 0];
  rotate4(point, 0, 1, Math.PI / 2);
  assert.ok(Math.abs(point[0]) < 1e-10);
  assert.ok(Math.abs(point[1] - 1) < 1e-10);
  assert.equal(point[2], 0);
  assert.equal(point[3], 0);
});

test("createStars fills 4D positions and a blue-range hue", () => {
  const stars = createStars(8, () => 0.25);
  assert.equal(stars.length, 8);
  assert.equal(createStars(STARFIELD_COUNT).length, STARFIELD_COUNT);
  for (const star of stars) {
    assert.equal(star.p.length, 4);
    assert.ok(star.hue >= 200 && star.hue <= 280);
  }
});

test("starfield markup is decorative canvas", () => {
  const html = renderToStaticMarkup(createElement(EmptyStarfield));
  assert.match(html, /a008-starfield/u);
  assert.match(html, /<canvas/u);
  assert.match(html, /aria-hidden="true"/u);
});

test("reduced motion does not start a frame loop", () => {
  const canvas = { getContext: () => ({}) } as unknown as HTMLCanvasElement;
  const host = {} as HTMLElement;
  const stop = startStarfield(canvas, host, { reducedMotion: true });
  stop();
});
