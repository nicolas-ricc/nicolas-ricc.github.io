import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { bounds, type Plate, type Solid } from "../iso/solids";
import { createRng, SEED } from "../map/seed";
import { blockAt, newCtx } from "./barrio-fixtures";
import { escuela } from "./barrio-escuela";
import { tech } from "./tech";
import { FACE_CAPS, blockRect, facesIn, insideInflated } from "./tech-budget";
import { SCHOOL } from "./tech-zoning";
import { zoneRng } from "./world";

type Prism = Solid & { kind: "prism" };
const isPrism = (s: Solid): s is Prism => s.kind === "prism";
const EPS = 1e-9;
const apart = (a: Solid, b: Solid): boolean => {
  const p = bounds(a), q = bounds(b);
  return p.max.x <= q.min.x + EPS || q.max.x <= p.min.x + EPS || p.max.y <= q.min.y + EPS || q.max.y <= p.min.y + EPS || p.max.z <= q.min.z + EPS || q.max.z <= p.min.z + EPS;
};
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6;

// el mundo real: la manzana SCHOOL tal como la arma tech() con el rng de la zona
const scene = tech(zoneRng(SEED, "cv", 2));
const b = blockAt(SCHOOL.x, SCHOOL.y), x = b.x, y = b.y, rect = blockRect(b);
const everything = [...scene.solids, ...scene.ground];
const own = everything.filter((s) => insideInflated(s, rect));
const prisms = own.filter(isPrism);
const find = (f: (s: Prism) => boolean): Prism[] => prisms.filter(f);
const block = find((s) => s.mat === "whitewash" && s.w === 6 && s.d === 16)[0];
const towers = find((s) => s.mat === "brick" && s.w === 3 && s.d === 3).sort((p, q) => p.at.y - q.at.y);
const roof = find((s) => s.mat === "copper" && s.w === 9 && s.d === 6)[0];
const columns = find((s) => s.mat === "concrete" && s.w === 0.4 && s.d === 0.4);
const mast = find((s) => s.mat === "whitewash" && s.w === 0.2 && s.d === 0.2)[0];
const flag = find((s) => s.mat === "whitewash" && s.w === 1.2 && s.d === 0.15)[0];
const trees = own.filter((s): s is Solid & { kind: "cone" } => s.kind === "cone" && s.mat === "leaf");
const lampPost = find((s) => s.mat === "steel" && s.w === 0.6 && s.d === 0.6 && s.h === 5);
const plates = (s: Prism | undefined, wall: number, f: (p: Plate) => boolean = () => true): Plate[] => (s?.plates ?? []).filter((p) => p.wall === wall && f(p));
const inRect = (a: Accent): boolean => { const p = a.kind === "dot" ? a.at : a.pts[0]!; return p.x >= rect.x0 && p.x <= rect.x1 && p.y >= rect.y0 && p.y <= rect.y1; };

