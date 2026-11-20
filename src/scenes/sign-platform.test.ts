import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { translate, translateAccent } from "../iso/translate";
import { tessellate, type Solid } from "../iso/solids";
import { Z_SCALE } from "../iso/project";
import { SIGN_FONT, staticContrast } from "../kit/legibility";
import { CHAINSAW_FACE, CHAINSAW_X, marqueeLayout } from "../kit/marquee";
import { CHAINSAW_WRITING } from "../kit/chainsaw-writing";
import { pointInPolygon } from "../map/geo";
import { waterCellMat } from "./terrain";
import { BLOG_SIGNS, BOARD_TOP, HEAVE, HEAVE_STEP, PAINT_LIFT, PLATFORM_DECK, PLATFORM_SITES, WRITING_CAP, heaveAt, seaPlatform, seaPlatformAt, signAt, type WritingSite } from "./sign-platform";

const at = (site: WritingSite, dz = 0) => { const out: Solid[] = [], accents: Accent[] = []; seaPlatformAt(out, accents, site, dz); return { out, accents }; };
/** The 8 phases of the heave cycle the pose tests sample (#444). */
const PHASES = Array.from({ length: 8 }, (_, k) => heaveAt((k * HEAVE.periodMs) / 8));
const build = () => { const out: Solid[] = [], accents: Accent[] = []; seaPlatform(out, accents); return { out, accents }; };
const boardOf = (out: Solid[]): Solid & { kind: "poly" } => { const b = out[0]!; if (b.kind !== "poly") throw new Error("board"); return b; };

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

describe("Writing board sites (#442)", () => {
  it("PLATFORM_SITES stay wide (570, 105, 0) and tall (440, 400, 0)", () => {
    expect(PLATFORM_SITES).toEqual({ wide: { x: 570, y: 105, z: 0 }, tall: { x: 440, y: 400, z: 0 } });
  });

  it("seaPlatform is seaPlatformAt(wide) moved by −PLATFORM_SITES.wide, solid by solid and accent by accent", () => {
    const o = build(), s = at("wide"), c = PLATFORM_SITES.wide;
    const r = (v: unknown) => JSON.parse(JSON.stringify(v)) as unknown;
    expectClose(r(o.out), r(s.out.map((x) => translate(x, -c.x, -c.y))));
    expectClose(r(o.accents), r(s.accents.map((x) => translateAccent(x, -c.x, -c.y))));
  });
});

