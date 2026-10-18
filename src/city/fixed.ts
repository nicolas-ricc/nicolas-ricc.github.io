import type { Accent } from "../iso/accent";
import { facadeAccents, windowPatches, type Facade } from "../iso/facade";
import { centroid, v3, type Vec3 } from "../iso/geometry";
import { visibleWalls, type Solid } from "../iso/solids";
import type { Rng } from "../map/seed";
import { QUAY_X, WORLD, ZONE_SPLIT_Y } from "../map/geo";
import { AVENUE, BRIDGE, CITY_EDGE, COLLAPSED, CRATERS, DISTRICT_BANK_Y, DISTRICT_ROWS, EAST_RING, FALLEN_BLOCK, LIT_FLOOR, MALECON, PLAZA, ROWS, STREET, TOWER, TOWER_FLOORS, TOWER_H, WEST_QUAY, blocks, estuaryEast, inCrater } from "../scenes/city-grid";
import { jungle } from "../scenes/flora";
import { CAR, bench, bollard, car, lamp, place, puddle } from "../kit/props";
import { PLINTH_H, plazaTone, prism, tiles } from "../scenes/city-pieces";

// ---------------------------------------------------------------- plaza y torre

/** Ventanas del piso encendido, punta de la antena y la ventana del papel: los anima city-anim. */
export interface TowerLights { litWindows: Accent[]; antenna: Vec3; paperWindow: Vec3 }

export function plazaAndTower(solids: Solid[], ground: Solid[], accents: Accent[], rng: Rng): TowerLights {
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
  const walls = visibleWalls(tower).filter((f) => f.mat === "officeDark" && f.toneOffset === 0);
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
  for (const [x, y] of [[TOWER.x + TOWER.w + 6.5, TOWER.y + 2], [TOWER.x + TOWER.w + 9, TOWER.y + 4]] as const) accents.push(...puddle(x, y, "amberBleed"));
  for (const [x, y] of [[PLAZA.x + 4, PLAZA.y + 3], [PLAZA.x + PLAZA.w - 6, PLAZA.y + 3], [PLAZA.x + 4, PLAZA.y + PLAZA.d - 4.2], [PLAZA.x + PLAZA.w - 6, PLAZA.y + PLAZA.d - 4.2]] as const) solids.push(...bench(v3(x, y, 0.05)));
  place(solids, accents, lamp(v3(PLAZA.x + 2, PLAZA.y + PLAZA.d / 2, 0.05)));
  place(solids, accents, lamp(v3(PLAZA.x + PLAZA.w - 2.6, PLAZA.y + PLAZA.d / 2, 0.05)));
  return { litWindows, antenna: v3(mast.x, mast.y, mast.z + 5), paperWindow };
}

// ---------------------------------------------------------------- puente, muelle oeste y malecón

export function bridge(solids: Solid[], accents: Accent[]): void {
  const { x0, x1, y0, y1, z, deckH } = BRIDGE;
  const top = z + deckH, d = y1 - y0;
  solids.push(prism(x0, y0, z, x1 - x0, d, deckH, "asphalt"));
  solids.push({ kind: "ramp", at: v3(x0 - STREET, y0, 0), w: STREET, d, h: top, mat: "asphalt", dir: "w" });
  solids.push({ kind: "ramp", at: v3(x1, y0, 0), w: STREET, d, h: top, mat: "asphalt", dir: "e" });
  for (let x = x0 + 18; x < x1; x += 18) solids.push(prism(x - 1, y0, -1, 2, d, z + 1, "plaza")); // pilotes: 210, 228, 246, 264
  solids.push(prism(WEST_QUAY.x0, y0, 0.6, WEST_QUAY.x1 - WEST_QUAY.x0, d, z - 0.6, "plaza")); // estribo (0.6, el tope del muelle): el tablero apoya, no flota
  solids.push(prism(x0, y0, top, x1 - x0, 0.3, 0.8, "officeDark"), prism(x0, y1 - 0.3, top, x1 - x0, 0.3, 0.8, "officeDark")); // barandas
  place(solids, accents, lamp(v3(x0 + 30, y0 + 0.4, top)));
  place(solids, accents, lamp(v3(x1 - 30, y1 - 1, top)));
  solids.push(...car(v3(x0 + 40, y0 + 1.5, top), "steel"), ...car(v3(x0 + 58, y1 - 3, top), "rust")); // autos detenidos
}

export function westQuay(solids: Solid[]): void {
  const { x0, x1 } = WEST_QUAY, w = x1 - x0;
  solids.push(prism(x0, CITY_EDGE.north, -1, w, 194 - CITY_EDGE.north, 1.6, "plaza"), prism(x0, 200, -1, w, CITY_EDGE.south - 200, 1.6, "plaza"));
  solids.push({ kind: "ramp", at: v3(x0, 194, -1), w, d: 6, h: 1.6, mat: "plaza", dir: "e" }); // escalera al agua
  for (const y of [192, 201]) solids.push(...bollard(v3(x0 + 3, y, 0.6)));
}

