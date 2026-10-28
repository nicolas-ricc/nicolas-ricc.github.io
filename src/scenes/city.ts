import type { Accent } from "../iso/accent";
import { facadeAccents, isWall, windowPatches, type Facade } from "../iso/facade";
import { centroid, v3, type Vec2, type Vec3 } from "../iso/geometry";
import { STEP_INSET, STEP_RATIO, tessellate, type Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import type { Rng } from "../map/seed";
import { QUAY_X, WORLD, ZONE_SPLIT_Y, islandWestX } from "../map/geo";
import { AVENUE, BLOCK_W, BOULEVARD, BRIDGE, CITY_EDGE, COLLAPSED, CRATERS, DISTRICT_BANK_Y, DISTRICT_ROWS, EAST_COLS, EAST_RING, FALLEN_BLOCK, LIT_FLOOR, MALECON, PLAZA, ROWS, SIDEWALK, STREET, TOWER, TOWER_FLOORS, TOWER_H, WEST_COLS, WEST_QUAY, blocks, estuaryEast, estuaryReaches, inBlock, inCrater, type Block } from "./city-grid";
import { jungle } from "./flora";
import { PLINTH_H, lamp, plazaTone, prism, tiles } from "./city-pieces";
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
  const cornice: Material = mat === "office" ? "officeDark" : "office";
  if (roof === "step") {
    const ix = w * STEP_INSET, iy = d * STEP_INSET;
    const top = z + h + h * STEP_RATIO;
    out.push(prism(x + ix - 0.5, y + iy - 0.5, top, w - 2 * ix + 1, d - 2 * iy + 1, 0.4, cornice));
    roofDetail(out, rng, x + ix, y + iy, w - 2 * ix, d - 2 * iy, top + 0.4, lowRoof);
  } else {
    const top = z + h;
    out.push(prism(x - 0.5, y - 0.5, top, w + 1, d + 1, 0.4, cornice));
    roofDetail(out, rng, x, y, w, d, top + 0.4, lowRoof);
  }
}

/**
 * Detalle de techo. Con `lowRoof` (edificios de 17..18) se fuerza la sala de
 * máquinas: es el único detalle que entra bajo el tope de 21 (0.3 de zócalo +
 * 18 + 0.4 de cornisa + 2 = 20.7); el tanque, la antena y los conos lo pasan.
 * El rng se consume igual en los dos casos, así la semilla no se desalinea.
 */
