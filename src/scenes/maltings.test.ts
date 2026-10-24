import { describe, expect, it } from "vitest";
import { isBehind, overlaps, screenBounds, sortByDepth } from "../iso/depth";
import { bounds, type Plate, type Solid } from "../iso/solids";
import { MALT, WATER_TOWER, maltings, waterTower } from "./maltings";

type Kind<K extends Solid["kind"]> = Solid & { kind: K };
const build = (f: (out: Solid[]) => void): Solid[] => { const out: Solid[] = []; f(out); return out; };
const of = <K extends Solid["kind"]>(ss: Solid[], k: K) => ss.filter((s): s is Kind<K> => s.kind === k);
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const len = (b: Kind<"beam">) => Math.hypot(b.to.x - b.from.x, b.to.y - b.from.y, b.to.z - b.from.z);
const meet = (a: Solid, b: Solid) => overlaps(screenBounds(bounds(a)), screenBounds(bounds(b)));
const cross3d = (a: Solid, b: Solid) => !isBehind(bounds(a), bounds(b)) && !isBehind(bounds(b), bounds(a));

/** Dimensiones de cada pieza por sus parámetros (D15 del plan): ninguna menor a 0.15. */
function dims(s: Solid): number[] {
  switch (s.kind) {
    case "prism": case "ramp": return [s.w, s.d, s.h];
    case "cylinder": case "cone": return [2 * s.r, s.h];
    case "beam": return [s.w, s.h, len(s)];
    default: return [];
  }
}
function plateDims(s: Solid): number[] {
  const plates: Plate[] = "plates" in s && s.plates ? s.plates : [];
  if (s.kind !== "prism" && s.kind !== "ramp") return [];
  return plates.flatMap((p) => [(p.u1 - p.u0) * (p.wall % 2 === 0 ? s.w : s.d), p.z1 - p.z0]);
}

