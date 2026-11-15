import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { centroid, v3, type Vec3 } from "../iso/geometry";
import { bounds, type Solid } from "../iso/solids";
import { diagonalWall, measureText, roofDiagonal, strokeText, toWorld, xHeightPx } from "../kit/lettering";
import { neon } from "../kit/props";
import { ROOF_WORD_SIZE, TUBE_FRAME_CENTER, TUBE_WORD_SIZE, helipadSign, helipadTubeSign } from "./sign-helipad";

const build = (f: (out: Solid[], accents: Accent[]) => void) => { const out: Solid[] = [], accents: Accent[] = []; f(out, accents); return { out, accents }; };
const EPS = 1e-6, TOP = 32.9, D = v3(Math.SQRT1_2, -Math.SQRT1_2, 0);
const polys = (accents: Accent[]) => accents.flatMap((a) => (a.kind === "poly" ? [a] : []));
const dots = (accents: Accent[]) => accents.flatMap((a) => (a.kind === "dot" ? [a] : []));
const prisms = (out: Solid[]) => out.flatMap((s) => (s.kind === "prism" ? [s] : []));
const beams = (out: Solid[]) => out.flatMap((s) => (s.kind === "beam" ? [s] : []));
const len = (a: Vec3, b: Vec3) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
const overlap = (a: number, b: number, c: number, d: number) => Math.min(b, d) - Math.max(a, c);

/** Pairs whose bounds overlap by more than EPS on x, y and z, unless both are interlocked (the oracle of `src/kit/kit.test.ts`). */
function interpenetrations(solids: Solid[]): [number, number][] {
  const boxes = solids.map(bounds), out: [number, number][] = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    if (solids[i]!.interlocks && solids[j]!.interlocks) continue;
    const a = boxes[i]!, b = boxes[j]!;
    if ((["x", "y", "z"] as const).every((k) => overlap(a.min[k], a.max[k], b.min[k], b.max[k]) > EPS)) out.push([i, j]);
  }
  return out;
}

describe("helipad sign: common base (#361)", () => {
  for (const f of [helipadSign, helipadTubeSign]) {
    describe(f.name, () => {
      const { out, accents } = build(f);

      it("a 16 × 14 × 30 officeDark tower centered at the origin, with its 17 × 15 × 0.4 office cornice at z 30", () => {
        expect(out).toContainEqual(expect.objectContaining({ kind: "prism", at: v3(-8, -7, 0), w: 16, d: 14, h: 30, mat: "officeDark" }));
        expect(out).toContainEqual(expect.objectContaining({ kind: "prism", at: v3(-8.5, -7.5, 30), w: 17, d: 15, h: 0.4, mat: "office" }));
      });

      it("a 22 × 22 concrete slab above z 32 that contains the tower in plan", () => {
        const slabs = prisms(out).filter((s) => s.mat === "concrete" && s.w === 22 && s.d === 22);
        expect(slabs).toHaveLength(1);
        const b = bounds(slabs[0]!);
        expect(b.min.z).toBeGreaterThanOrEqual(32);
        expect(b.max.z).toBeCloseTo(TOP, 9);
        expect(b.min.x).toBeLessThanOrEqual(-8); expect(b.max.x).toBeGreaterThanOrEqual(8);
        expect(b.min.y).toBeLessThanOrEqual(-7); expect(b.max.y).toBeGreaterThanOrEqual(7);
      });

      it("four pillars and two beams under the slab, steel and interlocked", () => {
        const pillars = prisms(out).filter((s) => s.mat === "steel" && s.w === 0.6 && s.d === 0.6 && s.h === 2);
        expect(pillars.map((s) => [s.at.x + 0.3, s.at.y + 0.3, s.at.z]).sort()).toEqual([[-6, -5, 30.4], [-6, 5, 30.4], [6, -5, 30.4], [6, 5, 30.4]].sort());
        const under = beams(out).filter((b) => Math.abs(b.from.z - 32.1) < EPS && Math.abs(b.to.z - 32.1) < EPS);
        expect(under).toHaveLength(2);
        for (const s of [...pillars, ...under]) expect(s.interlocks).toBe(true);
      });

      it("a perimeter net: four steel prisms 0.12 thick, tops at z 33.5, on the slab's edges", () => {
        const net = prisms(out).filter((s) => s.mat === "steel" && Math.abs(s.at.z - TOP) < EPS && Math.abs(s.at.z + s.h - 33.5) < EPS && Math.min(s.w, s.d) === 0.12);
        expect(net).toHaveLength(4);
        const boxes = net.map(bounds);
        expect(boxes.some((b) => Math.abs(b.max.x - 11) < EPS && b.min.x > 10.8)).toBe(true);
        expect(boxes.some((b) => Math.abs(b.min.x + 11) < EPS && b.max.x < -10.8)).toBe(true);
        expect(boxes.some((b) => Math.abs(b.max.y - 11) < EPS && b.min.y > 10.8)).toBe(true);
        expect(boxes.some((b) => Math.abs(b.min.y + 11) < EPS && b.max.y < -10.8)).toBe(true);
      });

      it("the pad marks: a whitewash 16-sided disc r 9 on the slab and an 'H' of three prisms centered at (−3.5, −3.5)", () => {
        expect(out).toContainEqual(expect.objectContaining({ kind: "cylinder", at: v3(0, 0, TOP), r: 9, h: 0.05, mat: "whitewash", sides: 16 }));
        const h = prisms(out).filter((s) => s.mat === "whitewash" && s.h === 0.06);
        expect(h).toHaveLength(3);
        const bs = h.map(bounds), x0 = Math.min(...bs.map((b) => b.min.x)), x1 = Math.max(...bs.map((b) => b.max.x));
        const y0 = Math.min(...bs.map((b) => b.min.y)), y1 = Math.max(...bs.map((b) => b.max.y));
        expect((x0 + x1) / 2).toBeCloseTo(-3.5, 9);
        expect((y0 + y1) / 2).toBeCloseTo(-3.5, 9);
      });

      it("16 greenMid edge lights r 0.25 on the circle r 9.6 around the slab's center, every 22.5° from 11.25°", () => {
        const lights = dots(accents).filter((a) => a.color === "greenMid");
        expect(lights).toHaveLength(16);
        for (const a of lights) {
          expect(Math.abs(Math.hypot(a.at.x, a.at.y) - 9.6)).toBeLessThan(EPS);
          expect(a.r).toBe(0.25);
          expect(a.at.z).toBeCloseTo(32.95, 9);
        }
        const deg = lights.map((a) => ((Math.atan2(a.at.y, a.at.x) * 180) / Math.PI + 360) % 360).sort((a, b) => a - b);
        deg.forEach((d, k) => expect(d).toBeCloseTo(11.25 + k * 22.5, 6));
      });

      it("three amber floodlights and no cyan bulb", () => {
        expect(dots(accents).filter((a) => a.color === "amber")).toHaveLength(3);
        expect(accents.filter((a) => a.color === "cyan")).toHaveLength(0);
      });

      it("no two solids interpenetrate, save interlocked steel structure", () => {
        expect(interpenetrations(out)).toEqual([]);
        for (const s of out.filter((s) => s.interlocks)) {
          expect(s.mat).toBe("steel");
          expect(["beam", "prism"]).toContain(s.kind);
        }
      });

      it("deterministic", () => {
        expect(build(f)).toEqual(build(f));
      });
    });
  }
});

