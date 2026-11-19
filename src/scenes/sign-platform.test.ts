import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { hullsOverlap } from "../iso/depth";
import { convexHull } from "../iso/geometry";
import { translate, translateAccent } from "../iso/translate";
import { bounds, tessellateAll, type Solid } from "../iso/solids";
import { contrastRatio, SIGN_FONT } from "../kit/legibility";
import { toWorld } from "../kit/lettering";
import { LOSTWAGES_FACE, marqueeLayout } from "../kit/marquee";
import { LOSTWAGES_WRITING } from "../kit/lostwages-writing";
import { project } from "../iso/project";
import { ISO_COLORS, toneColor } from "../map/palette-iso";
import { waterCellMat, WATER_MATS } from "./terrain";
import { pointInPolygon } from "../map/geo";
import { BLOG_SIGNS, DECK_HALF, isSeaPatch, PLATFORM_DECK, PLATFORM_SITES, WRITING_CAP, seaPlatform, seaPlatformAt, type WritingSite } from "./sign-platform";

const build = () => { const out: Solid[] = [], accents: Accent[] = []; seaPlatform(out, accents); return { out, accents }; };
const near = (a: number, b: number) => Math.abs(a - b) <= 1e-6;
const prisms = (out: Solid[]) => out.flatMap((s) => (s.kind === "prism" ? [s] : []));
const beams = (out: Solid[]) => out.flatMap((s) => (s.kind === "beam" ? [s] : []));
const isPile = (s: Solid) => s.kind === "cylinder" && s.mat === "steel" && s.at.z === -1;
const isDeck = (s: Solid) => s.kind === "poly" && s.mat === "deck";
const DECK = PLATFORM_DECK.flatMap((q) => [q.x, q.y]);
/** True when the plan of `s` (its tessellated points) lies on the deck at the origin. */
const onDeck = (s: Solid) => tessellateAll(s).every((f) => f.pts.every((p) => pointInPolygon(p.x, p.y, DECK)));

