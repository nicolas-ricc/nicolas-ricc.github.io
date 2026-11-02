import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import type { Plate } from "../iso/plate";
import { bounds, isFlat, tessellate, tessellateAll, type Bounds, type Solid } from "../iso/solids";
import { BUFFER_H, BUFFER_X, CROSSING, FENCE_Y, GAUGE, HEAD, ISLAND, LADDER, RAIL_W, RAIL_Z, SIDE, SIGNALS, STATION, STOP_X, TRACK_X0, TRACKS_Y, TRAIN_CLEAR, PARKED, station, building, HALL, WING_N, WING_S, LINK, SERVICE, TOWER, PORTICO, ESPLANADE } from "./station";
import { emu, trainLen } from "./train";

const build = (): { out: Solid[]; accents: Accent[] } => { const out: Solid[] = [], accents: Accent[] = []; station(out, accents); return { out, accents }; };
const { out, accents } = build();
const raised = out.filter((s) => !isFlat(s));
const prisms = out.filter((s): s is Solid & { kind: "prism" } => s.kind === "prism");
const strips = out.filter((s): s is Solid & { kind: "strip" } => s.kind === "strip");
const ramps = out.filter((s): s is Solid & { kind: "ramp" } => s.kind === "ramp");
const beams = out.filter((s): s is Solid & { kind: "beam" } => s.kind === "beam");
const dots = accents.filter((a): a is Accent & { kind: "dot" } => a.kind === "dot");
// body of a car of the parked train (#279)
const isCar = (p: Solid & { kind: "prism" }) => p.mat === "whitewash" && p.w === 11 && p.d === 3.4 && p.h === 4 && p.at.z === 1;
const box = (p: Solid & { kind: "prism" }) => [p.at.x, p.at.y, p.at.z, p.w, p.d, p.h];
const sorted = <T>(xs: T[]) => [...xs].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const range = (from: number, to: number, step: number, cond: (x: number) => boolean): number[] => { const r: number[] = []; for (let x = from; x <= to && cond(x); x += step) r.push(x); return r; };
const apart = (a: Bounds, b: Bounds) =>
  a.max.x <= b.min.x + 1e-9 || b.max.x <= a.min.x + 1e-9 || a.max.y <= b.min.y + 1e-9 || b.max.y <= a.min.y + 1e-9 || a.max.z <= b.min.z + 1e-9 || b.max.z <= a.min.z + 1e-9;
const flatBox = (x0: number, y0: number, x1: number, y1: number, z0 = -1, z1 = 100): Bounds => ({ min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 } });
const horizontal = (s: Solid & { kind: "strip" }, y: number, x0: number, x1: number) =>
  s.path.length === 2 && close(s.path[0]!.y, y) && close(s.path[1]!.y, y) && close(Math.min(s.path[0]!.x, s.path[1]!.x), x0) && close(Math.max(s.path[0]!.x, s.path[1]!.x), x1);
const SLEEPERS: number[][] = [range(136, 158, 4, (x) => x < BUFFER_X - 1), range(123, 158, 4, (x) => x < BUFFER_X - 1), range(110, 158, 4, () => true)];
const CANOPIES = [{ x0: 125, x1: 158, p: ISLAND, cols: [127.5, 132.5, 137.5, 142.5, 147.5, 152.5, 157.5], lights: [130, 140, 150] },
  { x0: 138, x1: 158, p: SIDE, cols: [140.5, 145.5, 150.5, 155.5], lights: [143, 153] }];

describe("station: constants (contract with the children of #239)", () => {
  it("exact values from the issue", () => {
    expect(STATION).toEqual({ x0: 100, y0: 80, x1: 197, y1: 142 });
    expect([GAUGE, RAIL_W, RAIL_Z]).toEqual([3, 0.5, 0.05]);
    expect(TRACKS_Y).toEqual([112.5, 122.5, 132.5]);
    expect(TRACK_X0).toEqual([134, 121, 104]);
    expect(LADDER).toEqual([{ x: 108, y: 132.5 }, { x: 134, y: 112.5 }]);
    expect([BUFFER_X, BUFFER_H, STOP_X]).toEqual([160, 1.2, 158]);
    expect(ISLAND).toEqual({ x0: 123, x1: 160, y0: 125.5, y1: 129.5 });
    expect(SIDE).toEqual({ x0: 136, x1: 160, y0: 104, y1: 108.5 });
    expect(HEAD).toEqual({ x0: 161.5, x1: 166, y0: 104, y1: 131 });
    expect(FENCE_Y).toBe(136);
    expect(CROSSING).toEqual({ x0: 100, x1: 108, north: { x: 99.4, y: 128.6, h: 3 }, south: { x: 108.3, y: 137.6, h: 2 } });
    expect(SIGNALS).toEqual({ in: { x: 96, y: 129.6 }, out: { x: 118, y: 129.6 } });
    expect(TRAIN_CLEAR).toEqual({ y0: 130.8, y1: 134.2, x1: STOP_X });
  });
});