describe("helipad sign A: the anamorphic word on the pad (#361)", () => {
  const { accents } = build(helipadSign);
  const word = polys(accents);
  const { width: W } = measureText("Resume", ROOF_WORD_SIZE);
  const m = 10 - W / (2 * Math.SQRT2), origin = v3(m - D.x * W / 2, m - D.y * W / 2, 32.95);

  it("the largest cap height whose word rectangle fits the SE triangle inset 1 u (≈ 3.490)", () => {
    expect(ROOF_WORD_SIZE).toBeCloseTo(3.490, 3);
    const plane = roofDiagonal(origin), s = ROOF_WORD_SIZE;
    const [b0, b1, t0, t1] = [toWorld(plane, 0, 0), toWorld(plane, W, 0), toWorld(plane, 0, s), toWorld(plane, W, s)];
    for (const p of [b0, b1, t0, t1]) {
      expect(p.x).toBeLessThanOrEqual(10 + EPS);
      expect(p.y).toBeLessThanOrEqual(10 + EPS);
      expect(p.x + p.y).toBeGreaterThanOrEqual(Math.SQRT2 - EPS);
    }
    expect(Math.max(b0.x, b1.x)).toBeCloseTo(10, 6);
    expect(Math.max(b0.y, b1.y)).toBeCloseTo(10, 6);
    expect(t0.x + t0.y).toBeCloseTo(Math.SQRT2, 6);
    expect(t1.x + t1.y).toBeCloseTo(Math.SQRT2, 6);
  });

  it("every polygon of the word lies at z 32.95, its centroid in the SE half, in green tube and greenBleed halo", () => {
    expect(word.length).toBeGreaterThan(0);
    for (const a of word) {
      for (const p of a.pts) expect(Math.abs(p.z - 32.95)).toBeLessThan(EPS);
      const c = centroid(a.pts);
      expect(c.x + c.y).toBeGreaterThan(0);
      expect(["green", "greenBleed"]).toContain(a.color);
    }
    expect(word.filter((a) => a.color === "green")).toHaveLength(word.length / 2);
  });

  it("the tubes are strokeText('Resume') on roofDiagonal at the fitted size, stroke 0.8, through neon(q, 'green')", () => {
    const want = strokeText("Resume", roofDiagonal(origin), ROOF_WORD_SIZE, 0.8).flatMap((q) => neon(q, "green"));
    expect(word).toEqual(want);
  });
});