describe("escuela Ameghino (#252), sobre el mundo", () => {
  it("zócalo de manzana paving 24×18×0.3", () => {
    expect(own).toContainEqual({ kind: "prism", at: { x, y, z: 0 }, w: 24, d: 18, h: 0.3, mat: "paving" });
  });

  it("bloque de aulas whitewash 6×16×5.6 en (x + 2, y + 1) sobre el zócalo", () => {
    expect(block).toBeDefined();
    expect(block!.at).toEqual({ x: x + 2, y: y + 1, z: 0.3 });
    expect(block!.h).toBe(5.6);
  });

  it("zócalo copper a todo lo largo e imposta stone en las caras este y sur", () => {
    for (const wall of [1, 2]) {
      expect(plates(block, wall, (p) => p.mat === "copper" && p.u0 === 0 && p.u1 === 1 && near(p.z0, 0.3) && near(p.z1, 1.3)), `wall ${wall}`).toHaveLength(1);
      expect(plates(block, wall, (p) => p.mat === "stone" && p.u0 === 0 && p.u1 === 1 && near(p.z0, 3.0) && near(p.z1, 3.3)), `wall ${wall}`).toHaveLength(1);
    }
  });

  it("16 ventanas glass altas pareadas en la cara este, 8 por piso, y un par por piso en la sur", () => {
    const east = plates(block, 1, (p) => p.mat === "glass");
    expect(east).toHaveLength(16);
    for (const p of east) { expect(p.toneOffset).toBe(-1); expect((p.u1 - p.u0) * 16).toBeCloseTo(0.9); expect(p.z1 - p.z0).toBeCloseTo(1.6); }
    for (const z0 of [1.0, 3.8]) {
      const floor = east.filter((p) => near(p.z0, z0)).map((p) => ((p.u0 + p.u1) / 2) * 16).sort((a, c) => a - c);
      expect(floor).toHaveLength(8);
      [1.4, 2.6, 5.4, 6.6, 9.4, 10.6, 13.4, 14.6].forEach((c, i) => expect(floor[i]).toBeCloseTo(c));
    }
    const south = plates(block, 2, (p) => p.mat === "glass");
    expect(south).toHaveLength(4);
    for (const z0 of [1.0, 3.8]) {
      // la cara sur va de este a oeste: x local = 8 − 6u
      const xs = south.filter((p) => near(p.z0, z0)).map((p) => [8 - 6 * p.u1, 8 - 6 * p.u0] as const).sort((a, c) => a[0] - c[0]);
      expect(xs).toHaveLength(2);
      expect(xs[0]![0]).toBeCloseTo(3.95); expect(xs[0]![1]).toBeCloseTo(4.85);
      expect(xs[1]![0]).toBeCloseTo(5.15); expect(xs[1]![1]).toBeCloseTo(6.05);
    }
  });

  it("5 pilastras stone de 0.4 entre pares y en los extremos, de la base al alero", () => {
    const pil = plates(block, 1, (p) => p.mat === "stone" && p.toneOffset === 1);
    expect(pil).toHaveLength(5);
    for (const p of pil) { expect((p.u1 - p.u0) * 16).toBeCloseTo(0.4); expect(p.z0).toBeCloseTo(0.3); expect(p.z1).toBeCloseTo(5.9); }
    const cs = pil.map((p) => (p.u0 + p.u1) / 2).sort((a, c) => a - c);
    [0.0125, 0.25, 0.5, 0.75, 0.9875].forEach((c, i) => expect(cs[i]).toBeCloseTo(c));
  });

  it("puerta doble officeDark entre las torres, la última placa de la cara este", () => {
    const east = plates(block, 1), door = east[east.length - 1]!;
    expect(door).toMatchObject({ shape: "rect", mat: "officeDark", toneOffset: -2 });
    expect(door.u0 * 16).toBeCloseTo(7.2); expect(door.u1 * 16).toBeCloseTo(8.8);
    expect(door.z0).toBeCloseTo(0.3); expect(door.z1).toBeCloseTo(2.6);
  });

  it("dos torres de ladrillo 3×3 de h ≥ 9 tocando la cara este, con un hueco ≥ 1.5 que enmarca la puerta", () => {
    expect(towers).toHaveLength(2);
    for (const t of towers) { expect(t.at.x).toBe(x + 8); expect(t.h).toBeGreaterThanOrEqual(9); expect(t.at.z).toBe(0.3); }
    const [n, s] = towers as [Prism, Prism];
    expect(s.at.y - (n.at.y + n.d)).toBeGreaterThanOrEqual(1.5);
    expect(n.at.y + n.d).toBeLessThanOrEqual(y + 8.2); expect(s.at.y).toBeGreaterThanOrEqual(y + 9.8);
  });

  it("un remate stone sobre cada torre y el escudo disc safety en la torre norte", () => {
    for (const t of towers) {
      const top = t.at.z + t.h;
      const cap = find((s) => s.mat === "stone" && near(s.at.z, top) && s.at.x <= t.at.x && s.at.x + s.w >= t.at.x + t.w && s.at.y <= t.at.y && s.at.y + s.d >= t.at.y + t.d);
      expect(cap, `torre ${t.at.y}`).toHaveLength(1);
    }
    const shield = plates(towers[0], 1, (p) => p.shape === "disc" && p.mat === "safety");
    expect(shield).toHaveLength(1);
    expect(shield[0]).toMatchObject({ u0: 0.3, u1: 0.7 }); expect(shield[0]!.z0).toBeCloseTo(7.2); expect(shield[0]!.z1).toBeCloseTo(8.4);
  });

  it("farol de entrada: dot ámbar r 0.5 en el hueco entre torres", () => {
    const dots = scene.accents.filter((a): a is Accent & { kind: "dot" } => a.kind === "dot" && inRect(a) && a.r === 0.5 && a.color === "amber");
    expect(dots).toHaveLength(1);
    expect(dots[0]!.at.x).toBeCloseTo(x + 8.2); expect(dots[0]!.at.y).toBeCloseTo(y + 9); expect(dots[0]!.at.z).toBeCloseTo(3.2);
  });

  it("caja de escalera: dos ventanas encendidas del grupo escuela-escalera en la cara este de la torre sur", () => {
    const homes = scene.homes.filter((w) => w.pts.every((p) => p.x >= rect.x0 && p.x <= rect.x1 && p.y >= rect.y0 && p.y <= rect.y1));
    expect(homes).toHaveLength(2);
    const s = towers[1]!;
    for (const w of homes) {
      expect(w).toMatchObject({ lit: true, group: "escuela-escalera" });
      expect(w.pts).toHaveLength(4);
      for (const p of w.pts) { expect(p.x).toBe(x + 11); expect(p.y).toBeGreaterThanOrEqual(s.at.y); expect(p.y).toBeLessThanOrEqual(s.at.y + s.d); }
      const ys = w.pts.map((p) => p.y);
      expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(1);
    }
    const zs = homes.map((w) => { const z = w.pts.map((p) => p.z); return [Math.min(...z), Math.max(...z)]; }).sort((a, c) => a[0]! - c[0]!);
    expect(zs[0]![0]).toBeCloseTo(4.5); expect(zs[0]![1]).toBeCloseTo(6.1);
    expect(zs[1]![0]).toBeCloseTo(7); expect(zs[1]![1]).toBeCloseTo(8.6);
  });

  it("patio plaza 11×16 al este del bloque", () => {
    expect(own).toContainEqual({ kind: "prism", at: { x: x + 11, y: y + 1, z: 0.3 }, w: 11, d: 16, h: 0.05, mat: "plaza" });
  });

  it("mástil whitewash de h 7 con bandera pegada a su cara este y banda hullBlue", () => {
    expect(mast).toBeDefined(); expect(mast!.h).toBe(7);
    expect(mast!.at.x).toBeCloseTo(x + 20); expect(mast!.at.y).toBeCloseTo(y + 14);
    expect(flag).toBeDefined();
    expect(flag!.at.x).toBeCloseTo(mast!.at.x + 0.2); expect(flag!.h).toBe(0.8); expect(flag!.at.z).toBeCloseTo(6);
    expect(flag!.at.y).toBeGreaterThanOrEqual(mast!.at.y); expect(flag!.at.y + flag!.d).toBeLessThanOrEqual(mast!.at.y + mast!.d + EPS);
    expect(flag!.plates?.some((p) => p.mat === "hullBlue" && p.shape === "rect" && near(p.z0, 6.27) && near(p.z1, 6.53))).toBe(true);
  });

  it("patio cubierto: techo copper 9×6 a z 3.5 sobre 4 columnas concrete", () => {
    expect(roof).toBeDefined();
    expect(roof!.at).toEqual({ x: x + 12, y: y + 2, z: 3.5 }); expect(roof!.h).toBe(0.3);
    expect(columns).toHaveLength(4);
    for (const c of columns) {
      expect(c.at.z).toBeCloseTo(0.3); expect(c.at.z + c.h).toBeCloseTo(3.5);
      expect(c.at.x).toBeGreaterThanOrEqual(roof!.at.x); expect(c.at.x + c.w).toBeLessThanOrEqual(roof!.at.x + roof!.w + EPS);
      expect(c.at.y).toBeGreaterThanOrEqual(roof!.at.y); expect(c.at.y + c.d).toBeLessThanOrEqual(roof!.at.y + roof!.d + EPS);
    }
    expect(new Set(columns.map((c) => `${c.at.x},${c.at.y}`)).size).toBe(4);
  });

  it("vereda: dos árboles leaf r 1.4 h 4 y un farol", () => {
    expect(trees).toHaveLength(2);
    for (const t of trees) { expect(t.r).toBe(1.4); expect(t.h).toBe(4); expect(t.at.x).toBeCloseTo(x + 24.8); }
    expect(trees.map((t) => t.at.y - y).sort((a, c) => a - c)).toEqual([3, 15]);
    expect(lampPost).toHaveLength(1);
  });

  it("nada se solapa: bloque ↔ torres, torres ↔ patio cubierto, mástil ↔ patio cubierto, árboles ↔ farol", () => {
    const covered = [roof!, ...columns];
    const pairs: [Solid, Solid][] = [
      ...towers.map((t): [Solid, Solid] => [block!, t]),
      ...towers.flatMap((t) => covered.map((c): [Solid, Solid] => [t, c])),
      ...[mast!, flag!].flatMap((m) => covered.map((c): [Solid, Solid] => [m, c])),
      ...trees.flatMap((t) => lampPost.map((l): [Solid, Solid] => [t, l])),
    ];
    for (const [p, q] of pairs) expect(apart(p, q), `${JSON.stringify(bounds(p))} × ${JSON.stringify(bounds(q))}`).toBe(true);
  });

  it("dentro del tope de caras y nada más alto que 21.5", () => {
    expect(facesIn(everything, rect)).toBeLessThanOrEqual(FACE_CAPS.escuela);
    for (const s of own) expect(bounds(s).max.z).toBeLessThanOrEqual(21.5);
  });
});

describe("escuela: geometría fija", () => {
  it("con otra semilla del rng da exactamente lo mismo y no consume el rng", () => {
    const a = newCtx(createRng(1)), c = newCtx(createRng(99));
    escuela(a, b); escuela(c, b);
    expect(JSON.stringify(a.solids)).toBe(JSON.stringify(c.solids));
    expect(JSON.stringify(a.accents)).toBe(JSON.stringify(c.accents));
    expect(JSON.stringify(a.homes)).toBe(JSON.stringify(c.homes));
    expect(a.rng.next()).toBe(createRng(1).next());
  });
});
