import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { buildRenderList } from "../iso/render-list";
import { overlaps, screenBounds, sortByDepth } from "../iso/depth";
import { bounds, isFlat, type Bounds, type Solid } from "../iso/solids";
import { WORLD, ZONE_SPLIT_X, ZONE_SPLIT_Y, worldZoneAt } from "../map/geo";
import { allIsoColors, type Material } from "../map/palette-iso";
import { createRng } from "../map/seed";
import { boilerHouse, gableEnd, inclineBelt, metalStacks, NAVE, naveBody, stairTower } from "./boiler-house";
import { MALT, PLANT, RAIL_YARD_X, STACKS, STACK_BASE_H, chimney, factory, type FactoryScene, type Stack } from "./factory";
import { towerCrane } from "./pieces";
import { terrainAt } from "./terrain";

const scene = (): FactoryScene => factory(createRng(7));
const PORTFOLIO_MATS: readonly Material[] = ["slab", "concrete", "rust", "steel", "road", "rail", "sand", "brick", "leaf", "leafDark", "whitewash", "glass", "office", "signal", "stockbrick", "safety"];
const slender = (s: Solid) => (s.kind === "cylinder" && s.r <= 4) || (s.kind === "prism" && ((s.w <= 3 && s.d <= 3) || s.h <= 1)) || s.kind === "beam"; // chimeneas, mástiles, vigas y barandas
const tallOk = (s: Solid) => bounds(s).max.z <= 26 || slender(s);
const build = (f: (out: Solid[]) => void): Solid[] => { const out: Solid[] = []; f(out); return out; };

/** Cajas para comparar vecindades: una viga diagonal se parte en 16 tramos (su caja entera cubre mucho aire). */
function boxes(s: Solid): Bounds[] {
  if (s.kind !== "beam") return [bounds(s)];
  const at = (t: number) => ({ x: s.from.x + (s.to.x - s.from.x) * t, y: s.from.y + (s.to.y - s.from.y) * t, z: s.from.z + (s.to.z - s.from.z) * t });
  return Array.from({ length: 16 }, (_, i) => bounds({ ...s, from: at(i / 16), to: at((i + 1) / 16) }));
}
const boxApart = (a: Bounds, b: Bounds): boolean =>
  a.max.x <= b.min.x || b.max.x <= a.min.x || a.max.y <= b.min.y || b.max.y <= a.min.y || a.max.z <= b.min.z || b.max.z <= a.min.z;
/** Separados en x, en y o en z (el contacto vale), tramo por tramo. */
const apart = (a: Solid, b: Solid): boolean => boxes(a).every((p) => boxes(b).every((q) => boxApart(p, q)));
const expectApart = (as: readonly Solid[], bs: readonly Solid[]) => {
  expect(as.length).toBeGreaterThan(0); expect(bs.length).toBeGreaterThan(0);
  for (const a of as) for (const b of bs) expect(apart(a, b), `${JSON.stringify(a).slice(0, 90)} × ${JSON.stringify(b).slice(0, 90)}`).toBe(true);
};
const isTruck = (x: Solid) => x.kind === "prism" && x.d === 2.4 && ((x.w === 6 && x.h === 2.8) || (x.w === 2 && x.h === 2.2));
const isPallet = (x: Solid) => x.kind === "prism" && x.mat === "steel" && x.w === 3 && x.d === 2 && x.at.y === -3;
const isLamp = (x: Solid) => x.kind === "prism" && x.mat === "steel" && x.w === 0.6 && x.d === 0.6 && x.h === 5;
const crane = build((out) => towerCrane(out, [], { at: { x: 60, y: -12 }, mastH: 20, jibLen: 30, dir: "e", light: "cyan" }));

