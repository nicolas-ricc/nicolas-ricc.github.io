import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { convexHull, v3 } from "../iso/geometry";
import { hullsOverlap } from "../iso/depth";
import { project } from "../iso/project";
import { bounds, tessellateAll, type Solid } from "../iso/solids";
import { translate, translateAccent } from "../iso/translate";
import { SIGN_FONT } from "../kit/legibility";
import { toWorld } from "../kit/lettering";
import { MARQUEE_FACE, marqueeLayout } from "../kit/marquee";
import { TOWER, TOWER_H } from "./city-grid";
import { CROWN_CAP, CROWN_SITE, CROWN_TRACKING, RESUME_SIGN, towerCrown, towerStandIn } from "./sign-crown";

const EPS = 1e-6, R2 = Math.SQRT1_2;
const N = v3(R2, R2, 0), U = v3(R2, -R2, 0);
const build = (f: (out: Solid[], accents: Accent[]) => void) => { const out: Solid[] = [], accents: Accent[] = []; f(out, accents); return { out, accents }; };
const crown = build((o, a) => towerCrown(o, a, CROWN_SITE));
const piece = build((o, a) => { towerStandIn(o, a); towerCrown(o, a, v3(0, 0, TOWER_H)); });

const at = CROWN_SITE, pp = v3(at.x + 4 * N.x, at.y + 4 * N.y, at.z);
const INK = RESUME_SIGN.glyphs.map((g) => g.layout.box), W = INK.at(-1)!.x1 - INK[0]!.x0, L = W + 6;
const PANEL_Z0 = at.z + 3.2, BASE = PANEL_Z0 + 2.7, PANEL_Z1 = BASE + CROWN_CAP + 2.7;
const along = (p: { x: number; y: number }) => (p.x - pp.x) * U.x + (p.y - pp.y) * U.y; // t along U from pp
const across = (p: { x: number; y: number }) => (p.x - pp.x) * N.x + (p.y - pp.y) * N.y; // offset along N from pp
const CORNICE = { x0: TOWER.x - 0.5, y0: TOWER.y - 0.5, x1: TOWER.x + TOWER.w + 0.5, y1: TOWER.y + TOWER.d + 0.5 };
const ROOM = { x0: TOWER.x + 5, y0: TOWER.y + 5, x1: TOWER.x + 11, y1: TOWER.y + 9 };

const of = <K extends Solid["kind"]>(out: Solid[], kind: K) => out.flatMap((s) => (s.kind === kind ? [s as Extract<Solid, { kind: K }>] : []));
const dots = (accents: Accent[]) => accents.flatMap((a) => (a.kind === "dot" ? [a] : []));
const polys = (accents: Accent[]) => accents.flatMap((a) => (a.kind === "poly" ? [a] : []));
const overlap = (a: number, b: number, c: number, d: number) => Math.min(b, d) - Math.max(a, c);

/**
 * The oracle of `src/kit/kit.test.ts` (box overlap > EPS on x, y and z, interlocked pairs excused), refined for diagonal solids:
 * a pair whose boxes overlap counts only if the plan convex hulls of their tessellated points also overlap (#378: the diagonal panel's box covers the whole rooftop).
 */
function interpenetrations(solids: Solid[]): string[] {
  const boxes = solids.map(bounds), hull = (s: Solid) => convexHull(tessellateAll(s).flatMap((f) => f.pts.map((p) => ({ x: p.x, y: p.y })))), out: string[] = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = solids[i]!, b = solids[j]!;
    if (a.interlocks && b.interlocks) continue;
    const A = boxes[i]!, B = boxes[j]!;
    if (!(["x", "y", "z"] as const).every((k) => overlap(A.min[k], A.max[k], B.min[k], B.max[k]) > EPS)) continue;
    if (hullsOverlap(hull(a), hull(b))) out.push(`${i} ${a.kind}/${a.mat} × ${j} ${b.kind}/${b.mat}`);
  }
  return out;
}

const panel = of(crown.out, "poly").filter((s) => s.mat === "glass");
const slab = of(crown.out, "cylinder").filter((s) => s.mat === "concrete");

