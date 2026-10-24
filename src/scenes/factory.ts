import type { Accent } from "../iso/accent";
import { v3, type Vec2, type Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import type { Rng } from "../map/seed";
import { WORLD } from "../map/geo";
import { jungle } from "./flora";
import { boilerHouse } from "./boiler-house";
import { towerCrane } from "./pieces";

/**
 * Fábrica, detrás (al norte) y al oeste del astillero. Banda norte
 * `x -60..205, y -60..0` al oeste del río: nave de calderas de la Fábrica de Luz (al
 * oeste, el marcador de la maltería), tres chimeneas humeantes, torre de enfriamiento, grúa torre sobre un
 * desvío ferroviario, cinta transportadora hasta el patio de material,
 * subestación y playa de camiones. Columna oeste `x -60..0, y 0..146`: playa
 * de vías y acopios de mineral, selva al sur. El terreno es `slab`.
 * Spec: docs/superpowers/specs/2026-09-14-mundo-2-fabrica-distrito-blog-design.md §5.
 */
export interface FactoryScene { ground: Solid[]; solids: Solid[]; accents: Accent[]; stacks: Vec3[] }

export const PLANT = { x: 20, y: -46, w: 100, d: 30, h: 14 } as const;
export const MALT = { x: 20, y: -46, w: 24, d: 30, h: 18 } as const;
export const STACKS = [{ x: 130, y: -40, r: 2.8, h: 22 }, { x: 140, y: -34, r: 2.6, h: 26 }, { x: 150, y: -40, r: 2.4, h: 24 }] as const;
export const STACK_BASE_H = 3;
const DECK_H = 0.3; // losa de la plataforma de las chimeneas
export const SIDING_Y = -8;
export const RAIL_YARD_X = [-56, -48, -40] as const; // vías N-S de la playa; los acopios van al este de ellas
const COOLING = { x: 172, y: -36 } as const;
const CONVEYOR_Z = 6;
const LAMP_H = 5;

const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Material): Solid => ({ kind: "prism", at: v3(x, y, z), w, d, h, mat });
const strip = (path: Vec2[], width: number, z: number, mat: Material): Solid => ({ kind: "strip", path, width, z, mat });

function lamp(out: Solid[], accents: Accent[], x: number, y: number): void {
  out.push(prism(x, y, 0, 0.6, 0.6, LAMP_H, "steel"));
  accents.push({ kind: "dot", at: v3(x + 0.3, y + 0.3, LAMP_H), r: 1.2, color: "cyan" });
}

function plant(out: Solid[]): void {
  const { x, y, w } = PLANT;
  out.push(prism(MALT.x, MALT.y, 0, MALT.w, MALT.d, MALT.h, "brick")); // marcador de la maltería, al oeste de la nave
  boilerHouse(out);
  out.push(prism(x + w - 0.2, -23, 0, 0.5, 6, 8, "concrete"));          // portón este, de donde sale la cinta
}

export type Stack = (typeof STACKS)[number];