describe.each(["wide", "tall"] as const)("Writing board at the %s site: a flat board floating on the water, WRITING painted on it (#442)", (site) => {
  const SITE = PLATFORM_SITES[site], SIGN = BLOG_SIGNS[site];

  it("one solid: an officeDark poly from the water (z −1) to BOARD_TOP, the same height everywhere; no posts, rails or frame", () => {
    const { out } = at(site);
    expect(out).toHaveLength(1);
    const b = boardOf(out);
    expect(b.mat).toBe("officeDark");
    expect(b.z).toBe(-1);
    expect(b.z + b.h).toBeCloseTo(BOARD_TOP, 12);
    expect(BOARD_TOP).toBe(-0.4);
  });

  it("the board is a rectangle along u = (1, −1)/√2 and n = (1, 1)/√2 centred on the site; PLATFORM_DECK is its plan at the origin", () => {
    const b = boardOf(at(site).out);
    expect(b.footprint).toHaveLength(4);
    const [p0, p1, p2, p3] = b.footprint as [typeof b.footprint[0], typeof b.footprint[0], typeof b.footprint[0], typeof b.footprint[0]];
    expect((p1.x - p0.x) + (p1.y - p0.y)).toBeCloseTo(0, 9); // p0→p1 along u
    expect((p2.x - p1.x) - (p2.y - p1.y)).toBeCloseTo(0, 9); // p1→p2 along n
    expect(p3.x - p0.x).toBeCloseTo(p2.x - p1.x, 9); expect(p3.y - p0.y).toBeCloseTo(p2.y - p1.y, 9);
    expect((p0.x + p2.x) / 2).toBeCloseTo(SITE.x, 9); expect((p0.y + p2.y) / 2).toBeCloseTo(SITE.y, 9);
    PLATFORM_DECK.forEach((q, i) => { expect(q.x).toBeCloseTo(b.footprint[i]!.x - SITE.x, 9); expect(q.y).toBeCloseTo(b.footprint[i]!.y - SITE.y, 9); });
  });

  it("BLOG_SIGNS[site]: WRITING in Chainsaw Carnage, cyan, filled, its shortest letter as x-height and its stem as stroke, backed by the board (copies)", () => {
    expect(SIGN).toMatchObject({ id: "plataforma", text: "WRITING", size: WRITING_CAP, width: SIGN_FONT.width, color: "cyan", xHeight: CHAINSAW_X * WRITING_CAP, stroke: CHAINSAW_FACE * WRITING_CAP });
    expect(WRITING_CAP).toBe(11.5);
    expect(SIGN.glyphs.map((g) => g.char).join("")).toBe("WRITING");
    const { out } = at(site);
    expect(SIGN.backing).toEqual(out);
    expect(out[0]).not.toBe(SIGN.backing[0]); // copies: a consumer that mutates the scene must not reach BLOG_SIGNS
    const built = boardOf(out), spec = boardOf([...SIGN.backing]);
    built.footprint.forEach((q, i) => expect(q).not.toBe(spec.footprint[i]));
    const lay = marqueeLayout(WRITING_CAP, 0, CHAINSAW_WRITING);
    for (const [i, g] of SIGN.glyphs.entries()) expect(g.quads).toHaveLength(lay[i]!.quads.length);
  });

  it("the letters' plane is horizontal and stretched along v by Z_SCALE so the word reads upright on screen (roofDiagonal)", () => {
    for (const g of SIGN.glyphs) {
      expect(g.plane.u.x).toBeCloseTo(Math.SQRT1_2, 12); expect(g.plane.u.y).toBeCloseTo(-Math.SQRT1_2, 12); expect(g.plane.u.z).toBe(0);
      expect(g.plane.v).toEqual({ x: -Z_SCALE, y: -Z_SCALE, z: 0 });
    }
  });

  it("the top face is flat: every paint vertex at exactly BOARD_TOP + PAINT_LIFT (0.02) and inside the board's plan", () => {
    const { out, accents } = at(site), plan = boardOf(out).footprint.flatMap((q) => [q.x, q.y]);
    expect(accents.length).toBeGreaterThan(0);
    for (const a of accents) {
      if (a.kind !== "poly") throw new Error(a.kind);
      for (const p of a.pts) {
        expect(Math.abs(p.z - (BOARD_TOP + 0.02))).toBeLessThan(1e-9);
        expect(pointInPolygon(p.x, p.y, plan)).toBe(true);
      }
    }
  });

  it("the board exceeds every letter's ink box by ≥ 1 w on every side", () => {
    const b = boardOf([...SIGN.backing]), plane = SIGN.glyphs[0]!.plane, w = SIGN_FONT.width;
    const along = b.footprint.map((q) => (q.x - plane.origin.x) * plane.u.x + (q.y - plane.origin.y) * plane.u.y);
    const across = b.footprint.map((q) => ((q.x - plane.origin.x) * plane.v.x + (q.y - plane.origin.y) * plane.v.y) / (plane.v.x ** 2 + plane.v.y ** 2));
    for (const g of SIGN.glyphs) {
      expect(g.layout.box.x0 - Math.min(...along), g.char).toBeGreaterThanOrEqual(w);
      expect(Math.max(...along) - g.layout.box.x1, g.char).toBeGreaterThanOrEqual(w);
      expect(g.layout.box.y0 - Math.min(...across), g.char).toBeGreaterThanOrEqual(w);
      expect(Math.max(...across) - g.layout.box.y1, g.char).toBeGreaterThanOrEqual(w);
    }
  });

  it("the board shows the camera its top face", () => {
    expect(tessellate(SIGN.backing[0]!).some((f) => f.mat === "officeDark" && f.normal.z > 0.99)).toBe(true);
  });

  it("seaPlatformAt paints the sign from BLOG_SIGNS[site]: its accents are the spec's triangles in cyan at 0.85, and nothing else (copies)", () => {
    const quads = SIGN.glyphs.flatMap((g) => g.quads), { accents } = at(site);
    expect(accents).toEqual(quads.map((pts) => ({ kind: "poly", pts, color: "cyan", alpha: 0.85 })));
    accents.forEach((a, i) => { if (a.kind === "poly") expect(a.pts[0]).not.toBe(quads[i]![0]); });
  });

  it("static contrast of the paint on the board is ≥ 7 : 1", () => {
    expect(staticContrast(SIGN)).toBeGreaterThanOrEqual(7);
  });

  it("every 1-u cell under the board's plan is water (cell centres)", () => {
    const b = boardOf(at(site).out), xs = b.footprint.map((q) => q.x), ys = b.footprint.map((q) => q.y), plan = b.footprint.flatMap((q) => [q.x, q.y]);
    let n = 0;
    for (let x = Math.floor(Math.min(...xs)) + 0.5; x <= Math.max(...xs); x++) for (let y = Math.floor(Math.min(...ys)) + 0.5; y <= Math.max(...ys); y++) {
      if (!pointInPolygon(x, y, plan)) continue;
      n++;
      expect(waterCellMat(x, y), `${x},${y}`).not.toBeNull();
    }
    expect(n).toBeGreaterThan(1000);
  });

  it("deterministic: two builds are equal", () => {
    expect(at(site)).toEqual(at(site));
  });
});

