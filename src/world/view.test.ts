import { describe, expect, it } from "vitest";
import { v3 } from "../iso/geometry";
import { project } from "../iso/project";
import { BLEED, WORLD, inCoverQuad, type WorldZone } from "../map/geo";
import { coverFrame, fitTransform } from "./frame";
import { COVER_FOCUS_U, VIEW_INSET, clampToBleed, clampToCover, coverView, pointerToWorld, unproject, viewCorners, zoneView, type View } from "./view";

const X0 = WORLD.x0 - BLEED.x, X1 = WORLD.x1 + BLEED.x, Y0 = WORLD.y0 - BLEED.y, Y1 = WORLD.y1 + BLEED.y;
const insideBleed = (p: { x: number; y: number }, inset = 0, tol = 1e-6) =>
  p.x >= X0 + inset - tol && p.x <= X1 - inset + tol && p.y >= Y0 + inset - tol && p.y <= Y1 - inset + tol;
const SIZES: [number, number][] = [[1600, 900], [1200, 900], [390, 693], [2100, 900], [640, 900], [390, 338]];
const COVER_SIZES: [number, number][] = [...SIZES, [390, 750], [820, 1180], [900, 900], [1280, 900], [50, 900]];
const ZONE_SIZES: [number, number][] = [...COVER_SIZES, [768, 955], [390, 300], [1920, 955]];
const A = 16 / 9;
const NARROW = COVER_SIZES.filter(([w, h]) => w / h < A);
// projected box of the 16:9 cover: axis-aligned on screen
const QPTS = coverFrame(A)[0]!.pts;
const QXS = QPTS.filter((_, i) => i % 2 === 0), QYS = QPTS.filter((_, i) => i % 2 === 1);
const QX0 = Math.min(...QXS), QX1 = Math.max(...QXS), QY0 = Math.min(...QYS), QY1 = Math.max(...QYS);
/** The 16:9 cover covers the host on each axis: its projected box spans [0, w] and [0, h] on screen. */
const coversX = (v: View, w: number) => QX0 * v.scale + v.x <= 1e-6 && QX1 * v.scale + v.x >= w - 1e-6;
const coversY = (v: View, h: number) => QY0 * v.scale + v.y <= 1e-6 && QY1 * v.scale + v.y >= h - 1e-6;

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
  it.each(COVER_SIZES)("%i×%i: corners inside the bleed, and inside the 16:9 cover when the host is not wider", (w, h) => {
    const v = coverView(w, h);
    expect(v.scale).toBeGreaterThan(0);
    for (const c of viewCorners(v, w, h)) {
      expect(insideBleed(c)).toBe(true);
      if (w / h <= A + 1e-9) expect(inCoverQuad(c.x, c.y, A, 1e-6)).toBe(true);
    }
  });
  it("16:9 is continuous with the old rule", () => {
    const v = coverView(1600, 900), f = fitTransform(coverFrame(A), 1600, 900, 0);
    expect(v.x).toBeCloseTo(f.x, 6); expect(v.y).toBeCloseTo(f.y, 6); expect(v.scale).toBeCloseTo(f.scale, 6);
    // just under 16:9 the narrow rule takes over without a jump
    const n = coverView(1919, 1080), old = fitTransform(coverFrame(1919 / 1080), 1919, 1080, 0);
    expect(Math.abs(n.scale / old.scale - 1)).toBeLessThan(1e-3);
    expect(Math.abs(n.x - old.x)).toBeLessThan(1); expect(Math.abs(n.y - old.y)).toBeLessThan(1);
  });
  it.each([[2100, 900], [1920, 955]])("%i×%i: wider than 16:9 is unchanged", (w, h) => {
    expect(coverView(w, h)).toEqual(fitTransform(coverFrame(w / h), w, h, 0));
  });
  it("390×750 centers on COVER_FOCUS_U of the 16:9 cover", () => {
    const v = coverView(390, 750);
    expect((QX0 + COVER_FOCUS_U * (QX1 - QX0)) * v.scale + v.x).toBeCloseTo(195, 6);
  });
  it("the 16:9 cover fills the height on narrow hosts", () => {
    const v = coverView(390, 750);
    expect((QY1 - QY0) * v.scale).toBeCloseTo(750, 6);
  });
  it("1280×900 is clamped to a cover edge", () => {
    // 4:3 shows 80 % of the cover, so its center is clamped to [0.40, 0.60] (valid while COVER_FOCUS_U ≤ 0.40)
    const v = coverView(1280, 900);
    const left = QX0 * v.scale + v.x, right = QX1 * v.scale + v.x;
    expect(Math.abs(left) < 1e-6 || Math.abs(right - 1280) < 1e-6).toBe(true);
    expect(coversX(v, 1280)).toBe(true);
  });
  it.each(NARROW)("%i×%i: never zooms out compared with the old rule", (w, h) => {
    expect(coverView(w, h).scale).toBeGreaterThanOrEqual(fitTransform(coverFrame(w / h), w, h, 0).scale - 1e-9);
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

describe("clampToCover", () => {
  it("leaves a view already inside the cover untouched", () => {
    const v = coverView(1600, 900);
    const z = { x: v.x * 2 - 800, y: v.y * 2 - 450, scale: v.scale * 2 };
    expect(clampToCover(z, 1600, 900)).toEqual(z);
    const n = coverView(390, 750);
    expect(clampToCover(n, 390, 750)).toEqual(n);
  });
  it("is idempotent and the cover ends up covering the host", () => {
    const v = coverView(1600, 900);
    const out = { x: v.x + 5000, y: v.y - 3000, scale: v.scale * 2 };
    const c = clampToCover(out, 1600, 900);
    expect(c.scale).toBe(out.scale);
    expect(coversX(c, 1600)).toBe(true); expect(coversY(c, 900)).toBe(true);
    expect(clampToCover(c, 1600, 900)).toEqual(c);
  });
  it("only clamps the axes where the cover fits", () => {
    // the cover spans the height of 2100×900 at this scale, not its width
    const s = 900 / (QY1 - QY0);
    const c = clampToCover({ x: 12345, y: 6789, scale: s }, 2100, 900);
    expect(c.x).toBe(12345);
    expect(coversY(c, 900)).toBe(true);
  });
});

describe("zoneView", () => {
  const zones: WorldZone[] = ["portfolio", "cv", "blog"];
  it.each(ZONE_SIZES)("%i×%i: inside the bleed, and inside the 16:9 cover on each axis it covers", (w, h) => {
    for (const z of zones) {
      const v = zoneView(z, w, h);
      for (const p of viewCorners(v, w, h)) expect(insideBleed(p, VIEW_INSET)).toBe(true);
      if ((QX1 - QX0) * v.scale >= w) expect(coversX(v, w)).toBe(true);
      if ((QY1 - QY0) * v.scale >= h) expect(coversY(v, h)).toBe(true);
    }
  });
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