describe("maltería", () => {
  const all = build(maltings);
  const walls = of(all, "prism").filter((p) => p.mat === "brick" && p.at.x === 20 && p.w === 24);
  const ramps = of(all, "ramp");
  const kiln = of(all, "prism").find((p) => p.mat === "brick" && p.w === 6 && p.d === 6)!;

  it("MALT conserva la huella", () => expect(MALT).toEqual({ x: 20, y: -46, w: 24, d: 30, h: 18 }));

  it("prisma de ladrillo 24 × 30 × 18 con la fachada del issue (D5)", () => {
    expect(walls).toHaveLength(1);
    const w = walls[0]!;
    expect(w).toMatchObject({ at: { x: 20, y: -46, z: 0 }, d: 30, h: 18 });
    expect(w.facade).toEqual({
      floors: 5, cols: 8, window: { w: 0.45, h: 0.5 }, head: "segmental", headMat: "stockbrick", sill: "stockbrick",
      piers: { every: 2, w: 0.5, mat: "stockbrick" }, courses: { mat: "stockbrick", h: 0.35 }, ties: { r: 0.25, mat: "steel" },
    });
  });

  it("seis rampas steel: cuatro de w 6 con cumbreras a z 24 en x 26 y 38 y dos tramos norte junto al horno (D1)", () => {
    expect(ramps).toHaveLength(6);
    expect(ramps.every((r) => r.mat === "steel" && r.at.z === 18)).toBe(true);
    const full = ramps.filter((r) => r.w === 6).map((r) => [r.at.x, r.at.y, r.d, r.h, r.dir]).sort((a, b) => (a[0] as number) - (b[0] as number));
    expect(full).toEqual([[20, -40, 24, 6, "w"], [26, -40, 24, 6, "e"], [32, -46, 30, 6, "w"], [38, -46, 30, 6, "e"]]);
    const north = ramps.filter((r) => r.w !== 6).map((r) => [r.at.x, r.at.y, r.w, r.d, r.h, r.dir]).sort((a, b) => (a[0] as number) - (b[0] as number));
    expect(north).toEqual([[20, -46, 2, 6, 2, "w"], [28, -46, 4, 6, 4, "e"]]);
  });

  it("pilastras stockbrick 0.5 × 0.4 adosadas al sur hasta los vértices (D2)", () => {
    const piers = of(all, "prism").filter((p) => p.mat === "stockbrick").map((p) => [p.at.x, p.at.y, p.at.z, p.w, p.d, p.at.z + p.h]).sort((a, b) => a[0]! - b[0]!);
    expect(piers).toHaveLength(5);
    const want = [[20, 0, 18], [25.75, 0, 24], [31.75, 16.7, 18], [37.75, 0, 24], [43.5, 0, 18]];
    piers.forEach((p, i) => {
      const [x, z0, z1] = want[i]!;
      expect(p[0]).toBeCloseTo(x!, 6); expect(p[1]).toBeCloseTo(-16.4, 6); expect(p[2]).toBeCloseTo(z0!, 6);
      expect(p[3]).toBeCloseTo(0.5, 6); expect(p[4]).toBeCloseTo(0.4, 6); expect(p[5]).toBeCloseTo(z1!, 6);
    });
  });

  it("cuatro cornisas beam stockbrick 0.4 × 0.3 en y −16.3 del alero a la cumbrera (D3)", () => {
    const c = of(all, "beam").filter((b) => b.mat === "stockbrick");
    expect(c).toHaveLength(4);
    const ends = c.map((b) => [b.from, b.to].map((p) => [p.x, p.z]).sort((a, b) => a[1]! - b[1]!)).sort((a, b) => a[0]![0]! - b[0]![0]!);
    expect(ends).toEqual([[[20.15, 18.15], [26, 24]], [[31.85, 18.15], [26, 24]], [[32.15, 18.15], [38, 24]], [[43.85, 18.15], [38, 24]]]);
    for (const b of c) { expect(b.w).toBe(0.4); expect(b.h).toBe(0.3); expect(b.from.y).toBe(-16.3); expect(b.to.y).toBe(-16.3); }
  });

  it("óculos: en la cara sur de cada rampa de w 6, anillo stockbrick y después vidrio, dentro del piñón (D4)", () => {
    for (const r of ramps.filter((x) => x.w === 6)) {
      const p = r.plates ?? [];
      expect(p).toHaveLength(2);
      expect(p[0]).toMatchObject({ wall: 2, shape: "disc", mat: "stockbrick" });
      expect(p[1]).toMatchObject({ wall: 2, shape: "disc", mat: "glass" });
      expect(p[0]!.u0).toBeCloseTo(0.35, 6); expect(p[0]!.u1).toBeCloseTo(0.65, 6);
      expect(p[0]!.z0).toBeCloseTo(18.8, 6); expect(p[0]!.z1).toBeCloseTo(20.6, 6);
      expect((p[1]!.u1 - p[1]!.u0) * 6).toBeCloseTo(1.4, 6); expect(p[1]!.z1 - p[1]!.z0).toBeCloseTo(1.4, 6);
      // el octógono inscripto (apotema 0.9) queda bajo la pendiente: distancia del centro al faldón > 0.9
      const cx = r.at.x + r.w / 2, low = r.dir === "w" ? r.at.x : r.at.x + r.w, roof = 18 + Math.abs(cx - low);
      expect((roof - 19.7) / Math.SQRT2).toBeGreaterThan(0.9);
    }
  });

  it("cuatro puertas de carga apiladas y portón doble en la pared sur del prisma (D6)", () => {
    const plates = walls[0]!.plates ?? [];
    expect(plates).toHaveLength(5);
    expect(plates.every((p) => p.wall === 2 && p.shape === "rect" && p.mat === "steel")).toBe(true);
    const doors = plates.filter((p) => p.toneOffset === -1).sort((a, b) => a.z0 - b.z0);
    expect(doors).toHaveLength(4);
    doors.forEach((d, i) => {
      expect(d.u0).toBeCloseTo(11 / 24, 6); expect(d.u1).toBeCloseTo(13 / 24, 6);
      expect(d.z0).toBeCloseTo(3.6 * (i + 1), 6); expect(d.z1).toBeCloseTo(3.6 * (i + 1) + 2.3, 6);
    });
    const gate = plates.find((p) => p.toneOffset === -2)!;
    expect(gate.u0).toBeCloseTo(10.5 / 24, 6); expect(gate.u1).toBeCloseTo(13.5 / 24, 6); expect(gate.z0).toBe(0); expect(gate.z1).toBe(3);
  });

  it("horno de ladrillo con techo piramidal de pizarra, vértice z 26 (D7)", () => {
    expect(kiln).toMatchObject({ at: { x: 22, y: -46, z: 18 }, w: 6, d: 6, h: 6 });
    const cone = of(all, "cone");
    expect(cone).toHaveLength(1);
    expect(cone[0]).toMatchObject({ at: { x: 25, y: -43, z: 24 }, r: 4.2, h: 2, mat: "steel", sides: 4 });
    const b = bounds(cone[0]!);
    expect(b.min.x).toBeGreaterThanOrEqual(22 - 1e-6); expect(b.max.x).toBeLessThanOrEqual(28 + 1e-6);
    expect(b.min.y).toBeGreaterThanOrEqual(-46 - 1e-6); expect(b.max.y).toBeLessThanOrEqual(-40 + 1e-6);
  });

  it("ninguna pieza mide menos de 0.15 ni pasa de z 26; todo en x 20..44, y −46..−16", () => {
    for (const s of all) {
      for (const d of [...dims(s), ...plateDims(s)]) expect(d).toBeGreaterThanOrEqual(0.15 - 1e-9);
      const b = bounds(s);
      expect(b.max.z).toBeLessThanOrEqual(26 + 1e-9);
      expect(b.min.x).toBeGreaterThanOrEqual(20 - 1e-9); expect(b.max.x).toBeLessThanOrEqual(44 + 1e-9);
      expect(b.min.y).toBeGreaterThanOrEqual(-46 - 1e-9); expect(b.max.y).toBeLessThanOrEqual(-16 + 1e-9);
    }
  });

  it("orden painter: el horno no se cruza con ninguna rampa y su orden contra cada una sigue al plano que los separa (D1)", () => {
    const order = sortByDepth(all), at = (x: Solid) => order.indexOf(x);
    for (const r of ramps) {
      expect(cross3d(kiln, r)).toBe(false);
      if (!meet(kiln, r)) continue;
      if (isBehind(bounds(kiln), bounds(r))) expect(at(kiln)).toBeLessThan(at(r));
      else expect(at(kiln)).toBeGreaterThan(at(r));
    }
  });

  it("orden painter: pilastras y cornisas se pintan después del muro y de las rampas que se les cruzan", () => {
    const order = sortByDepth(all), at = (x: Solid) => order.indexOf(x);
    const front = [...of(all, "prism").filter((p) => p.mat === "stockbrick"), ...of(all, "beam")];
    for (const f of front) for (const back of [walls[0]!, ...ramps]) if (meet(f, back) && cross3d(f, back)) expect(at(f)).toBeGreaterThan(at(back));
  });
});