describe("tower crown: the sign (#378)", () => {
  it("CROWN_SITE is the center of the real tower's rooftop, (129, 227, 30)", () => {
    expect(CROWN_SITE).toEqual(v3(TOWER.x + TOWER.w / 2, TOWER.y + TOWER.d / 2, TOWER_H));
    expect(CROWN_SITE).toEqual(v3(129, 227, 30));
  });

  it("RESUME_SIGN: 'RESUME' in Neon Light marquee letters, green, capitals (x-height = cap) and the face as stroke", () => {
    expect(RESUME_SIGN).toMatchObject({ id: "cartel-torre", text: "RESUME", size: CROWN_CAP, width: SIGN_FONT.width, color: "greenMid", xHeight: CROWN_CAP, stroke: MARQUEE_FACE * CROWN_CAP });
    expect(RESUME_SIGN.glyphs.map((g) => g.char).join("")).toBe("RESUME");
    for (const g of RESUME_SIGN.glyphs) expect(g.quads.length).toBe(g.layout.fill.length);
    for (const g of RESUME_SIGN.glyphs) for (const q of g.quads) expect(q).toHaveLength(3);
  });

  it("the word is centered on the panel and its baseline sits 2.7 above the panel's bottom", () => {
    const ends = [toWorld(RESUME_SIGN.glyphs[0]!.plane, INK[0]!.x0, 0), toWorld(RESUME_SIGN.glyphs[0]!.plane, INK.at(-1)!.x1, 0)];
    expect(along(ends[0]!)).toBeCloseTo(-W / 2, 9); expect(along(ends[1]!)).toBeCloseTo(W / 2, 9);
    expect(ends[0]!.z).toBeCloseTo(BASE, 9);
  });

  it("one warm bulb dot per marquee bulb, on the letter plane", () => {
    const bulbs = dots(crown.accents).filter((d) => d.color === "windowWarm");
    expect(bulbs).toHaveLength(marqueeLayout(CROWN_CAP, CROWN_TRACKING).reduce((n, g) => n + g.bulbs.length, 0));
    for (const d of bulbs) expect(Math.abs(across(d.at))).toBeLessThan(EPS);
  });

  it("one dark glass panel along (1, −1), 0.6 thick, its south-east face 0.06 behind the letters; it is the sign's backing", () => {
    expect(panel).toHaveLength(1);
    const p = panel[0]!;
    expect(RESUME_SIGN.backing).toEqual([p]);
    const t = p.footprint.map(along), n = p.footprint.map(across);
    expect(Math.min(...t)).toBeCloseTo(-L / 2, 9); expect(Math.max(...t)).toBeCloseTo(L / 2, 9);
    expect(Math.max(...n)).toBeCloseTo(-0.06, 9); expect(Math.min(...n)).toBeCloseTo(-0.66, 9);
    expect(p.z).toBeCloseTo(PANEL_Z0, 9);
    expect(p.z + p.h).toBeCloseTo(PANEL_Z1, 9);
  });

  it("the panel clears the real machine room: it starts above its top plus the lower beam", () => {
    expect(panel[0]!.z).toBeGreaterThanOrEqual(at.z + 2.9 + 0.3 - 1e-9);
  });

  it("the panel holds every glyph's ink box grown by 1 w", () => {
    const p = panel[0]!, w = SIGN_FONT.width;
    for (const g of RESUME_SIGN.glyphs) {
      const { x0, y0, x1, y1 } = g.layout.box;
      for (const [a, b] of [[x0 - w, y0 - w], [x1 + w, y0 - w], [x1 + w, y1 + w], [x0 - w, y1 + w]] as const) {
        const q = toWorld(g.plane, a, b);
        expect(q.z).toBeGreaterThanOrEqual(p.z); expect(q.z).toBeLessThanOrEqual(p.z + p.h);
        expect(Math.abs(along(q))).toBeLessThanOrEqual(L / 2);
      }
    }
  });

  it("the letters: the fill quads of RESUME_SIGN as greenMid alpha-1 polys, coplanar 0.06 in front of the panel, no halo", () => {
    const green = polys(crown.accents).filter((a) => a.color === "greenMid");
    expect(green.map((a) => a.pts)).toEqual(RESUME_SIGN.glyphs.flatMap((g) => g.quads));
    for (const a of green) {
      expect(a.alpha).toBe(1);
      for (const q of a.pts) expect(Math.abs(across(q))).toBeLessThan(EPS);
    }
    expect(crown.accents.filter((a) => a.color === "greenBleed" || a.color === "cyan")).toHaveLength(0);
    expect(polys(crown.accents)).toHaveLength(green.length);
  });
});