function roofDetail(out: Solid[], rng: Rng, x: number, y: number, w: number, d: number, z: number, lowRoof = false): void {
  const cx = x + w / 2, cy = y + d / 2;
  const pick = rng.int(0, 3);
  switch (lowRoof ? 1 : pick) {
    case 0: // tanque de agua sobre cuatro postes (1.1, no 1.2: distingue el poste del auto en el filtro de tests)
      for (const [dx, dy] of [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]] as const) out.push(prism(cx + dx - 0.15, cy + dy - 0.15, z, 0.3, 0.3, 1.1, "steel"));
      out.push({ kind: "cylinder", at: v3(cx, cy, z + 1.1), r: 1.2, h: 2, mat: "rust", sides: 6 });
      return;
    case 1: out.push(prism(x + 1, y + 1, z, 4, 3, 2, "officeDark")); return; // sala de máquinas
    case 2: out.push({ kind: "cylinder", at: v3(x + w - 1.5, y + 1.5, z), r: 0.2, h: 4, mat: "steel", sides: 4 }); return; // antena
    default: for (const [dx, dy] of [[2, 2], [w - 2, d - 2]] as const) out.push({ kind: "cone", at: v3(x + dx, y + dy, z), r: 1.2, h: 2.5, mat: "leaf" }); // terraza con selva
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

const PUDDLE_ALPHA = 0.25;
const PUDDLE_RADII = [2.5, 1.8, 1.2] as const;

/**
 * Charco de luz: tres octógonos planos concéntricos de radio decreciente, a ras
 * del piso. Proyectados se ven como elipses achatadas y, con poco alfa y
 * superpuestos, el borde se deshace en vez de recortarse como una mancha.
 */
function puddle(x: number, y: number): Accent[] {
  return PUDDLE_RADII.map((r) => ({
    kind: "poly",
    pts: Array.from({ length: 8 }, (_, i) => { const a = ((i + 0.5) / 8) * Math.PI * 2; return v3(x + r * Math.cos(a), y + r * Math.sin(a), 0.12); }),
    color: "amberBleed",
    alpha: PUDDLE_ALPHA,
  }));
}

// ---------------------------------------------------------------- plaza y torre

function plazaAndTower(solids: Solid[], ground: Solid[], accents: Accent[], rng: Rng): CityScene["tower"] {
  ground.push(tiles(rng, PLAZA, 0.05, "plaza", plazaTone));
  // cordón: una banda de `paving` de 1.2 alrededor de la plaza, ancha para que el contorno se lea al zoom de mundo
  const curb = 1.2;
  solids.push(prism(PLAZA.x, PLAZA.y, 0, PLAZA.w, curb, PLINTH_H, "paving"), prism(PLAZA.x, PLAZA.y + PLAZA.d - curb, 0, PLAZA.w, curb, PLINTH_H, "paving"));
  solids.push(prism(PLAZA.x, PLAZA.y, 0, curb, PLAZA.d, PLINTH_H, "paving"), prism(PLAZA.x + PLAZA.w - curb, PLAZA.y, 0, curb, PLAZA.d, PLINTH_H, "paving"));

  const facade: Facade = { floors: TOWER_FLOORS, cols: 4, litFloor: LIT_FLOOR, base: "portico" };
  const tower = prism(TOWER.x, TOWER.y, 0, TOWER.w, TOWER.d, TOWER_H, "officeDark", { facade });
  solids.push(tower);
  solids.push(prism(TOWER.x - 0.5, TOWER.y - 0.5, TOWER_H, TOWER.w + 1, TOWER.d + 1, 0.4, "office"));       // cornisa
  solids.push(prism(TOWER.x + 5, TOWER.y + 5, TOWER_H + 0.4, 6, 4, 2.5, "officeDark"));                     // sala de máquinas
  const mast = v3(TOWER.x + 8, TOWER.y + 7, TOWER_H + 2.9);
  solids.push({ kind: "cylinder", at: mast, r: 0.3, h: 5, mat: "steel", sides: 4 });                        // antena
  // selva trepando: conos en la base y dos prismas finos sobre las aristas NO y SE
  for (const [dx, dy] of [[-1.5, -1.5], [TOWER.w + 1.5, -1.5], [TOWER.w + 1.5, TOWER.d + 1.5], [-1.5, TOWER.d + 1.5]] as const) solids.push({ kind: "cone", at: v3(TOWER.x + dx, TOWER.y + dy, 0.05), r: 2.5, h: 6, mat: "leaf" });
  solids.push(prism(TOWER.x - 0.6, TOWER.y - 0.6, 0, 0.6, 0.6, 12, "leaf"), prism(TOWER.x + TOWER.w, TOWER.y + TOWER.d, 0, 0.6, 0.6, 12, "leaf"));
  // ventanas del piso encendido, solo en las paredes que mira la cámara (este y sur)
  const walls = tessellate(tower).filter((f) => isWall(f) && f.mat === "officeDark" && f.toneOffset === 0);
  const litWindows = facadeAccents(walls, facade, "amber");
  const east = walls.find((f) => f.normal.x > 0.5)!;
  const paperWindow = centroid(windowPatches(east, facade, facade.litFloor!)[facade.cols - 1]!);
  // derrame de luz: charcos planos sobre las baldosas, solo en la franja este de
  // la plaza (entre la pared este de la torre y el cordón), que es la parte que
  // la cámara ve libre de paredes, techos y árboles.
  // desviación del brief: la franja libre de la plaza (sin la pared este, los
  // conos de la esquina y los techos de la fila de enfrente) es esta diagonal,
  // no el pie mismo de la pared; los dos charcos se solapan y se leen como un
  // solo derrame estirado hacia el este.
  for (const [x, y] of [[TOWER.x + TOWER.w + 6.5, TOWER.y + 2], [TOWER.x + TOWER.w + 9, TOWER.y + 4]] as const) accents.push(...puddle(x, y));
  for (const [x, y] of [[PLAZA.x + 4, PLAZA.y + 3], [PLAZA.x + PLAZA.w - 6, PLAZA.y + 3], [PLAZA.x + 4, PLAZA.y + PLAZA.d - 4.2], [PLAZA.x + PLAZA.w - 6, PLAZA.y + PLAZA.d - 4.2]] as const) solids.push(prism(x, y, 0.05, 2, 0.6, 0.5, "paving"));
  lamp(solids, accents, PLAZA.x + 2, PLAZA.y + PLAZA.d / 2, 0.05);
  lamp(solids, accents, PLAZA.x + PLAZA.w - 2.6, PLAZA.y + PLAZA.d / 2, 0.05);
  return { litWindows, antenna: v3(mast.x, mast.y, mast.z + 5), paperWindow };
}

const strip = (path: Vec2[], width: number, mat: Material): Solid => ({ kind: "strip", path, width, z: 0.02, mat });

/**
 * Carril discontinuo (tramo 3, hueco 2) a lo largo de una calle N-S (x fijo) o
 * E-O (y fijo). Un tramo con cualquiera de sus dos puntas dentro de un cráter
 * no se pinta: el suelo se dibuja encima del pozo.
 */
function dashes(out: Solid[], from: Vec2, to: Vec2): void {
  const len = Math.hypot(to.x - from.x, to.y - from.y), ux = (to.x - from.x) / len, uy = (to.y - from.y) / len;
  for (let s = 0; s + 3 <= len; s += 5) {
    const p0 = { x: from.x + ux * s, y: from.y + uy * s }, p1 = { x: from.x + ux * (s + 3), y: from.y + uy * (s + 3) };
    if (inCrater(p0.x, p0.y) || inCrater(p1.x, p1.y)) continue;
    if (inPlaza(p0.x, p0.y) || inPlaza(p1.x, p1.y)) continue; // la plaza se dibuja antes que las calles: una raya ahí le pintaría encima
    out.push(strip([p0, p1], 0.4, "paving"));
  }
}

// ---------------------------------------------------------------- calles y avenida

const inPlaza = (x: number, y: number): boolean => x >= PLAZA.x && x < PLAZA.x + PLAZA.w && y >= PLAZA.y && y < PLAZA.y + PLAZA.d;
const inQuayWall = (x: number): boolean => x >= WEST_QUAY.x0 && x <= WEST_QUAY.x1;
/** Apoya cada poste en el suelo real de abajo: baldosa de la plaza, zócalo de manzana o asfalto. */
const postZ = (x: number, y: number): number => (inPlaza(x, y) ? 0.05 : inBlock(x, y) ? PLINTH_H : 0);

const WEST_LANE_X = WEST_COLS.map((x) => x + BLOCK_W + STREET / 2);              // centros de las calles N-S del oeste (39..189)
const EAST_LANE_X = [EAST_RING.x0 + STREET / 2, EAST_COLS[0] + BLOCK_W + STREET / 2]; // 273, 307
const LANE_X = [...WEST_LANE_X, ...EAST_LANE_X];

/** Carriles discontinuos de las calles N-S y E-O (sin la avenida, que tiene línea continua). */
function lanes(ground: Solid[]): void {
  for (const cx of LANE_X) {
    dashes(ground, { x: cx, y: CITY_EDGE.north }, { x: cx, y: AVENUE.y0 });
    // al sur de la avenida el anillo este se corta donde entra el estuario, y no pasa de donde la ribera este se vuelve selva: el suelo se dibuja encima del agua
    const yEnd = cx > QUAY_X ? Math.min(DISTRICT_BANK_Y, estuaryReaches(cx) - 1) : CITY_EDGE.south;
    if (yEnd > AVENUE.y1 + 3) dashes(ground, { x: cx, y: AVENUE.y1 }, { x: cx, y: yEnd });
  }
  const rowsY = [CITY_EDGE.north + STREET / 2, ...ROWS.slice(1).map((y) => y - STREET / 2), CITY_EDGE.south - 2].filter((y) => y < AVENUE.y0 || y > AVENUE.y1); // 161, 185, 239, 269, 299, 322 (la calle sur es de 4)
  for (const cy of rowsY) {
    dashes(ground, { x: CITY_EDGE.west, y: cy }, { x: WEST_QUAY.x0, y: cy });
    if (cy < DISTRICT_ROWS[0] - STREET) dashes(ground, { x: Math.max(EAST_RING.x0, Math.ceil(estuaryEast(cy)) + 1), y: cy }, { x: MALECON.x0, y: cy }); // arranca en tierra; al sur del distrito la ribera este es selva
  }
}

/** Avenida: doble línea continua a cada lado del boulevard, sendas en cada cruce y el boulevard arbolado por tramo de manzana. */
function avenue(ground: Solid[], solids: Solid[]): void {
  for (const [x0, x1] of [[CITY_EDGE.west, WEST_QUAY.x0], [EAST_RING.x1, MALECON.x0]] as const) {
    ground.push(strip([{ x: x0, y: BOULEVARD.y0 - 0.3 }, { x: x1, y: BOULEVARD.y0 - 0.3 }], 0.4, "paving"));
    ground.push(strip([{ x: x0, y: BOULEVARD.y1 + 0.3 }, { x: x1, y: BOULEVARD.y1 + 0.3 }], 0.4, "paving"));
  }
  for (const cx of LANE_X) {
    if (cx === EAST_RING.x0 + STREET / 2) continue; // la senda cebra bajo el tablero del puente no se pinta
    for (let k = -2; k <= 2; k++) ground.push(strip([{ x: cx + k, y: AVENUE.y0 }, { x: cx + k, y: AVENUE.y1 }], 0.5, "paving"));
  }
  for (const x of [...WEST_COLS, ...EAST_COLS]) {
    const x0 = x === EAST_COLS[0] ? x + 3 : x;                                  // el primer tramo este roza la rampa del puente (276..282)
    const x1 = x === EAST_COLS[1] ? MALECON.x0 - 0.5 : x + BLOCK_W;             // el último termina al pie del malecón, sin meterse en su muro
    solids.push(prism(x0, BOULEVARD.y0, 0, x1 - x0, BOULEVARD.y1 - BOULEVARD.y0, 0.3, "leafDark"));
    for (const dx of [4, 12, 20]) solids.push({ kind: "cone", at: v3(x + dx, BOULEVARD.y0 + 2, 0.3), r: 1.5, h: 4, mat: "leaf" });
  }
}

/** Faroles cada 12 u sobre la vereda norte de la avenida, en el tramo `[x0, x1]`. */
function lampRow(solids: Solid[], accents: Accent[], [x0, x1]: readonly [number, number]): void {
  const y = AVENUE.y0 - 1.3;
  for (let x = x0 + 6; x < x1 - 6; x += 12) lamp(solids, accents, x, y, postZ(x, y));
}

/** Semáforos apagados en las esquinas de la avenida y faroles sobre su vereda norte. */
function streetFurniture(solids: Solid[], accents: Accent[]): void {
  for (const cx of LANE_X) for (const [x, y] of [[cx - 3.5, AVENUE.y0 - 1], [cx + 3, AVENUE.y1 + 0.5]] as const) {
    if (inQuayWall(x)) continue; // un poste ahí caería dentro del muro del muelle
    const z = postZ(x, y);
    solids.push(prism(x, y, z, 0.3, 0.3, 4, "steel"), prism(x - 0.1, y - 0.1, z + 4, 0.5, 0.5, 1.2, "officeDark"));
  }
  for (const range of [[CITY_EDGE.west, WEST_QUAY.x0], [EAST_RING.x1, MALECON.x0]] as const) lampRow(solids, accents, range);
}

// ---------------------------------------------------------------- puente, muelle oeste y malecón

function bridge(solids: Solid[], accents: Accent[]): void {
  const { x0, x1, y0, y1, z, deckH } = BRIDGE;
  const top = z + deckH, d = y1 - y0;
  solids.push(prism(x0, y0, z, x1 - x0, d, deckH, "asphalt"));
  solids.push({ kind: "ramp", at: v3(x0 - STREET, y0, 0), w: STREET, d, h: top, mat: "asphalt", dir: "w" });
  solids.push({ kind: "ramp", at: v3(x1, y0, 0), w: STREET, d, h: top, mat: "asphalt", dir: "e" });
  for (let x = x0 + 18; x < x1; x += 18) solids.push(prism(x - 1, y0, -1, 2, d, z + 1, "plaza")); // pilotes: 210, 228, 246, 264
  solids.push(prism(WEST_QUAY.x0, y0, 0.6, WEST_QUAY.x1 - WEST_QUAY.x0, d, z - 0.6, "plaza")); // estribo (0.6, el tope del muelle): el tablero apoya, no flota
  solids.push(prism(x0, y0, top, x1 - x0, 0.3, 0.8, "officeDark"), prism(x0, y1 - 0.3, top, x1 - x0, 0.3, 0.8, "officeDark")); // barandas
  lamp(solids, accents, x0 + 30, y0 + 0.4, top);
  lamp(solids, accents, x1 - 30, y1 - 1, top);
  solids.push(prism(x0 + 40, y0 + 1.5, top, 3, 1.5, 1.2, "steel"), prism(x0 + 58, y1 - 3, top, 3, 1.5, 1.2, "rust")); // autos detenidos
}

function westQuay(solids: Solid[]): void {
  const { x0, x1 } = WEST_QUAY, w = x1 - x0;
  solids.push(prism(x0, CITY_EDGE.north, -1, w, 194 - CITY_EDGE.north, 1.6, "plaza"), prism(x0, 200, -1, w, CITY_EDGE.south - 200, 1.6, "plaza"));
  solids.push({ kind: "ramp", at: v3(x0, 194, -1), w, d: 6, h: 1.6, mat: "plaza", dir: "e" }); // escalera al agua
  for (const y of [192, 201]) solids.push({ kind: "cylinder", at: v3(x0 + 3, y, 0.6), r: 0.4, h: 0.8, mat: "rust", sides: 6 });
}

function malecon(solids: Solid[], accents: Accent[]): Vec3[] {
  const { x0, x1, y0, y1, z } = MALECON, w = x1 - x0, stairsY = 227;
  solids.push(prism(x0, y0, -1, w, stairsY - y0, z + 1, "paving"), prism(x0, stairsY + 6, -1, w, y1 - stairsY - 6, z + 1, "paving"));
  solids.push({ kind: "ramp", at: v3(x1 - 6, stairsY, -1), w: 6, d: 6, h: z + 1, mat: "paving", dir: "e" }); // escalera, hacia adentro de la zona
  solids.push(prism(x0, stairsY, -1, w - 6, 6, z + 1, "paving"));
  solids.push(prism(x1 - 1.5, y0, z, 1.5, stairsY - y0, 0.8, "paving"), prism(x1 - 1.5, stairsY + 6, z, 1.5, y1 - stairsY - 6, 0.8, "paving")); // parapeto
  for (const y of [170, 200, 245, 258]) solids.push(prism(x0 + 2, y, z, 2, 0.6, 0.5, "paving")); // bancos
  // faroles cada 12 u; el tramo nuevo del distrito (266..326) no comparte ninguno con el viejo
  const bulbs = [180, 210, 250, 272, 284, 296, 308, 320].map((y) => lamp(solids, accents, x1 - 3, y, z));
  for (const y of [stairsY - 1.5, stairsY + 6.5]) solids.push({ kind: "cylinder", at: v3(x1 - 3, y, z), r: 0.4, h: 0.8, mat: "rust", sides: 6 });
  return bulbs.map((b) => v3(b.x, b.y, b.z + 0.4));
}

// ---------------------------------------------------------------- derrumbe, cráteres, selva, autos

function collapsed(solids: Solid[], rng: Rng): void {
  const c = COLLAPSED;
  // el labio bajo (oeste) tiene que llegar al agua: estuaryEast ronda 274.6 en esta fila, no 280
  solids.push({ kind: "ramp", at: v3(c.x - 6, c.y, -1.2), w: 12, d: c.d, h: 1.5, mat: "asphalt", dir: "w" }); // la mitad oeste se hunde en el estuario
  solids.push(prism(c.x + 6, c.y, 0, 18, c.d, PLINTH_H, "paving")); // pegada al labio alto de la rampa (286), sin escalón
  solids.push(prism(c.x + 14, c.y + 4, PLINTH_H, 8, 10, rng.int(2, 3), "officeDark")); // ruina sin fachada, dentro de la plataforma
  // la losa grande del edificio caído, más dos cascotes; las tres enteras en agua (x + w < estuaryEast) y al oeste del labio de la rampa
  for (const [x, y, z, w, d] of [[c.x - 14, c.y + 8, -0.9, 8, 6], [c.x - 12, c.y + 1, -0.5, 4, 3], [c.x - 16, c.y + 16, -0.7, 3, 4]] as const) solids.push(prism(x, y, z, w, d, 1.2, "officeDark"));
  solids.push(prism(FALLEN_BLOCK.x, FALLEN_BLOCK.y, 0, FALLEN_BLOCK.w, FALLEN_BLOCK.d, 1, "officeDark")); // el cuarto, caído en la calle frente al malecón (el agua frente al malecón es zona Blog)
}

/**
 * Como `jungle`, pero descarta los conos que caerían en agua abierta del
 * estuario (consume el rng en el mismo orden, así no desalinea la semilla).
 */
function jungleOnLand(out: Solid[], rng: Rng, rect: { x0: number; x1: number; y0: number; y1: number }, n: number, z = 0.4): void {
  const tmp: Solid[] = [];
  jungle(tmp, rng, rect, n, z);
  for (const s of tmp) {
    if (s.kind === "cone" && s.at.x > QUAY_X - s.r && s.at.x <= islandWestX(s.at.y) + s.r) continue;
    out.push(s);
  }
}

function greenery(solids: Solid[], rng: Rng): void {
  jungleOnLand(solids, rng, { x0: WORLD.x0 + 3, x1: 340, y0: ZONE_SPLIT_Y + 1, y1: CITY_EDGE.north - 2 }, 30);      // cinturón de costura, sin pisar el estuario
  for (let y = ROWS[0]; y < COLLAPSED.y; y += 8) {                                                        // ribera este del estuario, ciudad vieja
    const x0 = Math.ceil(islandWestX(y + 6)) + 2, x1 = EAST_RING.x0 - 3;
    if (x1 - x0 >= 2) jungleOnLand(solids, rng, { x0, x1, y0: y, y1: y + 6 }, rng.int(1, 2));
  }
  // ribera este del distrito: selva entre el estuario y el malecón, al sur de la avenida vieja
  jungleOnLand(solids, rng, { x0: Math.ceil(islandWestX(DISTRICT_ROWS[0])) + 2, x1: MALECON.x0 - 3, y0: DISTRICT_BANK_Y, y1: MALECON.y1 - 2 }, 10);
  for (const c of CRATERS) { // cuadrado inscripto (0.7·r): todo cono queda dentro del círculo
    const k = Math.floor(c.r * 0.7);
    jungle(solids, rng, { x0: c.x - k, x1: c.x + k, y0: c.y - k, y1: c.y + k }, rng.int(4, 6), 0.2);
  }
}

/** Rectángulos `w0×d0` y `w1×d1` con esquinas en (x0,y0)/(x1,y1) que se tocan, agrandando el primero `gap` unidades. */
const rectsOverlap = (x0: number, y0: number, w0: number, d0: number, x1: number, y1: number, w1: number, d1: number, gap = 0): boolean =>
  x0 - gap < x1 + w1 && x0 + w0 + gap > x1 && y0 - gap < y1 + d1 && y0 + d0 + gap > y1;

function cars(solids: Solid[], rng: Rng): void {
  const placed: { x: number; y: number }[] = [];
  for (const b of blocks()) {
    if (b.kind === "plaza") continue;
    const n = rng.int(1, 3);
    for (let i = 0; i < n; i++) {
      const x = b.x + rng.int(2, b.w - 5);
      const y = rng.chance(0.5) ? b.y + b.d + 0.4 : b.y - 1.9; // vereda sur o norte de la manzana
      if (y < CITY_EDGE.north || y + 1.5 > CITY_EDGE.south) continue;
      if (y >= AVENUE.y0 - 2 && y <= AVENUE.y1) continue;      // la avenida no tiene autos en el cordón
      if (inCrater(x + 1.5, y + 0.75) || CRATERS.some((c) => Math.hypot(x + 1.5 - c.x, y + 0.75 - c.y) <= c.r + 2)) continue;
      if (x > QUAY_X && x <= estuaryEast(y) + 1) continue;    // sobre el estuario no hay vereda donde dejar un auto
      if (rectsOverlap(x, y, 3, 1.5, FALLEN_BLOCK.x, FALLEN_BLOCK.y, FALLEN_BLOCK.w, FALLEN_BLOCK.d)) continue;
      if (placed.some((p) => rectsOverlap(x, y, 3, 1.5, p.x, p.y, 3, 1.5, 1))) continue; // ningún auto pisa a otro, con 1 u de margen
      placed.push({ x, y });
      solids.push(prism(x, y, 0, 3, 1.5, 1.2, rng.chance(0.6) ? "steel" : "rust"));
    }
  }
}

// ---------------------------------------------------------------- escena

export function city(rng: Rng, districtRng: Rng): CityScene {
  const ground: Solid[] = [], solids: Solid[] = [], accents: Accent[] = [], signs: Accent[] = [];
  const tallPending = new Set<Block["bank"]>(["west", "east"]);
  for (const b of blocks()) if (b.kind === "block") block(solids, ground, rng, b, maxHeightFor(b), tallPending);
  const tower = plazaAndTower(solids, ground, accents, rng);
  for (const b of blocks()) if (b.kind === "district" || b.kind === "site") districtBlock(solids, ground, accents, signs, districtRng, b, maxDistrictHeight(b));
  lanes(ground);
  avenue(ground, solids);
  streetFurniture(solids, accents);
  bridge(solids, accents);
  westQuay(solids);
  const maleconLights = malecon(solids, accents);
  collapsed(solids, rng);
  greenery(solids, rng);
  cars(solids, rng);
  return { ground, solids, accents, tower, neon: { signs, malecon: maleconLights } };
}