describe("station", () => {
  it("is deterministic", () => {
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });

  it("everything falls in STATION (x 96..197.3, y 80..142) and nothing raised west of the building goes past z 6", () => {
    expect(out.length).toBeGreaterThan(50);
    for (const s of out) {
      const b = bounds(s), where = JSON.stringify(s).slice(0, 120);
      // 197.3: the esplanade railing (#278, "esplanade ↔ quay"); the quay starts at 198
      expect(b.min.x, where).toBeGreaterThanOrEqual(96 - 1e-9); expect(b.max.x, where).toBeLessThanOrEqual(STATION.x1 + 0.3 + 1e-9);
      expect(b.min.y, where).toBeGreaterThanOrEqual(STATION.y0 - 1e-9); expect(b.max.y, where).toBeLessThanOrEqual(STATION.y1 + 1e-9);
    }
    for (const s of raised) if (bounds(s).min.x < 166) expect(bounds(s).max.z).toBeLessThanOrEqual(6);
  });

  it("tracks: rails from TRACK_X0 to BUFFER_X at axis ±1.5, sleepers every 4 u and third rail at axis + 2.1", () => {
    TRACKS_Y.forEach((axis, i) => {
      const x0 = TRACK_X0[i]!;
      for (const dy of [-GAUGE / 2, GAUGE / 2]) {
        expect(strips.filter((s) => s.mat === "rail" && s.width === RAIL_W && s.z === RAIL_Z && horizontal(s, axis + dy, x0, BUFFER_X)), `track ${i + 1} ${dy}`).toHaveLength(1);
      }
      const sleepers = prisms.filter((p) => p.mat === "rust" && p.w === 1 && p.d === 5 && p.h === 0.3 && p.at.z === 0 && p.at.y === axis - 2.5);
      expect(sleepers.map((p) => p.at.x).sort((a, b) => a - b), `sleepers track ${i + 1}`).toEqual(SLEEPERS[i]);
      const third = strips.filter((s) => s.mat === "whitewash" && s.width === 0.3 && s.z === 0.05 && horizontal(s, axis + 2.1, Math.max(x0, CROSSING.x1), BUFFER_X));
      expect(third, `third rail track ${i + 1}`).toHaveLength(1);
    });
    expect(SLEEPERS[2]![0]).toBe(110); expect(SLEEPERS[2]!.at(-1)).toBe(158);
  });

  it("the third rail does not cross the level crossing (no point with x < 108)", () => {
    const whites = strips.filter((s) => s.mat === "whitewash");
    expect(whites).toHaveLength(3);
    for (const s of whites) for (const p of s.path) expect(p.x).toBeGreaterThanOrEqual(CROSSING.x1);
  });

  it("fan: two diagonal rails from LADDER[0] to LADDER[1], offset ±1.5 perpendicular", () => {
    const diag = strips.filter((s) => s.mat === "rail" && s.path.length === 2 && !close(s.path[0]!.y, s.path[1]!.y));
    expect(diag).toHaveLength(2);
    const [a, b] = LADDER, len = Math.hypot(b.x - a.x, b.y - a.y), n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
    const offsets = diag.map((s) => {
      const [p, q] = [...s.path].sort((u, v) => u.x - v.x) as [{ x: number; y: number }, { x: number; y: number }];
      const op = (p.x - a.x) * n.x + (p.y - a.y) * n.y, oq = (q.x - b.x) * n.x + (q.y - b.y) * n.y;
      expect(op).toBeCloseTo(oq, 9);
      expect((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)).toBeCloseTo(0, 9); // without shifting along
      expect(s.width).toBe(RAIL_W);
      return op;
    });
    expect(offsets.map(Math.abs)).toEqual([expect.closeTo(1.5, 9), expect.closeTo(1.5, 9)]);
    expect(Math.sign(offsets[0]!)).not.toBe(Math.sign(offsets[1]!));
    expect(prisms.filter((p) => p.mat === "rust" && p.h === 0.3 && !TRACKS_Y.some((y) => p.at.y === y - 2.5))).toEqual([]); // no sleepers on the diagonal
  });

  it("concrete platforms h 1 with yellow stripes on the track side and railing on the cross platform", () => {
    const platforms = prisms.filter((p) => p.mat === "concrete" && p.h === 1 && p.at.z === 0).map(box);
    expect(sorted(platforms)).toEqual(sorted([ISLAND, SIDE, HEAD].map((p) => [p.x0, p.y0, 0, p.x1 - p.x0, p.y1 - p.y0, 1])));
    const safety = prisms.filter((p) => p.mat === "safety" && p.at.z === 1 && p.h === 0.15).map(box);
    expect(sorted(safety)).toEqual(sorted([
      [123, 125.5, 1, 37, 0.3, 0.15], [123, 129.2, 1, 37, 0.3, 0.15],
      [136, 108.2, 1, 24, 0.3, 0.15],
      [161.5, 104, 1, 0.3, 27, 0.15],
    ]));
    expect(prisms.filter((p) => p.mat === "canopy" && p.at.z === 1).map(box)).toEqual([[165.8, 104, 1, 0.2, 27, 1]]);
  });

  it("canopies: low gable, columns every 5 u, trusses, fascias and cyanMid lights", () => {
    for (const c of CANOPIES) {
      const ym = (c.p.y0 + c.p.y1) / 2, half = (c.p.y1 - c.p.y0) / 2;
      const mine = ramps.filter((r) => r.mat === "canopy" && r.at.x === c.x0 && r.w === c.x1 - c.x0 && r.at.z === 4.2 && r.h === 0.5 && r.d === half);
      expect(sorted(mine.map((r) => [r.at.y, r.dir]))).toEqual(sorted([[c.p.y0, "n"], [ym, "s"]]));
      const cols = prisms.filter((p) => p.mat === "steel" && p.w === 0.3 && p.d === 0.3 && p.at.z === 1 && close(p.at.z + p.h, 4.2) && close(p.at.y, ym - 0.15));
      expect(cols.map((p) => p.at.x + 0.15).sort((a, b) => a - b).map((x) => Math.round(x * 1e6) / 1e6)).toEqual(c.cols);
      for (const x of c.cols) {
        const truss = beams.filter((b) => close(b.from.x, x) && close(b.to.x, x));
        const tie = truss.filter((b) => b.from.z === 4 && b.to.z === 4 && b.w === 0.2 && b.h === 0.2);
        expect(tie, `tie x ${x}`).toHaveLength(1);
        expect([Math.min(tie[0]!.from.y, tie[0]!.to.y), Math.max(tie[0]!.from.y, tie[0]!.to.y)]).toEqual([c.p.y0, c.p.y1]);
        expect(truss.filter((b) => b !== tie[0]), `diagonals x ${x}`).toHaveLength(2);
        for (const b of truss) expect(bounds(b).max.z).toBeLessThanOrEqual(4.2 + 1e-9); // under the base of the ramps
      }
      const fascia = prisms.filter((p) => p.mat === "whitewash" && p.h === 0.25 && p.at.y === c.p.y1 && p.at.x === c.x0 && p.w === c.x1 - c.x0);
      expect(fascia, "south fascia").toHaveLength(1);
      expect(close(fascia[0]!.at.z + fascia[0]!.h, 4.2)).toBe(true);
      for (const r of mine) expect(tessellate(r).some((f) => f.mat === "whitewash" && f.normal.x > 0), `east fascia ${r.dir}`).toBe(true);
      for (const r of mine) { // the east plate goes on the half of the wall taller than 0.25 (A3)
        const east = (r.plates ?? []).filter((p) => p.wall === 1 && p.mat === "whitewash");
        expect(east.map((p) => [p.u0, p.u1, p.z0, p.z1]), `east fascia ${r.dir}`).toEqual([r.dir === "n" ? [0.5, 1, 4.2, 4.45] : [0, 0.5, 4.2, 4.45]]);
      }
      const lights = dots.filter((d) => d.color === "cyanMid" && d.at.y === ym && d.at.z === 3.9 && d.r === 0.8).map((d) => d.at.x).sort((a, b) => a - b);
      expect(lights).toEqual(c.lights);
    }
    expect(prisms.filter((p) => p.mat === "canopy" && p.at.z === 3.5).map(box)).toEqual([[161.5, 104, 3.5, 4.5, 27, 0.3]]);
    const headCols = prisms.filter((p) => p.mat === "steel" && p.at.x === 161.8 && p.w === 0.3 && p.d === 0.3 && p.at.z === 1 && close(p.h, 2.5));
    expect(headCols.map((p) => p.at.y).sort((a, b) => a - b)).toEqual([104, 110, 116, 122, 128]);
    expect(sorted(dots.filter((d) => d.color === "cyanMid" && d.at.z === 3.4).map((d) => [d.at.x, d.at.y]))).toEqual(sorted([[163.75, 109], [163.75, 119], [163.75, 129]]));
    expect(dots.filter((d) => d.color === "cyanMid")).toHaveLength(8);
  });

  it("buffers: three at x 160..161.5, h 1.2, safety/asphalt stripes on east and south, magenta light", () => {
    const buffers = prisms.filter((p) => p.mat === "steel" && p.at.x === BUFFER_X && p.w === 1.5 && p.h === BUFFER_H && p.at.z === 0);
    expect(sorted(buffers.map((p) => [p.at.y, p.d]))).toEqual(sorted(TRACKS_Y.map((y) => [y - 1.5, 3])));
    for (const b of buffers) {
      for (const wall of [1, 2]) {
        const ps = (b.plates ?? []).filter((p) => p.wall === wall && p.shape === "rect").sort((p, q) => p.u0 - q.u0);
        expect(ps.map((p) => p.mat), `wall ${wall}`).toEqual(["safety", "asphalt", "safety", "asphalt"]);
        expect(ps.map((p) => [p.u0, p.u1, p.z0, p.z1]), `stripes ${wall}`).toEqual([0, 1, 2, 3].map((k) => [k / 4, (k + 1) / 4, 0, BUFFER_H]));
      }
    }
    const reds = dots.filter((d) => d.color === "magenta");
    expect(sorted(reds.map((d) => [d.at.x, d.at.y, d.at.z, d.r]))).toEqual(sorted(TRACKS_Y.map((y) => [160.75, y, 1.5, 0.35])));
  });

  it("south fence at FENCE_Y, h ≤ 1, and nothing else south of track 3 except the level crossing", () => {
    expect(prisms.filter((p) => p.mat === "steel" && p.at.y === FENCE_Y).map(box)).toEqual([[110, 136, 0, 50, 0.3, 1]]);
    const south = raised.filter((s) => bounds(s).min.y > TRAIN_CLEAR.y1 && bounds(s).min.x >= CROSSING.x1 + 1);
    expect(south.map((s) => s.kind === "prism" && box(s))).toEqual([[110, 136, 0, 50, 0.3, 1]]);
  });

  it("signals: steel post 0.3 h 3.5 under an asphalt head 0.5×0.5×1.2 anchored at SIGNALS", () => {
    for (const s of [SIGNALS.in, SIGNALS.out]) {
      expect(prisms.filter((p) => p.mat === "steel" && close(p.at.x, s.x + 0.1) && close(p.at.y, s.y + 0.1)).map(box)).toEqual([[s.x + 0.1, s.y + 0.1, 0, 0.3, 0.3, 3.5]]);
      expect(prisms.filter((p) => p.mat === "asphalt" && p.at.x === s.x && p.at.y === s.y).map(box)).toEqual([[s.x, s.y, 3.5, 0.5, 0.5, 1.2]]);
    }
  });

  it("level crossing: deck planks, two posts and two low barriers of four signal/whitewash segments", () => {
    expect(sorted(prisms.filter((p) => p.mat === "deck").map(box))).toEqual(sorted([
      [100, 131.3, 0, 8, 2.4, 0.3], [100, 129.6, 0, 8, 1.1, 0.3], [100, 134.3, 0, 8, 1.1, 0.3],
    ]));
    for (const post of [CROSSING.north, CROSSING.south]) {
      expect(prisms.filter((p) => p.mat === "steel" && p.at.x === post.x && p.at.y === post.y).map(box)).toEqual([[post.x, post.y, 0, 0.3, 0.3, post.h]]);
    }
    for (const [y, from, to] of [[128.75, 99.7, 107.7], [137.75, 108.3, 100.3]] as const) {
      const arm = beams.filter((b) => b.from.y === y && b.to.y === y && b.from.z === 1 && b.to.z === 1);
      expect(arm.every((b) => b.w === 0.25 && b.h === 0.25)).toBe(true);
      const xs = arm.map((b) => [Math.min(b.from.x, b.to.x), Math.max(b.from.x, b.to.x), b.mat] as const).sort((a, b) => (from < to ? a[0] - b[0] : b[0] - a[0]));
      expect(xs).toHaveLength(4);
      expect(xs.map((s) => s[2])).toEqual(["signal", "whitewash", "signal", "whitewash"]); // from the post
      const lo = Math.min(from, to), hi = Math.max(from, to);
      expect(Math.min(...xs.map((s) => s[0]))).toBeCloseTo(lo, 9); expect(Math.max(...xs.map((s) => s[1]))).toBeCloseTo(hi, 9);
      for (const s of xs) expect(s[1] - s[0]).toBeCloseTo((hi - lo) / 4, 9);
    }
    const crossingSouth = raised.filter((s) => { const b = bounds(s); return b.min.x < CROSSING.x1 + 1 && b.max.x > CROSSING.x0 - 1 && b.min.y > TRAIN_CLEAR.y1; });
    for (const s of crossingSouth) {
      const b = bounds(s);
      if (b.max.z > 1.125 + 1e-9) expect(s.kind === "prism" && s.at.x === CROSSING.south.x && s.at.y === CROSSING.south.y).toBe(true);
    }
  });

  it("occlusion: no tall static solid ends up in front of the train (rules of §6.2)", () => {
    let south = 0, east = 0;
    for (const s of raised) {
      const b = bounds(s), where = JSON.stringify(b);
      if (b.max.z - b.min.z <= 0.4) continue;
      if (b.min.y > TRAIN_CLEAR.y1) { south++; expect(b.min.y - 1.4 * b.max.z, where).toBeGreaterThanOrEqual(134.5 - 1e-9); }
      if (b.min.x >= TRAIN_CLEAR.x1 && b.max.y > TRAIN_CLEAR.y0) { east++; expect(b.min.x - b.max.y >= 27.2 - 1e-9 || b.min.x - 1.4 * b.max.z >= 158 - 1e-9, where).toBe(true); }
      if (b.min.y <= TRAIN_CLEAR.y1 && b.max.y > TRAIN_CLEAR.y0) expect(b.min.x, `over track 3: ${where}`).toBeGreaterThanOrEqual(BUFFER_X);
    }
    expect(south).toBeGreaterThanOrEqual(2); // fence and south post (the south barrier measures 0.25)
    expect(east).toBeGreaterThanOrEqual(3);  // buffer of track 3, cross platform and its railing
  });
});