export function malecon(solids: Solid[], accents: Accent[]): Vec3[] {
  const { x0, x1, y0, y1, z } = MALECON, w = x1 - x0, stairsY = 227;
  solids.push(prism(x0, y0, -1, w, stairsY - y0, z + 1, "paving"), prism(x0, stairsY + 6, -1, w, y1 - stairsY - 6, z + 1, "paving"));
  solids.push({ kind: "ramp", at: v3(x1 - 6, stairsY, -1), w: 6, d: 6, h: z + 1, mat: "paving", dir: "e" }); // escalera, hacia adentro de la zona
  solids.push(prism(x0, stairsY, -1, w - 6, 6, z + 1, "paving"));
  solids.push(prism(x1 - 1.5, y0, z, 1.5, stairsY - y0, 0.8, "paving"), prism(x1 - 1.5, stairsY + 6, z, 1.5, y1 - stairsY - 6, 0.8, "paving")); // parapeto
  for (const y of [170, 200, 245, 258]) solids.push(...bench(v3(x0 + 2, y, z))); // bancos
  // faroles cada 12 u; el tramo nuevo del distrito (266..326) no comparte ninguno con el viejo
  const bulbs = [180, 210, 250, 272, 284, 296, 308, 320].map((y) => { const l = lamp(v3(x1 - 3, y, z)); place(solids, accents, l); return l.bulb; });
  for (const y of [stairsY - 1.5, stairsY + 6.5]) solids.push(...bollard(v3(x1 - 3, y, z)));
  return bulbs.map((b) => v3(b.x, b.y, b.z + 0.4));
}

// ---------------------------------------------------------------- derrumbe, cráteres, selva, autos

export function collapsed(solids: Solid[], rng: Rng): void {
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
    if (s.kind === "cone" && s.at.x > QUAY_X - s.r && s.at.x <= estuaryEast(s.at.y) + s.r) continue;
    out.push(s);
  }
}

export function greenery(solids: Solid[], rng: Rng): void {
  jungleOnLand(solids, rng, { x0: WORLD.x0 + 3, x1: 340, y0: ZONE_SPLIT_Y + 1, y1: CITY_EDGE.north - 2 }, 30);      // cinturón de costura, sin pisar el estuario
  for (let y = ROWS[0]; y < COLLAPSED.y; y += 8) {                                                        // ribera este del estuario, ciudad vieja
    const x0 = Math.ceil(estuaryEast(y + 6)) + 2, x1 = EAST_RING.x0 - 3;
    if (x1 - x0 >= 2) jungleOnLand(solids, rng, { x0, x1, y0: y, y1: y + 6 }, rng.int(1, 2));
  }
  // ribera este del distrito: selva entre el estuario y el malecón, al sur de la avenida vieja
  jungleOnLand(solids, rng, { x0: Math.ceil(estuaryEast(DISTRICT_ROWS[0])) + 2, x1: MALECON.x0 - 3, y0: DISTRICT_BANK_Y, y1: MALECON.y1 - 2 }, 10);
  for (const c of CRATERS) { // cuadrado inscripto (0.7·r): todo cono queda dentro del círculo
    const k = Math.floor(c.r * 0.7);
    jungle(solids, rng, { x0: c.x - k, x1: c.x + k, y0: c.y - k, y1: c.y + k }, rng.int(4, 6), 0.2);
  }
}

/** Rectángulos `w0×d0` y `w1×d1` con esquinas en (x0,y0)/(x1,y1) que se tocan, agrandando el primero `gap` unidades. */
const rectsOverlap = (x0: number, y0: number, w0: number, d0: number, x1: number, y1: number, w1: number, d1: number, gap = 0): boolean =>
  x0 - gap < x1 + w1 && x0 + w0 + gap > x1 && y0 - gap < y1 + d1 && y0 + d0 + gap > y1;

export function cars(solids: Solid[], rng: Rng): void {
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
      if (rectsOverlap(x, y, CAR.w, CAR.d, FALLEN_BLOCK.x, FALLEN_BLOCK.y, FALLEN_BLOCK.w, FALLEN_BLOCK.d)) continue;
      if (placed.some((p) => rectsOverlap(x, y, CAR.w, CAR.d, p.x, p.y, CAR.w, CAR.d, 1))) continue; // ningún auto pisa a otro, con 1 u de margen
      placed.push({ x, y });
      solids.push(...car(v3(x, y, 0), rng.chance(0.6) ? "steel" : "rust"));
    }
  }
}