/** Emite una chimenea detallada en `out`/`accents` y devuelve su boca. */
export function chimney(s: Stack, out: Solid[], accents: Accent[]): Vec3 {
  const B = STACK_BASE_H, M = B + s.h;
  const cyl = (z: number, r: number, h: number, mat: Material): Solid => ({ kind: "cylinder", at: v3(s.x, s.y, z), r, h, mat });
  out.push(prism(s.x - 3.5, s.y - 3.5, 0, 7, 7, B, "concrete"));
  out.push(cyl(B, s.r + 1.0, 1.5, "brick"), cyl(B + 1.5, s.r + 0.6, 1.5, "brick")); // base escalonada
  const z0 = B + 3, z1 = M - 0.6, half = (z1 - z0) / 2, seg = half / 4;
  const radii = [0.5, (0.5 * 2) / 3, 0.5 / 3, 0].map((d) => s.r + d);              // mitad inferior: se afina hasta r
  radii.forEach((r, i) => out.push(cyl(z0 + i * seg, r, seg, "brick")));
  for (let k = 0; k < 3; k++) out.push(cyl(z0 + (k + 1) * seg - 0.2, radii[k]! + 0.1, 0.2, "steel")); // zunchos en la junta de arriba de cada tramo: con el centro sobre el del tramo, el orden painter los dibuja después
  const bh = (half - DECK_H) / 7, dz = z0 + half + 6 * bh;                            // la plataforma llena la junta entre la 6ª y la 7ª banda: nada del fuste comparte su z y el orden painter no empata
  for (let i = 0; i < 7; i++) out.push(cyl(z0 + half + i * bh + (i === 6 ? DECK_H : 0), s.r, bh, i % 2 === 0 ? "signal" : "whitewash"));
  out.push(cyl(dz, s.r + 1.2, DECK_H, "concrete"));                                   // plataforma
  const pTop = dz + DECK_H;
  const pr = (cx: number, cy: number, z: number, h: number): Solid => prism(cx - 0.075, cy - 0.075, z, 0.15, 0.15, h, "steel");
  const pRad = (s.r + 1.2) * Math.cos(Math.PI / 8) - 0.15;            // postes al medio de cada cara del octógono, metidos 0.15
  const post = (k: number) => v3(s.x + pRad * Math.cos((k * Math.PI) / 4), s.y + pRad * Math.sin((k * Math.PI) / 4), pTop);
  for (let k = 0; k < 8; k++) {
    const p = post(k), q = post((k + 1) % 8);
    out.push(pr(p.x, p.y, pTop, 1.1));
    out.push({ kind: "beam", from: v3(p.x, p.y, pTop + 1.025), to: v3(q.x, q.y, pTop + 1.025), w: 0.15, h: 0.15, mat: "steel" }); // baranda
  }
  out.push(cyl(M - 0.6, s.r + 0.4, 0.6, "brick"));                                    // corona
  for (const [dx, dy] of [[1, 0], [0, 1], [0, -1], [-1, 0]] as const) out.push(pr(s.x + dx * (s.r + 0.1), s.y + dy * (s.r + 0.1), M, 1.5)); // pararrayos
  const ly = s.y + (s.r + 1.2) * Math.cos(Math.PI / 8) + 0.2;                         // escalera de gato al sur, por fuera de la plataforma: separada en y de bandas y losa, el orden painter no empata
  for (const dx of [-0.35, 0.35]) out.push(pr(s.x + dx, ly, z0, pTop + 1.1 - z0));
  for (let z = z0 + 2; z < pTop + 1.1; z += 2) out.push({ kind: "beam", from: v3(s.x - 0.35, ly, z), to: v3(s.x + 0.35, ly, z), w: 0.15, h: 0.15, mat: "steel" }); // peldaños
  accents.push({ kind: "dot", at: v3(s.x + s.r, s.y, M - 1), r: 0.5, color: "magenta" }, { kind: "dot", at: v3(s.x, s.y + s.r, M - 1), r: 0.5, color: "magenta" });
  out.push(prism(s.x - 0.45, s.y + 3.5, 0, 0.9, 0.3, 1.4, "steel"));                  // puerta en la cara sur del pedestal
  return v3(s.x, s.y, M);
}

function chimneys(out: Solid[], accents: Accent[]): Vec3[] {
  return STACKS.map((s) => chimney(s, out, accents));
}

function coolingTower(out: Solid[]): void {
  let z = 0;
  for (const r of [9, 8, 7, 7.5]) { out.push({ kind: "cylinder", at: v3(COOLING.x, COOLING.y, z), r, h: 4, mat: "concrete", sides: 12 }); z += 4; }
}

function siding(out: Solid[]): void {
  for (const dy of [-0.8, 0.8]) out.push(strip([{ x: WORLD.x0, y: SIDING_Y + dy }, { x: 110, y: SIDING_Y + dy }], 0.4, 0.1, "steel"));
  for (let i = 0; i < 6; i++) out.push(prism(-50 + i * 9, SIDING_Y - 1.2, 0, 8, 2.4, 3, i % 2 === 0 ? "rust" : "steel")); // vagones con 1 u de hueco
  out.push(prism(6, SIDING_Y - 1.3, 0, 9, 2.6, 3.6, "steel"), prism(12, SIDING_Y - 1.3, 3.6, 3, 2.6, 1, "steel"));      // locomotora y cabina
}

/** Del portón este de la planta al patio de material: arranca justo afuera del portón, dos tramos rectos a z 6 sobre caballetes cada 12 u. */
function conveyor(out: Solid[]): void {
  out.push(prism(121, -20, CONVEYOR_Z, 2, 22, 0.6, "steel"));
  out.push(prism(30, 1, CONVEYOR_Z, 93, 2, 0.6, "steel"));
  for (let y = -16; y < 2; y += 12) out.push(prism(121.6, y, 0, 0.8, 0.8, CONVEYOR_Z, "steel"));
  for (let x = 34; x < 120; x += 12) out.push(prism(x, 1.6, 0, 0.8, 0.8, CONVEYOR_Z, "steel"));
}

