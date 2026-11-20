import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { translate } from "../iso/translate";
import type { Solid } from "../iso/solids";
import { CHAINSAW_BAR, CHAINSAW_FACE, CHAINSAW_X } from "../kit/marquee";
import { SIGN_FONT, staticContrast } from "../kit/legibility";
import { groundDiagonal } from "../kit/lettering";
import { pointInPolygon } from "../map/geo";
import { raftAt } from "./raft";
import { waterCellMat } from "./terrain";
import * as platform from "./sign-platform";
import { BLOG_SIGNS, BOARD_TOP, HEAVE, HEAVE_STEP, PLATFORM_DECK, PLATFORM_SITES, REST_POSE, WRITING_CAP, heaveAt, seaPlatform, seaPlatformAt, signAt, type WritingSite } from "./sign-platform";

const pose = (dz: number) => ({ dz, pitch: 0, roll: 0 });
const at = (site: WritingSite, dz = 0) => { const out: Solid[] = []; seaPlatformAt(out, site, pose(dz)); return out; };
/** The 8 phases of the heave cycle the pose tests sample (#444). */
const PHASES = Array.from({ length: 8 }, (_, k) => heaveAt((k * HEAVE.periodMs) / 8));
const meshOf = (out: readonly Solid[]): Solid & { kind: "mesh" } => { const b = out[0]!; if (b.kind !== "mesh") throw new Error("raft"); return b; };

describe("Writing raft sites (#442, #454)", () => {
  it("PLATFORM_SITES stay wide (570, 105, 0) and tall (440, 400, 0)", () => {
    expect(PLATFORM_SITES).toEqual({ wide: { x: 570, y: 105, z: 0 }, tall: { x: 440, y: 400, z: 0 } });
  });

  it("seaPlatform is the wide raft moved by −PLATFORM_SITES.wide, and it leaves the accents alone", () => {
    const out: Solid[] = [], accents: Accent[] = [], c = PLATFORM_SITES.wide;
    seaPlatform(out, accents);
    expect(out).toEqual([translate(raftAt("wide"), -c.x, -c.y)]);
    expect(accents).toEqual([]);
  });

  it("PAINT_LIFT is gone", () => {
    expect("PAINT_LIFT" in platform).toBe(false);
  });
});