describe("factory", () => {
  it("es determinística y trae más de 90 sólidos elevados dentro de Portfolio", () => {
    expect(JSON.stringify(factory(createRng(7)))).toBe(JSON.stringify(factory(createRng(7))));
    const s = scene();
    expect(s.solids.filter((x) => !isFlat(x)).length).toBeGreaterThan(90); // la selva del cinturón descarta los conos que pisarían las vías del oeste
    for (const x of [...s.ground, ...s.solids]) {
      const b = bounds(x);
      expect(b.min.x).toBeGreaterThanOrEqual(WORLD.x0 - 1); expect(b.max.x).toBeLessThanOrEqual(ZONE_SPLIT_X);
      expect(b.min.y).toBeGreaterThanOrEqual(WORLD.y0 - 1); expect(b.max.y).toBeLessThanOrEqual(ZONE_SPLIT_Y);
      expect(worldZoneAt(b.min.x, b.min.y)).toBe("portfolio");
      expect(PORTFOLIO_MATS).toContain(x.mat);
    }
  });

  it("nada apoya en agua y todo lo que supera z 26 es esbelto (cilindro r ≤ 4, prisma fino o viga)", () => {
    for (const x of scene().solids) {
      const b = bounds(x);
      if (x.kind !== "cone") expect(terrainAt(b.min.x, b.min.y)).not.toBe("water");
      expect(tallOk(x)).toBe(true);
    }
  });

  it("la regla de altura rechaza un sólido ancho por encima de z 26 y acepta vigas y cilindros finos", () => {
    const at = { x: 0, y: 0, z: 0 };
    expect(tallOk({ kind: "prism", at, w: 5, d: 5, h: 27, mat: "brick" })).toBe(false);
    expect(tallOk({ kind: "cylinder", at, r: 4.5, h: 27, mat: "brick" })).toBe(false);
    expect(tallOk({ kind: "cylinder", at, r: 4, h: 30, mat: "brick" })).toBe(true);
    expect(tallOk({ kind: "beam", from: at, to: { x: 0, y: 0, z: 30 }, w: 1, h: 1, mat: "steel" })).toBe(true);
    expect(tallOk({ kind: "prism", at, w: 5, d: 5, h: 26, mat: "brick" })).toBe(true);
    expect(tallOk({ kind: "prism", at, w: 3, d: 3, h: 30, mat: "steel" })).toBe(true);
    expect(tallOk({ kind: "prism", at: { x: 0, y: 0, z: 27 }, w: 30, d: 1, h: 1, mat: "steel" })).toBe(true);
  });

  it("la planta: marcador de la maltería 24 × 30 × 18 y nave de dos prismas de ladrillo apilados, sin dientes de sierra; tres chimeneas sin banda rust, torre de enfriamiento y grúa", () => {
    const s = scene();
    expect(MALT).toEqual({ x: 20, y: -46, w: 24, d: 30, h: 18 });
    expect(NAVE).toEqual({ x: 44, y: -46, w: 76, d: 30, h: 14 });
    expect(PLANT).toMatchObject({ x: 20, y: -46, w: 100, d: 30 }); // huella estable
    expect(s.solids.filter((x) => x.kind === "prism" && x.mat === "brick" && x.at.x === MALT.x && x.at.y === MALT.y && x.w === 24 && x.d === 30 && x.h === 18)).toHaveLength(1);
    expect(s.solids.filter((x) => x.kind === "prism" && x.mat === "brick" && x.at.x === NAVE.x && x.at.y === NAVE.y && x.w === NAVE.w && x.d === NAVE.d && x.h === 7)).toHaveLength(2);
    expect(s.solids.filter((x) => x.kind === "ramp" && x.mat === "brick")).toHaveLength(0);
    for (const x of build(boilerHouse)) expect(s.solids).toContainEqual(x);
    const stacks = s.solids.filter((x) => x.kind === "cylinder" && x.mat === "brick");
    expect(stacks).toHaveLength(21); // 7 por chimenea: base escalonada, fuste y corona
    expect(s.stacks).toHaveLength(3);
    STACKS.forEach((st, i) => expect(s.stacks[i]).toEqual({ x: st.x, y: st.y, z: STACK_BASE_H + st.h }));
    expect(s.solids.some((x) => x.kind === "cylinder" && x.mat === "rust" && x.r > 1)).toBe(false); // la banda rust de antes se fue (las chimeneas metálicas y los tubos de la nave son finos)
    expect(s.solids.filter((x) => x.kind === "cylinder" && x.mat === "concrete" && x.r >= 7)).toHaveLength(4); // torre de enfriamiento
    expect(s.solids.some((x) => x.kind === "prism" && x.h === 20 && x.w === 1.2)).toBe(true); // mástil de la grúa
  });

  it("el portón este sigue en x 119.8..120.3, y −23..−17", () => {
    const gates = scene().solids.filter((x) => x.kind === "prism" && x.mat === "concrete" && x.h === 8);
    expect(gates).toHaveLength(1);
    expect(bounds(gates[0]!)).toEqual({ min: { x: 119.8, y: -23, z: 0 }, max: { x: 120.3, y: -17, z: 8 } });
  });

  it("ningún sólido de la nave supera z 20 salvo las chimeneas metálicas y sus tensores (≤ 22.6)", () => {
    const stacks = build(metalStacks);
    for (const x of stacks) expect(bounds(x).max.z).toBeLessThanOrEqual(22.6 + 1e-9);
    for (const x of [...build(naveBody), ...build(gableEnd), ...build(stairTower), ...build(inclineBelt)]) expect(bounds(x).max.z).toBeLessThanOrEqual(20);
  });

  it("las chimeneas metálicas y sus tensores quedan dentro de la huella de la nave en planta", () => {
    for (const x of build(metalStacks)) {
      const b = bounds(x);
      expect(b.min.x).toBeGreaterThanOrEqual(NAVE.x); expect(b.max.x).toBeLessThanOrEqual(NAVE.x + NAVE.w);
      expect(b.min.y).toBeGreaterThanOrEqual(NAVE.y); expect(b.max.y).toBeLessThanOrEqual(NAVE.y + NAVE.d);
    }
  });

  it("la torre de escalera no toca la cinta existente (x 121..123, y ≥ −20) ni el pedestal de la primera chimenea (x ≥ 126.5)", () => {
    const s = scene();
    const conveyor = s.solids.filter((x) => x.kind === "prism" && x.mat === "steel" && ((x.at.z === 6 && x.h === 0.6) || (x.w === 0.8 && x.d === 0.8 && x.h === 6)));
    const pedestal = s.solids.filter((x) => x.kind === "prism" && x.mat === "concrete" && x.w === 7 && x.d === 7);
    expect(Math.min(...pedestal.map((p) => bounds(p).min.x))).toBe(126.5);
    expectApart(build(stairTower), [...conveyor, ...pedestal]);
  });

  it("la cinta inclinada y su tolva no tocan camiones, pallets, grúa torre (mástil, pluma, cable, gancho) ni faroles", () => {
    const s = scene();
    for (const c of crane) expect(s.solids).toContainEqual(c);
    expect(s.solids.filter(isTruck)).toHaveLength(6);
    expect(s.solids.filter(isPallet)).toHaveLength(6);
    expect(s.solids.filter(isLamp)).toHaveLength(7);
    expectApart(build(inclineBelt), [...s.solids.filter(isTruck), ...s.solids.filter(isPallet), ...crane, ...s.solids.filter(isLamp)]);
  });

  it("el zócalo no toca camiones ni faroles", () => {
    const s = scene();
    const plinth = build(naveBody).filter((x) => (x.kind === "prism" && x.mat === "whitewash" && x.h === 3.5) || (x.kind === "cylinder" && x.r === 0.3 && x.h === 0.8));
    expect(plinth).toHaveLength(21);
    expectApart(plinth, [...s.solids.filter(isTruck), ...s.solids.filter(isLamp)]);
  });

  it("las ménsulas de las pilastras no tocan el remate sur del alero", () => {
    const body = build(naveBody);
    expectApart(body.filter((x) => x.kind === "beam" && x.w === 0.3), body.filter((x) => x.kind === "prism" && x.mat === "whitewash" && x.at.y === -15.4));
  });

  it("en la escena, el muro alto se pinta antes de cada tramo del faldón norte y del sur (sin ciclos que corten esas relaciones)", () => {
    const near = scene().solids.filter((x) => { const b = bounds(x); return b.max.x >= 17 && b.min.x <= 126.4 && b.max.y >= -49 && b.min.y <= -14; });
    const order = sortByDepth(near);
    const wall = order.findIndex((x) => x.kind === "prism" && x.mat === "brick" && x.at.x === NAVE.x && x.at.z === 7);
    const roof = order.flatMap((x, i) => (x.kind === "ramp" && x.mat === "steel" ? [i] : []));
    expect(roof).toHaveLength(6);
    for (const i of roof) expect(i).toBeGreaterThan(wall);
  });

  it("el farol de (58, −16) pasa a (50, −13.5)", () => {
    const at = scene().solids.filter(isLamp).map((l) => l.kind === "prism" ? [l.at.x, l.at.y] : []);
    expect(at).toContainEqual([50, -13.5]);
    expect(at).not.toContainEqual([58, -16]);
  });

  it("desvío con seis vagones y locomotora, cinta elevada, subestación, camiones y playa de vías con acopios", () => {
    const s = scene();
    const wagons = s.solids.filter((x) => x.kind === "prism" && x.w === 8 && x.d === 2.4 && x.h === 3);
    expect(wagons).toHaveLength(6);
    for (let i = 0; i < wagons.length; i++) for (let j = i + 1; j < wagons.length; j++) {
      const a = bounds(wagons[i]!), b = bounds(wagons[j]!);
      expect(a.max.x <= b.min.x || b.max.x <= a.min.x).toBe(true);
    }
    const conveyorPieces = s.solids.filter((x) => x.kind === "prism" && ((x.at.z === 6 && x.h === 0.6) || (x.w === 0.8 && x.d === 0.8 && x.h === 6)));
    expect(s.solids.filter((x) => x.kind === "prism" && x.at.z === 6 && x.h === 0.6)).toHaveLength(2); // dos tramos de cinta
    for (const c of conveyorPieces) { const b = bounds(c); expect(b.min.x >= PLANT.x + PLANT.w || b.min.y >= PLANT.y + PLANT.d).toBe(true); } // la cinta no pisa la planta
    expect(s.solids.filter((x) => x.kind === "prism" && x.w === 3 && x.d === 3 && x.h === 3 && x.mat === "steel")).toHaveLength(6); // transformadores
    expect(s.solids.filter((x) => x.kind === "prism" && x.w === 6 && x.d === 2.4 && x.h === 2.8)).toHaveLength(3); // camiones
    const rails = s.ground.filter((x) => x.kind === "strip" && x.mat === "steel");
    expect(rails.length).toBeGreaterThanOrEqual(RAIL_YARD_X.length * 2 + 2);
    const piles = s.solids.filter((x): x is Solid & { kind: "cone" } => x.kind === "cone" && (x.mat === "rust" || x.mat === "sand"));
    expect(piles).toHaveLength(6);
    for (const p of piles) expect(p.at.x - p.r).toBeGreaterThanOrEqual(Math.max(...RAIL_YARD_X) + 1); // ningún acopio pisa las vías
  });

  it("acentos dot (cian, magenta o ámbar) en altura y todo el render usa colores del atlas", () => {
    const s = scene();
    expect(s.accents.length).toBeGreaterThanOrEqual(7);
    expect(s.accents.every((a) => a.kind === "dot" && ["cyan", "magenta", "amber"].includes(a.color) && a.at.z > 0)).toBe(true);
    const colors = allIsoColors();
    for (const i of buildRenderList([...s.ground, ...s.solids])) expect(colors.has(i.color)).toBe(true);
  });
});

