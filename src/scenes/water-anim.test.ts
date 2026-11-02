import { describe, expect, it } from "vitest";
import type { Tri } from "../iso/solids";
import { v3 } from "../iso/geometry";
import { project } from "../iso/project";
import { createRng } from "../map/seed";
import { buildTerrain } from "./terrain";
import { BANDS, CHOP, FOAM_STEP_MS, GLINT_H, SWELL, WATER_STEP_MS, createWaterAnim, foamOn, glintShape, glints, triHash, triNoise, waveField, waveTone } from "./water-anim";

const tri = (x: number, y: number, base = 0): Tri => ({ pts: [v3(x, y, -1), v3(x + 6, y, -1), v3(x + 6, y + 6, -1)], baseTone: base });
const tris = (s: { kind: string; tris?: Tri[] }) => (s.kind === "ground" ? s.tris! : []);

describe("water-anim", () => {
  it("the wave is periodic, bounded, and the background sea travels northwest", () => {
    const T = SWELL.T * CHOP.T / 500; // common multiple of the two periods (9000 and 5500): 99 000
    for (let k = 0; k < 200; k++) {
      const t = tri(k * 3, (k * 7) % 100, (k % 3) - 1);
      expect(waveField(t, "water", 1234)).toBeCloseTo(waveField(t, "water", 1234 + T), 6);
      for (let c = 0; c < SWELL.T; c += 250) {
        expect(Math.abs(waveField(t, "water", c))).toBeLessThan(1.5);
        const v = waveTone(t, "water", c);
        expect(v).toBeGreaterThanOrEqual(-2);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
    // the crest at s at time t is at s − λ/4 at t + T/4, with s the coordinate along k (travels against k: toward the NW)
    const dir = { x: SWELL.k.x, y: SWELL.k.y }, q = SWELL.lambda / 4;
    let towardNW = 0, towardSE = 0;
    for (let x = 0; x < 400; x += 6) {
      const a = waveField(tri(x, 0), "water", 0);
      towardNW += Math.abs(waveField(tri(x - q * dir.x, -q * dir.y), "water", SWELL.T / 4) - a);
      towardSE += Math.abs(waveField(tri(x + q * dir.x, q * dir.y), "water", SWELL.T / 4) - a);
    }
    expect(towardNW).toBeLessThan(towardSE);
  });
  it("on average the wave respects the baseTone (shore lighter than the deep edge) and the trench is calmer than the sea", () => {
    let sea = 0, abyss = 0, n = 0;
    const mean = (t: Tri): number => { let sum = 0, m = 0; for (let c = 0; c < SWELL.T; c += 50) { sum += waveTone(t, "water", c); m++; } return sum / m; };
    for (let k = 0; k < 300; k++) {
      expect(Math.abs(mean(tri(k * 5, k * 2, 0)))).toBeLessThan(0.45);
      expect(mean(tri(k * 5, k * 2, 1))).toBeGreaterThan(mean(tri(k * 5, k * 2, -1)) + 0.8);
      for (let c = 0; c < SWELL.T; c += 50) { sea += Math.abs(waveField(tri(k * 5, k * 2), "water", c)); abyss += Math.abs(waveField(tri(k * 5, k * 2), "abyss", c)); n++; }
    }
    expect(abyss / n).toBeLessThan(sea / n);
  });
  it("the crests are not straight: along a screen horizontal the tone changes often", () => {
    // With a single flat wave toward the NW, the crest was horizontal on screen (x − y constant) and
    // dozens of consecutive triangles shared a tone. Now, in 60 consecutive cells of the same
    // horizontal, there are equal runs but none long.
    let longest = 0;
    for (let clock = 0; clock < SWELL.T; clock += 900) {
      let run = 1;
      for (let k = 1; k < 60; k++) {
        const same = waveTone(tri(k * 6, k * 6), "waterDeep", clock) === waveTone(tri((k - 1) * 6, (k - 1) * 6), "waterDeep", clock);
        run = same ? run + 1 : 1;
        longest = Math.max(longest, run);
      }
    }
    expect(longest).toBeLessThan(9);
  });
  it("splits the water into six even, interleaved bands, paints one per step in rotation and moves the foam", () => {
    const terrain = buildTerrain(createRng(7));
    const a = createWaterAnim(terrain, { reducedMotion: false });
    const water = (k: number) => a.band(k).filter((s) => s.mat !== "glint");
    const sizes = Array.from({ length: BANDS }, (_, k) => water(k).reduce((n, s) => n + tris(s).length, 0));
    const total = terrain.water.reduce((n, s) => n + tris(s).length, 0);
    expect(sizes.reduce((x, y) => x + y, 0)).toBe(total);
    expect(Math.max(...sizes)).toBeLessThan(1.5 * Math.min(...sizes));
    // interleaved: each band covers the whole screen width, not a stripe
    const sx = (t: Tri) => project(t.pts[0]).x;
    const span = (ts: Tri[]) => Math.max(...ts.map(sx)) - Math.min(...ts.map(sx));
    const all = terrain.water.flatMap(tris);
    for (let k = 0; k < BANDS; k++) expect(span(water(k).flatMap(tris))).toBeGreaterThan(0.9 * span(all));
    expect(a.band(0).some((s) => tris(s).some((t) => (t.toneOffset ?? 0) !== 0))).toBe(true);
    const c1 = a.tick(WATER_STEP_MS), c2 = a.tick(WATER_STEP_MS), c3 = a.tick(WATER_STEP_MS), c4 = a.tick(WATER_STEP_MS), c5 = a.tick(WATER_STEP_MS), c6 = a.tick(WATER_STEP_MS);
    expect([c1, c2, c3, c4, c5, c6].map((c) => [...c.bands])).toEqual([[1], [2], [3], [4], [5], [0]]);
    expect(a.tick(FOAM_STEP_MS).foam).toBe(true);
    expect(a.foam()[0]!.mat).toBe("foam");
    const foam = tris(a.foam()[0]!);
    expect(foam.some((t) => t.toneOffset === -1)).toBe(true);
    expect(foam.filter((t) => t.toneOffset === 0).length).toBeGreaterThan(foam.length / 2);
  });
  it("the foam laps: each triangle alternates over the cycle and neighbors do not all move together", () => {
    const t = tri(200, 300);
    const states = new Set<boolean>();
    for (let c = 0; c < 5200; c += 100) states.add(foamOn(t, c));
    expect(states.size).toBe(2);
    let differ = 0;
    for (let k = 0; k < 40; k++) if (foamOn(tri(k * 6, 0), 0) !== foamOn(tri(k * 6 + 6, 0), 0)) differ++;
    expect(differ).toBeGreaterThan(3);
  });
  it("triHash spreads evenly mod 4 over the grid and does not fall into diagonal stripes; triNoise is in [−1, 1)", () => {
    const terrain = buildTerrain(createRng(7));
    const all = terrain.water.flatMap(tris);
    const counts = [0, 0, 0, 0];
    for (const t of all) { counts[triHash(t)]!++; expect(triNoise(t)).toBeGreaterThanOrEqual(-1); expect(triNoise(t)).toBeLessThan(1); }
    for (const n of counts) {
      const share = n / all.length;
      expect(share).toBeGreaterThan(0.15);
      expect(share).toBeLessThan(0.35);
    }
    let sameAsNeighbor = 0, checked = 0;
    for (let k = 0; k < 300; k++) {
      const a = tri(k * 6, 0), b = tri((k + 1) * 6, 6); // neighbors along a screen diagonal
      if (triHash(a) === triHash(b)) sameAsNeighbor++;
      checked++;
    }
    expect(sameAsNeighbor).toBeLessThan(0.4 * checked);
  });
  it("glints are small diamonds, horizontal on screen, inside the cell, and only where the wave is high", () => {
    const t = tri(30, 60);
    const [a, b] = glintShape(t, 2.2);
    const pts = [...a.pts, ...b.pts].map(project);
    const w = Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x)), h = Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y));
    const cell = project(v3(36, 60, -1)).x - project(v3(30, 66, -1)).x; // screen width of the cell (12 u)
    expect(w).toBeLessThan(0.7 * cell);
    expect(h).toBeLessThan(w / 4);
    for (const p of [...a.pts, ...b.pts]) { expect(p.x).toBeGreaterThan(30); expect(p.x).toBeLessThan(36); expect(p.y).toBeGreaterThan(60); expect(p.y).toBeLessThan(66); }
    for (let c = 0; c < SWELL.T; c += 50) {
      const g = glints(t, "water", c);
      if (g.length) { expect(waveField(t, "water", c)).toBeGreaterThanOrEqual(GLINT_H); expect(g).toHaveLength(2); expect(g.every((x) => x.toneOffset === 0 || x.toneOffset === 1)).toBe(true); }
    }
  });
  it("on the real terrain the glints are few and the bands carry them as glint material at the end", () => {
    const terrain = buildTerrain(createRng(7));
    const a = createWaterAnim(terrain, { reducedMotion: false });
    let glint = 0, water = 0;
    for (let k = 0; k < BANDS; k++) {
      const band = a.band(k);
      expect(band[band.length - 1]!.mat).toBe("glint");
      for (const s of band) if (s.mat === "glint") glint += tris(s).length / 2; else water += tris(s).length;
    }
    expect(glint / water).toBeLessThan(0.08);
    expect(glint / water).toBeGreaterThan(0.005);
  });
});
