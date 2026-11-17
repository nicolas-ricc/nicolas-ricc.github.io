import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { hullsOverlap } from "../iso/depth";
import { convexHull } from "../iso/geometry";
import { translate, translateAccent } from "../iso/translate";
import { bounds, tessellate, tessellateAll, type Solid } from "../iso/solids";
import { SIGN_FONT } from "../kit/legibility";
import { CHANCERY_FACE, CHANCERY_X, marqueeLayout } from "../kit/marquee";
import { CHANCERY_WRITING } from "../kit/chancery-writing";
import { pointInPolygon } from "../map/geo";
import { BLOG_SIGN, DECK_HALF, PLATFORM_DECK, PLATFORM_SITE, WRITING_CAP, seaPlatform, seaPlatformAt } from "./sign-platform";

const build = () => { const out: Solid[] = [], accents: Accent[] = []; seaPlatform(out, accents); return { out, accents }; };
const near = (a: number, b: number) => Math.abs(a - b) <= 1e-6;
const prisms = (out: Solid[]) => out.flatMap((s) => (s.kind === "prism" ? [s] : []));
const beams = (out: Solid[]) => out.flatMap((s) => (s.kind === "beam" ? [s] : []));
const isPile = (s: Solid) => s.kind === "cylinder" && s.mat === "steel" && s.at.z === -1;
const isDeck = (s: Solid) => s.kind === "poly" && s.mat === "deck";
const DECK = PLATFORM_DECK.flatMap((q) => [q.x, q.y]);
/** True when the plan of `s` (its tessellated points) lies on the deck at the origin. */
const onDeck = (s: Solid) => tessellateAll(s).every((f) => f.pts.every((p) => pointInPolygon(p.x, p.y, DECK)));

