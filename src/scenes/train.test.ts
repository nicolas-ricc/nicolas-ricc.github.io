import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import type { Plate } from "../iso/plate";
import { bounds, tessellate, type Bounds, type Solid } from "../iso/solids";
import { CAR_H, CAR_LEN, CAR_W, COUPLER, FLOOR_Z, GAP, TRAIN_TOP, emu, trainBox, trainLen, type Lead } from "./train";

type Prism = Solid & { kind: "prism" };
const X0 = 100, Y = 132.5;
const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;
const prisms = (ss: Solid[]) => ss.filter((s): s is Prism => s.kind === "prism");
const is = (mat: string, w: number, d: number, h: number, z: number) => (p: Prism) => p.mat === mat && close(p.w, w) && close(p.d, d) && close(p.h, h) && close(p.at.z, z);
const carX = (k: number) => X0 + COUPLER + k * (CAR_LEN + GAP);
const span = (p: Plate) => [p.u0, p.u1, p.z0, p.z1].map((v) => Math.round(v * 1e6) / 1e6);
const sorted = <T>(xs: T[]) => [...xs].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
const on = (p: Prism, wall: number, mat: string) => (p.plates ?? []).filter((q) => q.wall === wall && q.mat === mat);
const wallLen = (s: { w: number; d: number }, wall: number) => (wall % 2 === 0 ? s.w : s.d);
const apart = (a: Bounds, b: Bounds) =>
  a.max.x <= b.min.x + 1e-9 || b.max.x <= a.min.x + 1e-9 || a.max.y <= b.min.y + 1e-9 || b.max.y <= a.min.y + 1e-9 || a.max.z <= b.min.z + 1e-9 || b.max.z <= a.min.z + 1e-9;
const COMBOS: { lead: Lead; lit: boolean }[] = (["e", "w", null] as const).flatMap((lead) => [true, false].map((lit) => ({ lead, lit })));

const DOORS = [[0.07, 0.18], [0.445, 0.555], [0.82, 0.93]] as const;
const PANES = [[0.01, 0.07], [0.18, 0.445], [0.555, 0.82], [0.93, 0.99]] as const;

describe("train: constantes", () => {
  it("valores del issue", () => {
    expect([CAR_LEN, CAR_W, CAR_H, FLOOR_Z, GAP, COUPLER]).toEqual([11, 3.4, 4, 1, 0.6, 0.5]);
    expect(trainLen(4)).toBeCloseTo(46.8, 9);
    expect(trainLen(3)).toBeCloseTo(35.2, 9);
    expect(TRAIN_TOP).toBe(5.7);
  });
});