describe("tanque de agua", () => {
  const all = build(waterTower);
  const { x: cx, y: cy } = WATER_TOWER;
  const half = (z: number) => 4 - (1.5 * z) / 14;
  const beams = of(all, "beam"), cyls = of(all, "cylinder");
  const cyl = (r: number, z: number) => cyls.find((c) => near(c.r, r) && near(c.at.z, z));

  it("centro (10, −36)", () => expect(WATER_TOWER).toEqual({ x: 10, y: -36 }));

  it("cuatro patas rust 0.5 inclinadas de 8 × 8 a 5 × 5 y riser central (D8)", () => {
    const legs = beams.filter((b) => b.mat === "rust" && b.w === 0.5);
    expect(legs).toHaveLength(4);
    for (const l of legs) {
      expect(l.h).toBe(0.5); expect(l.from.z).toBe(0); expect(l.to.z).toBe(14);
      expect(Math.abs(l.from.x - cx)).toBeCloseTo(4, 6); expect(Math.abs(l.from.y - cy)).toBeCloseTo(4, 6);
      expect(Math.abs(l.to.x - cx)).toBeCloseTo(2.5, 6); expect(Math.abs(l.to.y - cy)).toBeCloseTo(2.5, 6);
      expect(Math.sign(l.to.x - cx)).toBe(Math.sign(l.from.x - cx)); expect(Math.sign(l.to.y - cy)).toBe(Math.sign(l.from.y - cy));
    }
    expect(cyl(0.6, 0)).toMatchObject({ at: { x: cx, y: cy }, h: 14, mat: "steel" });
  });

  it("tornapuntas 0.3 a z 5 y z 10 entre ejes de patas y cruces 0.15 en los paños este y sur (D9)", () => {
    const struts = beams.filter((b) => b.w === 0.3);
    expect(struts).toHaveLength(8);
    for (const z of [5, 10]) {
      const lvl = struts.filter((b) => b.from.z === z && b.to.z === z);
      expect(lvl).toHaveLength(4);
      for (const b of lvl) for (const p of [b.from, b.to]) { expect(Math.abs(p.x - cx)).toBeCloseTo(half(z), 6); expect(Math.abs(p.y - cy)).toBeCloseTo(half(z), 6); }
    }
    const xs = beams.filter((b) => b.w === 0.15 && b.mat === "rust");
    expect(xs).toHaveLength(8);
    for (const [z0, z1] of [[0, 5], [5, 10]] as const) {
      const east = xs.filter((b) => Math.min(b.from.z, b.to.z) === z0 && Math.max(b.from.z, b.to.z) === z1 && near(b.from.x - cx, half(b.from.z)) && near(b.to.x - cx, half(b.to.z)));
      const south = xs.filter((b) => Math.min(b.from.z, b.to.z) === z0 && Math.max(b.from.z, b.to.z) === z1 && near(b.from.y - cy, half(b.from.z)) && near(b.to.y - cy, half(b.to.z)));
      expect(east).toHaveLength(2); expect(south).toHaveLength(2);
      for (const b of [...east, ...south]) expect(Math.sign(b.from.x - cx) !== Math.sign(b.to.x - cx) || Math.sign(b.from.y - cy) !== Math.sign(b.to.y - cy)).toBe(true); // en X: de esquina a esquina opuesta
    }
  });

  it("escalera paralela a la pata sudeste, hasta la pasarela (D10)", () => {
    const ladder = beams.filter((b) => b.w === 0.6);
    expect(ladder).toHaveLength(1);
    expect(ladder[0]).toMatchObject({ from: { x: 14.5, y: -31.5, z: 0 }, to: { x: 13, y: -33, z: 14 }, h: 0.15, mat: "steel" });
  });

  it("pasarela r 4.6 a z 14 con ocho postes y ocho tramos de baranda (D11)", () => {
    expect(cyl(4.6, 14)).toMatchObject({ h: 0.25, mat: "steel" });
    const posts = of(all, "prism").filter((p) => p.w === 0.15 && p.d === 0.15 && p.h === 1);
    expect(posts).toHaveLength(8);
    const pr = 4.6 * Math.cos(Math.PI / 8) - 0.15;
    for (const p of posts) { expect(p.at.z).toBeCloseTo(14.25, 6); expect(Math.hypot(p.at.x + 0.075 - cx, p.at.y + 0.075 - cy)).toBeCloseTo(pr, 6); }
    const rail = beams.filter((b) => b.w === 0.15 && b.mat === "steel");
    expect(rail).toHaveLength(8);
    for (const b of rail) { expect(b.from.z).toBeCloseTo(15.175, 6); expect(b.to.z).toBeCloseTo(15.175, 6); }
  });

  it("fondo escalonado, cuba, techo cónico de 12 lados y bola; tope ≤ 25 (D12)", () => {
    for (const [r, z] of [[2.2, 13], [3.2, 13.6], [3.8, 14.2]] as const) expect(cyl(r, z)).toMatchObject({ h: 0.6, mat: "steel" });
    expect(cyl(4, 14.8)).toMatchObject({ h: 8, mat: "steel" });
    const roof = of(all, "cone");
    expect(roof).toHaveLength(1);
    expect(roof[0]).toMatchObject({ at: { x: cx, y: cy, z: 22.8 }, r: 4.6, h: 1.4, sides: 12, mat: "steel" });
    expect(cyl(0.3, 24.2)).toMatchObject({ h: 0.5, mat: "steel" });
    for (const s of all) { expect(bounds(s).max.z).toBeLessThanOrEqual(25); expect(["rust", "steel"]).toContain(s.mat); }
    for (const c of cyls) { expect(c.at.x).toBe(cx); expect(c.at.y).toBe(cy); }
  });

  it("armado en otro centro es el mismo tanque trasladado", () => {
    const moved: Solid[] = []; waterTower(moved, { x: 0, y: 0 });
    const shift = (s: Solid) => JSON.parse(JSON.stringify(s, (k, v) => (k === "x" && typeof v === "number" ? +(v - cx).toFixed(9) : k === "y" && typeof v === "number" ? +(v - cy).toFixed(9) : v)));
    const round = (s: Solid) => JSON.parse(JSON.stringify(s, (k, v) => (typeof v === "number" ? +v.toFixed(9) : v)));
    expect(moved.map(round)).toEqual(all.map(shift).map(round));
  });

  it("ninguna pieza mide menos de 0.15", () => {
    for (const s of all) for (const d of dims(s)) expect(d).toBeGreaterThanOrEqual(0.15 - 1e-9);
  });

  it("orden painter: la pasarela se pinta después del fondo r 3.2 y antes del r 3.8", () => {
    const order = sortByDepth(all), at = (x: Solid) => order.indexOf(x);
    const deck = cyl(4.6, 14)!;
    expect(at(deck)).toBeGreaterThan(at(cyl(3.2, 13.6)!));
    expect(at(deck)).toBeLessThan(at(cyl(3.8, 14.2)!));
  });
});