describe("tower crown: structure and helipad (#378)", () => {
  const steel = crown.out.filter((s) => s.mat === "steel");
  const posts = of(crown.out, "prism").filter((s) => s.mat === "steel" && s.w === 0.3 && s.d === 0.3);
  const pillars = of(crown.out, "prism").filter((s) => s.mat === "steel" && s.w === 0.6 && s.d === 0.6 && s.at.z === at.z + 0.4);

  it("one 16-sided concrete slab r 7, 0.5 thick, centered on the rooftop, above the upper beam", () => {
    expect(slab).toHaveLength(1);
    const s = slab[0]!;
    expect(s).toMatchObject({ r: 7, h: 0.5, sides: 16 });
    expect(s.at.x).toBeCloseTo(at.x, 9); expect(s.at.y).toBeCloseTo(at.y, 9);
    expect(s.at.z).toBeGreaterThanOrEqual(PANEL_Z1 + 0.3);
    for (const o of crown.out.filter((o) => o.mat === "concrete")) expect(bounds(o).max.z).toBeLessThanOrEqual(s.at.z + s.h + EPS);
  });

  it("on screen the slab stays above the band 1 w over the letters' ink (dense check, every 0.05 u)", () => {
    const s = slab[0]!, ring = Array.from({ length: s.sides! }, (_, k) => project(v3(s.at.x + s.r * Math.cos((2 * Math.PI * k) / s.sides!), s.at.y + s.r * Math.sin((2 * Math.PI * k) / s.sides!), s.at.z)));
    const inkTop = Math.max(...RESUME_SIGN.glyphs.map((g) => toWorld(g.plane, 0, g.layout.box.y1).z)), bandZ = inkTop + SIGN_FONT.width;
    let margin = Infinity;
    for (let t = -W / 2 - SIGN_FONT.width; t <= W / 2 + SIGN_FONT.width; t += 0.05) {
      const p = project(v3(pp.x + U.x * t, pp.y + U.y * t, bandZ));
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i]!, b = ring[(i + 1) % ring.length]!;
        if (a.x === b.x || (a.x - p.x) * (b.x - p.x) > 0) continue;
        margin = Math.min(margin, p.y - (a.y + ((p.x - a.x) * (b.y - a.y)) / (b.x - a.x)));
      }
    }
    expect(margin).toBeGreaterThan(0.2);
  });

  it("three 0.3² posts behind the panel at t = −5, 0, 5, from the cornice top to the slab, on the rooftop and off the machine room", () => {
    expect(posts).toHaveLength(3);
    const ts = posts.map((p) => along({ x: p.at.x + 0.15, y: p.at.y + 0.15 })).sort((a, b) => a - b);
    ts.forEach((t, k) => expect(t).toBeCloseTo([-5, 0, 5][k]!, 9));
    for (const p of posts) {
      expect(across({ x: p.at.x + 0.15, y: p.at.y + 0.15 })).toBeCloseTo(-0.66 - 0.15 * Math.SQRT2, 9);
      expect(p.at.z).toBeCloseTo(at.z + 0.4, 9);
      expect(p.at.z + p.h).toBeCloseTo(slab[0]!.at.z, 9);
    }
  });

  it("two 0.6² pillars in the NW half, from the cornice top to the slab", () => {
    expect(pillars).toHaveLength(2);
    for (const p of pillars) {
      expect(p.at.x + 0.3 + p.at.y + 0.3).toBeLessThan(at.x + at.y);
      expect(p.at.z + p.h).toBeCloseTo(slab[0]!.at.z, 9);
    }
  });

  it("posts and pillars stand on the cornice top, clear of the machine room and of the antenna", () => {
    for (const p of [...posts, ...pillars]) {
      const b = bounds(p);
      expect(b.min.x).toBeGreaterThanOrEqual(CORNICE.x0); expect(b.max.x).toBeLessThanOrEqual(CORNICE.x1);
      expect(b.min.y).toBeGreaterThanOrEqual(CORNICE.y0); expect(b.max.y).toBeLessThanOrEqual(CORNICE.y1);
      expect(Math.min(overlap(b.min.x, b.max.x, ROOM.x0, ROOM.x1), overlap(b.min.y, b.max.y, ROOM.y0, ROOM.y1))).toBeLessThanOrEqual(EPS);
      expect(Math.min(overlap(b.min.x, b.max.x, at.x - 0.3, at.x + 0.3), overlap(b.min.y, b.max.y, at.y - 0.3, at.y + 0.3))).toBeLessThanOrEqual(EPS);
    }
  });

  it("two 0.3² beams along the panel's lower and upper edges, L long", () => {
    const beams = of(crown.out, "beam").filter((b) => b.w === 0.3 && b.h === 0.3);
    expect(beams).toHaveLength(2);
    const zs = beams.map((b) => b.from.z).sort((a, b) => a - b);
    expect(zs[0]).toBeCloseTo(PANEL_Z0 - 0.15, 9); expect(zs[1]).toBeCloseTo(PANEL_Z1 + 0.15, 9);
    for (const b of beams) {
      expect(b.to.z).toBeCloseTo(b.from.z, 9);
      expect(Math.hypot(b.to.x - b.from.x, b.to.y - b.from.y)).toBeCloseTo(L, 9);
      expect(Math.abs(along(b.from) + along(b.to))).toBeLessThan(EPS);
      expect(across(b.from)).toBeCloseTo(-0.36, 9); expect(across(b.to)).toBeCloseTo(-0.36, 9);
    }
  });

  it("two 0.2² tensors from the lower beam's ends down to the nearest cornice corner, resting on its top", () => {
    const tensors = of(crown.out, "beam").filter((b) => b.w === 0.2);
    expect(tensors).toHaveLength(2);
    const lower = of(crown.out, "beam").find((b) => b.w === 0.3 && Math.abs(b.from.z - (PANEL_Z0 - 0.15)) < EPS)!;
    for (const t of tensors) {
      expect([lower.from, lower.to].some((e) => Math.hypot(e.x - t.from.x, e.y - t.from.y, e.z - t.from.z) < EPS)).toBe(true);
      // the nearest cornice point, moved inward by the half section so the foot does not overhang the cornice
      const clamp = (v: number, lo: number, hi: number) => (v > hi ? hi - 0.1 : v < lo ? lo + 0.1 : v);
      expect(t.to.x).toBeCloseTo(clamp(t.from.x, CORNICE.x0, CORNICE.x1), 9); expect(t.to.y).toBeCloseTo(clamp(t.from.y, CORNICE.y0, CORNICE.y1), 9);
      expect(Math.abs(bounds(t).min.z - (at.z + 0.4))).toBeLessThan(EPS);
    }
  });

  it("the pad: whitewash disc r 5.5 and an 'H' of three whitewash prisms 0.06 high centered on the rooftop", () => {
    const pad = slab[0]!.at.z + 0.5;
    expect(crown.out).toContainEqual(expect.objectContaining({ kind: "cylinder", at: v3(at.x, at.y, pad), r: 5.5, h: 0.05, sides: 16, mat: "whitewash" }));
    const h = of(crown.out, "prism").filter((s) => s.mat === "whitewash");
    expect(h).toHaveLength(3);
    const bs = h.map(bounds);
    for (const b of bs) { expect(b.min.z).toBeCloseTo(pad + 0.05, 9); expect(b.max.z - b.min.z).toBeCloseTo(0.06, 9); }
    expect((Math.min(...bs.map((b) => b.min.x)) + Math.max(...bs.map((b) => b.max.x))) / 2).toBeCloseTo(at.x, 9);
    expect((Math.min(...bs.map((b) => b.min.y)) + Math.max(...bs.map((b) => b.max.y))) / 2).toBeCloseTo(at.y, 9);
  });

  it("16 greenMid edge lights r 0.25 on one circle, every 22.5°", () => {
    const lights = dots(crown.accents).filter((a) => a.color === "greenMid");
    expect(lights).toHaveLength(16);
    const r = Math.hypot(lights[0]!.at.x - at.x, lights[0]!.at.y - at.y);
    expect(r).toBeLessThan(7);
    for (const a of lights) {
      expect(a.r).toBe(0.25);
      expect(a.at.z).toBeCloseTo(lights[0]!.at.z, 9);
      expect(Math.hypot(a.at.x - at.x, a.at.y - at.y)).toBeCloseTo(r, 9);
    }
    const deg = lights.map((a) => (((Math.atan2(a.at.y - at.y, a.at.x - at.x) * 180) / Math.PI) + 360) % 360).sort((a, b) => a - b);
    deg.forEach((d, k) => expect(d - deg[0]!).toBeCloseTo(k * 22.5, 6));
  });

  it("a perimeter net of 16 steel beams 0.12 × 0.6 on the slab's edge", () => {
    const net = of(crown.out, "beam").filter((b) => b.w === 0.12 && b.h === 0.6);
    expect(net).toHaveLength(16);
    for (const b of net) for (const p of [b.from, b.to]) expect(Math.hypot(p.x - at.x, p.y - at.y)).toBeLessThanOrEqual(7);
  });

  it("two amber floodlights on 1-high steel posts in the slab's NW half, and no cyan bulb", () => {
    const amber = dots(crown.accents).filter((a) => a.color === "amber");
    expect(amber).toHaveLength(2);
    for (const a of amber) expect(a.at.x + a.at.y).toBeLessThan(at.x + at.y);
    const lampPosts = of(crown.out, "prism").filter((s) => s.mat === "steel" && s.w === 0.6 && s.h === 1);
    expect(lampPosts).toHaveLength(2);
    for (const p of lampPosts) expect(p.at.z).toBeCloseTo(slab[0]!.at.z + 0.5, 9);
    const lights = dots(crown.accents).filter((a) => a.color === "greenMid");
    for (const p of lampPosts) for (const l of lights) { // no edge light sits on a lamp post
      const dx = Math.max(p.at.x - l.at.x, 0, l.at.x - (p.at.x + p.w)), dy = Math.max(p.at.y - l.at.y, 0, l.at.y - (p.at.y + p.d));
      expect(Math.hypot(dx, dy)).toBeGreaterThan(l.r);
    }
  });

  it("no two solids interpenetrate, alone or on the stand-in tower; only steel interlocks", () => {
    expect(interpenetrations(crown.out)).toEqual([]);
    expect(interpenetrations(piece.out)).toEqual([]);
    for (const s of crown.out.filter((s) => s.interlocks)) expect(s.mat).toBe("steel");
    expect(steel.length).toBeGreaterThan(0);
  });

  it("deterministic", () => {
    expect(build((o, a) => towerCrown(o, a, CROWN_SITE))).toEqual(crown);
  });

  it("built at (0, 0, 30) and moved by CROWN_SITE it is the crown at the site", () => {
    const moved = build((o, a) => towerCrown(o, a, v3(0, 0, TOWER_H)));
    const out = moved.out.map((s) => translate(s, at.x, at.y)), accents = moved.accents.map((a) => translateAccent(a, at.x, at.y));
    const close = (x: unknown, y: unknown): void => {
      if (typeof x === "number") { expect(x).toBeCloseTo(y as number, 9); return; }
      if (x && typeof x === "object") { expect(Object.keys(x).sort()).toEqual(Object.keys(y as object).sort()); for (const k of Object.keys(x)) close((x as Record<string, unknown>)[k], (y as Record<string, unknown>)[k]); return; }
      expect(x).toEqual(y);
    };
    close({ out, accents }, crown);
  });
});