describe("sea platform (Writing, after #374)", () => {
  it("the deck is a strip along u = (1, −1)/√2, 2·DECK_HALF long and 10 deep, its top at z 1.6", () => {
    const decks = build().out.filter(isDeck);
    expect(decks).toHaveLength(1);
    const d = decks[0]!;
    if (d.kind !== "poly") throw new Error("deck");
    expect(d.z + d.h).toBeCloseTo(1.6, 9);
    const side = (a: number, b: number) => Math.hypot(d.footprint[b]!.x - d.footprint[a]!.x, d.footprint[b]!.y - d.footprint[a]!.y);
    expect(side(0, 1)).toBeCloseTo(2 * DECK_HALF, 9);
    expect(side(1, 2)).toBeCloseTo(10, 9);
  });

  it("the piles stand in the water along both long edges: steel r 0.3 from z −1 to 1.2, under the deck, at most 10 apart", () => {
    const { out } = build();
    expect(Math.min(...out.map((s) => bounds(s).min.z))).toBeCloseTo(-1, 9);
    const piles = out.flatMap((s) => (isPile(s) && s.kind === "cylinder" ? [s] : []));
    expect(piles.length).toBeGreaterThanOrEqual(2 * Math.ceil((2 * DECK_HALF) / 10));
    for (const p of piles) {
      expect(p.r).toBe(0.3); expect(p.at.z + p.h).toBeCloseTo(1.2, 9);
      expect(pointInPolygon(p.at.x, p.at.y, DECK)).toBe(true);
    }
  });

  it("railing posts 0.15² h 1 on the deck, with a handrail at z 2.5 between neighbours", () => {
    const { out } = build();
    const posts = prisms(out).filter((s) => s.mat === "steel" && near(s.w, 0.15) && near(s.d, 0.15) && near(s.h, 1) && near(s.at.z, 1.6));
    expect(posts.length).toBeGreaterThanOrEqual(14);
    for (const p of posts) expect(onDeck(p)).toBe(true);
    expect(beams(out).filter((b) => near(b.from.z, 2.5) && near(b.to.z, 2.5) && near(b.w, 0.1))).toHaveLength(posts.length - 1);
  });

  it("a ladder off the front edge: steel beams from the deck top z 1.6 down to z −0.6", () => {
    const rails = beams(build().out).filter((b) => near(Math.min(b.from.z, b.to.z), -0.6) && near(Math.max(b.from.z, b.to.z), 1.6));
    expect(rails).toHaveLength(2);
  });

  it("the boxGrey hut 2.4 × 1.8 × 1.4 and the steel mast r 0.15 h 4 stand on the deck, past the ends of the frame", () => {
    const { out } = build();
    const hut = prisms(out).filter((s) => s.mat === "boxGrey" && near(s.w, 2.4) && near(s.d, 1.8) && near(s.h, 1.4) && near(s.at.z, 1.6));
    const mast = out.filter((s) => s.kind === "cylinder" && s.mat === "steel" && s.r === 0.15 && s.h === 4 && near(s.at.z, 1.6));
    expect(hut).toHaveLength(1); expect(mast).toHaveLength(1);
    expect(onDeck(hut[0]!)).toBe(true); expect(onDeck(mast[0]!)).toBe(true);
  });

  it("exactly one cyan dot (the beacon, z ≥ 5.5) and one cyanMid dot (the hut light)", () => {
    const dots = build().accents.flatMap((a) => (a.kind === "dot" ? [a] : []));
    const cyan = dots.filter((d) => d.color === "cyan");
    expect(cyan).toHaveLength(1);
    expect(cyan[0]!.at.z).toBeGreaterThanOrEqual(5.5);
    expect(dots.filter((d) => d.color === "cyanMid")).toHaveLength(1);
  });

  it("the sign polygons are cyan triangles at 0.85 on the frame's plane (normal (1, 1, 0)/√2)", () => {
    const { out, accents } = build();
    const polys = accents.flatMap((a) => (a.kind === "poly" ? [a] : []));
    expect(polys.length).toBeGreaterThan(0);
    const frame = beams(out).filter((b) => near(b.w, 0.15) && near(b.from.z, b.to.z) && b.from.z >= 2.8 - 1e-9);
    expect(frame).toHaveLength(2);
    const plane = (frame[0]!.from.x + frame[0]!.to.x + frame[0]!.from.y + frame[0]!.to.y) / 2;
    for (const a of polys) {
      expect(a.color).toBe("cyan"); expect(a.alpha).toBe(0.85); expect(a.pts).toHaveLength(3);
      for (const p of a.pts) expect(p.x + p.y).toBeCloseTo(plane, 9);
    }
  });

  it("the sign posts 0.2² stand on the deck, at most 16 apart", () => {
    const posts = prisms(build().out).filter((s) => s.mat === "steel" && near(s.w, 0.2) && near(s.d, 0.2));
    expect(posts.length).toBeGreaterThanOrEqual(5);
    for (const s of posts) { expect(s.at.z).toBeCloseTo(1.6, 9); expect(onDeck(s)).toBe(true); }
  });

  it("no two solids interpenetrate (boxes overlap and plan hulls overlap), except the piles with the deck and interlocked pairs (the railing)", () => {
    const { out } = build();
    const boxes = out.map(bounds), hull = (s: Solid) => convexHull(tessellateAll(s).flatMap((f) => f.pts.map((p) => ({ x: p.x, y: p.y })))), bad: string[] = [];
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
      const a = out[i]!, b = out[j]!;
      if ((isPile(a) && isDeck(b)) || (isPile(b) && isDeck(a)) || (a.interlocks && b.interlocks)) continue;
      const A = boxes[i]!, B = boxes[j]!;
      if (!(["x", "y", "z"] as const).every((k) => Math.min(A.max[k], B.max[k]) - Math.max(A.min[k], B.min[k]) > 1e-6)) continue;
      if (hullsOverlap(hull(a), hull(b))) bad.push(`${i} ${a.kind}/${a.mat} × ${j} ${b.kind}/${b.mat}`);
    }
    expect(bad).toEqual([]);
  });

  it("deterministic: two builds are equal", () => {
    expect(build()).toEqual(build());
  });
});

const site = () => { const out: Solid[] = [], accents: Accent[] = []; seaPlatformAt(out, accents); return { out, accents }; };
const isPanel = (s: Solid) => s.kind === "poly" && s.mat === "officeDark";
const N = { x: Math.SQRT1_2, y: Math.SQRT1_2 };

