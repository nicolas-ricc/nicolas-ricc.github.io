import { describe, expect, it } from "vitest";
import { v3 } from "../iso/geometry";
import { project } from "../iso/project";
import { BLEED, WORLD, type WorldZone } from "../map/geo";
import { VIEW_INSET, clampToBleed, coverView, pointerToWorld, unproject, viewCorners, zoneView } from "./view";

const X0 = WORLD.x0 - BLEED.x, X1 = WORLD.x1 + BLEED.x, Y0 = WORLD.y0 - BLEED.y, Y1 = WORLD.y1 + BLEED.y;
const insideBleed = (p: { x: number; y: number }, inset = 0, tol = 1e-6) =>
  p.x >= X0 + inset - tol && p.x <= X1 - inset + tol && p.y >= Y0 + inset - tol && p.y <= Y1 - inset + tol;
const SIZES: [number, number][] = [[1600, 900], [1200, 900], [390, 693], [2100, 900], [640, 900], [390, 338]];

describe("unproject", () => {
  it("inverts project at z 0", () => {
    for (const [x, y] of [[0, 0], [150, 50], [-402, 714], [912, -438]] as const) {
      const s = project(v3(x, y, 0));
      const w = unproject(s.x, s.y);
      expect(w.x).toBeCloseTo(x, 9); expect(w.y).toBeCloseTo(y, 9);
    }
  });
  it("pointerToWorld inverts the camera", () => {
    const v = { x: 123, y: -45, scale: 1.7 };
    const s = project(v3(129, 227, 0));
    const w = pointerToWorld(v, s.x * v.scale + v.x, s.y * v.scale + v.y);
    expect(w.x).toBeCloseTo(129, 9); expect(w.y).toBeCloseTo(227, 9);
  });
});

describe("coverView", () => {
  it.each(SIZES)("%i×%i: fills the host and its four corners fall inside the bleed", (w, h) => {
    const v = coverView(w, h);
    expect(v.scale).toBeGreaterThan(0);
    for (const c of viewCorners(v, w, h)) expect(insideBleed(c)).toBe(true);
  });
  it("16:9 is the same framing as the lab's key 4 (coverFrame 16/9 without margin)", () => {
    const v = coverView(1600, 900);
    // the projected cover rectangle is exactly 1600 wide at this scale
    const corners = viewCorners(v, 1600, 900);
    const sx = corners.map((c) => project(v3(c.x, c.y, 0)).x);
    expect((Math.max(...sx) - Math.min(...sx)) * v.scale).toBeCloseTo(1600, 6);
  });
});

describe("clampToBleed", () => {
  it("leaves a view that is already inside untouched", () => {
    const v = coverView(1600, 900);
    // the center of the cover at double scale: the viewport is half the cover, centered; it stays inside
    const z = { x: v.x * 2 - 800, y: v.y * 2 - 450, scale: v.scale * 2 };
    for (const p of viewCorners(z, 1600, 900)) expect(insideBleed(p, VIEW_INSET)).toBe(true);
    expect(clampToBleed(z, 1600, 900)).toEqual(z);
  });
  it("shifts a view that sticks out, is idempotent and the result ends up inside with VIEW_INSET", () => {
    const v = coverView(1600, 900);
    const out = { x: v.x + 5000, y: v.y - 3000, scale: v.scale * 2 };
    const c = clampToBleed(out, 1600, 900);
    expect(c.scale).toBe(out.scale);
    for (const p of viewCorners(c, 1600, 900)) expect(insideBleed(p, VIEW_INSET)).toBe(true);
    expect(clampToBleed(c, 1600, 900)).toEqual(c);
  });
  it("if the viewport does not fit at that scale it returns coverView", () => {
    const v = coverView(1600, 900);
    expect(clampToBleed({ x: 0, y: 0, scale: v.scale / 2 }, 1600, 900)).toEqual(v);
  });
});

describe("zoneView", () => {
  const zones: WorldZone[] = ["portfolio", "cv", "blog"];
  it.each(SIZES)("%i×%i: never below cover and always inside the bleed", (w, h) => {
    const cover = coverView(w, h);
    for (const z of zones) {
      const v = zoneView(z, w, h);
      expect(v.scale).toBeGreaterThanOrEqual(cover.scale);
      for (const p of viewCorners(v, w, h)) expect(insideBleed(p, VIEW_INSET)).toBe(true);
    }
  });
  it("on mobile (390×338) the whole zone fits: the scale exceeds the cover", () => {
    expect(zoneView("portfolio", 390, 338).scale).toBeGreaterThan(coverView(390, 338).scale * 1.05);
  });
  it("in the narrow column (640×900) the zone's landmark stays visible", () => {
    const v = zoneView("cv", 640, 900);
    const s = project(v3(129, 227, 0)); // office tower
    const px = s.x * v.scale + v.x, py = s.y * v.scale + v.y;
    expect(px).toBeGreaterThan(0); expect(px).toBeLessThan(640);
    expect(py).toBeGreaterThan(0); expect(py).toBeLessThan(900);
  });
});
