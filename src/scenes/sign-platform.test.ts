import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { translate, translateAccent } from "../iso/translate";
import { bounds, tessellate, type Solid } from "../iso/solids";
import { SIGN_FONT } from "../kit/legibility";
import { layoutText } from "../kit/lettering";
import { neon } from "../kit/props";
import { BLOG_SIGN, PLATFORM_SITE, SIGN_SIZE, SIGN_TUBE, seaPlatform, seaPlatformAt } from "./sign-platform";

const build = () => { const out: Solid[] = [], accents: Accent[] = []; seaPlatform(out, accents); return { out, accents }; };
const near = (a: number, b: number) => Math.abs(a - b) <= 1e-6;
const prisms = (out: Solid[]) => out.flatMap((s) => (s.kind === "prism" ? [s] : []));
const beams = (out: Solid[]) => out.flatMap((s) => (s.kind === "beam" ? [s] : []));
const isPile = (s: Solid) => s.kind === "cylinder" && s.mat === "steel" && s.at.z === -1;
const isDeck = (s: Solid) => s.kind === "prism" && s.mat === "deck";

describe("sea platform (#363)", () => {
  it("the piles stand in the water: the piece starts at z −1, six steel piles r 0.3 from z −1 to 1.2", () => {
    const { out } = build();
    expect(Math.min(...out.map((s) => bounds(s).min.z))).toBeCloseTo(-1, 9);
    const steel = out.filter((s) => s.kind === "cylinder" && s.mat === "steel");
    const piles = steel.filter((s) => s.kind === "cylinder" && s.r === 0.3 && s.at.z === -1 && near(s.at.z + s.h, 1.2));
    expect(piles).toHaveLength(6);
  });

  it("the six pile centers sit 0.6 inside the deck edge: x ∈ {−6.4, 0, 6.4} × y ∈ {−5.4, 5.4}", () => {
    const piles = build().out.filter((s) => isPile(s) && s.kind === "cylinder");
    const want = [-6.4, 0, 6.4].flatMap((x) => [-5.4, 5.4].map((y) => ({ x, y })));
    for (const { x, y } of want) expect(piles.some((s) => s.kind === "cylinder" && near(s.at.x, x) && near(s.at.y, y))).toBe(true);
    expect(piles).toHaveLength(6);
  });

  it("a 14 × 12 deck prism with its top at z 1.6", () => {
    const decks = prisms(build().out).filter((s) => s.mat === "deck" && s.w === 14 && s.d === 12);
    expect(decks).toHaveLength(1);
    expect(decks[0]!.at.z + decks[0]!.h).toBeCloseTo(1.6, 9);
  });

  it("at least 10 railing posts 0.15² h 1 on the deck along the S and E edges", () => {
    const posts = prisms(build().out).filter((s) => s.mat === "steel" && near(s.w, 0.15) && near(s.d, 0.15) && near(s.h, 1) && near(s.at.z, 1.6));
    expect(posts.filter((s) => near(s.at.x, 7 - 0.15) || near(s.at.y, 6 - 0.15)).length).toBeGreaterThanOrEqual(10);
  });

  it("a ladder off the E edge: steel beams from the deck top z 1.6 down to z −0.6", () => {
    const rails = beams(build().out).filter((b) => b.mat === "steel" && near(Math.min(b.from.z, b.to.z), -0.6) && near(Math.max(b.from.z, b.to.z), 1.6));
    expect(rails.length).toBeGreaterThanOrEqual(2);
    for (const r of rails) expect(Math.min(r.from.x, r.to.x)).toBeGreaterThanOrEqual(7);
  });

  it("a handrail per railing span at z 2.5, the boxGrey hut 2.4 × 1.8 × 1.4 and the steel mast r 0.15 h 4 on the deck", () => {
    const { out } = build();
    expect(beams(out).filter((b) => b.mat === "steel" && near(b.from.z, 2.5) && near(b.to.z, 2.5) && near(b.w, 0.1))).toHaveLength(13);
    expect(prisms(out).filter((s) => s.mat === "boxGrey" && near(s.w, 2.4) && near(s.d, 1.8) && near(s.h, 1.4) && near(s.at.z, 1.6))).toHaveLength(1);
    expect(out.filter((s) => s.kind === "cylinder" && s.mat === "steel" && s.r === 0.15 && s.h === 4 && near(s.at.z, 1.6))).toHaveLength(1);
  });

  it("exactly one cyan dot (the beacon, z ≥ 5.5) and one cyanMid dot (the hut light)", () => {
    const dots = build().accents.flatMap((a) => (a.kind === "dot" ? [a] : []));
    const cyan = dots.filter((d) => d.color === "cyan");
    expect(cyan).toHaveLength(1);
    expect(cyan[0]!.at.z).toBeGreaterThanOrEqual(5.5);
    expect(dots.filter((d) => d.color === "cyanMid")).toHaveLength(1);
  });

  it("the sign polygons are cyan neon at 0.75 (tube) and 0.45 (halo), each on a plane of normal (1, 1, 0)/√2; the tubes on the frame's plane", () => {
    const { out, accents } = build();
    const polys = accents.flatMap((a) => (a.kind === "poly" ? [a] : []));
    expect(polys.length).toBeGreaterThan(0);
    for (const a of polys) {
      expect(["cyan", "cyanBleed"]).toContain(a.color);
      expect(a.alpha).toBeCloseTo(a.color === "cyan" ? 0.75 : 0.45, 12);
      const k = a.pts[0]!.x + a.pts[0]!.y;
      for (const p of a.pts) expect(Math.abs(p.x + p.y - k)).toBeLessThan(1e-9);
    }
    const frame = beams(out).filter((b) => b.mat === "steel" && near(b.w, 0.15) && near(b.from.z, b.to.z) && b.from.z >= 2.8 - 1e-9);
    expect(frame).toHaveLength(2);
    expect(Math.min(...frame.map((b) => b.from.z))).toBeCloseTo(2.8, 9);
    const plane = (frame[0]!.from.x + frame[0]!.to.x + frame[0]!.from.y + frame[0]!.to.y) / 2;
    for (const b of frame) expect((b.from.x + b.to.x + b.from.y + b.to.y) / 2).toBeCloseTo(plane, 9);
    for (const a of polys.filter((p) => p.color === "cyan")) expect(a.pts[0]!.x + a.pts[0]!.y).toBeCloseTo(plane, 9);
  });

  it("the two sign posts 0.2² stand on the deck, inside it in plan", () => {
    const posts = prisms(build().out).filter((s) => s.mat === "steel" && near(s.w, 0.2) && near(s.d, 0.2));
    expect(posts).toHaveLength(2);
    for (const s of posts) {
      expect(s.at.z).toBeCloseTo(1.6, 9);
      expect(s.at.x).toBeGreaterThanOrEqual(-7);
      expect(s.at.x + s.w).toBeLessThanOrEqual(7);
      expect(s.at.y).toBeGreaterThanOrEqual(-6);
      expect(s.at.y + s.d).toBeLessThanOrEqual(6);
    }
  });

  it("the common sign measure: SIGN_SIZE and SIGN_TUBE are SIGN_FONT (#376)", () => {
    expect([SIGN_SIZE, SIGN_TUBE]).toEqual([SIGN_FONT.size, SIGN_FONT.width]);
  });

  it("no solid interpenetrates another (boxes disjoint on x, y or z within 1e-6), except the piles with the deck", () => {
    const { out } = build();
    const boxes = out.map(bounds), bad: string[] = [];
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
      const a = out[i]!, b = out[j]!;
      if ((isPile(a) && isDeck(b)) || (isPile(b) && isDeck(a))) continue;
      const A = boxes[i]!, B = boxes[j]!;
      if ((["x", "y", "z"] as const).every((k) => Math.min(A.max[k], B.max[k]) - Math.max(A.min[k], B.min[k]) > 1e-6)) bad.push(`${i} ${a.kind}/${a.mat} × ${j} ${b.kind}/${b.mat}`);
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

describe("Blog sign at SIGN_FONT, with its backing panel (#376)", () => {
  it("PLATFORM_SITE is (400, 170, 0)", () => {
    expect(PLATFORM_SITE).toEqual({ x: 400, y: 170, z: 0 });
  });
  it("BLOG_SIGN: Blog, SIGN_FONT, cyan, stroke quads of the layout, on one diagonal plane", () => {
    expect(BLOG_SIGN).toMatchObject({ id: "plataforma", text: "Blog", size: SIGN_FONT.size, width: SIGN_FONT.width, color: "cyan" });
    expect(BLOG_SIGN.facade).toBeUndefined();
    expect(BLOG_SIGN.glyphs.map((g) => g.char)).toEqual(["B", "l", "o", "g"]);
    const lay = layoutText("Blog", SIGN_FONT.size, SIGN_FONT.width);
    BLOG_SIGN.glyphs.forEach((g, i) => {
      expect(g.plane.u.x).toBeCloseTo(Math.SQRT1_2, 12); expect(g.plane.u.y).toBeCloseTo(-Math.SQRT1_2, 12);
      expect(g.plane.v).toEqual({ x: 0, y: 0, z: 1 });
      expect(g.quads).toHaveLength(lay[i]!.quads.length);
    });
  });
  it("seaPlatformAt draws the sign from BLOG_SIGN: its cyan accents are the spec's quads through neon(…, 0.75)", () => {
    const want = BLOG_SIGN.glyphs.flatMap((g) => g.quads).flatMap((q) => neon(q, "cyan", 0.75));
    const got = site().accents.filter((a) => a.kind === "poly" && (a.color === "cyan" || a.color === "cyanBleed"));
    expect(got).toEqual(want);
  });
  it("the backing is one officeDark poly, the same one seaPlatformAt builds", () => {
    expect(BLOG_SIGN.backing).toHaveLength(1);
    expect(isPanel(BLOG_SIGN.backing[0]!)).toBe(true);
    const panels = site().out.filter(isPanel);
    expect(panels).toEqual(BLOG_SIGN.backing);
  });
  it("the panel is 0.3 thick, 0.06 behind the tube plane", () => {
    const p = BLOG_SIGN.backing[0]!;
    if (p.kind !== "poly") throw new Error("panel");
    const tube = BLOG_SIGN.glyphs[0]!.quads[0]![0]!, k = tube.x * N.x + tube.y * N.y;
    const ks = p.footprint.map((q) => q.x * N.x + q.y * N.y);
    expect(Math.max(...ks)).toBeCloseTo(k - 0.06, 9);
    expect(Math.min(...ks)).toBeCloseTo(k - 0.36, 9);
  });
  it("the panel exceeds every letter's ink box, the g's descender included, by ≥ 1 w on every side", () => {
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