type Cyl = Solid & { kind: "cylinder" };
type Box = Solid & { kind: "prism" };
const EPS = 1e-6;
const one = (st: Stack) => { const out: Solid[] = [], acc: Accent[] = []; const mouth = chimney(st, out, acc); return { out, acc, mouth }; };
const cyls = (out: Solid[], ...mats: Material[]) => out.filter((x): x is Cyl => x.kind === "cylinder" && mats.includes(x.mat)).sort((a, b) => a.at.z - b.at.z);
const boxes = (out: Solid[], w: number, d: number, h: number) => out.filter((x): x is Box => x.kind === "prism" && Math.abs(x.w - w) < EPS && Math.abs(x.d - d) < EPS && Math.abs(x.h - h) < EPS);
const apart = (a: Solid, b: Solid) => {
  const p = bounds(a), q = bounds(b);
  return p.max.x <= q.min.x || q.max.x <= p.min.x || p.max.y <= q.min.y || q.max.y <= p.min.y || p.max.z <= q.min.z || q.max.z <= p.min.z;
};
const APO = Math.cos(Math.PI / 8); // apotema de un cilindro de 8 lados con radio 1

const isRung = (x: Solid): x is Solid & { kind: "beam" } => x.kind === "beam" && x.from.y === x.to.y && Math.abs(Math.abs(x.to.x - x.from.x) - 0.7) < 1e-9; // peldaño: 0.7 de ancho y E-O; la baranda une postes a k·π/4, ninguna cuerda corre E-O