describe("tower stand-in (#378)", () => {
  const { out, accents } = build(towerStandIn);

  it("the tower the crown was audited on in #378, at the origin: body, cornice, machine room and antenna, no facade, no lights", () => {
    expect(accents).toEqual([]);
    expect(out).toEqual([
      expect.objectContaining({ kind: "prism", at: v3(-8, -7, 0), w: 16, d: 14, h: 30, mat: "officeDark" }),
      expect.objectContaining({ kind: "prism", at: v3(-8.5, -7.5, 30), w: 17, d: 15, h: 0.4, mat: "office" }),
      expect.objectContaining({ kind: "prism", at: v3(-3, -2, 30.4), w: 6, d: 4, h: 2.5, mat: "officeDark" }),
      expect.objectContaining({ kind: "cylinder", at: v3(0, 0, 32.9), r: 0.3, h: 5, mat: "steel", sides: 4 }),
    ]);
    for (const s of out) expect("facade" in s && s.facade).toBeFalsy();
  });

  it("moved to the rooftop center it matches src/city/fixed.ts's tower (TOWER, TOWER_H)", () => {
    const moved = out.map((s) => translate(s, at.x, at.y)).map(bounds);
    expect(moved[0]).toEqual({ min: v3(TOWER.x, TOWER.y, 0), max: v3(TOWER.x + TOWER.w, TOWER.y + TOWER.d, TOWER_H) });
    expect(moved[2]).toEqual({ min: v3(ROOM.x0, ROOM.y0, TOWER_H + 0.4), max: v3(ROOM.x1, ROOM.y1, TOWER_H + 2.9) });
  });
});