describe("helipad sign B: the rooftop tube sign (#361)", () => {
  const { out, accents } = build(helipadTubeSign);
  const word = polys(accents);
  const C = TUBE_FRAME_CENTER, L = measureText("Resume", 8.55).width + 2;
  const at = (s: number, z: number) => v3(C.x + D.x * s, C.y + D.y * s, z);

  it("the frame center is 10.56 u SE of the slab's center, where the slab chord is 10 u", () => {
    expect(C.x).toBeCloseTo(11 - 5 / Math.SQRT2, 9);
    expect(C.y).toBeCloseTo(11 - 5 / Math.SQRT2, 9);
  });

  it("cap height 8.55 meets x ≥ 10 px CSS at cover scale 1.17", () => {
    expect(TUBE_WORD_SIZE).toBe(8.55);
    expect(xHeightPx(8.55, 1.17)).toBeGreaterThanOrEqual(10);
    expect(xHeightPx(TUBE_WORD_SIZE, 1.17)).toBeGreaterThanOrEqual(10);
  });

  it("every polygon of the word is coplanar with a plane of normal (1, 1, 0)/√2; the tubes on the frame's plane", () => {
    expect(word.length).toBeGreaterThan(0);
    for (const a of word) {
      const k = a.pts[0]!.x + a.pts[0]!.y;
      for (const p of a.pts) expect(Math.abs(p.x + p.y - k)).toBeLessThan(EPS);
      expect(["green", "greenBleed"]).toContain(a.color);
    }
    for (const a of word.filter((a) => a.color === "green")) for (const p of a.pts) expect(Math.abs(p.x + p.y - 2 * C.x)).toBeLessThan(EPS);
    expect(accents.some((a) => a.kind === "poly" && a.pts.some((p) => Math.abs(p.z - 32.95) < EPS))).toBe(false);
  });

  it("the tubes are strokeText('Resume') on diagonalWall through the frame axis, baseline z 34.3, tube 1.0", () => {
    const { width } = measureText("Resume", TUBE_WORD_SIZE);
    const want = strokeText("Resume", diagonalWall(at(-width / 2, 34.3)), TUBE_WORD_SIZE, 1).flatMap((q) => neon(q, "green"));
    expect(word).toEqual(want);
  });

  it("frame: a lower beam at z 34.1 in two halves and an upper beam at z 43.65, steel 0.3², length L along (1, −1)", () => {
    const frame = beams(out).filter((b) => b.w === 0.3 && b.h === 0.3 && b.from.z === b.to.z && b.from.z > 34);
    const lower = frame.filter((b) => Math.abs(b.from.z - 34.1) < EPS), upper = frame.filter((b) => Math.abs(b.from.z - 43.65) < EPS);
    expect(lower).toHaveLength(2);
    expect(upper).toHaveLength(1);
    for (const b of frame) {
      expect(b.mat).toBe("steel");
      expect(b.interlocks).toBe(true);
      expect(Math.abs((b.to.x - b.from.x) + (b.to.y - b.from.y))).toBeLessThan(EPS); // along (1, −1)
      for (const p of [b.from, b.to]) expect(Math.abs(p.x + p.y - 2 * C.x)).toBeLessThan(EPS);
    }
    expect(lower.reduce((n, b) => n + len(b.from, b.to), 0)).toBeCloseTo(L, 9);
    expect(len(upper[0]!.from, upper[0]!.to)).toBeCloseTo(L, 9);
  });

  it("three steel posts 0.25² at s = −4, 0, +4 along the frame, from the slab up", () => {
    const posts = prisms(out).filter((s) => s.w === 0.25 && s.d === 0.25);
    expect(posts).toHaveLength(3);
    const want = [-4, 0, 4].map((s) => at(s, 0));
    for (const p of posts) {
      expect(p.mat).toBe("steel");
      expect(p.interlocks).toBe(true);
      expect(p.at.z).toBeCloseTo(TOP, 9);
      expect(p.at.z + p.h).toBeGreaterThanOrEqual(43.65 - EPS);
      const cx = p.at.x + 0.125, cy = p.at.y + 0.125;
      expect(want.some((w) => Math.hypot(w.x - cx, w.y - cy) < EPS)).toBe(true);
    }
  });

  it("two steel tensors 0.2² from each frame end at z 34.1 down to the slab's top edge, touching it", () => {
    const tensors = beams(out).filter((b) => b.w === 0.2);
    expect(tensors).toHaveLength(2);
    const ends = [at(-L / 2, 34.1), at(L / 2, 34.1)];
    const slab = bounds(prisms(out).find((s) => s.mat === "concrete")!);
    for (const t of tensors) {
      expect(t.mat).toBe("steel");
      expect(ends.some((e) => len(e, t.from) < EPS)).toBe(true);
      expect(t.to.z).toBeCloseTo(TOP, 9);
      const b = bounds(t);
      const ox = overlap(b.min.x, b.max.x, slab.min.x, slab.max.x), oy = overlap(b.min.y, b.max.y, slab.min.y, slab.max.y);
      expect(Math.min(ox, oy)).toBeLessThanOrEqual(EPS);
      expect(Math.min(ox, oy)).toBeGreaterThanOrEqual(-0.05);
    }
  });

  it("the frame ends fly beyond the slab in plan", () => {
    for (const s of [-L / 2, L / 2]) { const e = at(s, 0); expect(Math.max(Math.abs(e.x), Math.abs(e.y))).toBeGreaterThan(11); }
  });
});