describe("heaveAt: the board's heave, a quantized slow sine (#444)", () => {
  const steps = (dz: number) => dz / HEAVE_STEP;
  it("HEAVE is ±0.15 u over 6.7 s, quantized to 0.01 u", () => {
    expect(HEAVE).toEqual({ amp: 0.15, periodMs: 6700 });
    expect(HEAVE_STEP).toBe(0.01);
  });

  it("periodic, bounded by amp and always a multiple of HEAVE_STEP", () => {
    for (let t = 0; t <= 2 * HEAVE.periodMs; t += 37) {
      expect(Math.abs(heaveAt(t) - heaveAt(t + HEAVE.periodMs)), `${t}`).toBeLessThanOrEqual(1e-9);
      expect(Math.abs(heaveAt(t)), `${t}`).toBeLessThanOrEqual(HEAVE.amp + 1e-12);
      expect(Math.abs(steps(heaveAt(t)) - Math.round(steps(heaveAt(t)))), `${t}`).toBeLessThanOrEqual(1e-9);
    }
  });

  it("starts at rest: heaveAt(0) === 0", () => {
    expect(heaveAt(0)).toBe(0);
  });

  it("takes at least 20 distinct values over a period sampled every 50 ms", () => {
    const seen = new Set<number>();
    for (let t = 0; t < HEAVE.periodMs; t += 50) seen.add(Math.round(steps(heaveAt(t))));
    expect(seen.size).toBeGreaterThanOrEqual(20);
  });

  it("a clock hours long keeps the cycle: heaveAt(1e9 · period + 1234) is heaveAt(1234)", () => {
    expect(Math.abs(heaveAt(1e9 * HEAVE.periodMs + 1234) - heaveAt(1234))).toBeLessThanOrEqual(1e-9);
  });
});

describe.each(["wide", "tall"] as const)("Writing board at the %s site across the heave cycle: one rigid body (#444)", (site) => {
  const rest = at(site), restBoard = boardOf(rest.out);

  it("signAt(site, 0) is BLOG_SIGNS[site]", () => {
    expect(signAt(site, 0)).toEqual(BLOG_SIGNS[site]);
    expect(signAt(site)).toEqual(BLOG_SIGNS[site]);
  });

  it.each(PHASES.map((dz, k) => [k, dz] as const))("phase %i/8: the board is raised by dz with the same thickness and plan", (_k, dz) => {
    const b = boardOf(at(site, dz).out);
    expect(Math.abs(b.z - (-1 + dz))).toBeLessThanOrEqual(1e-9);
    expect(Math.abs(b.z + b.h - (BOARD_TOP + dz))).toBeLessThanOrEqual(1e-9);
    expect(b.h).toBeCloseTo(restBoard.h, 12);
    expect(b.footprint).toEqual(restBoard.footprint);
    expect(b.mat).toBe("officeDark");
  });

  it.each(PHASES.map((dz, k) => [k, dz] as const))("phase %i/8: every paint vertex at BOARD_TOP + PAINT_LIFT + dz, inside the plan, at its rest (x, y)", (_k, dz) => {
    const { out, accents } = at(site, dz), plan = boardOf(out).footprint.flatMap((q) => [q.x, q.y]);
    expect(PAINT_LIFT).toBe(0.02);
    expect(accents).toHaveLength(rest.accents.length);
    accents.forEach((a, i) => {
      const r = rest.accents[i]!;
      if (a.kind !== "poly" || r.kind !== "poly") throw new Error(a.kind);
      a.pts.forEach((p, j) => {
        expect(Math.abs(p.z - (BOARD_TOP + PAINT_LIFT + dz))).toBeLessThanOrEqual(1e-9);
        expect(pointInPolygon(p.x, p.y, plan)).toBe(true);
        expect(p.x).toBe(r.pts[j]!.x); expect(p.y).toBe(r.pts[j]!.y);
      });
    });
  });

  it.each(PHASES.map((dz, k) => [k, dz] as const))("phase %i/8: signAt(site, dz) is backed by the posed board and paints what seaPlatformAt paints", (_k, dz) => {
    const sign = signAt(site, dz), { out, accents } = at(site, dz);
    expect(sign.backing).toEqual(out);
    expect(accents).toEqual(sign.glyphs.flatMap((g) => g.quads).map((pts) => ({ kind: "poly", pts, color: "cyan", alpha: 0.85 })));
  });
});