describe("emu", () => {
  it("es determinista", () => {
    const a = emu(X0, Y, { cars: 4, lead: "e", lit: true }), b = emu(X0, Y, { cars: 4, lead: "e", lit: true });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("trainBox: x0..x0 + trainLen, y ± 1.7, z 0..5.7, y contiene a todos los sólidos", () => {
    expect(trainBox(X0, Y, 4)).toEqual({ min: { x: 100, y: 130.8, z: 0 }, max: { x: X0 + trainLen(4), y: 134.2, z: 5.7 } });
    const cases = [...COMBOS.map((o) => ({ cars: 4 as const, ...o })), { cars: 3 as const, lead: "e" as Lead, lit: true }];
    for (const o of cases) {
      const box = trainBox(X0, Y, o.cars);
      for (const s of emu(X0, Y, o).solids) {
        const b = bounds(s), where = `${JSON.stringify(o)} ${JSON.stringify(s).slice(0, 100)}`;
        for (const k of ["x", "y", "z"] as const) {
          expect(b.min[k], where).toBeGreaterThanOrEqual(box.min[k] - 1e-9);
          expect(b.max[k], where).toBeLessThanOrEqual(box.max[k] + 1e-9);
        }
      }
    }
  });

  it.each([4, 3] as const)("inventario por coche (%i coches)", (cars) => {
    const { solids } = emu(X0, Y, { cars, lead: "e", lit: true });
    const ps = prisms(solids);
    const bodies = ps.filter(is("whitewash", 11, 3.4, 4, 1));
    expect(bodies.map((p) => p.at.x).sort((a, b) => a - b).map((x) => Math.round(x * 1e6) / 1e6)).toEqual(Array.from({ length: cars }, (_, k) => Math.round(carX(k) * 1e6) / 1e6));
    for (let k = 0; k < cars; k++) {
      const xk = carX(k), c = xk + 5.5, where = `coche ${k}`;
      const body = bodies.find((p) => close(p.at.x, xk))!;
      expect(close(body.at.y, Y - 1.7), where).toBe(true);
      expect(ps.filter(is("paving", 11, 3.4, 0.2, 5)).filter((p) => close(p.at.x, xk) && close(p.at.y, Y - 1.7)), `${where} techo`).toHaveLength(1);
      const ac = ps.filter(is("steel", 3.6, 2, 0.5, 5.2)).filter((p) => close(p.at.x, c - 1.8) && close(p.at.y, Y - 1));
      expect(ac, `${where} aire`).toHaveLength(1);
      expect(sorted(on(ac[0]!, 2, "asphalt").map(span)), `${where} rejillas`).toEqual(sorted([[0.1, 0.45, 5.3, 5.6], [0.55, 0.9, 5.3, 5.6]]));
      const bogies = ps.filter(is("steel", 2.4, 2.8, 1, 0)).filter((p) => p.at.x > xk - 1e-9 && p.at.x + p.w < xk + 11 + 1e-9);
      expect(bogies.map((p) => Math.round((p.at.x + 1.2 - c) * 1e6) / 1e6).sort((a, b) => a - b), `${where} bogies`).toEqual([-3.2, 3.2]);
      for (const b of bogies) expect(close(b.at.y, Y - 1.4)).toBe(true);
      expect(on(body, 2, "steel").map(span), `${where} bastidor`).toEqual([[0, 1, 1, 1.25]]);
      expect(sorted(on(body, 2, "livery").map(span)), `${where} librea`).toEqual(sorted([
        [0, 1, 3.9, 4.7], [0, 1, 1.4, 1.6], ...DOORS.map(([u0, u1]) => [u0, u1, 1.05, 3.9]),
      ]));
      expect(sorted(on(body, 2, "glass").map(span)), `${where} vidrios`).toEqual(sorted([
        ...PANES.map(([u0, u1]) => [u0, u1, 2.5, 3.8]), ...DOORS.map(([u0, u1]) => [Math.round((u0 + 0.02) * 1e6) / 1e6, Math.round((u1 - 0.02) * 1e6) / 1e6, 2.5, 3.4]),
      ]));
    }
    const bellows = ps.filter(is("asphalt", 0.6, 3, 3.6, 1.2));
    expect(bellows.map((p) => Math.round(p.at.x * 1e6) / 1e6).sort((a, b) => a - b)).toEqual(Array.from({ length: cars - 1 }, (_, k) => Math.round((carX(k) + 11) * 1e6) / 1e6));
    for (const b of bellows) expect(close(b.at.y, Y - 1.5)).toBe(true);
    const couplers = ps.filter(is("safety", 0.5, 0.6, 0.4, 1.3));
    expect(couplers.map((p) => Math.round(p.at.x * 1e6) / 1e6).sort((a, b) => a - b)).toEqual([X0, Math.round((X0 + trainLen(cars) - 0.5) * 1e6) / 1e6]);
    for (const p of couplers) expect(close(p.at.y, Y - 0.3)).toBe(true);
    // sin pantógrafo: nada por encima del aire acondicionado, ninguna viga
    expect(solids.some((s) => s.kind === "beam")).toBe(false);
    for (const s of solids) expect(bounds(s).max.z).toBeLessThanOrEqual(TRAIN_TOP + 1e-9);
  });

  it("frentes de cabina: parabrisas, mitad superior y franja livery en wall 1 del último coche y wall 3 del primero", () => {
    const bodies = prisms(emu(X0, Y, { cars: 4, lead: "e", lit: true }).solids).filter(is("whitewash", 11, 3.4, 4, 1)).sort((a, b) => a.at.x - b.at.x);
    const front = [[0.1, 0.9, 2.6, 4.3, "asphalt"], [0, 1, 4.3, 5, "livery"], [0, 1, 1.6, 2.6, "livery"]];
    const plates = (p: Prism, wall: number) => sorted((p.plates ?? []).filter((q) => q.wall === wall).map((q) => [...span(q), q.mat]));
    expect(plates(bodies[3]!, 1)).toEqual(sorted(front));
    expect(plates(bodies[0]!, 3)).toEqual(sorted(front));
    for (const [k, b] of bodies.entries()) {
      if (k !== 3) expect(plates(b, 1), `coche ${k} este`).toEqual([]);
      if (k !== 0) expect(plates(b, 3), `coche ${k} oeste`).toEqual([]);
    }
  });

  it("ningún sólido pisa otro dentro de la formación (se tocan, no se cruzan)", () => {
    const bs = emu(X0, Y, { cars: 4, lead: "e", lit: true }).solids.map(bounds);
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) expect(apart(bs[i]!, bs[j]!), `${JSON.stringify(bs[i])} ↔ ${JSON.stringify(bs[j])}`).toBe(true);
  });

  it("tamaño mínimo 0.15 en sólidos y placas", () => {
    for (const s of emu(X0, Y, { cars: 4, lead: "e", lit: true }).solids) {
      const b = bounds(s), where = JSON.stringify(s).slice(0, 100);
      for (const k of ["x", "y", "z"] as const) expect(b.max[k] - b.min[k], `${where} ${k}`).toBeGreaterThanOrEqual(0.15 - 1e-9);
      if (s.kind !== "prism") continue;
      for (const p of s.plates ?? []) {
        expect((p.u1 - p.u0) * wallLen(s, p.wall), `${where} placa u`).toBeGreaterThanOrEqual(0.15 - 1e-9);
        expect(p.z1 - p.z0, `${where} placa z`).toBeGreaterThanOrEqual(0.15 - 1e-9);
      }
    }
  });

  // piso 120 y no 150 (plan A1): el inventario del issue tesela en 138 caras visibles con 4 coches
  it.each(COMBOS)("tope de caras: 4 coches con %o en 120..600 caras visibles", (o) => {
    const n = emu(X0, Y, { cars: 4, ...o }).solids.reduce((sum, s) => sum + tessellate(s).length, 0);
    expect(n).toBeLessThanOrEqual(600);
    expect(n).toBeGreaterThanOrEqual(120);
  });
});

describe("emu: luces", () => {
  const dots = (ls: Accent[], color: string) => ls.filter((a): a is Accent & { kind: "dot" } => a.kind === "dot" && a.color === color);
  const polys = (ls: Accent[], color: string) => ls.filter((a): a is Accent & { kind: "poly" } => a.kind === "poly" && a.color === color);
  const east = X0 + trainLen(4);

  it.each([["e", east, X0], ["w", X0, east]] as const)("lead %s: faros cyan adelante, rojas magenta atrás", (lead, head, tail) => {
    const { lights } = emu(X0, Y, { cars: 4, lead, lit: true });
    const cyan = dots(lights, "cyan"), red = dots(lights, "magenta");
    expect(cyan).toHaveLength(2); expect(red).toHaveLength(2);
    for (const d of cyan) { expect(Math.abs(d.at.x - head)).toBeLessThanOrEqual(0.5); expect(d.r).toBe(0.3); expect(d.at.z).toBe(1.8); }
    for (const d of red) { expect(Math.abs(d.at.x - tail)).toBeLessThanOrEqual(0.5); expect(d.r).toBe(0.25); expect(d.at.z).toBe(1.8); }
    for (const d of [...cyan, ...red]) expect(Math.abs(Math.abs(d.at.y - Y) - 1.3)).toBeLessThan(1e-9);
    expect(sorted(cyan.map((d) => Math.sign(d.at.y - Y)))).toEqual([-1, 1]);
  });

  it("lead null: ni faros ni rojas", () => {
    const { lights } = emu(X0, Y, { cars: 4, lead: null, lit: true });
    expect(dots(lights, "cyan")).toEqual([]);
    expect(dots(lights, "magenta")).toEqual([]);
  });

  it("salón: sin cyanBleed apagado; 4 por coche encendido, cada uno sobre un tramo de la banda de ventanas", () => {
    expect(polys(emu(X0, Y, { cars: 4, lead: "e", lit: false }).lights, "cyanBleed")).toEqual([]);
    for (const cars of [4, 3] as const) {
      const { solids, lights } = emu(X0, Y, { cars, lead: "e", lit: true });
      const bleed = polys(lights, "cyanBleed");
      expect(bleed).toHaveLength(cars * 4);
      // tramos de la banda en mundo: wall 2 corre de x1 a x0
      const panes = prisms(solids).filter(is("whitewash", 11, 3.4, 4, 1)).flatMap((b) => on(b, 2, "glass").filter((p) => p.z0 === 2.5 && p.z1 === 3.8)
        .map((p) => ({ xa: b.at.x + 11 - p.u1 * 11, xb: b.at.x + 11 - p.u0 * 11 })));
      for (const p of bleed) {
        expect(p.alpha).toBe(0.7);
        for (const q of p.pts) expect(close(q.y, Y + 1.75)).toBe(true);
        const xs = p.pts.map((q) => q.x), zs = p.pts.map((q) => q.z);
        expect([Math.min(...zs), Math.max(...zs)]).toEqual([2.5, 3.8]);
        expect(panes.filter((w) => close(w.xa, Math.min(...xs)) && close(w.xb, Math.max(...xs))), JSON.stringify(xs)).toHaveLength(1);
      }
    }
  });

  it.each([null, "e"] as const)("cartel LED ámbar en los dos frentes (lead %s)", (lead) => {
    const signs = polys(emu(X0, Y, { cars: 4, lead, lit: false }).lights, "amber");
    expect(signs).toHaveLength(2);
    for (const s of signs) {
      expect(s.alpha).toBe(0.9);
      const zs = s.pts.map((q) => q.z), ys = s.pts.map((q) => q.y);
      expect(Math.min(...zs)).toBeCloseTo(4.4, 9); expect(Math.max(...zs)).toBeCloseTo(4.75, 9);
      expect(Math.min(...ys)).toBeCloseTo(Y - 1.7 + 0.35 * 3.4, 9); expect(Math.max(...ys)).toBeCloseTo(Y - 1.7 + 0.65 * 3.4, 9);
    }
    const xs = signs.map((s) => s.pts[0]!.x).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(X0 + COUPLER - 0.05, 9);
    expect(xs[1]).toBeCloseTo(east - COUPLER + 0.05, 9);
  });
});