describe("Writing sign in Black Chancery, with its backing panel", () => {
  it("PLATFORM_SITE is (392, 178, 0)", () => {
    expect(PLATFORM_SITE).toEqual({ x: 392, y: 178, z: 0 });
  });
  it("BLOG_SIGN: Writing in Black Chancery, cyan, the font's x-height and stem as stroke, on one diagonal plane", () => {
    expect(BLOG_SIGN).toMatchObject({ id: "plataforma", text: "Writing", size: WRITING_CAP, width: SIGN_FONT.width, color: "cyan", xHeight: CHANCERY_X * WRITING_CAP, stroke: CHANCERY_FACE * WRITING_CAP });
    expect(BLOG_SIGN.facade).toBeUndefined();
    expect(BLOG_SIGN.glyphs.map((g) => g.char).join("")).toBe("Writing");
    const lay = marqueeLayout(WRITING_CAP, 0, CHANCERY_WRITING);
    BLOG_SIGN.glyphs.forEach((g, i) => {
      expect(g.plane.u.x).toBeCloseTo(Math.SQRT1_2, 12); expect(g.plane.u.y).toBeCloseTo(-Math.SQRT1_2, 12);
      expect(g.plane.v).toEqual({ x: 0, y: 0, z: 1 });
      expect(g.quads).toHaveLength(lay[i]!.quads.length);
    });
  });
  it("seaPlatformAt draws the sign from BLOG_SIGN: its cyan polys are the spec's triangles at 0.85", () => {
    const want = BLOG_SIGN.glyphs.flatMap((g) => g.quads).map((pts) => ({ kind: "poly", pts, color: "cyan", alpha: 0.85 }));
    expect(site().accents.filter((a) => a.kind === "poly")).toEqual(want);
  });
  it("the backing is one officeDark poly, the same one seaPlatformAt builds", () => {
    expect(BLOG_SIGN.backing).toHaveLength(1);
    expect(isPanel(BLOG_SIGN.backing[0]!)).toBe(true);
    const panels = site().out.filter(isPanel);
    expect(panels).toEqual(BLOG_SIGN.backing);
  });
  it("the panel is 0.3 thick, 0.06 behind the letters' plane", () => {
    const p = BLOG_SIGN.backing[0]!;
    if (p.kind !== "poly") throw new Error("panel");
    const tube = BLOG_SIGN.glyphs[0]!.quads[0]![0]!, k = tube.x * N.x + tube.y * N.y;
    const ks = p.footprint.map((q) => q.x * N.x + q.y * N.y);
    expect(Math.max(...ks)).toBeCloseTo(k - 0.06, 9);
    expect(Math.min(...ks)).toBeCloseTo(k - 0.36, 9);
  });
  it("the panel exceeds every letter's ink box, the swashes and the g's descender included, by ≥ 1 w on every side", () => {
    const p = BLOG_SIGN.backing[0]!;
    if (p.kind !== "poly") throw new Error("panel");
    const plane = BLOG_SIGN.glyphs[0]!.plane, w = SIGN_FONT.width;
    const along = p.footprint.map((q) => (q.x - plane.origin.x) * plane.u.x + (q.y - plane.origin.y) * plane.u.y);
    const a0 = Math.min(...along), a1 = Math.max(...along), b0 = p.z - plane.origin.z, b1 = p.z + p.h - plane.origin.z;
    for (const g of BLOG_SIGN.glyphs) {
      expect(g.layout.box.x0 - a0, g.char).toBeGreaterThanOrEqual(w);
      expect(a1 - g.layout.box.x1, g.char).toBeGreaterThanOrEqual(w);
      expect(g.layout.box.y0 - b0, g.char).toBeGreaterThanOrEqual(w);
      expect(b1 - g.layout.box.y1, g.char).toBeGreaterThanOrEqual(w);
    }
    expect(BLOG_SIGN.glyphs.find((g) => g.char === "g")!.layout.box.y0).toBeLessThan(0);
  });
  it("the panel shows the camera its shaded front face", () => {
    expect(tessellate(BLOG_SIGN.backing[0]!).some((f) => f.mat === "officeDark" && f.tone === "shade")).toBe(true);
  });
  it("the frame grows with the word: beams span the panel", () => {
    const p = BLOG_SIGN.backing[0]!;
    const frame = beams(site().out).filter((b) => near(b.w, 0.15) && near(b.from.z, b.to.z) && b.from.z >= 2.8 - 1e-9);
    expect(frame).toHaveLength(2);
    const len = (b: (typeof frame)[number]) => Math.hypot(b.to.x - b.from.x, b.to.y - b.from.y);
    const pb = bounds(p);
    for (const b of frame) expect(len(b)).toBeGreaterThan(Math.hypot(pb.max.x - pb.min.x, pb.max.y - pb.min.y) / Math.SQRT2);
    const [lo, hi] = [...frame].sort((a, b) => a.from.z - b.from.z);
    expect(pb.min.z).toBeCloseTo(lo!.from.z + 0.075, 9);
    expect(pb.max.z).toBeCloseTo(hi!.from.z - 0.075, 9);
  });
  it("seaPlatform is seaPlatformAt moved by −PLATFORM_SITE, solid by solid and accent by accent", () => {
    const o = build(), s = site();
    const r = (v: unknown) => JSON.parse(JSON.stringify(v, (_k, x: unknown) => (typeof x === "number" ? Math.round(x * 1e9) / 1e9 + 0 : x)));
    expect(r(o.out)).toEqual(r(s.out.map((x) => translate(x, -PLATFORM_SITE.x, -PLATFORM_SITE.y))));
    expect(r(o.accents)).toEqual(r(s.accents.map((x) => translateAccent(x, -PLATFORM_SITE.x, -PLATFORM_SITE.y))));
  });
});