describe.each(STACKS.map((st, i) => [i, st] as const))("chimenea %i", (_i, st) => {
  const B = STACK_BASE_H, M = B + st.h, z0 = B + 3;

  it("devuelve la boca de hoy", () => expect(one(st).mouth).toEqual({ x: st.x, y: st.y, z: M }));

  it("siete cilindros de ladrillo: base escalonada, fuste que se afina y corona", () => {
    const b = cyls(one(st).out, "brick");
    expect(b).toHaveLength(7);
    const [s1, s2, ...rest] = b, crown = rest.pop()!, shaft = rest;
    expect(s1!.r).toBeCloseTo(st.r + 1, 6); expect(s1!.at.z).toBeCloseTo(B, 6); expect(s1!.h).toBeCloseTo(1.5, 6);
    expect(s2!.r).toBeCloseTo(st.r + 0.6, 6); expect(s2!.at.z).toBeCloseTo(B + 1.5, 6); expect(s2!.h).toBeCloseTo(1.5, 6);
    expect(shaft).toHaveLength(4);
    expect(shaft[0]!.at.z).toBeCloseTo(z0, 6);
    expect(shaft[0]!.r).toBeCloseTo(st.r + 0.5, 6); expect(shaft[3]!.r).toBeCloseTo(st.r, 6);
    for (let k = 1; k < 4; k++) {
      expect(shaft[k]!.r).toBeLessThan(shaft[k - 1]!.r);
      expect(Math.abs(shaft[k]!.at.z - (shaft[k - 1]!.at.z + shaft[k - 1]!.h))).toBeLessThan(EPS);
    }
    expect(crown.r).toBeCloseTo(st.r + 0.4, 6); expect(crown.at.z + crown.h).toBeCloseTo(M, 6); expect(crown.at.z).toBeCloseTo(M - 0.6, 6);
  });

  it("siete bandas iguales rojo y blanco, rojo arriba y abajo", () => {
    const { out } = one(st);
    const bands = cyls(out, "signal", "whitewash"), shaft = cyls(out, "brick").slice(2, 6);
    expect(bands).toHaveLength(7);
    bands.forEach((b, k) => {
      expect(b.mat).toBe(k % 2 === 0 ? "signal" : "whitewash");
      expect(b.r).toBeCloseTo(st.r, 6);
      expect(b.h).toBeCloseTo(bands[0]!.h, 6);
      if (k > 0) expect(Math.abs(b.at.z - (bands[k - 1]!.at.z + bands[k - 1]!.h) - (k === 6 ? 0.3 : 0))).toBeLessThan(EPS); // hueco de 0.3 entre 6ª y 7ª: lo ocupa la plataforma
    });
    expect(bands.filter((b) => b.mat === "signal")).toHaveLength(4);
    const last = shaft[3]!;
    expect(Math.abs(bands[0]!.at.z - (last.at.z + last.h))).toBeLessThan(EPS);
    expect(bands[6]!.at.z + bands[6]!.h).toBeCloseTo(M - 0.6, 6);
    expect(bands[0]!.at.z).toBeCloseTo(z0 + (M - 0.6 - z0) / 2, 6); // arrancan en la mitad del fuste
  });

  it("sin banda rust", () => expect(one(st).out.some((x) => x.mat === "rust")).toBe(false));

  it("zunchos de acero que asoman del ladrillo", () => {
    const { out } = one(st);
    const hoops = cyls(out, "steel").filter((c) => Math.abs(c.h - 0.2) < EPS), shaft = cyls(out, "brick").slice(2, 6);
    expect(hoops.length).toBeGreaterThanOrEqual(3);
    const order = sortByDepth(out);
    for (const h of hoops) {
      const seg = shaft.find((s) => h.at.z >= s.at.z - EPS && h.at.z + h.h <= s.at.z + s.h + EPS);
      expect(seg).toBeDefined();
      expect(h.r).toBeCloseTo(seg!.r + 0.1, 6);
      expect(order.indexOf(seg!)).toBeLessThan(order.indexOf(h)); // el tramo que abraza empata en los tres ejes: tiene que ir antes o lo tapa
    }
  });

  it("puerta en la cara sur del pedestal", () => {
    const door = boxes(one(st).out, 0.9, 0.3, 1.4).filter((d) => d.mat === "steel");
    expect(door).toHaveLength(1);
    expect(door[0]!.at.x).toBeCloseTo(st.x - 0.45, 6); expect(door[0]!.at.y).toBeCloseTo(st.y + 3.5, 6); expect(door[0]!.at.z).toBe(0);
  });

  it("plataforma con ocho postes y baranda", () => {
    const { out } = one(st);
    const deck = cyls(out, "concrete");
    expect(deck).toHaveLength(1);
    expect(deck[0]!.r).toBeCloseTo(st.r + 1.2, 6); expect(deck[0]!.h).toBeCloseTo(0.3, 6);
    const bands = cyls(out, "signal", "whitewash");
    expect(deck[0]!.at.z).toBeCloseTo(bands[5]!.at.z + bands[5]!.h, 6); expect(deck[0]!.at.z + deck[0]!.h).toBeCloseTo(bands[6]!.at.z, 6); // llena la junta entre 6ª y 7ª banda
    const posts = boxes(out, 0.15, 0.15, 1.1).filter((p) => p.mat === "steel");
    expect(posts).toHaveLength(8);
    const lim = (st.r + 1.2) * APO;
    for (const p of posts) {
      expect(p.at.z).toBeCloseTo(deck[0]!.at.z + deck[0]!.h, 6);
      const b = bounds(p);
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) expect(Math.hypot(x - st.x, y - st.y)).toBeLessThanOrEqual(lim + EPS);
    }
    const rail = out.filter((x): x is Solid & { kind: "beam" } => x.kind === "beam" && !isRung(x));
    expect(rail).toHaveLength(8);
  });

  it("cuatro pararrayos sobre la boca", () => {
    const rods = boxes(one(st).out, 0.15, 0.15, 1.5).filter((p) => p.mat === "steel");
    expect(rods).toHaveLength(4);
    for (const r of rods) {
      expect(r.at.z).toBeCloseTo(M, 6);
      expect(Math.hypot(r.at.x + 0.075 - st.x, r.at.y + 0.075 - st.y)).toBeCloseTo(st.r + 0.1, 6);
    }
  });

  it("escalera de gato en la cara sur, por fuera de la plataforma, hasta la altura de la baranda", () => {
    const { out } = one(st);
    const rails = out.filter((x): x is Box => x.kind === "prism" && x.mat === "steel" && Math.abs(x.w - 0.15) < EPS && Math.abs(x.d - 0.15) < EPS && Math.abs(x.at.z - z0) < EPS);
    expect(rails).toHaveLength(2);
    const deck = cyls(out, "concrete")[0]!, top = deck.at.z + deck.h + 1.1;
    for (const r of rails) {
      expect(r.at.z + r.h).toBeCloseTo(top, 6);
      expect(bounds(r).min.y).toBeGreaterThan(st.y + deck.r * APO); // fuera de la cara sur de la losa: también de todo el fuste
    }
    const rungs = out.filter((x): x is Solid & { kind: "beam" } => isRung(x)).sort((a, b) => a.from.z - b.from.z);
    expect(rungs.length).toBeGreaterThanOrEqual(5);
    for (const g of rungs) expect(g.from.z).toBeLessThan(top);
    for (let k = 1; k < rungs.length; k++) expect(rungs[k]!.from.z - rungs[k - 1]!.from.z).toBeCloseTo(2, 6);
  });

  it("orden painter: la plataforma va antes que la banda de arriba, la corona y los postes y la baranda del lado de la cámara, y la escalera después de la plataforma", () => {
    const { out } = one(st);
    const order = sortByDepth(out), at = (x: Solid) => order.indexOf(x);
    const meet = (a: Solid, b: Solid) => overlaps(screenBounds(bounds(a)), screenBounds(bounds(b))); // el orden solo importa si se cruzan en pantalla
    const deck = cyls(out, "concrete")[0]!, bands = cyls(out, "signal", "whitewash"), crown = cyls(out, "brick").at(-1)!;
    const posts = boxes(out, 0.15, 0.15, 1.1).filter((p) => p.mat === "steel");
    const rail = out.filter((x) => x.kind === "beam" && !isRung(x));
    // del lado lejano (N/O) el borde de la losa puede pisar el pie de un poste: queda detrás del fuste y no se ve
    const near = (x: Solid) => { const b = bounds(x); return b.min.x + b.max.x - 2 * st.x + b.min.y + b.max.y - 2 * st.y > EPS; };
    for (const x of [bands[6]!, crown, ...[...posts, ...rail].filter(near)]) if (meet(deck, x)) expect(at(deck)).toBeLessThan(at(x));
    const ladder = [
      ...out.filter((x): x is Box => x.kind === "prism" && x.mat === "steel" && Math.abs(x.at.z - z0) < EPS && Math.abs(x.w - 0.15) < EPS),
      ...out.filter(isRung),
    ];
    expect(ladder.length).toBeGreaterThanOrEqual(7);
    for (const l of ladder) if (meet(l, deck)) expect(at(l)).toBeGreaterThan(at(deck));
  });

  it("dos luces magenta apenas debajo de la boca", () => {
    const { acc } = one(st);
    expect(acc).toHaveLength(2);
    for (const a of acc) { expect(a.kind).toBe("dot"); expect(a.color).toBe("magenta"); if (a.kind === "dot") { expect(a.r).toBe(0.5); expect(a.at.z).toBeCloseTo(M - 1, 6); } }
  });

  it("ninguna pieza mide menos de 0.15", () => {
    for (const x of one(st).out) {
      const b = bounds(x);
      for (const d of [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z]) expect(d).toBeGreaterThanOrEqual(0.15 - 1e-9);
    }
  });

  it("ninguna pieza toca la torre de enfriamiento", () => {
    const tower = scene().solids.filter((x) => x.kind === "cylinder" && x.mat === "concrete" && x.r >= 7);
    expect(tower).toHaveLength(4);
    for (const p of one(st).out) for (const t of tower) expect(apart(p, t)).toBe(true);
  });

  it("ninguna pieza entra al cerco de la subestación (y ≤ −47)", () => {
    for (const p of one(st).out) expect(bounds(p).min.y).toBeGreaterThan(-47);
  });
});

describe("chimeneas vecinas", () => {
  it("las piezas de una chimenea no tocan las de otra", () => {
    const all = STACKS.map((st) => one(st).out);
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++)
      for (const a of all[i]!) for (const b of all[j]!) expect(apart(a, b)).toBe(true);
  });
});