describe.each(["wide", "tall"] as const)("Writing raft at the %s site: planks floating on the water, WRITING as a navy decal (#454)", (site) => {
  const SITE = PLATFORM_SITES[site], SIGN = BLOG_SIGNS[site];

  it("seaPlatformAt pushes exactly one solid: the timber mesh raftAt(site, REST_POSE)", () => {
    const out = at(site);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "mesh", mat: "timber" });
    expect(out).toEqual([raftAt(site, REST_POSE)]);
    const def: Solid[] = [];
    seaPlatformAt(def, site);
    expect(def).toEqual(out);
  });

  it("BLOG_SIGNS[site] is a ground sign: navy decal, bar, cap 20, Chainsaw Carnage measures, no colour, backed by the raft", () => {
    expect(SIGN).toMatchObject({ id: "plataforma", text: "WRITING", size: WRITING_CAP, width: SIGN_FONT.width, decal: "navy", ground: true, xHeight: CHAINSAW_X * WRITING_CAP, stroke: CHAINSAW_FACE * WRITING_CAP, bar: CHAINSAW_BAR * WRITING_CAP });
    expect(WRITING_CAP).toBe(20);
    expect(SIGN.color).toBeUndefined();
    expect(SIGN.glyphs.map((g) => g.char).join("")).toBe("WRITING");
    expect(SIGN.backing).toEqual(at(site));
  });

  it("seaPlatformAt pushes a fresh mesh: mutating it leaves BLOG_SIGNS intact", () => {
    const before = JSON.stringify(SIGN.backing), m = meshOf(at(site));
    expect(m).not.toBe(SIGN.backing[0]);
    m.faces[0]!.pts[0]!.x += 100;
    m.faces.length = 0;
    expect(JSON.stringify(SIGN.backing)).toBe(before);
  });

  it("the letters' plane is groundDiagonal: u = (√½, −√½, 0), v = (−√½, −√½, 0) exactly", () => {
    const g = groundDiagonal({ x: 0, y: 0, z: 0 });
    for (const glyph of SIGN.glyphs) {
      expect(glyph.plane.u).toEqual(g.u);
      expect(glyph.plane.v).toEqual(g.v);
      expect(glyph.plane.origin.z).toBeCloseTo(BOARD_TOP, 12);
    }
  });

  it("static contrast of the navy decal on its plank is ≥ 7 : 1", () => {
    expect(staticContrast(SIGN)).toBeGreaterThanOrEqual(7);
  });

  it("every mesh vertex is at z ≤ BOARD_TOP", () => {
    for (const f of meshOf(at(site)).faces) for (const p of f.pts) expect(p.z).toBeLessThanOrEqual(BOARD_TOP + 1e-9);
  });

  it("PLATFORM_DECK, moved to the site, holds every vertex of the raft in plan", () => {
    const deck = PLATFORM_DECK.flatMap((q) => [q.x + SITE.x, q.y + SITE.y]);
    expect(PLATFORM_DECK).toHaveLength(4);
    for (const f of meshOf(at(site)).faces) for (const p of f.pts) {
      const c = { x: p.x + (SITE.x - p.x) * 1e-9, y: p.y + (SITE.y - p.y) * 1e-9 }; // nudged inward: vertices on the envelope's edge count
      expect(pointInPolygon(c.x, c.y, deck), `${p.x},${p.y}`).toBe(true);
    }
  });

  it("every 1-u cell under PLATFORM_DECK moved to the site is water (> 1500 cells)", () => {
    const deck = PLATFORM_DECK.map((q) => ({ x: q.x + SITE.x, y: q.y + SITE.y })), xs = deck.map((q) => q.x), ys = deck.map((q) => q.y), plan = deck.flatMap((q) => [q.x, q.y]);
    let n = 0;
    for (let x = Math.floor(Math.min(...xs)) + 0.5; x <= Math.max(...xs); x++) for (let y = Math.floor(Math.min(...ys)) + 0.5; y <= Math.max(...ys); y++) {
      if (!pointInPolygon(x, y, plan)) continue;
      n++;
      expect(waterCellMat(x, y), `${x},${y}`).not.toBeNull();
    }
    expect(n).toBeGreaterThan(1500);
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

describe.each(["wide", "tall"] as const)("Writing raft at the %s site across the heave cycle: one rigid body (#444, #454)", (site) => {
  const rest = meshOf(at(site));

  it("signAt(site, REST_POSE) is BLOG_SIGNS[site]", () => {
    expect(signAt(site, REST_POSE)).toEqual(BLOG_SIGNS[site]);
    expect(signAt(site)).toEqual(BLOG_SIGNS[site]);
  });

  it.each(PHASES.map((dz, k) => [k, dz] as const))("phase %i/8: every vertex is the rest one raised by dz", (_k, dz) => {
    const m = meshOf(at(site, dz));
    expect(m.faces).toHaveLength(rest.faces.length);
    m.faces.forEach((f, i) => f.pts.forEach((p, j) => {
      const r = rest.faces[i]!.pts[j]!;
      expect(Math.abs(p.x - r.x) + Math.abs(p.y - r.y)).toBeLessThanOrEqual(1e-9);
      expect(Math.abs(p.z - (r.z + dz))).toBeLessThanOrEqual(1e-9);
    }));
  });

  it.each(PHASES.map((dz, k) => [k, dz] as const))("phase %i/8: signAt is backed by seaPlatformAt at the same pose, its plane raised by dz", (_k, dz) => {
    const sign = signAt(site, pose(dz));
    expect(sign.backing).toEqual(at(site, dz));
    for (const g of sign.glyphs) expect(Math.abs(g.plane.origin.z - (BOARD_TOP + dz))).toBeLessThanOrEqual(1e-9);
  });
});
