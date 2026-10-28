import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { buildRenderList } from "../iso/render-list";
import { overlaps, screenBounds, sortByDepth } from "../iso/depth";
import { bounds, isFlat, tessellateAll, type Bounds, type Solid } from "../iso/solids";
import { WORLD, ZONE_SPLIT_X, ZONE_SPLIT_Y, worldZoneAt } from "../map/geo";
import { allIsoColors, type Material } from "../map/palette-iso";
import { createRng } from "../map/seed";
import { BAYS, boilerHouse, gableEnd, inclineBelt, metalStacks, NAVE, naveBody, STAIR_TOWER, stairTower } from "./boiler-house";
import { maltings, waterTower } from "./maltings";
import { MALT, PLANT, RAIL_YARD_X, STACKS, STACK_BASE_H, chimney, factory, type FactoryScene, type Stack } from "./factory";
import { towerCrane } from "./pieces";
import { FIREWALL, PHASES_Y, SUBSTATION, SUBSTATION_SHIFT, TRANSFORMERS_Y, currentTransformer, disconnector, droppers, powerTransformer, substation } from "./substation";
import { translate } from "../iso/translate";
import { EXCAVATOR, excavator, excavatorBox, excavatorWheel, local } from "./excavator";
import { terrainAt } from "./terrain";

const scene = (): FactoryScene => factory(createRng(7));
const PORTFOLIO_MATS: readonly Material[] = ["slab", "concrete", "rust", "steel", "road", "rail", "sand", "brick", "leaf", "leafDark", "whitewash", "glass", "office", "signal", "stockbrick", "safety"];
const slender = (s: Solid) => (s.kind === "cylinder" && s.r <= 4) || (s.kind === "prism" && ((s.w <= 3 && s.d <= 3) || s.h <= 1)) || s.kind === "beam"; // chimeneas, mástiles, vigas y barandas
const tallOk = (s: Solid) => bounds(s).max.z <= 26 || slender(s);
const build = (f: (out: Solid[]) => void): Solid[] => { const out: Solid[] = []; f(out); return out; };

/** Cajas para comparar vecindades: una viga diagonal se parte en 16 tramos (su caja entera cubre mucho aire). */
function slices(s: Solid): Bounds[] {
  if (s.kind !== "beam") return [bounds(s)];
  const at = (t: number) => ({ x: s.from.x + (s.to.x - s.from.x) * t, y: s.from.y + (s.to.y - s.from.y) * t, z: s.from.z + (s.to.z - s.from.z) * t });
  return Array.from({ length: 16 }, (_, i) => bounds({ ...s, from: at(i / 16), to: at((i + 1) / 16) }));
}
const boxApart = (a: Bounds, b: Bounds): boolean =>
  a.max.x <= b.min.x || b.max.x <= a.min.x || a.max.y <= b.min.y || b.max.y <= a.min.y || a.max.z <= b.min.z || b.max.z <= a.min.z;
