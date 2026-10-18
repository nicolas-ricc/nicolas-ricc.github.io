import type { Accent } from "../iso/accent";
import type { Facade } from "../iso/facade";
import { v3, type Vec3 } from "../iso/geometry";
import { STEP_RATIO, type Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import type { Rng } from "../map/seed";
import { SIDEWALK, blocks, type Block } from "./city-grid";
import { jungle } from "./flora";
import { antenna, machineRoom, roofShrub, waterTank } from "../kit/props";
import { cornice, stepTop } from "../kit/roofs";
import { PLINTH_H, prism, tiles } from "./city-pieces";
import { streets } from "../city/streets";
import { bridge, collapsed, cars, greenery, malecon, plazaAndTower, westQuay } from "../city/fixed";
import { districtBlock, maxDistrictHeight } from "./district";

/**
 * Resume: ciudad de oficinas en grilla, tragada por la selva, partida por el
 * estuario. El terreno (terrain.ts) es el asfalto; acá van los zócalos de cada
 * manzana, los edificios con fachada, la plaza con la torre del piso encendido,
 * y después (segunda tanda) avenida, puente, malecón, derrumbe, autos y selva.
 * Spec: docs/superpowers/specs/2026-09-14-resume-ciudad-design.md.
 */
export { PLINTH_H } from "./city-pieces";
export { TOWER_H } from "./city-grid";
export const MAX_BUILDING_H = 18;
export const TALL_H = 17; // desde acá el edificio solo admite sala de máquinas en el techo
const FLOOR_H = 3;

export interface CityScene {
  ground: Solid[];   // baldosas de la plaza, suelo de manzanas devoradas, carriles
  solids: Solid[];
  accents: Accent[]; // faroles y derrame de luz; las ventanas encendidas y la antena las anima city-anim
  tower: { litWindows: Accent[]; antenna: Vec3; paperWindow: Vec3 };
  neon: { signs: Accent[]; malecon: Vec3[] }; // carteles del distrito y luces del malecón; los anima city-anim
}

// ---------------------------------------------------------------- edificios

/**
 * Prisma con fachada, cornisa de material contrario y un detalle de techo.
 * `z` es la base (el zócalo). Ruling del controller: con techo escalonado la
 * cornice y el detalle de techo se apoyan sobre la huella del segundo nivel
 * (retranqueada), no sobre la base completa, porque un elemento de ancho
 * completo quedaría flotando sobre el retranqueo.
 */
function building(out: Solid[], rng: Rng, x: number, y: number, z: number, w: number, d: number, h: number, mat: Material, roof?: "step"): void {
  const lowRoof = h >= TALL_H; // ver roofDetail: sobre un edificio de 17..18 solo entra la sala de máquinas bajo el tope de 21
  const facade: Facade = { floors: Math.max(1, Math.round(h / FLOOR_H)), cols: rng.int(2, 4), base: rng.chance(0.5) ? "glass" : "portico" };
  out.push(prism(x, y, z, w, d, h, mat, roof ? { roof, facade } : { facade }));
  const corniceMat: Material = mat === "office" ? "officeDark" : "office";
  if (roof === "step") {
    // la regla del retranqueo vive en stepTop
    const top = stepTop({ x, y, w, d, z: z + h }, h * STEP_RATIO);
    out.push(...cornice(top, corniceMat));
    roofDetail(out, rng, top.x, top.y, top.w, top.d, top.z + 0.4, lowRoof);
  } else {
    out.push(...cornice({ x, y, w, d, z: z + h }, corniceMat));
    roofDetail(out, rng, x, y, w, d, z + h + 0.4, lowRoof);
  }
}

/**
 * Detalle de techo. Con `lowRoof` (edificios de 17..18) se fuerza la sala de
 * máquinas: es el único detalle que entra bajo el tope de 21 (0.3 de zócalo +
 * 18 + 0.4 de cornisa + 2 = 20.7); el tanque, la antena y los conos lo pasan.
 * El rng se consume igual en los dos casos, así la semilla no se desalinea.
 */
function roofDetail(out: Solid[], rng: Rng, x: number, y: number, w: number, d: number, z: number, lowRoof = false): void {
  const pick = rng.int(0, 3);
  switch (lowRoof ? 1 : pick) {
    case 0: out.push(...waterTank(v3(x + w / 2, y + d / 2, z))); return;
    case 1: out.push(...machineRoom(v3(x + 1, y + 1, z))); return; // sala de máquinas
    case 2: out.push(...antenna(v3(x + w - 1.5, y + 1.5, z))); return;
    default: for (const [dx, dy] of [[2, 2], [w - 2, d - 2]] as const) out.push(...roofShrub(v3(x + dx, y + dy, z))); // terraza con selva
  }
}

type BlockType = "tower" | "pair" | "low" | "eaten";

function pickType(rng: Rng, maxH: number): BlockType {
  const r = rng.next();
  const t: BlockType = r < 0.3 ? "tower" : r < 0.6 ? "pair" : r < 0.8 ? "low" : "eaten";
  return t === "tower" && maxH < 12 ? "pair" : t;
}

/**
 * Una manzana común: zócalo más contenido por rng. `maxH` topa la altura (fila
 * frente a la torre). `tallPending` son las riberas que todavía no tienen un
 * edificio de 17..18: la primera manzana tipo torre de cada una se lo lleva, así
 * el skyline no queda plano abajo del landmark.
 */
function block(solids: Solid[], ground: Solid[], rng: Rng, b: Block, maxH: number, tallPending: Set<Block["bank"]>): void {
  const type = pickType(rng, maxH);
  const ix = b.x + SIDEWALK, iy = b.y + SIDEWALK, iw = b.w - 2 * SIDEWALK, id = b.d - 2 * SIDEWALK; // huella útil 21×15
  if (type === "eaten") {
    ground.push(tiles(rng, b, 0.05, "leafDark"));
    solids.push(prism(b.x, b.y, 0, 10, 8, PLINTH_H, "paving"), prism(b.x + 14, b.y + 10, 0, 10, 8, PLINTH_H, "paving"));
    if (rng.chance(0.5)) solids.push(prism(b.x, b.y + 12, 0, 8, 6, PLINTH_H, "paving"));
    solids.push(prism(b.x + 12, b.y + 2, 0.05, 5, 4, rng.int(2, 3), "officeDark")); // ruina, sin pisar ninguna de las tres losas
    jungle(solids, rng, { x0: b.x + 2, x1: b.x + b.w - 2, y0: b.y + 2, y1: b.y + b.d - 2 }, rng.int(6, 9), 0.05);
    return;
  }
  solids.push(prism(b.x, b.y, 0, b.w, b.d, PLINTH_H, "paving"));
  if (type === "tower") {
    const tall = tallPending.delete(b.bank);
    const w = rng.int(12, 14), d = rng.int(10, 12), h = tall ? rng.int(TALL_H, MAX_BUILDING_H) : rng.int(12, Math.max(12, Math.min(MAX_BUILDING_H, maxH)));
    building(solids, rng, ix + (iw - w) / 2, iy + (id - d) / 2, PLINTH_H, w, d, h, "office");
  } else if (type === "pair") {
    const y = iy + (id - 13) / 2;
    building(solids, rng, ix, y, PLINTH_H, 9, 13, rng.int(7, Math.min(10, maxH)), "office");
    building(solids, rng, ix + 11, y, PLINTH_H, 9, 13, rng.int(7, Math.min(10, maxH)), rng.chance(0.5) ? "officeDark" : "office");
  } else {
    const h = rng.int(4, 6);
    building(solids, rng, ix, iy, PLINTH_H, iw, 7, h, "office", "step");
    building(solids, rng, ix, iy + 7, PLINTH_H, 7, 8, h, "office");
    for (const [dx, dy] of [[15, 12], [19, 14]] as const) solids.push({ kind: "cone", at: v3(b.x + dx, b.y + dy, PLINTH_H), r: 1.5, h: 3, mat: "leaf" });
  }
}

/** Ruling: frente a la torre (fila sur, x 96..162) nada supera 10 para que sus ventanas encendidas no floten sobre otro edificio. */
const maxHeightFor = (b: Block): number => (b.row === 3 && b.x >= 96 && b.x + b.w <= 162 ? 10 : MAX_BUILDING_H);

// ---------------------------------------------------------------- escena

export function city(rng: Rng, districtRng: Rng): CityScene {
  const ground: Solid[] = [], solids: Solid[] = [], accents: Accent[] = [], signs: Accent[] = [];
  const tallPending = new Set<Block["bank"]>(["west", "east"]);
  for (const b of blocks()) if (b.kind === "block") block(solids, ground, rng, b, maxHeightFor(b), tallPending);
  const tower = plazaAndTower(solids, ground, accents, rng);
  for (const b of blocks()) if (b.kind === "district" || b.kind === "site") districtBlock(solids, ground, accents, signs, districtRng, b, maxDistrictHeight(b));
  streets(ground, solids, accents);
  bridge(solids, accents);
  westQuay(solids);
  const maleconLights = malecon(solids, accents);
  collapsed(solids, rng);
  greenery(solids, rng);
  cars(solids, rng);
  return { ground, solids, accents, tower, neon: { signs, malecon: maleconLights } };
}