describe("station: consist parked on track 2 (#279)", () => {
  const bodies = prisms.filter(isCar);
  const parked = emu(STOP_X - trainLen(PARKED.cars), TRACKS_Y[PARKED.track], { cars: PARKED.cars, lead: null, lit: true });
  it("three cars with axis on track 2, between TRACK_X0[1] and STOP_X", () => {
    expect(PARKED).toEqual({ track: 1, cars: 3 });
    expect(bodies).toHaveLength(3);
    for (const b of bodies) {
      expect(close(b.at.y + 1.7, TRACKS_Y[1])).toBe(true);
      expect(b.at.x).toBeGreaterThanOrEqual(TRACK_X0[1]);
      expect(b.at.x + b.w).toBeLessThanOrEqual(STOP_X);
    }
    const couplers = prisms.filter((p) => p.mat === "safety" && p.w === 0.5 && p.d === 0.6 && p.h === 0.4);
    expect(couplers).toHaveLength(2);
    expect(Math.max(...couplers.map((p) => p.at.x + p.w))).toBeCloseTo(STOP_X, 9);
    expect(Math.min(...couplers.map((p) => p.at.x))).toBeGreaterThanOrEqual(TRACK_X0[1]);
  });

  it("saloon lit, no headlights or red lights, and everything at y ≤ 124.2 (+0.05 for the lights)", () => {
    const bleed = accents.filter((a): a is Accent & { kind: "poly" } => a.kind === "poly" && a.color === "cyanBleed" && a.alpha === 0.7);
    expect(bleed).toHaveLength(12);
    for (const p of bleed) for (const q of p.pts) expect(q.y).toBeCloseTo(124.25, 9);
    expect(dots.filter((d) => (d.color === "cyan" && d.r === 0.3) || (d.color === "magenta" && d.r === 0.25))).toEqual([]);
    const inStation = new Set(out.map((x) => JSON.stringify(x))), lights = new Set(accents.map((a) => JSON.stringify(a)));
    for (const x of parked.solids) {
      expect(inStation.has(JSON.stringify(x)), JSON.stringify(x).slice(0, 100)).toBe(true);
      expect(bounds(x).max.y).toBeLessThanOrEqual(TRACKS_Y[1] + 1.7 + 1e-9);
    }
    for (const a of parked.lights) {
      expect(lights.has(JSON.stringify(a))).toBe(true);
      for (const q of a.kind === "poly" ? a.pts : [a.at]) expect(q.y).toBeLessThanOrEqual(TRACKS_Y[1] + 1.75 + 1e-9);
    }
  });
});