function substation(out: Solid[]): void {
  for (let i = 0; i < 6; i++) out.push(prism(152 + (i % 3) * 12, -58 + Math.floor(i / 3) * 6, 0, 3, 3, 3, "steel"));
  for (const x of [150, 186]) {
    out.push(prism(x, -59, 0, 0.6, 0.6, 7, "steel"), prism(x, -49, 0, 0.6, 0.6, 7, "steel"));
    out.push(prism(x, -59, 6.4, 0.6, 10.6, 0.6, "steel")); // travesaño del pórtico
  }
  out.push(strip([{ x: 149, y: -60 }, { x: 190, y: -60 }, { x: 190, y: -47 }, { x: 149, y: -47 }, { x: 149, y: -60 }], 0.3, 0.05, "concrete")); // cerco
}

function truckYard(out: Solid[], accents: Accent[]): void {
  for (const [x, y] of [[40, -12], [70, -6], [95, -12]] as const) { out.push(prism(x, y, 0, 6, 2.4, 2.8, "rust")); out.push(prism(x + 6, y, 0, 2, 2.4, 2.2, "steel")); } // caja y cabina
  for (let i = 0; i < 6; i++) out.push(prism(22 + i * 4, -3, 0, 3, 2, 0.5 + (i % 3) * 0.4, "steel")); // pallets de chapa junto al portón oeste
  for (const [x, y] of [[20, -14], [110, -3]] as const) lamp(out, accents, x, y);
}

/** Columna oeste: tres vías N-S que empalman con las vías del oeste del astillero, acopios de mineral al este de ellas, selva al sur. */
function railYard(out: Solid[], rng: Rng): void {
  for (const x of RAIL_YARD_X) for (const dx of [-0.8, 0.8]) out.push(strip([{ x: x + dx, y: WORLD.y0 }, { x: x + dx, y: 128 }], 0.4, 0.1, "steel"));
  for (const dy of [-0.8, 0.8]) out.push(strip([{ x: -40 + dy, y: 128 }, { x: -30, y: 132.5 + dy }, { x: 2, y: 132.5 + dy }], 0.4, 0.1, "steel")); // empalme
  for (let i = 0; i < 6; i++) {
    const big = i < 4;
    out.push({ kind: "cone", at: v3(rng.int(-25, -13), rng.int(44, 96), 0), r: big ? rng.int(6, 9) : 5, h: big ? rng.int(4, 6) : 3, mat: big ? "rust" : "sand", sides: 7 });
  }
  for (let i = 0; i < 8; i++) out.push(prism(RAIL_YARD_X[i % 3]! - 1.1, -46 + i * 14, 0, 2.2, 7, 2.8, i % 2 === 0 ? "rust" : "steel")); // vagones estacionados N-S sobre las vías; -46: el tercero termina en y -11, sin tocar el desvío E-O (y -9.2..-6.8)
  jungle(out, rng, { x0: -58, x1: -6, y0: 110, y1: 140 }, 14, 0.4, { y: [128, 131, 134] }); // y1 140: un cono de r 4 no puede cruzar la costura y = 146; ningún cono pisa el empalme ni las vías del oeste
}

function lamps(out: Solid[], accents: Accent[]): void {
  for (const [x, y] of [[24, -13], [64, -13], [58, -16], [148, -46], [-30, 20]] as const) lamp(out, accents, x, y);
}

export function factory(rng: Rng): FactoryScene {
  const solids: Solid[] = [], accents: Accent[] = [];
  plant(solids);
  const stacks = chimneys(solids, accents);
  coolingTower(solids);
  towerCrane(solids, accents, { at: { x: 60, y: -12 }, mastH: 20, jibLen: 30, dir: "e", light: "cyan" });
  siding(solids);
  conveyor(solids);
  substation(solids);
  truckYard(solids, accents);
  railYard(solids, rng);
  lamps(solids, accents);
  return { ground: solids.filter((s) => s.kind === "strip"), solids: solids.filter((s) => s.kind !== "strip"), accents, stacks };
}