/** Same JSON shape and keys, every number within 1e-9, every other leaf equal. */
function expectClose(a: unknown, b: unknown, path = "$"): void {
  if (typeof a === "number" && typeof b === "number") { expect(Math.abs(a - b), path).toBeLessThanOrEqual(1e-9); return; }
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
    expect(Object.keys(a).sort(), path).toEqual(Object.keys(b).sort());
    for (const k of Object.keys(a)) expectClose((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`);
    return;
  }
  expect(a, path).toEqual(b);
}

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

const at = (w: WritingSite) => { const out: Solid[] = [], accents: Accent[] = []; seaPlatformAt(out, accents, w); return { out, accents }; };
const isPanel = (s: Solid) => s.kind === "poly" && s.mat === "officeDark";
const N = { x: Math.SQRT1_2, y: Math.SQRT1_2 };

describe("the two Writing sites (#427)", () => {
  it("PLATFORM_SITES: wide (570, 105, 0) and tall (440, 400, 0)", () => {
    // wide moved 20 u north-east from (550, 125) in #429: the return cargo's screen box crossed the word's box (sea-anim.test.ts)
    expect(PLATFORM_SITES).toEqual({ wide: { x: 570, y: 105, z: 0 }, tall: { x: 440, y: 400, z: 0 } });
  });
});

describe.each(["wide", "tall"] as const)("WRITING sign in LostWages, no panel, %s site", (w) => {
  const BLOG_SIGN = BLOG_SIGNS[w], site = () => at(w), SITE = PLATFORM_SITES[w];
  const isSignPost = (s: Solid) => s.kind === "prism" && s.mat === "steel" && near(s.w, 0.2) && near(s.d, 0.2);
  const frame = () => beams(site().out).filter((b) => near(b.w, 0.15) && near(b.from.z, b.to.z) && b.from.z >= 2.8 - 1e-9).sort((a, b) => a.from.z - b.from.z);
  const sea = () => { const s = BLOG_SIGN.backing.at(-1)!; if (s.kind !== "poly") throw new Error("sea"); return s; };
  /** Along-u coordinate of a world point, from the site centre. */
  const u = (p: { x: number; y: number }) => (p.x - SITE.x) * Math.SQRT1_2 - (p.y - SITE.y) * Math.SQRT1_2;
  it("BLOG_SIGNS[site]: WRITING in LostWages, cyan, capitals (x-height = cap) and the face as stroke, on one diagonal plane", () => {
    expect(BLOG_SIGN).toMatchObject({ id: "plataforma", text: "WRITING", size: WRITING_CAP, width: SIGN_FONT.width, color: "cyan", xHeight: WRITING_CAP, stroke: LOSTWAGES_FACE * WRITING_CAP });
    expect(BLOG_SIGN.facade).toBeUndefined();
    expect(BLOG_SIGN.glyphs.map((g) => g.char).join("")).toBe("WRITING");
    expect(BLOG_SIGN.glyphs).toHaveLength(7);
    const lay = marqueeLayout(WRITING_CAP, 0, LOSTWAGES_WRITING);
    BLOG_SIGN.glyphs.forEach((g, i) => {
      expect(g.plane.u.x).toBeCloseTo(Math.SQRT1_2, 12); expect(g.plane.u.y).toBeCloseTo(-Math.SQRT1_2, 12);
      expect(g.plane.v).toEqual({ x: 0, y: 0, z: 1 });
      expect(g.quads).toHaveLength(lay[i]!.quads.length);
    });
  });
  it("seaPlatformAt draws the sign from BLOG_SIGNS[site]: its cyan polys are the spec's triangles at 0.85", () => {
    const want = BLOG_SIGN.glyphs.flatMap((g) => g.quads).map((pts) => ({ kind: "poly", pts, color: "cyan", alpha: 0.85 }));
    expect(site().accents.filter((a) => a.kind === "poly")).toEqual(want);
  });
  it("no dark panel: the platform builds no officeDark poly", () => {
    expect(site().out.filter(isPanel)).toEqual([]);
    expect(BLOG_SIGN.backing.filter(isPanel)).toEqual([]);
  });
  it("the backing is the frame posts seaPlatformAt builds, as copies, plus one sea patch", () => {
    const posts = site().out.filter(isSignPost);
    expect(posts.length).toBeGreaterThanOrEqual(5);
    expect(BLOG_SIGN.backing.slice(0, -1)).toEqual(posts);
    posts.forEach((p, i) => expect(p).not.toBe(BLOG_SIGN.backing[i])); // copies: a consumer that mutates the layer must not reach BLOG_SIGNS
    expect(site().out).not.toContainEqual(sea()); // the sea patch is terrain the oracle sees, not a built solid
  });
  it("the sea patch is the water surface: its top at z −1, every cell under it is water", () => {
    const s = sea();
    expect(s.z + s.h).toBeCloseTo(-1, 9);
    const xs = s.footprint.map((q) => q.x), ys = s.footprint.map((q) => q.y), poly = s.footprint.flatMap((q) => [q.x, q.y]);
    let n = 0;
    // one probe per 1-u cell, at its centre: x = 570 (WORLD.x1, the wide site) is the seam between world and bleed, which no rendered cell centre hits
    for (let x = Math.floor(Math.min(...xs)) + 0.5; x <= Math.max(...xs); x++) for (let y = Math.floor(Math.min(...ys)) + 0.5; y <= Math.max(...ys); y++) {
      if (!pointInPolygon(x, y, poly)) continue;
      n++;
      expect(waterCellMat(x, y), `${x},${y}`).not.toBeNull();
    }
    expect(n).toBeGreaterThan(50);
    const cx = xs.reduce((a, b) => a + b, 0) / xs.length, cy = ys.reduce((a, b) => a + b, 0) / ys.length;
    expect(s.mat).toBe(waterCellMat(cx, cy));
  });
  it("cyan against the lightest tone of the sea patch's material stays ≥ 4.5 : 1", () => {
    expect(contrastRatio(ISO_COLORS.cyan, toneColor(sea().mat, "glow"))).toBeGreaterThanOrEqual(4.5);
  });
  it("…and of every water material, so the patch's single material sample cannot pick one that breaks it", () => {
    for (const m of WATER_MATS) expect(contrastRatio(ISO_COLORS.cyan, toneColor(m, "glow")), m).toBeGreaterThanOrEqual(4.5);
  });
  it("isSeaPatch tells the sea patch from the posts", () => {
    expect(BLOG_SIGN.backing.map(isSeaPatch)).toEqual([...BLOG_SIGN.backing.slice(0, -1).map(() => false), true]);
  });
  it("the sea patch lies under the word along the view: every glyph's ink box, grown by w, projects inside it", () => {
    const s = sea(), poly = s.footprint.map((q) => project({ x: q.x, y: q.y, z: s.z + s.h })).flatMap((q) => [q.x, q.y]), m = SIGN_FONT.width;
    for (const g of BLOG_SIGN.glyphs) {
      const { x0, y0, x1, y1 } = g.layout.box;
      for (const [a, b] of [[x0 - m, y0 - m], [x1 + m, y0 - m], [x1 + m, y1 + m], [x0 - m, y1 + m]] as const) {
        const p = project(toWorld(g.plane, a, b));
        expect(pointInPolygon(p.x, p.y, poly), g.char).toBe(true);
      }
    }
  });
  it("the beams clear every letter's ink, the loops below the baseline included, by ≥ 1.6", () => {
    const [lo, hi] = frame();
    for (const g of BLOG_SIGN.glyphs) {
      const z0 = g.plane.origin.z + g.layout.box.y0, z1 = g.plane.origin.z + g.layout.box.y1;
      expect(z0 - (lo!.from.z + 0.075), g.char).toBeGreaterThanOrEqual(1.6 - 1e-9);
      expect(hi!.from.z - 0.075 - z1, g.char).toBeGreaterThanOrEqual(1.6 - 1e-9);
    }
    expect(Math.min(...BLOG_SIGN.glyphs.map((g) => g.layout.box.y0))).toBeLessThan(0);
  });
  it("the frame is the ink width plus 1.5 on each end", () => {
    const G = BLOG_SIGN.glyphs, ink = G.at(-1)!.layout.box.x1 - G[0]!.layout.box.x0;
    for (const b of frame()) expect(Math.hypot(b.to.x - b.from.x, b.to.y - b.from.y)).toBeCloseTo(ink + 3, 9);
  });
  it("the posts stand just behind the letters' plane, not in front of the neon", () => {
    const k = (p: { x: number; y: number }) => p.x * N.x + p.y * N.y, plane = k(BLOG_SIGN.glyphs[0]!.plane.origin);
    for (const s of site().out.filter(isSignPost)) {
      if (s.kind !== "prism") throw new Error("post");
      const front = Math.max(...[[0, 0], [s.w, 0], [0, s.d], [s.w, s.d]].map(([dx, dy]) => k({ x: s.at.x + dx!, y: s.at.y + dy! })));
      expect(front).toBeLessThanOrEqual(plane - 0.06 + 1e-9);
    }
  });
  it("the hut and the mast stand past the ends of the frame", () => {
    const { out } = site(), half = (() => { const b = frame()[0]!; return Math.abs(u(b.from)); })();
    const hut = prisms(out).find((s) => s.mat === "boxGrey" && near(s.w, 2.4))!;
    const mast = out.find((s) => s.kind === "cylinder" && s.mat === "steel" && s.r === 0.15)!;
    if (mast.kind !== "cylinder") throw new Error("mast");
    expect(Math.min(...[[0, 0], [hut.w, 0], [0, hut.d], [hut.w, hut.d]].map(([dx, dy]) => Math.abs(u({ x: hut.at.x + dx!, y: hut.at.y + dy! }))))).toBeGreaterThan(half);
    expect(Math.abs(u(mast.at)) - 0.15).toBeGreaterThan(half);
  });
  it("seaPlatform is seaPlatformAt(site) moved by −PLATFORM_SITES[site], solid by solid and accent by accent", () => {
    const o = build(), s = site();
    // compared with a tolerance: rounding to 1e-9 hit a boundary case (a value at x.xxxxxxxx5)
    const r = (v: unknown) => JSON.parse(JSON.stringify(v)) as unknown;
    expectClose(r(o.out), r(s.out.map((x) => translate(x, -SITE.x, -SITE.y))));
    expectClose(r(o.accents), r(s.accents.map((x) => translateAccent(x, -SITE.x, -SITE.y))));
  });
});
