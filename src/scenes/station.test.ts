import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { bounds, isFlat, tessellate, type Bounds, type Solid } from "../iso/solids";
import { BUFFER_H, BUFFER_X, CROSSING, FENCE_Y, GAUGE, HEAD, ISLAND, LADDER, RAIL_W, RAIL_Z, SIDE, SIGNALS, STATION, STOP_X, TRACK_X0, TRACKS_Y, TRAIN_CLEAR, station } from "./station";

const build = (): { out: Solid[]; accents: Accent[] } => { const out: Solid[] = [], accents: Accent[] = []; station(out, accents); return { out, accents }; };
const { out, accents } = build();
const raised = out.filter((s) => !isFlat(s));
const prisms = out.filter((s): s is Solid & { kind: "prism" } => s.kind === "prism");
const strips = out.filter((s): s is Solid & { kind: "strip" } => s.kind === "strip");
const ramps = out.filter((s): s is Solid & { kind: "ramp" } => s.kind === "ramp");
const beams = out.filter((s): s is Solid & { kind: "beam" } => s.kind === "beam");
const dots = accents.filter((a): a is Accent & { kind: "dot" } => a.kind === "dot");
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

describe("station: constantes (contrato con los hijos de #239)", () => {
  it("valores exactos del issue", () => {
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
  it("es determinista", () => {
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });

  it("todo cae en STATION (x 96..197, y 80..142) y nada elevado pasa z 6", () => {
    expect(out.length).toBeGreaterThan(50);
    for (const s of out) {
      const b = bounds(s), where = JSON.stringify(s).slice(0, 120);
      expect(b.min.x, where).toBeGreaterThanOrEqual(96 - 1e-9); expect(b.max.x, where).toBeLessThanOrEqual(STATION.x1 + 1e-9);
      expect(b.min.y, where).toBeGreaterThanOrEqual(STATION.y0 - 1e-9); expect(b.max.y, where).toBeLessThanOrEqual(STATION.y1 + 1e-9);
    }
    for (const s of raised) expect(bounds(s).max.z).toBeLessThanOrEqual(6);
  });

  it("vías: rieles de TRACK_X0 a BUFFER_X en eje ±1.5, durmientes cada 4 u y tercer riel en eje + 2.1", () => {
    TRACKS_Y.forEach((axis, i) => {
      const x0 = TRACK_X0[i]!;
      for (const dy of [-GAUGE / 2, GAUGE / 2]) {
        expect(strips.filter((s) => s.mat === "rail" && s.width === RAIL_W && s.z === RAIL_Z && horizontal(s, axis + dy, x0, BUFFER_X)), `vía ${i + 1} ${dy}`).toHaveLength(1);
      }
      const sleepers = prisms.filter((p) => p.mat === "rust" && p.w === 1 && p.d === 5 && p.h === 0.3 && p.at.z === 0 && p.at.y === axis - 2.5);
      expect(sleepers.map((p) => p.at.x).sort((a, b) => a - b), `durmientes vía ${i + 1}`).toEqual(SLEEPERS[i]);
      const third = strips.filter((s) => s.mat === "whitewash" && s.width === 0.3 && s.z === 0.05 && horizontal(s, axis + 2.1, Math.max(x0, CROSSING.x1), BUFFER_X));
      expect(third, `tercer riel vía ${i + 1}`).toHaveLength(1);
    });
    expect(SLEEPERS[2]![0]).toBe(110); expect(SLEEPERS[2]!.at(-1)).toBe(158);
  });

  it("el tercer riel no cruza el paso a nivel (ningún punto con x < 108)", () => {
    const whites = strips.filter((s) => s.mat === "whitewash");
    expect(whites).toHaveLength(3);
    for (const s of whites) for (const p of s.path) expect(p.x).toBeGreaterThanOrEqual(CROSSING.x1);
  });

  it("abanico: dos rieles diagonales de LADDER[0] a LADDER[1], corridos ±1.5 en perpendicular", () => {
    const diag = strips.filter((s) => s.mat === "rail" && s.path.length === 2 && !close(s.path[0]!.y, s.path[1]!.y));
    expect(diag).toHaveLength(2);
    const [a, b] = LADDER, len = Math.hypot(b.x - a.x, b.y - a.y), n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
    const offsets = diag.map((s) => {
      const [p, q] = [...s.path].sort((u, v) => u.x - v.x) as [{ x: number; y: number }, { x: number; y: number }];
      const op = (p.x - a.x) * n.x + (p.y - a.y) * n.y, oq = (q.x - b.x) * n.x + (q.y - b.y) * n.y;
      expect(op).toBeCloseTo(oq, 9);
      expect((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)).toBeCloseTo(0, 9); // sin correrse a lo largo
      expect(s.width).toBe(RAIL_W);
      return op;
    });
    expect(offsets.map(Math.abs)).toEqual([expect.closeTo(1.5, 9), expect.closeTo(1.5, 9)]);
    expect(Math.sign(offsets[0]!)).not.toBe(Math.sign(offsets[1]!));
    expect(prisms.filter((p) => p.mat === "rust" && p.h === 0.3 && !TRACKS_Y.some((y) => p.at.y === y - 2.5))).toEqual([]); // sin durmientes en la diagonal
  });

  it("andenes concrete h 1 con franjas amarillas del lado de las vías y baranda en el transversal", () => {
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

  it("marquesinas: dos aguas bajas, columnas cada 5 u, cabriadas, fajas y luces cyanMid", () => {
    for (const c of CANOPIES) {
      const ym = (c.p.y0 + c.p.y1) / 2, half = (c.p.y1 - c.p.y0) / 2;
      const mine = ramps.filter((r) => r.mat === "canopy" && r.at.x === c.x0 && r.w === c.x1 - c.x0 && r.at.z === 4.2 && r.h === 0.5 && r.d === half);
      expect(sorted(mine.map((r) => [r.at.y, r.dir]))).toEqual(sorted([[c.p.y0, "n"], [ym, "s"]]));
      const cols = prisms.filter((p) => p.mat === "steel" && p.w === 0.3 && p.d === 0.3 && p.at.z === 1 && close(p.at.z + p.h, 4.2) && close(p.at.y, ym - 0.15));
      expect(cols.map((p) => p.at.x + 0.15).sort((a, b) => a - b).map((x) => Math.round(x * 1e6) / 1e6)).toEqual(c.cols);
      for (const x of c.cols) {
        const truss = beams.filter((b) => close(b.from.x, x) && close(b.to.x, x));
        const tie = truss.filter((b) => b.from.z === 4 && b.to.z === 4 && b.w === 0.2 && b.h === 0.2);
        expect(tie, `tirante x ${x}`).toHaveLength(1);
        expect([Math.min(tie[0]!.from.y, tie[0]!.to.y), Math.max(tie[0]!.from.y, tie[0]!.to.y)]).toEqual([c.p.y0, c.p.y1]);
        expect(truss.filter((b) => b !== tie[0]), `diagonales x ${x}`).toHaveLength(2);
        for (const b of truss) expect(bounds(b).max.z).toBeLessThanOrEqual(4.2 + 1e-9); // bajo la base de las rampas
      }
      const fascia = prisms.filter((p) => p.mat === "whitewash" && p.h === 0.25 && p.at.y === c.p.y1 && p.at.x === c.x0 && p.w === c.x1 - c.x0);
      expect(fascia, "faja sur").toHaveLength(1);
      expect(close(fascia[0]!.at.z + fascia[0]!.h, 4.2)).toBe(true);
      for (const r of mine) expect(tessellate(r).some((f) => f.mat === "whitewash" && f.normal.x > 0), `faja este ${r.dir}`).toBe(true);
      const lights = dots.filter((d) => d.color === "cyanMid" && d.at.y === ym && d.at.z === 3.9 && d.r === 0.8).map((d) => d.at.x).sort((a, b) => a - b);
      expect(lights).toEqual(c.lights);
    }
    expect(prisms.filter((p) => p.mat === "canopy" && p.at.z === 3.5).map(box)).toEqual([[161.5, 104, 3.5, 4.5, 27, 0.3]]);
    const headCols = prisms.filter((p) => p.mat === "steel" && p.at.x === 161.8 && p.w === 0.3 && p.d === 0.3 && p.at.z === 1 && close(p.h, 2.5));
    expect(headCols.map((p) => p.at.y).sort((a, b) => a - b)).toEqual([104, 110, 116, 122, 128]);
    expect(sorted(dots.filter((d) => d.color === "cyanMid" && d.at.z === 3.4).map((d) => [d.at.x, d.at.y]))).toEqual(sorted([[163.75, 109], [163.75, 119], [163.75, 129]]));
    expect(dots.filter((d) => d.color === "cyanMid")).toHaveLength(8);
  });

  it("topes: tres en x 160..161.5, h 1.2, franjas safety/asphalt en este y sur, luz magenta", () => {
    const buffers = prisms.filter((p) => p.mat === "steel" && p.at.x === BUFFER_X && p.w === 1.5 && p.h === BUFFER_H && p.at.z === 0);
    expect(sorted(buffers.map((p) => [p.at.y, p.d]))).toEqual(sorted(TRACKS_Y.map((y) => [y - 1.5, 3])));
    for (const b of buffers) {
      for (const wall of [1, 2]) {
        const ps = (b.plates ?? []).filter((p) => p.wall === wall && p.shape === "rect").sort((p, q) => p.u0 - q.u0);
        expect(ps.map((p) => p.mat), `pared ${wall}`).toEqual(["safety", "asphalt", "safety", "asphalt"]);
      }
    }
    const reds = dots.filter((d) => d.color === "magenta");
    expect(sorted(reds.map((d) => [d.at.x, d.at.y, d.at.z, d.r]))).toEqual(sorted(TRACKS_Y.map((y) => [160.75, y, 1.5, 0.35])));
  });

  it("cerco sur en FENCE_Y, h ≤ 1, y nada más al sur de la vía 3 salvo el paso a nivel", () => {
    expect(prisms.filter((p) => p.mat === "steel" && p.at.y === FENCE_Y).map(box)).toEqual([[110, 136, 0, 50, 0.3, 1]]);
    const south = raised.filter((s) => bounds(s).min.y > TRAIN_CLEAR.y1 && bounds(s).min.x >= CROSSING.x1 + 1);
    expect(south.map((s) => s.kind === "prism" && box(s))).toEqual([[110, 136, 0, 50, 0.3, 1]]);
  });

  it("semáforos: poste steel 0.3 h 3.5 bajo una cabeza asphalt 0.5×0.5×1.2 anclada en SIGNALS", () => {
    for (const s of [SIGNALS.in, SIGNALS.out]) {
      expect(prisms.filter((p) => p.mat === "steel" && close(p.at.x, s.x + 0.1) && close(p.at.y, s.y + 0.1)).map(box)).toEqual([[s.x + 0.1, s.y + 0.1, 0, 0.3, 0.3, 3.5]]);
      expect(prisms.filter((p) => p.mat === "asphalt" && p.at.x === s.x && p.at.y === s.y).map(box)).toEqual([[s.x, s.y, 3.5, 0.5, 0.5, 1.2]]);
    }
  });

  it("paso a nivel: tablones deck, dos postes y dos barreras bajas de cuatro tramos signal/whitewash", () => {
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
      expect(xs.map((s) => s[2])).toEqual(["signal", "whitewash", "signal", "whitewash"]); // desde el poste
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

  it("oclusión: nada estático alto queda delante del tren (reglas de §6.2)", () => {
    let south = 0, east = 0;
    for (const s of raised) {
      const b = bounds(s), where = JSON.stringify(b);
      if (b.max.z - b.min.z <= 0.4) continue;
      if (b.min.y > TRAIN_CLEAR.y1) { south++; expect(b.min.y - 1.4 * b.max.z, where).toBeGreaterThanOrEqual(134.5 - 1e-9); }
      if (b.min.x >= TRAIN_CLEAR.x1 && b.max.y > TRAIN_CLEAR.y0) { east++; expect(b.min.x - b.max.y >= 27.2 - 1e-9 || b.min.x - 1.4 * b.max.z >= 158 - 1e-9, where).toBe(true); }
      if (b.min.y <= TRAIN_CLEAR.y1 && b.max.y > TRAIN_CLEAR.y0) expect(b.min.x, `sobre la vía 3: ${where}`).toBeGreaterThanOrEqual(BUFFER_X);
    }
    expect(south).toBeGreaterThanOrEqual(2); // cerco y poste sur (la barrera sur mide 0.25)
    expect(east).toBeGreaterThanOrEqual(3);  // tope de la vía 3, andén transversal y su baranda
  });
});

describe("station: vecindades (cajas disjuntas, 1e-9)", () => {
  const trackBand = (axis: number, i: number) => flatBox(TRACK_X0[i]!, axis - 1.75, BUFFER_X, axis + 1.75); // tramo recto: de TRACK_X0 a los topes
  const platformSolids = prisms.filter((p) => p.mat === "concrete");
  const columns = prisms.filter((p) => p.mat === "steel" && p.w === 0.3 && p.d === 0.3 && p.at.z === 1);

  it("marquesinas ↔ vías: ninguna columna pisa la franja eje ±1.75", () => {
    expect(columns.length).toBe(16);
    for (const c of columns) TRACKS_Y.forEach((y, i) => expect(apart(bounds(c), trackBand(y, i))).toBe(true));
  });

  it("andenes ↔ vías", () => {
    expect(platformSolids).toHaveLength(3);
    for (const p of platformSolids) TRACKS_Y.forEach((y, i) => expect(apart(bounds(p), trackBand(y, i))).toBe(true));
  });

  it("paso a nivel ↔ calle: los postes quedan fuera de x 100..108", () => {
    for (const post of [CROSSING.north, CROSSING.south]) {
      const b = bounds(prisms.find((p) => p.at.x === post.x && p.at.y === post.y)!);
      expect(b.max.x <= CROSSING.x0 + 1e-9 || b.min.x >= CROSSING.x1 - 1e-9).toBe(true);
    }
  });

  it("estación ↔ playa de estacionamiento (x 46..98, y 100..126)", () => {
    for (const s of raised) expect(apart(bounds(s), flatBox(46, 100, 98, 126))).toBe(true);
  });

  it("estación ↔ faroles de la calle (x 108.5, y 12/40/68/96/124) y camión (105, 88)", () => {
    const others = [...[12, 40, 68, 96, 124].map((y) => flatBox(108.5, y, 109.1, y + 0.6, 0, 5)), flatBox(105, 88, 108, 95, -0.4, 2.1)];
    for (const s of raised) for (const o of others) expect(apart(bounds(s), o)).toBe(true);
  });
});