describe("station: neighbors (disjoint boxes, 1e-9)", () => {
  const trackBand = (axis: number, i: number) => flatBox(TRACK_X0[i]!, axis - 1.75, BUFFER_X, axis + 1.75); // straight stretch: from TRACK_X0 to the buffers
  const platformSolids = prisms.filter((p) => p.mat === "concrete");
  const columns = prisms.filter((p) => p.mat === "steel" && p.w === 0.3 && p.d === 0.3 && p.at.z === 1);

  it("canopies ↔ tracks: no column, ramp or fascia covers the axis ±1.75 band", () => {
    expect(columns.length).toBe(16);
    // x < 166: the tracks and platforms; the portico, the sign and the building's awnings (#278) stay to the east
    // #279: the parked cars (`isCar`) do go over track 2
    const roofs = [...ramps, ...prisms.filter((p) => (p.mat === "whitewash" && !isCar(p)) || (p.mat === "canopy" && p.at.z > 1))].filter((s) => s.at.x < 166);
    expect(roofs).toHaveLength(7); // four ramps, two south fascias and the cross platform roof
    for (const c of [...columns, ...roofs]) TRACKS_Y.forEach((y, i) => expect(apart(bounds(c), trackBand(y, i))).toBe(true));
  });

  it("no raised solid covers another, except the pieces of a single truss (column, tie and diagonals, A4) and the tower cap (#278)", () => {
    const bs = raised.map((s) => ({ s, b: bounds(s) }));
    // the cap cone's box covers the whole top of the tower: pinnacles and gables always cross it
    const spire = (s: Solid) => s.kind === "cone" && s.mat === "tile";
    const onTop = (s: Solid) => s.kind === "prism" && s.at.z === 24 && (s.mat === "safety" || (s.mat === "stone" && s.roof === "gable"));
    const truss = (s: Solid) => s.kind === "beam" || (s.kind === "prism" && s.mat === "steel" && s.w === 0.3 && s.at.z === 1);
    // the parked consist's bogies rest on track 2: they cross its sleepers (z 0..0.3), plan #279 A4
    const bogie = (s: Solid) => s.kind === "prism" && s.mat === "steel" && s.w === 2.4 && s.d === 2.8 && s.h === 1 && s.at.z === 0 && close(s.at.y + 1.4, TRACKS_Y[PARKED.track]);
    const sleeper2 = (s: Solid) => s.kind === "prism" && s.mat === "rust" && s.h === 0.3 && s.at.y === TRACKS_Y[1] - 2.5;
    const sameX = (a: Bounds, b: Bounds) => Math.abs((a.min.x + a.max.x) / 2 - (b.min.x + b.max.x) / 2) < 1e-6;
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i]!, b = bs[j]!;
      if (truss(a.s) && truss(b.s) && sameX(a.b, b.b)) continue;
      if ((spire(a.s) && onTop(b.s)) || (spire(b.s) && onTop(a.s))) continue;
      if ((bogie(a.s) && sleeper2(b.s)) || (bogie(b.s) && sleeper2(a.s))) continue;
      expect(apart(a.b, b.b), `${JSON.stringify(a.b)} ↔ ${JSON.stringify(b.b)}`).toBe(true);
    }
  });

  it("platforms ↔ tracks", () => {
    expect(platformSolids).toHaveLength(3);
    for (const p of platformSolids) TRACKS_Y.forEach((y, i) => expect(apart(bounds(p), trackBand(y, i))).toBe(true));
  });

  it("level crossing ↔ street: the posts stay outside x 100..108", () => {
    for (const post of [CROSSING.north, CROSSING.south]) {
      const b = bounds(prisms.find((p) => p.at.x === post.x && p.at.y === post.y)!);
      expect(b.max.x <= CROSSING.x0 + 1e-9 || b.min.x >= CROSSING.x1 - 1e-9).toBe(true);
    }
  });

  it("station ↔ parking lot (x 46..98, y 100..126)", () => {
    for (const s of raised) expect(apart(bounds(s), flatBox(46, 100, 98, 126))).toBe(true);
  });

  it("station ↔ street lamps (x 108.5, y 12/40/68/96/124) and truck (105, 88)", () => {
    const others = [...[12, 40, 68, 96, 124].map((y) => flatBox(108.5, y, 109.1, y + 0.6, 0, 5)), flatBox(105, 88, 108, 95, -0.4, 2.1)];
    for (const s of raised) for (const o of others) expect(apart(bounds(s), o)).toBe(true);
  });
});

