import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { project } from "../iso/project";
import { tessellate } from "../iso/solids";
import type { SignSpec } from "../kit/legibility";
import { pointInPolygon, worldZoneAt } from "../map/geo";
import { ZONE_IDS } from "../map/zones";
import { BLOG_SIGN } from "../scenes/sign-platform";
import { RESUME_SIGN } from "../scenes/sign-crown";
import { TINKER_SIGN } from "../scenes/sign-tinker";
import { labelLayout, SIGN_ORDER, signBox, signPolygons, SIGNS, zoneAtScreen, type ScreenBox } from "./signs";
import { coverView, pointerToWorld, unproject, type View } from "./view";

const ALL = Object.entries(SIGNS) as [keyof typeof SIGNS, SignSpec][];
const ID: View = { x: 0, y: 0, scale: 1 };

/** Screen bounding box of a set of flat polygons. */
function boundsOf(polys: number[][]): ScreenBox {
  const xs = polys.flatMap((p) => p.filter((_, i) => i % 2 === 0)), ys = polys.flatMap((p) => p.filter((_, i) => i % 2 === 1));
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}
const inSign = (s: SignSpec, x: number, y: number): boolean => signPolygons(s).some((p) => pointInPolygon(x, y, p));
const toHost = (b: ScreenBox, v: View): ScreenBox =>
  ({ minX: b.minX * v.scale + v.x, minY: b.minY * v.scale + v.y, maxX: b.maxX * v.scale + v.x, maxY: b.maxY * v.scale + v.y });

describe("SIGNS (#393)", () => {
  it("SIGNS maps each zone to its sign and SIGN_ORDER is portfolio, cv, blog", () => {
    expect(SIGNS.portfolio).toBe(TINKER_SIGN);
    expect(SIGNS.cv).toBe(RESUME_SIGN);
    expect(SIGNS.blog).toBe(BLOG_SIGN);
    expect(SIGN_ORDER).toEqual(["portfolio", "cv", "blog"]);
    expect([...SIGN_ORDER].sort()).toEqual([...ZONE_IDS].sort());
  });
});

describe("signPolygons (#393)", () => {
  it("signPolygons: one flat polygon per tessellated backing face plus one quad per glyph box", () => {
    for (const [, s] of ALL) {
      const polys = signPolygons(s), faces = s.backing.flatMap(tessellate).length;
      expect(polys.length).toBe(faces + s.glyphs.length);
      for (const p of polys) {
        expect(p.length % 2).toBe(0);
        expect(p.length).toBeGreaterThanOrEqual(6);
      }
      for (const p of polys.slice(faces)) expect(p.length).toBe(8);
      expect(signPolygons(s)).toBe(polys);
    }
  });

  it("the projected center of every glyph lies in the sign's polygons", () => {
    for (const [id, s] of ALL) {
      for (const g of s.glyphs) {
        const pts = g.quads.flat().map(project);
        const c = { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length };
        expect(inSign(s, c.x, c.y), `${id} ${g.char}`).toBe(true);
      }
    }
  });

  // on the row of the word's vertical center, 3 units past the extremes of every polygon point
  it("a point 3 u beyond either end of the panel is outside the sign", () => {
    for (const [id, s] of ALL) {
      const b = boundsOf(signPolygons(s)), w = signBox(s), y = (w.minY + w.maxY) / 2;
      expect(inSign(s, b.minX - 3, y), `${id} left`).toBe(false);
      expect(inSign(s, b.maxX + 3, y), `${id} right`).toBe(false);
    }
  });

  // a View is a uniform scale plus an offset, so disjoint at scale 1 means disjoint at every camera
  it("the three signs' polygons are disjoint", () => {
    const boxes = ALL.map(([, s]) => boundsOf(signPolygons(s)));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!, b = boxes[j]!;
        const meet = a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
        expect(meet, `${ALL[i]![0]} × ${ALL[j]![0]}`).toBe(false);
      }
    }
  });
});

describe("signBox (#393)", () => {
  it("signBox is the screen box of the projected glyph quads", () => {
    for (const [, s] of ALL) {
      const pts = s.glyphs.flatMap((g) => g.quads.flat()).map(project);
      expect(signBox(s)).toEqual({
        minX: Math.min(...pts.map((p) => p.x)), minY: Math.min(...pts.map((p) => p.y)),
        maxX: Math.max(...pts.map((p) => p.x)), maxY: Math.max(...pts.map((p) => p.y)),
      });
    }
    // measured in the issue: the words at the laptop cover, in host px
    const v = coverView(1366, 657);
    const r = (b: ScreenBox): number[] => [b.minX, b.maxX, b.minY, b.maxY].map(Math.round);
    expect(r(toHost(signBox(RESUME_SIGN), v))).toEqual([394, 467, 237, 251]);
    expect(r(toHost(signBox(TINKER_SIGN), v))).toEqual([600, 688, 70, 86]);
  });
});

