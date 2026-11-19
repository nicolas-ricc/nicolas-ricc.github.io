import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { translate, translateAccent } from "../iso/translate";
import { tessellate, type Solid } from "../iso/solids";
import { Z_SCALE } from "../iso/project";
import { SIGN_FONT } from "../kit/legibility";
import { CHAINSAW_FACE, CHAINSAW_X, marqueeLayout } from "../kit/marquee";
import { CHAINSAW_WRITING } from "../kit/chainsaw-writing";
import { pointInPolygon } from "../map/geo";
import { BLOG_SIGN, BOARD_TOP, PLATFORM_DECK, PLATFORM_SITE, WRITING_CAP, seaPlatform, seaPlatformAt } from "./sign-platform";

const build = () => { const out: Solid[] = [], accents: Accent[] = []; seaPlatform(out, accents); return { out, accents }; };
const site = () => { const out: Solid[] = [], accents: Accent[] = []; seaPlatformAt(out, accents); return { out, accents }; };

describe("Writing board (a flat board floating on the water, WRITING painted on it)", () => {
  it("PLATFORM_SITE is (380, 178, 0)", () => {
    expect(PLATFORM_SITE).toEqual({ x: 380, y: 178, z: 0 });
  });

  it("the whole piece is one officeDark slab from the water (z −1) to BOARD_TOP, the same height everywhere: no posts, rails or frame", () => {
    const { out } = site();
    expect(out).toHaveLength(1);
    const b = out[0]!;
    if (b.kind !== "poly") throw new Error("board");
    expect(b.mat).toBe("officeDark");
    expect(b.z).toBe(-1);
    expect(b.z + b.h).toBeCloseTo(BOARD_TOP, 12);
    expect(BOARD_TOP - -1).toBeLessThanOrEqual(1);
  });

  it("the board is a rectangle along u = (1, −1)/√2 and n = (1, 1)/√2, centered on PLATFORM_SITE; PLATFORM_DECK is its plan at the origin", () => {
    const b = site().out[0]!;
    if (b.kind !== "poly") throw new Error("board");
    const [p0, p1, p2] = b.footprint as [typeof b.footprint[0], typeof b.footprint[0], typeof b.footprint[0]];
    expect((p1.x - p0.x) + (p1.y - p0.y)).toBeCloseTo(0, 9); // p0→p1 along u
    expect((p2.x - p1.x) - (p2.y - p1.y)).toBeCloseTo(0, 9); // p1→p2 along n
    expect((p0.x + p2.x) / 2).toBeCloseTo(PLATFORM_SITE.x, 9); expect((p0.y + p2.y) / 2).toBeCloseTo(PLATFORM_SITE.y, 9);
    expect(PLATFORM_DECK).toEqual(b.footprint.map((q) => ({ x: q.x - PLATFORM_SITE.x, y: q.y - PLATFORM_SITE.y })));
  });

  it("BLOG_SIGN: WRITING in Chainsaw Carnage, cyan, its shortest letter as x-height and its stem as stroke, backed by the board", () => {
    expect(BLOG_SIGN).toMatchObject({ id: "plataforma", text: "WRITING", size: WRITING_CAP, width: SIGN_FONT.width, color: "cyan", xHeight: CHAINSAW_X * WRITING_CAP, stroke: CHAINSAW_FACE * WRITING_CAP });
    expect(BLOG_SIGN.facade).toBeUndefined();
    expect(BLOG_SIGN.glyphs.map((g) => g.char).join("")).toBe("WRITING");
    expect(BLOG_SIGN.backing).toEqual(site().out);
    const lay = marqueeLayout(WRITING_CAP, 0, CHAINSAW_WRITING);
    for (const [i, g] of BLOG_SIGN.glyphs.entries()) expect(g.quads).toHaveLength(lay[i]!.quads.length);
  });

  it("CHAINSAW_X is the ink height of the shortest letter, within a hundredth of a cap", () => {
    const lay = marqueeLayout(1, 0, CHAINSAW_WRITING);
    expect(Math.min(...lay.map((g) => g.box.y1 - g.box.y0))).toBeCloseTo(CHAINSAW_X, 2);
  });

  it("the paint is flat on the board's top face: every vertex of every letter at the same z, just over BOARD_TOP, and none outside the board", () => {
    const b = site().out[0]!;
    if (b.kind !== "poly") throw new Error("board");
    const plan = b.footprint.flatMap((q) => [q.x, q.y]);
    const polys = site().accents.flatMap((a) => (a.kind === "poly" ? [a] : []));
    expect(polys.length).toBeGreaterThan(0);
    for (const a of polys) for (const p of a.pts) {
      expect(p.z).toBeGreaterThan(BOARD_TOP); expect(p.z).toBeLessThan(BOARD_TOP + 0.05);
      expect(pointInPolygon(p.x, p.y, plan)).toBe(true);
    }
  });

  it("the letters' plane is horizontal and stretched along v by Z_SCALE so the word reads upright on screen (roofDiagonal)", () => {
    for (const g of BLOG_SIGN.glyphs) {
      expect(g.plane.u.x).toBeCloseTo(Math.SQRT1_2, 12); expect(g.plane.u.y).toBeCloseTo(-Math.SQRT1_2, 12); expect(g.plane.u.z).toBe(0);
      expect(g.plane.v).toEqual({ x: -Z_SCALE, y: -Z_SCALE, z: 0 });
    }
  });

  it("seaPlatformAt paints the sign from BLOG_SIGN: its accents are the spec's triangles in cyan at 0.85, and nothing else", () => {
    const want = BLOG_SIGN.glyphs.flatMap((g) => g.quads).map((pts) => ({ kind: "poly", pts, color: "cyan", alpha: 0.85 }));
    expect(site().accents).toEqual(want);
  });

  it("the board exceeds every letter's ink box by ≥ 1 w on every side", () => {
    const b = BLOG_SIGN.backing[0]!;
    if (b.kind !== "poly") throw new Error("board");
    const plane = BLOG_SIGN.glyphs[0]!.plane, w = SIGN_FONT.width;
    const along = b.footprint.map((q) => (q.x - plane.origin.x) * plane.u.x + (q.y - plane.origin.y) * plane.u.y);
    const across = b.footprint.map((q) => ((q.x - plane.origin.x) * plane.v.x + (q.y - plane.origin.y) * plane.v.y) / (plane.v.x ** 2 + plane.v.y ** 2));
    for (const g of BLOG_SIGN.glyphs) {
      expect(g.layout.box.x0 - Math.min(...along), g.char).toBeGreaterThanOrEqual(w);
      expect(Math.max(...along) - g.layout.box.x1, g.char).toBeGreaterThanOrEqual(w);
      expect(g.layout.box.y0 - Math.min(...across), g.char).toBeGreaterThanOrEqual(w);
      expect(Math.max(...across) - g.layout.box.y1, g.char).toBeGreaterThanOrEqual(w);
    }
  });

  it("the board shows the camera its lit top face", () => {
    expect(tessellate(BLOG_SIGN.backing[0]!).some((f) => f.mat === "officeDark" && f.normal.z > 0.99)).toBe(true);
  });

  it("seaPlatform is seaPlatformAt moved by −PLATFORM_SITE, solid by solid and accent by accent", () => {
    const o = build(), s = site();
    const r = (v: unknown) => JSON.parse(JSON.stringify(v, (_k, x: unknown) => (typeof x === "number" ? Math.round(x * 1e9) / 1e9 + 0 : x)));
    expect(r(o.out)).toEqual(r(s.out.map((x) => translate(x, -PLATFORM_SITE.x, -PLATFORM_SITE.y))));
    expect(r(o.accents)).toEqual(r(s.accents.map((x) => translateAccent(x, -PLATFORM_SITE.x, -PLATFORM_SITE.y))));
  });

  it("deterministic: two builds are equal", () => {
    expect(build()).toEqual(build());
  });
});