describe("station: building, tower and esplanade (#278)", () => {
  const mine = (): { out: Solid[]; accents: Accent[] } => { const o: Solid[] = [], a: Accent[] = []; building(o, a); return { out: o, accents: a }; };
  const { out: bOut, accents: bAcc } = mine();
  const bPrisms = bOut.filter((s): s is Solid & { kind: "prism" } => s.kind === "prism");
  const bRamps = bOut.filter((s): s is Solid & { kind: "ramp" } => s.kind === "ramp");
  const bDots = bAcc.filter((a): a is Accent & { kind: "dot" } => a.kind === "dot");
  const bPolys = bAcc.filter((a): a is Accent & { kind: "poly" } => a.kind === "poly");
  const at = (c: { x: number; y: number; w: number; d: number }, h: number, z = 0) => (p: Solid & { kind: "prism" }) =>
    close(p.at.x, c.x) && close(p.at.y, c.y) && close(p.at.z, z) && close(p.w, c.w) && close(p.d, c.d) && close(p.h, h);
  const find = (c: { x: number; y: number; w: number; d: number }, h: number, z = 0) => { const r = bPrisms.filter(at(c, h, z)); expect(r, JSON.stringify(c)).toHaveLength(1); return r[0]!; };
  const hall = () => find(HALL, HALL.h), wingN = () => find(WING_N, WING_N.h), wingS = () => find(WING_S, WING_S.h);
  const shaft = () => find({ x: TOWER.x, y: TOWER.y, w: TOWER.w, d: TOWER.d }, TOWER.h);
  const on = (s: { plates?: Plate[] }, wall: number, mat: string, shape = "rect") => (s.plates ?? []).filter((p) => p.wall === wall && p.mat === mat && p.shape === shape);
  const span = (p: Plate) => [p.u0, p.u1, p.z0, p.z1].map((v) => Math.round(v * 1e6) / 1e6);
  const wallLen = (s: { w: number; d: number }, wall: number) => (wall % 2 === 0 ? s.w : s.d);
  const samePts = (a: { x: number; y: number; z: number }[], b: { x: number; y: number; z: number }[]) =>
    a.length === b.length && a.every((p) => b.some((q) => close(p.x, q.x) && close(p.y, q.y) && close(p.z, q.z)));

  it("exact footprints (contract with the following children of #239)", () => {
    expect(HALL).toEqual({ x: 170, y: 106, w: 20, d: 18, h: 8 });
    expect(WING_N).toEqual({ x: 168, y: 100, w: 22, d: 6, h: 5 });
    expect(WING_S).toEqual({ x: 168, y: 124, w: 16, d: 8, h: 5 });
    expect(LINK).toEqual({ x: 184, y: 124, w: 6, d: 2, h: 5 });
    expect(SERVICE).toEqual({ x: 166, y: 106, w: 4, d: 18, h: 6 });
    expect(TOWER).toEqual({ x: 184, y: 126, w: 6, d: 6, h: 24, top: 29 });
    expect(PORTICO).toEqual({ x: 190, y: 110, w: 4, d: 12, z: 5.2 });
    expect(ESPLANADE).toEqual({ x0: 190, x1: 197, y0: 98, y1: 136 });
    for (const [c, h] of [[HALL, 8], [WING_N, 5], [WING_S, 5]] as const) {
      const p = find(c, h);
      expect([p.mat, p.roof, p.roofMat]).toEqual(["brick", "gable", "tile"]);
    }
    for (const [c, h] of [[LINK, 5], [SERVICE, 6]] as const) { const p = find(c, h); expect([p.mat, p.roof ?? "flat"]).toEqual(["brick", "flat"]); }
    expect(shaft().mat).toBe("stone");
    const slab = bPrisms.filter((p) => p.mat === "paving");
    expect(slab.map(box)).toEqual([[190, 98, 0, 7, 38, 0.15]]);
    // station() includes the building
    for (const s of bOut) expect(out.some((o) => JSON.stringify(o) === JSON.stringify(s))).toBe(true);
  });

  it("hall: eave 8, ridge 10.8, lantern with caps, fanlight, dentil cornice, large windows and plinth", () => {
    const h = hall(), b = bounds(h);
    expect(b.max.z).toBeCloseTo(10.8, 9);
    // lantern and caps
    expect(bPrisms.filter((p) => p.mat === "glass").map(box)).toEqual([[172, 114.4, 10.8, 16, 1.2, 0.8]]);
    expect(sorted(bPrisms.filter((p) => p.mat === "asphalt" && p.at.z === 10.8).map(box).map((r) => r.map((v) => Math.round(v * 1e6) / 1e6))))
      .toEqual(sorted([[171.85, 114.4, 10.8, 0.15, 1.2, 0.8], [188, 114.4, 10.8, 0.15, 1.2, 0.8]]));
    // fanlight in the east gable wall
    expect(on(h, 1, "stockbrick", "disc").map(span)).toEqual([[0.41, 0.59, 8.1, 10]]);
    expect(on(h, 1, "glass", "disc").map(span)).toEqual([[0.43, 0.57, 8.3, 9.8]]);
    // cornice: 10 + 10 on the walls at z 7.5..7.9, 8 under the slopes of the gable wall
    for (const wall of [1, 2]) {
      const dent = on(h, wall, "stockbrick").filter((p) => p.z0 === 7.5 && p.z1 === 7.9);
      expect(dent, `cornice ${wall}`).toHaveLength(10);
      for (const p of dent) expect((p.u1 - p.u0) * wallLen(h, wall)).toBeCloseTo(0.4, 9);
    }
    const slopeDent = on(h, 1, "stockbrick").filter((p) => p.z0 !== 7.5 && close(p.z1 - p.z0, 0.4) && close((p.u1 - p.u0) * 18, 0.4));
    expect(slopeDent).toHaveLength(8);
    for (const p of slopeDent) {
      const yc = 106 + ((p.u0 + p.u1) / 2) * 18, line = 8 + 2.8 * (9 - Math.abs(yc - 115)) / 9;
      expect(p.z1).toBeCloseTo(line - 0.1, 9); expect(p.z1 - p.z0).toBeCloseTo(0.4, 9);
      expect(p.u1 <= 0.41 || p.u0 >= 0.59).toBe(true); // does not cover the arch
    }
    // three large windows on the east, under the portico, with mullions and pilasters
    const big = on(h, 1, "glass").sort((a, b) => a.u0 - b.u0);
    expect(big.map(span)).toEqual([[0.08, 0.28, 1.2, 6.4], [0.39, 0.61, 1.2, 6.4], [0.72, 0.92, 1.2, 6.4]]);
    // u runs from y 106 to y 124 on the east wall: the middle large window is centered on the ridge (y 115)
    expect(106 + ((big[1]!.u0 + big[1]!.u1) / 2) * 18).toBeCloseTo(115, 9);
    const mull = on(h, 1, "canopy").filter((p) => p.z0 >= 1.2 - 1e-9);
    for (const g of big) {
      const inside = mull.filter((m) => m.u0 >= g.u0 - 1e-9 && m.u1 <= g.u1 + 1e-9);
      expect(inside.some((m) => close((m.u1 - m.u0) * 18, 0.15) && close(m.z0, 1.2) && close(m.z1, 6.4) && close((m.u0 + m.u1) / 2, (g.u0 + g.u1) / 2)), "vertical mullion").toBe(true);
      expect(inside.some((m) => close(m.z1 - m.z0, 0.15) && close((m.z0 + m.z1) / 2, 4) && close(m.u0, g.u0) && close(m.u1, g.u1)), "horizontal mullion").toBe(true);
    }
    expect(on(h, 1, "stockbrick").filter((p) => p.z0 === 0.8).map(span)).toEqual([[0.3, 0.36, 0.8, 7.5], [0.64, 0.7, 0.8, 7.5]]);
    // four windows on the south, 1.6 wide, z 2..5.5, with mullion
    const south = on(h, 2, "glass");
    expect(south).toHaveLength(4);
    for (const p of south) {
      expect((p.u1 - p.u0) * 20).toBeCloseTo(1.6, 9); expect([p.z0, p.z1]).toEqual([2, 5.5]);
      expect(on(h, 2, "canopy").some((m) => m.u0 > p.u0 && m.u1 < p.u1 && close((m.u1 - m.u0) * 20, 0.15))).toBe(true);
    }
    // plinth on the hall and the wings
    for (const s of [h, wingN(), wingS()]) for (const wall of [1, 2]) expect(on(s, wall, "canopy").filter((p) => p.z0 === 0 && p.z1 === 0.8 && p.u0 === 0 && p.u1 === 1), `plinth ${wall}`).toHaveLength(1);
  });

  it("portico: canopy with glass, two round columns, light sign", () => {
    const m = find({ x: PORTICO.x, y: PORTICO.y, w: PORTICO.w, d: PORTICO.d }, 0.4, PORTICO.z);
    expect(m.mat).toBe("canopy");
    for (const wall of [1, 2]) expect(on(m, wall, "glass").length, `glass ${wall}`).toBe(1);
    const cols = bOut.filter((s): s is Solid & { kind: "cylinder" } => s.kind === "cylinder" && s.mat === "canopy");
    expect(sorted(cols.map((c) => [c.at.x, c.at.y, c.at.z, c.r, c.sides, Math.round((c.at.z + c.h) * 1e6) / 1e6]))).toEqual(sorted([[193.4, 111.5, 0.15, 0.3, 8, 5.2], [193.4, 120.5, 0.15, 0.3, 8, 5.2]]));
    expect(bPrisms.filter((p) => p.mat === "whitewash").map(box).map((r) => r.map((v) => Math.round(v * 1e6) / 1e6))).toEqual([[193.85, 111, 5.6, 0.15, 10, 1]]);
  });

  it("wings and awnings: four south of WING_S, two east of WING_N, each with its shopfront", () => {
    const sRamps = bRamps.filter((r) => r.mat === "signal" && r.dir === "s"), eRamps = bRamps.filter((r) => r.mat === "signal" && r.dir === "e");
    expect(sRamps).toHaveLength(4); expect(eRamps).toHaveLength(2);
    for (const r of sRamps) expect([r.at.y, r.at.z, r.w, r.d, r.h]).toEqual([132, 3, 2, 0.8, 0.5]);
    for (const r of eRamps) expect([r.at.x, r.at.z, r.w, r.d, r.h]).toEqual([190, 3, 0.8, 2, 0.5]);
    const ws = on(wingS(), 2, "glass"), wn = on(wingN(), 1, "glass");
    for (const r of sRamps) expect(ws.some((p) => close(184 - p.u0 * 16, r.at.x + r.w) && close(184 - p.u1 * 16, r.at.x) && p.z1 <= 3 + 1e-9), `shopfront s ${r.at.x}`).toBe(true);
    for (const r of eRamps) expect(wn.some((p) => close(100 + p.u0 * 6, r.at.y) && close(100 + p.u1 * 6, r.at.y + r.d) && p.z1 <= 3 + 1e-9), `shopfront e ${r.at.y}`).toBe(true);
    for (const r of sRamps) { expect(r.at.x).toBeGreaterThanOrEqual(WING_S.x - 1e-9); expect(r.at.x + r.w).toBeLessThanOrEqual(WING_S.x + WING_S.w + 1e-9); }
    for (const r of eRamps) { expect(r.at.y).toBeGreaterThanOrEqual(WING_N.y - 1e-9); expect(r.at.y + r.d).toBeLessThanOrEqual(WING_N.y + WING_N.d + 1e-9); }
  });

  it("esplanade: tall lamps, palms and railing; whatever rests on the slab starts at z 0.15", () => {
    const posts = bPrisms.filter((p) => p.mat === "steel" && p.w === 0.6 && p.h === 6);
    expect(sorted(posts.map((p) => [Math.round((p.at.x + 0.3) * 1e6) / 1e6, Math.round((p.at.y + 0.3) * 1e6) / 1e6, p.at.z]))).toEqual(sorted([[195.5, 102, 0.15], [195.5, 130, 0.15]]));
    const trunks = bOut.filter((s): s is Solid & { kind: "cylinder" } => s.kind === "cylinder" && s.mat === "deck");
    expect(sorted(trunks.map((t) => [t.at.x, t.at.y, t.at.z, t.r, t.h, t.sides]))).toEqual(sorted([[195.5, 108, 0.15, 0.25, 6, 6], [195.6, 116.5, 0.15, 0.25, 6, 6], [195.5, 125, 0.15, 0.25, 6, 6]]));
    const crowns = bOut.filter((s): s is Solid & { kind: "cone" } => s.kind === "cone" && s.mat === "leaf");
    expect(sorted(crowns.map((c) => [c.at.x, c.at.y, c.at.z, c.r, c.h]))).toEqual(sorted(trunks.map((t) => [t.at.x, t.at.y, 6.15, 1.8, 1.6])));
    expect(bPrisms.filter((p) => p.mat === "canopy" && p.at.x === 197).map(box)).toEqual([[197, 98, 0, 0.3, 38, 1]]);
    for (const s of bOut) {
      const b = bounds(s);
      if (b.min.x >= ESPLANADE.x0 + 1e-9 && b.max.x <= ESPLANADE.x1 + 1e-9 && b.max.z > 0.15 + 1e-9) expect(b.min.z, JSON.stringify(b)).toBeGreaterThanOrEqual(0.15 - 1e-9);
    }
  });

  it("tower: stone shaft with slits, four dials with ring, pinnacles, tile cap with gables and vents", () => {
    const t = shaft();
    for (const wall of [1, 2]) expect(sorted(on(t, wall, "asphalt").map(span))).toEqual(sorted([[0.475, 0.525, 4, 8], [0.475, 0.525, 11, 15]]));
    for (const wall of [0, 1, 2, 3]) {
      expect(on(t, wall, "safety", "disc").map(span), `ring ${wall}`).toEqual([[0.2, 0.8, 20.3, 23.3]]);
      expect(on(t, wall, "whitewash", "disc").map(span), `dial ${wall}`).toEqual([[0.26, 0.74, 20.6, 23]]);
    }
    const pins = bPrisms.filter((p) => p.mat === "safety" && p.at.z === 24);
    expect(sorted(pins.map(box).map((r) => r.map((v) => Math.round(v * 1e6) / 1e6)))).toEqual(sorted([[184, 126], [189.6, 126], [184, 131.6], [189.6, 131.6]].map(([x, y]) => [x, y, 24, 0.4, 0.4, 1.2])));
    const roof = bOut.filter((s): s is Solid & { kind: "cone" } => s.kind === "cone" && s.mat === "tile");
    expect(roof).toHaveLength(1);
    const rb = bounds(roof[0]!);
    expect([rb.min.x, rb.min.y, rb.min.z, rb.max.x, rb.max.y, rb.max.z].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([184, 126, 24, 190, 132, TOWER.top]);
    expect(roof[0]!.sides).toBe(4);
    const top = Math.max(...out.filter((s) => !isFlat(s)).map((s) => bounds(s).max.z));
    expect(top).toBeCloseTo(TOWER.top, 9);
    expect(out.filter((s) => !isFlat(s) && bounds(s).max.z > TOWER.top - 1e-9)).toEqual([roof[0]]);
    // gables: pentagon facing outward (A3), vent in the outer gable
    const gables = bPrisms.filter((p) => p.mat === "stone" && p.roof === "gable");
    expect(sorted(gables.map(box).map((r) => r.map((v) => Math.round(v * 1e6) / 1e6)))).toEqual(sorted([
      [188, 128.6, 24, 2, 0.8, 1], [184, 128.6, 24, 2, 0.8, 1], [186.6, 126, 24, 0.8, 2, 1], [186.6, 130, 24, 0.8, 2, 1],
    ]));
    const outWall = (g: Solid & { kind: "prism" }) => (g.w > g.d ? (g.at.x > 186 ? 1 : 3) : (g.at.y > 128 ? 2 : 0));
    for (const g of gables) expect(on(g, outWall(g), "asphalt").map(span), `vent ${outWall(g)}`).toEqual([[0.3125, 0.6875, 24.5, 24.8]]);
  });

  it("night lights: portico, lantern, fanlight, windows, dials and lamps", () => {
    const portico = bDots.filter((d) => d.color === "amber" && d.at.x > 190 && d.at.x < 194 && d.at.y > 110 && d.at.y < 122 && d.at.z < 5.2);
    expect(portico.length).toBeGreaterThanOrEqual(3);
    expect(sorted(bDots.filter((d) => d.color === "amber" && d.r === 0.5).map((d) => [d.at.x, d.at.y, d.at.z]))).toEqual(sorted([[190.05, 109, 3.2], [190.05, 123, 3.2]]));
    expect(sorted(bDots.filter((d) => d.color === "cyan").map((d) => [d.at.x, d.at.y, d.at.z, d.r]))).toEqual(sorted([[195.5, 102, 6.15, 1.2], [195.5, 130, 6.15, 1.2]]));
    // each poly falls on a wall plate (same outline in the world)
    const t = shaft(), h = hall();
    const faces = (s: Solid, mat: string, shape: string) => tessellateAll(s).filter((f) => f.mat === mat && f.pts.length === (shape === "disc" ? 8 : 4));
    const dial = faces(t, "whitewash", "disc").filter((f) => f.normal.x > 0.5 || f.normal.y > 0.5);
    const amberPolys = bPolys.filter((p) => p.color === "amber");
    expect(dial).toHaveLength(2);
    for (const f of dial) expect(amberPolys.some((p) => samePts(p.pts, f.pts) && p.alpha === 0.6), "dial").toBe(true);
    const fan = faces(h, "glass", "disc");
    expect(fan).toHaveLength(1);
    expect(amberPolys.some((p) => samePts(p.pts, fan[0]!.pts) && p.alpha === 0.5), "fanlight").toBe(true);
    const windows = faces(h, "glass", "rect");
    const cyanB = bPolys.filter((p) => p.color === "cyanBleed");
    expect(cyanB).toHaveLength(3); // the large east windows; the south windows are not lit (the wing and the tower cover them)
    for (const p of cyanB) { expect(p.alpha).toBe(0.5); expect(windows.some((f) => samePts(p.pts, f.pts)), "window").toBe(true); }
    const lantern = bPolys.filter((p) => p.color === "amberBleed");
    expect(lantern).toHaveLength(1);
    expect(lantern[0]!.alpha).toBe(0.6);
    expect(samePts(lantern[0]!.pts, [v3(188, 115.6, 10.8), v3(172, 115.6, 10.8), v3(172, 115.6, 11.6), v3(188, 115.6, 11.6)])).toBe(true);
  });

  it("minimum size 0.15 in every solid and every plate of the building", () => {
    for (const s of bOut) {
      const b = bounds(s), where = JSON.stringify(s).slice(0, 120);
      for (const k of ["x", "y", "z"] as const) expect(b.max[k] - b.min[k], `${where} ${k}`).toBeGreaterThanOrEqual(0.15 - 1e-9);
      if (s.kind !== "prism" && s.kind !== "ramp") continue;
      for (const p of s.plates ?? []) {
        expect((p.u1 - p.u0) * wallLen(s, p.wall), `${where} plate u`).toBeGreaterThanOrEqual(0.15 - 1e-9);
        expect(p.z1 - p.z0, `${where} plate z`).toBeGreaterThanOrEqual(0.15 - 1e-9);
      }
    }
  });

  describe("neighbors", () => {
    const bb = bOut.map((s) => ({ s, b: bounds(s) }));
    it("building ↔ HEAD and its canopy: everything at x ≥ 166, disjoint from the platform and its roof", () => {
      const head = flatBox(HEAD.x0, HEAD.y0, HEAD.x1, HEAD.y1, 0, 3.8);
      for (const { b } of bb) { expect(b.min.x, JSON.stringify(b)).toBeGreaterThanOrEqual(166 - 1e-9); expect(apart(b, head)).toBe(true); }
    });
    it("tower ↔ esplanade: whatever passes x 190 is portico, sign, columns, awnings or rests on the slab (z ≥ 0.15)", () => {
      const slab = bPrisms.find((p) => p.mat === "paving")!;
      for (const { s, b } of bb) {
        if (s === slab || b.max.x <= 190 + 1e-9) continue;
        expect(b.min.x, JSON.stringify(b)).toBeGreaterThanOrEqual(190 - 1e-9);
        if (!(s.kind === "prism" && s.mat === "canopy" && s.at.x === 197)) expect(b.min.z, JSON.stringify(b)).toBeGreaterThanOrEqual(0.15 - 1e-9);
      }
      const tower = bb.filter(({ b }) => b.min.x >= TOWER.x - 1e-9 && b.min.x < TOWER.x + TOWER.w && b.min.y >= TOWER.y - 1e-9 && b.max.y <= TOWER.y + TOWER.d + 1e-9 && b.min.z >= 0 && b.max.z > 5);
      for (const { b } of tower) expect(b.max.x).toBeLessThanOrEqual(190 + 1e-9);
    });
    it("esplanade ↔ quay: max.x ≤ 197.3", () => {
      for (const { b } of bb) expect(b.max.x).toBeLessThanOrEqual(197.3 + 1e-9);
    });
    it("hall ↔ wings ↔ tower: boxes that touch but do not cross", () => {
      const parts = [hall(), wingN(), wingS(), find(LINK, 5), find(SERVICE, 6), shaft()].map(bounds);
      const touch = (a: Bounds, b: Bounds) => a.min.x <= b.max.x + 1e-9 && b.min.x <= a.max.x + 1e-9 && a.min.y <= b.max.y + 1e-9 && b.min.y <= a.max.y + 1e-9;
      for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) expect(apart(parts[i]!, parts[j]!), `${i} ↔ ${j}`).toBe(true);
      const [h, n, s, l, sv, t] = parts as [Bounds, Bounds, Bounds, Bounds, Bounds, Bounds];
      for (const [a, b] of [[h, n], [h, s], [h, l], [h, sv], [s, t], [l, t], [n, sv], [s, sv]] as const) expect(touch(a, b)).toBe(true);
    });
    it("no building solid at y < 98 or y > 136", () => {
      for (const { b } of bb) { expect(b.min.y).toBeGreaterThanOrEqual(98 - 1e-9); expect(b.max.y).toBeLessThanOrEqual(136 + 1e-9); }
    });
  });
});