describe("zoneAtScreen (#393)", () => {
  it("zoneAtScreen on the center of each word returns its zone", () => {
    for (const v of [ID, coverView(1366, 657)]) {
      for (const [id, s] of ALL) {
        const b = toHost(signBox(s), v);
        expect(zoneAtScreen(v, (b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2), `${id} at scale ${v.scale}`).toBe(id);
      }
    }
  });

  // A10: the Writing platform stands over ground that the geography gives to Resume
  it("zoneAtScreen prefers the sign over the geography beneath it", () => {
    const b = boundsOf(signPolygons(BLOG_SIGN));
    let found: { x: number; y: number } | undefined;
    for (let x = b.minX; x <= b.maxX && !found; x += 0.5) {
      for (let y = b.minY; y <= b.maxY && !found; y += 0.5) {
        const g = unproject(x, y);
        if (inSign(BLOG_SIGN, x, y) && worldZoneAt(g.x, g.y) === "cv") found = { x, y };
      }
    }
    expect(found).toBeDefined();
    expect(zoneAtScreen(ID, found!.x, found!.y)).toBe("blog");
  });

  // a 20 px grid of the laptop host, without the points over a sign
  it("zoneAtScreen away from the signs equals worldZoneAt(pointerToWorld(…))", () => {
    const v = coverView(1366, 657);
    let checked = 0;
    for (let px = 0; px <= 1366; px += 20) {
      for (let py = 0; py <= 657; py += 20) {
        const sx = (px - v.x) / v.scale, sy = (py - v.y) / v.scale;
        if (ALL.some(([, s]) => inSign(s, sx, sy))) continue;
        const g = pointerToWorld(v, px, py);
        expect(zoneAtScreen(v, px, py), `${px},${py}`).toBe(worldZoneAt(g.x, g.y));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(2000);
  });
});

describe("labelLayout (#393)", () => {
  const PAD = { hw: 50, hh: 20 };

  it("labelLayout at coverView(1366, 657) puts the three on their sign", () => {
    const v = coverView(1366, 657);
    for (const [id, s] of ALL) {
      const b = signBox(s), l = labelLayout(b, v, { w: 1366, h: 657 }, PAD);
      expect(l.mode, id).toBe("sign");
      if (l.mode !== "sign") continue;
      expect(l.x).toBeCloseTo(b.minX * v.scale + v.x, 6);
      expect(l.y).toBeCloseTo(b.minY * v.scale + v.y, 6);
      expect(l.w).toBeCloseTo((b.maxX - b.minX) * v.scale, 6);
      expect(l.h).toBeCloseTo((b.maxY - b.minY) * v.scale, 6);
    }
  });

  // Writing falls outside the phone window and sticks to its right edge
  it("labelLayout at coverView(390, 750): RESUME and PORTFOLIO on their sign, Writing on the right edge", () => {
    const v = coverView(390, 750), host = { w: 390, h: 750 };
    expect(labelLayout(signBox(RESUME_SIGN), v, host, PAD).mode).toBe("sign");
    expect(labelLayout(signBox(TINKER_SIGN), v, host, PAD).mode).toBe("sign");
    const w = labelLayout(signBox(BLOG_SIGN), v, host, PAD);
    expect(w.mode).toBe("edge");
    expect(w.x).toBe(390 - PAD.hw);
    expect(w.y).toBeGreaterThanOrEqual(PAD.hh);
    expect(w.y).toBeLessThanOrEqual(750 - PAD.hh);
  });

  // exactly half inside on both axes still counts as on the sign
  it("labelLayout keeps the sign when exactly half of the box is inside", () => {
    const l = labelLayout({ minX: 90, minY: -10, maxX: 110, maxY: 10 }, ID, { w: 100, h: 100 }, PAD);
    expect(l).toEqual({ mode: "sign", x: 90, y: -10, w: 20, h: 20 });
    expect(labelLayout({ minX: 91, minY: 0, maxX: 111, maxY: 10 }, ID, { w: 100, h: 100 }, PAD).mode).toBe("edge");
  });

  // a host smaller than the label clamps to the low end, as placeLabels did
  it("labelLayout clamps the edge label to lo when the host is smaller than the label", () => {
    const l = labelLayout({ minX: 500, minY: 500, maxX: 600, maxY: 520 }, ID, { w: 40, h: 40 }, { hw: 50, hh: 30 });
    expect(l).toEqual({ mode: "edge", x: 50, y: 30 });
  });
});

describe("signs.ts stays pure (#393)", () => {
  // pixi-free.test.ts does not cover src/world (stage.ts is Pixi), so this module guards itself
  it("signs.ts imports neither pixi.js nor the DOM", () => {
    const src = readFileSync(fileURLToPath(new URL("./signs.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/["']pixi\.js["']/);
    expect(src).not.toMatch(/\b(document|window|HTMLElement)\b/);
  });
});