/** Separados en x, en y o en z (el contacto vale), tramo por tramo. */
const apartSliced = (a: Solid, b: Solid): boolean => slices(a).every((p) => slices(b).every((q) => boxApart(p, q)));
const expectApart = (as: readonly Solid[], bs: readonly Solid[]) => {
  expect(as.length).toBeGreaterThan(0); expect(bs.length).toBeGreaterThan(0);
  for (const a of as) for (const b of bs) expect(apartSliced(a, b), `${JSON.stringify(a).slice(0, 90)} × ${JSON.stringify(b).slice(0, 90)}`).toBe(true);
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
    for (const x of [...s.ground, ...s.solids, ...s.excavator]) {
      const b = bounds(x);
      expect(b.min.x).toBeGreaterThanOrEqual(WORLD.x0 - 1); expect(b.max.x).toBeLessThanOrEqual(ZONE_SPLIT_X);
      expect(b.min.y).toBeGreaterThanOrEqual(WORLD.y0 - 1); expect(b.max.y).toBeLessThanOrEqual(ZONE_SPLIT_Y);
      expect(worldZoneAt(b.min.x, b.min.y)).toBe("portfolio");
      expect(PORTFOLIO_MATS).toContain(x.mat);
    }
  });

  it("nada apoya en agua y todo lo que supera z 26 es esbelto (cilindro r ≤ 4, prisma fino o viga)", () => {
    const sc = scene();
    for (const x of [...sc.solids, ...sc.excavator]) {
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

  it("la planta: maltería 24 × 30 × 18 de cinco pisos, tanque y nave de dos prismas de ladrillo apilados, sin dientes de sierra; tres chimeneas sin banda rust, torre de enfriamiento y grúa", () => {
    const s = scene();
    expect(MALT).toEqual({ x: 20, y: -46, w: 24, d: 30, h: 18 });
    expect(PLANT).toEqual({ x: MALT.x, y: MALT.y, w: MALT.w + NAVE.w, d: 30, h: 14 }); // maltería + nave
    expect(PLANT.w).toBe(87);
    expect(PLANT.x + PLANT.w).toBe(NAVE.x + NAVE.w); // el portón queda contra el testero
    expect(s.solids.filter((x) => x.kind === "prism" && x.mat === "brick" && x.at.x === MALT.x && x.at.y === MALT.y && x.w === 24 && x.d === 30 && x.h === 18 && x.facade?.floors === 5)).toHaveLength(1);
    for (const x of [...build(maltings), ...build(waterTower)]) expect(s.solids).toContainEqual(x);
    expect(s.solids.filter((x) => x.kind === "ramp" && x.mat === "steel" && x.w === 6 && x.at.z === 18)).toHaveLength(4); // faldones de la maltería
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

  it("el portón este va en el testero: x 106.8..107.3, y −23..−17", () => {
    const gates = scene().solids.filter((x) => x.kind === "prism" && x.mat === "concrete" && x.h === 8);
    expect(gates).toHaveLength(1);
    const b = bounds(gates[0]!);
    expect(b.min.x).toBeCloseTo(PLANT.x + PLANT.w - 0.2, 9); expect(b.max.x).toBeCloseTo(PLANT.x + PLANT.w + 0.3, 9);
    expect(b.min.x).toBeCloseTo(106.8, 9); expect(b.max.x).toBeCloseTo(107.3, 9);
    expect(b.min.y).toBe(-23); expect(b.max.y).toBe(-17); expect(b.min.z).toBe(0); expect(b.max.z).toBe(8);
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

  it("la torre de escalera no toca el pedestal de la primera chimenea (x ≥ 126.5)", () => {
    const s = scene();
    const pedestal = s.solids.filter((x) => x.kind === "prism" && x.mat === "concrete" && x.w === 7 && x.d === 7);
    expect(Math.min(...pedestal.map((p) => bounds(p).min.x))).toBe(126.5);
    expectApart(build(stairTower), pedestal);
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
    expect(plinth).toHaveLength(2 * BAYS + 1);
    expectApart(plinth, [...s.solids.filter(isTruck), ...s.solids.filter(isLamp)]);
  });

  it("las ménsulas de las pilastras no tocan el remate sur del alero", () => {
    const body = build(naveBody);
    expectApart(body.filter((x) => x.kind === "beam" && x.w === 0.3), body.filter((x) => x.kind === "prism" && x.mat === "whitewash" && x.at.y === -15.4));
  });

  it("en la escena, el muro alto se pinta antes de cada tramo del faldón norte y del sur (sin ciclos que corten esas relaciones)", () => {
    const near = scene().solids.filter((x) => { const b = bounds(x); return b.max.x >= 17 && b.min.x <= STAIR_TOWER.x1 + 0.4 && b.max.y >= -49 && b.min.y <= -14; });
    const order = sortByDepth(near);
    const wall = order.findIndex((x) => x.kind === "prism" && x.mat === "brick" && x.at.x === NAVE.x && x.at.z === 7);
    const roof = order.flatMap((x, i) => (x.kind === "ramp" && x.mat === "steel" && x.at.x >= NAVE.x ? [i] : []));
    expect(roof).toHaveLength(6);
    for (const i of roof) expect(i).toBeGreaterThan(wall);
  });

  it("el tanque no toca desvío ni locomotora (y ≤ −9.3) ni la maltería (x ≤ 20)", () => {
    const s = scene(), tank = build(waterTower);
    for (const x of tank) { const b = bounds(x); expect(b.max.y).toBeLessThanOrEqual(-9.3); expect(b.max.x).toBeLessThanOrEqual(20); }
    const siding = s.ground.filter((x) => x.kind === "strip" && x.path.some((p) => p.y > -9.3 && p.y < -6.7));
    const loco = s.solids.filter((x) => x.kind === "prism" && x.mat === "steel" && x.at.y === -9.3);
    expect(loco).toHaveLength(2); // locomotora y cabina
    expectApart(tank, [...siding, ...loco, ...build(maltings)]);
  });

  it("la maltería no pisa la nave (x ≤ 44) ni los pallets (y ≤ −16)", () => {
    const s = scene(), malt = build(maltings);
    for (const x of malt) { const b = bounds(x); expect(b.max.x).toBeLessThanOrEqual(44); expect(b.max.y).toBeLessThanOrEqual(-16); }
    expectApart(malt, [...build(naveBody), ...s.solids.filter(isPallet)]);
  });

  it("ningún sólido de maltería o tanque supera z 26", () => {
    for (const x of [...build(maltings), ...build(waterTower)]) expect(bounds(x).max.z).toBeLessThanOrEqual(26 + 1e-9);
  });

  it("el farol de (58, −16) pasa a (50, −13.5)", () => {
    const at = scene().solids.filter(isLamp).map((l) => l.kind === "prism" ? [l.at.x, l.at.y] : []);
    expect(at).toContainEqual([50, -13.5]);
    expect(at).not.toContainEqual([58, -16]);
  });

  it("desvío con seis vagones y locomotora, sin cinta larga, subestación, camiones y playa de vías con acopios", () => {
    const s = scene();
    const wagons = s.solids.filter((x) => x.kind === "prism" && x.w === 8 && x.d === 2.4 && x.h === 3);
    expect(wagons).toHaveLength(6);
    for (let i = 0; i < wagons.length; i++) for (let j = i + 1; j < wagons.length; j++) {
      const a = bounds(wagons[i]!), b = bounds(wagons[j]!);
      expect(a.max.x <= b.min.x || b.max.x <= a.min.x).toBe(true);
    }
    expect(s.solids.filter((x) => x.kind === "prism" && x.at.z === 6 && x.h === 0.6)).toEqual([]);           // tramos de la cinta larga
    expect(s.solids.filter((x) => x.kind === "prism" && x.w === 0.8 && x.d === 0.8 && x.h === 6)).toEqual([]); // sus caballetes
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
    for (const i of buildRenderList([...s.ground, ...s.solids, ...s.excavator])) expect(colors.has(i.color)).toBe(true);
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

  it("ninguna pieza entra al cerco de la subestación", () => {
    for (const p of one(st).out) expect(apartBox(bounds(p), FENCE_BOX)).toBe(true);
  });
});

describe("chimeneas vecinas", () => {
  it("las piezas de una chimenea no tocan las de otra", () => {
    const all = STACKS.map((st) => one(st).out);
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++)
      for (const a of all[i]!) for (const b of all[j]!) expect(apart(a, b)).toBe(true);
  });
});

const sub = (): Solid[] => build(substation);
/** Cerco de la subestación en mundo, de z 0 a los mástiles (z 12). */
const FENCE_BOX: Bounds = { min: { x: SUBSTATION.x0, y: SUBSTATION.y0, z: 0 }, max: { x: SUBSTATION.x1, y: SUBSTATION.y1, z: 12 } };
/** Portón del cerco sur: de 19.5 a 22.5 desde la esquina oeste. */
const GATE = { x0: SUBSTATION.x0 + 19.5, x1: SUBSTATION.x0 + 22.5 } as const;
/** Redondeo a 1e-6: compara x de mundo (157.1 − 95 no es exactamente 62.1). */
const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;
/** Huella FNV-1a de 32 bits del JSON de los sólidos, con los números redondeados a 1e-6. */
function fingerprint(solids: readonly Solid[]): string {
  const json = JSON.stringify(solids, (_k, v: unknown) => (typeof v === "number" ? r6(v) + 0 : v));
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) h = Math.imul(h ^ json.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}
/** Huella de la subestación de hoy en su marco local (x 149..190, y −60..−47), tomada antes del traslado (#244). */
const LOCAL_FINGERPRINT = "ef04a1c8";
const raised = (): Solid[] => sub().filter((x) => !isFlat(x));
function union(solids: readonly Solid[]): Bounds {
  const bs = solids.map(bounds);
  return {
    min: { x: Math.min(...bs.map((b) => b.min.x)), y: Math.min(...bs.map((b) => b.min.y)), z: Math.min(...bs.map((b) => b.min.z)) },
    max: { x: Math.max(...bs.map((b) => b.max.x)), y: Math.max(...bs.map((b) => b.max.y)), z: Math.max(...bs.map((b) => b.max.z)) },
  };
}
/** Disjuntas en x, en y o en z (tocarse en una cara no es solape). */
const apartBox = (a: Bounds, b: Bounds): boolean =>
  a.max.x <= b.min.x + 1e-9 || b.max.x <= a.min.x + 1e-9 || a.max.y <= b.min.y + 1e-9 || b.max.y <= a.min.y + 1e-9 || a.max.z <= b.min.z + 1e-9 || b.max.z <= a.min.z + 1e-9;
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6;
const isPrism = (x: Solid, w: number, d: number, h: number, mat?: string): x is Solid & { kind: "prism" } =>
  x.kind === "prism" && near(x.w, w) && near(x.d, d) && near(x.h, h) && (mat === undefined || x.mat === mat);
type Beam = Solid & { kind: "beam" };
const beams = (solids: readonly Solid[]): Beam[] => solids.filter((x): x is Beam => x.kind === "beam");
const beamLen = (b: Beam): number => Math.hypot(b.to.x - b.from.x, b.to.y - b.from.y, b.to.z - b.from.z);
const cylinders = (solids: readonly Solid[]) => solids.filter((x): x is Solid & { kind: "cylinder" } => x.kind === "cylinder");
const T1 = (): Solid[] => build((o) => powerTransformer(o, TRANSFORMERS_Y[0], false));
const T2 = (): Solid[] => build((o) => powerTransformer(o, TRANSFORMERS_Y[1], true));
const fins = (solids: readonly Solid[]) => solids.filter((x) => x.mat === "steel" && (isPrism(x, 0.15, 1.6, 3) || isPrism(x, 1.6, 0.15, 3)));

describe("subestación de intemperie (#215)", () => {
  it("se quitan los cubos 3 × 3 × 3 y los pórticos de postes de hoy", () => {
    const s = scene();
    expect(s.solids.filter((x) => isPrism(x, 3, 3, 3, "steel"))).toHaveLength(0);
    expect(s.solids.filter((x) => isPrism(x, 0.6, 0.6, 7, "steel"))).toHaveLength(0);
    expect(s.solids.filter((x) => isPrism(x, 0.6, 10.6, 0.6, "steel"))).toHaveLength(0);
  });

  it("patio de grava sand antes del cordón concrete, y los dos en el suelo de la fábrica", () => {
    const flat = sub().filter(isFlat);
    const yard = flat.findIndex((x) => x.kind === "strip" && x.mat === "sand"), curb = flat.findIndex((x) => x.kind === "strip" && x.mat === "concrete");
    expect(yard).toBeGreaterThanOrEqual(0); expect(curb).toBeGreaterThan(yard);
    const g = flat[yard]!;
    expect(g).toMatchObject({ kind: "strip", width: SUBSTATION.y1 - SUBSTATION.y0, z: 0.03, path: [{ x: SUBSTATION.x0, y: (SUBSTATION.y0 + SUBSTATION.y1) / 2 }, { x: SUBSTATION.x1, y: (SUBSTATION.y0 + SUBSTATION.y1) / 2 }] });
    const b = bounds(g);
    expect(b.min.x).toBeGreaterThanOrEqual(SUBSTATION.x0); expect(b.max.x).toBeLessThanOrEqual(SUBSTATION.x1);
    expect(b.min.y).toBeGreaterThanOrEqual(SUBSTATION.y0 - 1e-9); expect(b.max.y).toBeLessThanOrEqual(SUBSTATION.y1 + 1e-9);
    const ground = scene().ground;
    const gi = ground.findIndex((x) => x.kind === "strip" && x.mat === "sand" && x.width === 13);
    const ci = ground.findIndex((x) => x.kind === "strip" && x.mat === "concrete" && x.path.length === 5 && x.path[0]!.x === SUBSTATION.x0);
    expect(gi).toBeGreaterThanOrEqual(0); expect(ci).toBeGreaterThan(gi);
  });

  it("el cerco está contra el desvío en x 54..95, y −2..11: SUBSTATION_SHIFT (−95, +58) desde x 149..190, y −60..−47", () => {
    expect(SUBSTATION_SHIFT).toEqual({ x: -95, y: 58 });
    expect(SUBSTATION).toEqual({ x0: 54, x1: 95, y0: -2, y1: 11 });
    expect(PHASES_Y).toEqual([1, 4.5, 8]);
    expect(TRANSFORMERS_Y).toEqual([-1, 5]);
    expect(FIREWALL).toEqual({ x: 76.5, y: 3.7, w: 7, d: 0.6, h: 5.5 });
  });

  it("es la subestación de hoy trasladada: mismos sólidos, en el mismo orden, desplazados SUBSTATION_SHIFT", () => {
    const world = sub();
    expect(world).toHaveLength(357);
    expect(raised()).toHaveLength(355);
    const local = world.map((x) => translate(x, -SUBSTATION_SHIFT.x, -SUBSTATION_SHIFT.y));
    expect(fingerprint(local)).toBe(LOCAL_FINGERPRINT);
    // anclas en el marco de hoy, más el shift: caseta, cubas, cortafuego y pilares del portón
    const at = (x: number, y: number) => ({ x: x + SUBSTATION_SHIFT.x, y: y + SUBSTATION_SHIFT.y });
    const hut = world.find((x): x is Solid & { kind: "prism" } => isPrism(x, 4, 3, 2.8, "whitewash"))!;
    expect(hut.at).toMatchObject(at(182, -52));
    const tanks = world.filter((x): x is Solid & { kind: "prism" } => isPrism(x, 6, 4, 4, "steel"));
    expect(tanks.map((t) => ({ x: t.at.x, y: t.at.y }))).toEqual([at(172, -59), at(172, -53)]);
    const wall = world.find((x): x is Solid & { kind: "prism" } => isPrism(x, FIREWALL.w, FIREWALL.d, FIREWALL.h, "concrete"))!;
    expect(r6(wall.at.x)).toBe(r6(at(171.5, -54.3).x)); expect(r6(wall.at.y)).toBe(r6(at(171.5, -54.3).y));
    const pillars = world.filter((x): x is Solid & { kind: "prism" } => isPrism(x, 0.6, 0.6, 2.6, "concrete"));
    expect(pillars.map((p) => r6(p.at.x))).toEqual([r6(at(168.5, 0).x), r6(at(170.9, 0).x)]);
  });

  it("todo sólido de la subestación cae dentro del cerco SUBSTATION, y ninguno supera z 12", () => {
    const solids = raised();
    expect(solids.length).toBeGreaterThan(300);
    for (const x of solids) {
      const b = bounds(x);
      expect(b.min.x, x.kind).toBeGreaterThanOrEqual(SUBSTATION.x0); expect(b.max.x, x.kind).toBeLessThanOrEqual(SUBSTATION.x1);
      expect(b.min.y, x.kind).toBeGreaterThanOrEqual(SUBSTATION.y0); expect(b.max.y, x.kind).toBeLessThanOrEqual(SUBSTATION.y1);
      expect(b.min.z, x.kind).toBeGreaterThanOrEqual(0); expect(b.max.z, x.kind).toBeLessThanOrEqual(12 + 1e-9);
    }
    expect(union(solids).max.z).toBeCloseTo(12); // los mástiles de hilo de guardia
  });

  it("ninguna pieza más fina que 0.15 u", () => {
    const min = 0.15 - 1e-9;
    for (const x of raised()) {
      if (x.kind === "prism") for (const v of [x.w, x.d, x.h]) expect(v).toBeGreaterThanOrEqual(min);
      if (x.kind === "cylinder" || x.kind === "cone") { expect(2 * x.r).toBeGreaterThanOrEqual(min); expect(x.h).toBeGreaterThanOrEqual(min); }
      if (x.kind === "beam") for (const v of [x.w, x.h, beamLen(x)]) expect(v).toBeGreaterThanOrEqual(min);
    }
  });

  it("queda en la región nueva: y ≥ −4 y x ≤ 98.7", () => {
    for (const x of raised()) { const b = bounds(x); expect(b.min.y).toBeGreaterThanOrEqual(-4); expect(b.max.x).toBeLessThanOrEqual(98.7); }
  });

  it("farol de la subestación en la esquina SO del cerco, (53, 12)", () => {
    const lamp = scene().solids.filter((x): x is Solid & { kind: "prism" } => isLamp(x) && x.at.x === SUBSTATION.x0 - 1 && x.at.y === SUBSTATION.y1 + 1);
    expect(lamp).toHaveLength(1);
    expect(lamp[0]!.at).toMatchObject({ x: 53, y: 12 });
    expect(scene().solids.filter((x) => isLamp(x) && x.at.x === 148 && x.at.y === -46)).toHaveLength(0);
  });

  it("no toca ningún otro sólido de la fábrica: vagones, locomotora, grúa torre, pallets, camiones, faroles, torre y chimeneas", () => {
    const s = scene(), mine = raised();
    const keys = new Set(mine.map((x) => JSON.stringify(x)));
    expect(s.solids.filter((x) => keys.has(JSON.stringify(x)))).toHaveLength(mine.length);
    const others = s.solids.filter((x) => !keys.has(JSON.stringify(x)));
    expect(others.length).toBeGreaterThan(0);
    const near12 = others.flatMap(slices).filter((b) => b.max.x >= SUBSTATION.x0 - 2 && b.min.x <= SUBSTATION.x1 + 2 && b.max.y >= SUBSTATION.y0 - 2 && b.min.y <= SUBSTATION.y1 + 2);
    expect(near12.length).toBeGreaterThan(0); // el farol propio, al menos
    for (const a of mine) for (const p of slices(a)) for (const q of near12) expect(apartBox(p, q), JSON.stringify(a).slice(0, 90)).toBe(true);
  });

  it("cerco: 13 postes, ninguno en el portón, y malla romboidal de 26 diagonales", () => {
    const solids = raised();
    const posts = solids.filter((x): x is Solid & { kind: "prism" } => isPrism(x, 0.15, 0.15, 2.2, "steel"));
    expect(posts).toHaveLength(13);
    for (const p of posts) expect(p.at.x + 0.15 <= GATE.x0 + 1e-9 || p.at.x >= GATE.x1 - 1e-9).toBe(true);
    expect(posts.filter((p) => near(p.at.y, SUBSTATION.y1 - 0.15))).toHaveLength(10); // lado sur
    expect(posts.filter((p) => near(p.at.x, SUBSTATION.x1 - 0.15))).toHaveLength(4);  // lado este, con la esquina
    const mesh = beams(solids).filter((b) => b.mat === "steel" && near(b.w, 0.15) && near(Math.min(b.from.z, b.to.z), 0.1) && near(Math.max(b.from.z, b.to.z), 2.1));
    expect(mesh).toHaveLength(26);
  });

  it("portón de dos hojas: pilares con carteles rayo safety y peligro signal, 8 barrotes y 2 rieles", () => {
    const solids = raised();
    const pillars = solids.filter((x): x is Solid & { kind: "prism" } => isPrism(x, 0.6, 0.6, 2.6, "concrete"));
    expect(pillars.map((p) => r6(p.at.x)).sort((a, b) => a - b)).toEqual([r6(GATE.x0), r6(GATE.x1 - 0.6)]);
    const plates = pillars.flatMap((p) => p.plates ?? []);
    expect(plates).toEqual(expect.arrayContaining([expect.objectContaining({ wall: 2, shape: "tri", mat: "safety" }), expect.objectContaining({ wall: 2, shape: "rect", mat: "signal" })]));
    const bars = solids.filter((x): x is Solid & { kind: "prism" } => isPrism(x, 0.15, 0.15, 2, "steel") && x.at.z === 0); // los mástiles (z 10) miden igual
    expect(bars).toHaveLength(8);
    for (const b of bars) { expect(b.at.x).toBeGreaterThanOrEqual(GATE.x0 + 0.6 - 1e-9); expect(b.at.x + 0.15).toBeLessThanOrEqual(GATE.x1 - 0.6 + 1e-9); }
    expect(beams(solids).filter((b) => near(b.from.z, 1.85) && near(b.to.z, 1.85) && near(b.from.y, SUBSTATION.y1 - 0.3))).toHaveLength(2);
  });

  it("caseta de control whitewash con fachada y puerta", () => {
    const hut = raised().filter((x): x is Solid & { kind: "prism" } => isPrism(x, 4, 3, 2.8, "whitewash"));
    expect(hut).toHaveLength(1);
    expect(hut[0]!.at).toEqual({ x: SUBSTATION.x0 + 33, y: SUBSTATION.y0 + 8, z: 0 });
    expect(hut[0]!.facade).toMatchObject({ floors: 1, cols: 2 });
    expect(hut[0]!.plates).toEqual([expect.objectContaining({ wall: 2, shape: "rect", mat: "steel", toneOffset: -2 })]);
  });

  it("dos pórticos de celosía: 16 montantes, 64 diagonales en X, 4 cordones, 16 tramos de zigzag, 4 puntas y 4 mástiles", () => {
    const solids = raised();
    expect(solids.filter((x) => isPrism(x, 0.2, 0.2, 9, "steel"))).toHaveLength(16);
    const thin = beams(solids).filter((b) => b.mat === "steel" && near(b.w, 0.15));
    const diag = thin.filter((b) => { const dz = Math.abs(b.to.z - b.from.z); return (near(dz, 2.5) || near(dz, 2.4) || near(dz, 1.5)) && near(Math.hypot(b.to.x - b.from.x, b.to.y - b.from.y), 0.8); });
    expect(diag).toHaveLength(64);
    expect(beams(solids).filter((b) => b.mat === "steel" && near(b.w, 0.3) && near(b.h, 0.3))).toHaveLength(4);
    expect(thin.filter((b) => near(Math.abs(b.to.y - b.from.y), 1.125) && near(Math.abs(b.to.z - b.from.z), 1) && near(b.from.x, b.to.x))).toHaveLength(16);
    expect(solids.filter((x) => x.kind === "cone" && x.mat === "steel" && x.sides === 4 && near(x.r, 0.7) && near(x.h, 1))).toHaveLength(4);
    expect(solids.filter((x) => isPrism(x, 0.15, 0.15, 2, "steel") && near(x.at.z, 10))).toHaveLength(4);
  });

  it("tres líneas de SUBSTATION.x0 + 2.5 a SUBSTATION.x1 − 3.5 a z 9.5: dos cadenas de 9 discos alternados y un conductor entre ellas, disjuntos en x", () => {
    const all = beams(raised());
    for (const y of PHASES_Y) {
      const line = all.filter((b) => near(b.from.y, y) && near(b.to.y, y) && near(b.from.z, 9.5) && near(b.to.z, 9.5));
      const discs = line.filter((b) => near(beamLen(b), 0.15));
      expect(discs).toHaveLength(18);
      for (const d of discs) expect((near(d.w, 0.5) && near(d.h, 0.5) && d.mat === "whitewash") || (near(d.w, 0.35) && near(d.h, 0.35) && d.mat === "glass")).toBe(true);
      expect(discs.filter((d) => d.mat === "whitewash")).toHaveLength(10);
      const wires = line.filter((b) => b.mat === "steel" && near(b.w, 0.15) && !near(beamLen(b), 0.15));
      expect(wires).toHaveLength(1);
      const w = bounds(wires[0]!);
      expect(w.min.x).toBeCloseTo(SUBSTATION.x0 + 3.85); expect(w.max.x).toBeCloseTo(SUBSTATION.x1 - 4.85);
      const db = discs.map(bounds);
      expect(Math.min(...db.map((b) => b.min.x))).toBeCloseTo(SUBSTATION.x0 + 2.5); expect(Math.max(...db.map((b) => b.max.x))).toBeCloseTo(SUBSTATION.x1 - 3.5);
      for (const b of db) expect(b.max.x <= w.min.x + 1e-9 || b.min.x >= w.max.x - 1e-9).toBe(true);
    }
  });

  it("tres seccionadores: bastidor, dos columnas de 6 polleras y brazo signal", () => {
    const solids = raised();
    expect(solids.filter((x) => isPrism(x, 2.4, 0.6, 2.5, "steel"))).toHaveLength(3);
    expect(beams(solids).filter((b) => b.mat === "signal" && near(b.w, 0.2) && near(b.h, 0.2))).toHaveLength(3);
    const one = build((o) => disconnector(o, PHASES_Y[0]));
    const sheds = cylinders(one).filter((c) => c.mat === "whitewash" && near(c.h, 0.3));
    expect(sheds).toHaveLength(12);
    expect(new Set(sheds.map((c) => c.r))).toEqual(new Set([0.3, 0.42]));
    expect(new Set(sheds.map((c) => r6(c.at.x)))).toEqual(new Set([r6(SUBSTATION.x0 + 8.1), r6(SUBSTATION.x0 + 9.9)]));
    for (const c of sheds) { expect(near(c.at.y, PHASES_Y[0])).toBe(true); expect(apartBox(bounds(c), FENCE_BOX)).toBe(false); } // sub-builder en mundo: cae en el cerco
  });

  it("tres TI sobre escalerilla, con 6 polleras y cabeza redondeada", () => {
    const one = build((o) => currentTransformer(o, PHASES_Y[1]));
    expect(one.filter((x) => isPrism(x, 0.15, 0.15, 2.5, "steel"))).toHaveLength(4);
    expect(one.filter((x) => isPrism(x, 0.8, 0.8, 0.15, "steel"))).toHaveLength(1);
    expect(cylinders(one).filter((c) => c.mat === "whitewash" && near(c.h, 0.3))).toHaveLength(6);
    expect(cylinders(one).filter((c) => c.mat === "whitewash" && near(c.r, 0.6) && near(c.h, 0.8))).toHaveLength(1);
    expect(one.filter((x) => x.kind === "cone" && x.mat === "whitewash" && near(x.r, 0.6) && near(x.h, 0.4))).toHaveLength(1);
    expect(cylinders(raised()).filter((c) => c.mat === "whitewash" && near(c.r, 0.6) && near(c.h, 0.8))).toHaveLength(3);
    expect(cylinders(raised()).filter((c) => c.mat === "whitewash" && near(c.h, 0.3))).toHaveLength(54); // 36 de seccionadores + 18 de TI
  });

  it("seccionadores, TI y transformadores de fases distintas no se tocan entre sí", () => {
    const units: { phase: number; b: Bounds }[] = [
      ...PHASES_Y.map((y, i) => ({ phase: i, b: union(build((o) => disconnector(o, y))) })),
      ...PHASES_Y.map((y, i) => ({ phase: i, b: union(build((o) => currentTransformer(o, y))) })),
      { phase: 0, b: union(T1()) }, { phase: 2, b: union(T2()) },
    ];
    for (const a of units) for (const c of units) if (a.phase !== c.phase) expect(apartBox(a.b, c.b)).toBe(true);
    for (const { b } of units) { // los sub-builders reciben y emiten mundo: cada unidad cae dentro del cerco
      expect(b.min.x).toBeGreaterThanOrEqual(SUBSTATION.x0); expect(b.max.x).toBeLessThanOrEqual(SUBSTATION.x1);
      expect(b.min.y).toBeGreaterThanOrEqual(SUBSTATION.y0 - 1e-9); expect(b.max.y).toBeLessThanOrEqual(SUBSTATION.y1 + 1e-9);
    }
  });

  it("dos transformadores: cuba 6 × 4 × 4 a z 0.5 con placa, 18 aletas, conservador con caño y 3 pasatapas a 35° hacia el sur", () => {
    const solids = raised();
    const tanks = solids.filter((x): x is Solid & { kind: "prism" } => isPrism(x, 6, 4, 4, "steel"));
    expect(tanks.map((t) => t.at)).toEqual(TRANSFORMERS_Y.map((y) => ({ x: SUBSTATION.x0 + 23, y, z: 0.5 })));
    for (const t of tanks) expect(t.plates).toEqual([expect.objectContaining({ shape: "rect", mat: "whitewash" })]);
    expect(fins(solids)).toHaveLength(18);
    expect(fins(T1())).toHaveLength(6); expect(fins(T2())).toHaveLength(12);
    for (const unit of [T1(), T2()]) {
      expect(beams(unit).filter((b) => b.mat === "steel" && near(b.w, 1.2) && near(b.h, 1.2))).toHaveLength(1); // conservador
      expect(beams(unit).filter((b) => b.mat === "steel" && near(b.w, 0.15))).toHaveLength(1);                  // caño
      expect(unit.filter((x) => isPrism(x, 0.3, 0.3, 0.7, "steel"))).toHaveLength(2);                           // postes del conservador
      const bushings = beams(unit).filter((b) => b.mat === "whitewash" && near(b.w, 0.4));
      expect(bushings).toHaveLength(3);
      for (const b of bushings) {
        expect(beamLen(b)).toBeCloseTo(2.5);
        expect(near(b.from.z, 4.5)).toBe(true);
        expect((b.to.z - b.from.z) / beamLen(b)).toBeCloseTo(Math.sin((35 * Math.PI) / 180));
        expect(b.to.y).toBeGreaterThan(b.from.y);
      }
    }
  });

  it("la placa de T1 cae al sur de sus aletas este y la de T2 al este de sus aletas sur", () => {
    const plate = (unit: Solid[]) => tessellateAll(unit.find((x) => isPrism(x, 6, 4, 4, "steel"))!).filter((f) => f.mat === "whitewash");
    const p1 = plate(T1()), p2 = plate(T2());
    expect(p1).toHaveLength(1); expect(p2).toHaveLength(1);
    const f1 = union(fins(T1())), f2 = fins(T2()).filter((x) => isPrism(x, 0.15, 1.6, 3)).map(bounds);
    expect(Math.min(...p1[0]!.pts.map((p) => p.y))).toBeGreaterThanOrEqual(f1.max.y);
    expect(p1[0]!.pts.every((p) => near(p.x, SUBSTATION.x0 + 29))).toBe(true);
    expect(Math.min(...p2[0]!.pts.map((p) => p.x))).toBeGreaterThanOrEqual(Math.max(...f2.map((b) => b.max.x)));
    expect(p2[0]!.pts.every((p) => near(p.y, TRANSFORMERS_Y[1] + 4))).toBe(true);
  });

  it("cortafuego más alto que las cubas y sin tocarlas; fosos de 4 marcos por cuba; T1 y T2 no tocan el cortafuego", () => {
    const solids = raised();
    const wall = solids.filter((x) => isPrism(x, FIREWALL.w, FIREWALL.d, FIREWALL.h, "concrete"));
    expect(wall).toHaveLength(1);
    const wb = bounds(wall[0]!);
    expect(wb.min.x).toBeCloseTo(FIREWALL.x); expect(wb.min.y).toBeCloseTo(FIREWALL.y); expect(wb.min.z).toBe(0);
    expect(wb.max.x).toBeCloseTo(FIREWALL.x + FIREWALL.w); expect(wb.max.z).toBeCloseTo(FIREWALL.h);
    const tanks = solids.filter((x) => isPrism(x, 6, 4, 4, "steel"));
    for (const t of tanks) { expect(apartBox(wb, bounds(t))).toBe(true); expect(wb.max.z).toBeGreaterThan(bounds(t).max.z); }
    expect(solids.filter((x) => x.kind === "prism" && x.mat === "concrete" && near(x.h, 0.3) && near(x.at.z, 0))).toHaveLength(8);
    for (const unit of [T1(), T2()]) expect(apartBox(wb, union(unit))).toBe(true);
    expect(apartBox(union(T1()), union(T2()))).toBe(true);
  });

  it("12 puentes bajan de la panza del conductor a seccionadores, TI y pasatapas", () => {
    const d = beams(build(droppers));
    expect(d).toHaveLength(12);
    for (const b of d) { expect(b.mat).toBe("steel"); expect(near(b.w, 0.15)).toBe(true); expect(near(b.from.z, 9.425)).toBe(true); expect(b.to.z).toBeLessThan(9.425); }
    const tip = 4.5 + 2.5 * Math.sin((35 * Math.PI) / 180);
    expect(d.map((b) => Math.round(b.to.z * 1000) / 1000).sort()).toEqual([...Array(3).fill(4.5), ...Array(3).fill(5.65), ...Array(6).fill(Math.round(tip * 1000) / 1000)].sort()); // brazo, cabeza del TI, punta del pasatapas
    for (const b of d.filter((x) => near(x.to.z, tip))) expect(near(b.from.y, b.to.y > TRANSFORMERS_Y[1] + 1 ? PHASES_Y[2] : PHASES_Y[1])).toBe(true); // T1 → PHASES_Y[1], T2 → PHASES_Y[2]
  });
});

describe("excavadora en la playa de vías", () => {
  const machine = (): Solid[] => { const out: Solid[] = []; excavator(out, []); return out; };
  const withWheel = (): Solid[] => [...machine(), excavatorWheel(0)]; // la rueda también cuenta contra vías, vagones y farol
  const axle = local(EXCAVATOR.axleDx, 0);
  const piles = (sc: FactoryScene) => sc.solids.filter((x): x is Solid & { kind: "cone" } => x.kind === "cone" && (x.mat === "rust" || x.mat === "sand"));
  const isFixed = (p: Solid & { kind: "cone" }) => Math.abs(p.at.x - axle.x) < EPS && Math.abs(p.at.y - axle.y) < EPS && p.r === EXCAVATOR.pile.r;

  it("la escena trae la máquina entera en scene.excavator y ninguna pieza en scene.solids", () => {
    const sc = scene();
    expect(sc.excavator).toEqual(machine());
    expect(sc.excavator.length).toBeGreaterThan(0);
    for (const x of sc.excavator) expect(sc.solids).not.toContain(x);
    const s = JSON.stringify(sc.solids);
    for (const x of machine()) expect(s).not.toContain(JSON.stringify(x));
  });

  it("ningún sólido toca las vías salvo por encima (z ≥ 2)", () => {
    for (const x of withWheel()) {
      const b = bounds(x);
      for (const rx of RAIL_YARD_X) for (const dx of [-0.8, 0.8]) {
        const x0 = rx + dx - 0.2, x1 = rx + dx + 0.2;
        if (b.max.x > x0 && b.min.x < x1) expect(b.min.z).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("ni los vagones, ni el farol (−30, 20), y toda la máquina en y ≤ 108", () => {
    const s = scene();
    const wagons = s.solids.filter((x) => x.kind === "prism" && x.w === 2.2 && x.d === 7 && x.h === 2.8);
    expect(wagons).toHaveLength(8);
    const lamp = s.solids.find((x) => x.kind === "prism" && x.at.x === -30 && x.at.y === 20 && x.w === 0.6)!;
    expect(lamp).toBeDefined();
    for (const x of withWheel()) {
      for (const w of [...wagons, lamp]) expect(apart(x, w)).toBe(true);
      expect(bounds(x).max.y).toBeLessThanOrEqual(108);
    }
  });

  it("ningún sólido supera z 20.5", () => {
    for (const x of machine()) expect(bounds(x).max.z).toBeLessThanOrEqual(20.5);
  });

  it("acopio fijo bajo la rueda más 3 grandes rust y 2 chicos sand del rng", () => {
    const ps = piles(scene());
    const fixed = ps.filter(isFixed);
    expect(fixed).toHaveLength(1);
    expect(fixed[0]).toMatchObject({ mat: "rust", r: 6.5, h: 4.5, sides: 7 });
    const rest = ps.filter((p) => !isFixed(p));
    expect(rest.filter((p) => p.mat === "rust")).toHaveLength(3);
    expect(rest.filter((p) => p.mat === "sand")).toHaveLength(2);
  });

  it.each(Array.from({ length: 20 }, (_, i) => i + 1).concat(7))("seed %i: ningún acopio rng toca la caja de la máquina y todos quedan al este de las vías", (seed) => {
    const box = excavatorBox();
    for (const p of piles(factory(createRng(seed)))) {
      expect(p.at.x - p.r).toBeGreaterThanOrEqual(-39);
      if (isFixed(p)) continue;
      const touches = p.at.x + p.r > box.x0 - 1 && p.at.x - p.r < box.x1 + 1 && p.at.y + p.r > box.y0 - 1 && p.at.y - p.r < box.y1 + 1; // caja inflada 1, como la implementación
      expect(touches).toBe(false);
    }
  });

  it("la caja de la máquina contiene todos sus sólidos y la rueda a cualquier ángulo", () => {
    const box = excavatorBox();
    for (const x of machine()) {
      const b = bounds(x);
      expect(b.min.x).toBeGreaterThanOrEqual(box.x0 - EPS); expect(b.max.x).toBeLessThanOrEqual(box.x1 + EPS);
      expect(b.min.y).toBeGreaterThanOrEqual(box.y0 - EPS); expect(b.max.y).toBeLessThanOrEqual(box.y1 + EPS);
    }
  });
});
