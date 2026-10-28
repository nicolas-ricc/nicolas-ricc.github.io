import type { Accent } from "../iso/accent";
import { v3, type Vec2, type Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import type { Rng } from "../map/seed";
import { BLEED, WORLD, ZONE_SPLIT_Y, inCoverQuad } from "../map/geo";
import { jungle } from "./flora";
import { towerCrane } from "./pieces";
import { RAIL_Y } from "./shipyard";
import { COVER_MARGIN, GREEN_BELT, builtAt } from "./sprawl-grid";
import { TRAIN_CLEAR } from "./station";

/**
 * Hinterland industrial de Portfolio, sobre el sangrado al norte y al oeste
 * de la fábrica: playa de maniobras con vagones, galpones, parque de tanques,
 * batería de silos, línea de alta tensión, acopios, patio de contenedores con
 * pórticos, depósito de agua y camiones. Al sur del patio sigue el cinturón
 * verde que separa la industria de la ciudad. Solo existe con el mundo entero.
 * Spec: docs/superpowers/specs/2026-09-15-margenes-urbanos-design.md §5.
 */
export interface HinterlandScene { ground: Solid[]; solids: Solid[]; accents: Accent[]; stacks: Vec3[] }

export const YARD_TRACKS_Y = [-72, -76, -80, -84, -88] as const;
export const YARD_X = { x0: -200, x1: 140 } as const;
export const WEST_TRACKS_X = [-70, -78] as const;
export const TANKS: readonly Vec2[] = [{ x: 118, y: -140 }, { x: 144, y: -140 }, { x: 170, y: -140 }, { x: 118, y: -112 }, { x: 144, y: -112 }, { x: 170, y: -112 }];
export const SILOS = { x0: 36, y0: -176, cols: 3, rows: 2, step: 7, r: 3, h: 16 } as const;
export const PYLON_Y = -196, PYLON_X0 = -190, PYLON_STEP = 48, PYLON_N = 8, PYLON_H = 14;
export const CONTAINER_YARD = { x0: -198, x1: -104, y0: -46, rows: 6, rowStep: 12 } as const;
const LAMP_H = 5, WATER_Z = -1;

const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Material, roof?: "gable"): Solid => (roof ? { kind: "prism", at: v3(x, y, z), w, d, h, mat, roof } : { kind: "prism", at: v3(x, y, z), w, d, h, mat });
const strip = (path: Vec2[], width: number, z: number, mat: Material): Solid => ({ kind: "strip", path, width, z, mat });
/** Una huella entera sobre tierra industrial del sangrado (o sobre el contenido, que ya es losa). */
const onIndustrial = (x: number, y: number, w: number, d: number): boolean =>
  [[x, y], [x + w, y], [x + w, y + d], [x, y + d]].every(([px, py]) => (px! >= WORLD.x0 && px! <= WORLD.x1 && py! >= WORLD.y0 && py! <= WORLD.y1) || builtAt(px!, py!) === "industrial");

function lamp(out: Solid[], accents: Accent[], x: number, y: number): void {
  out.push(prism(x, y, 0, 0.6, 0.6, LAMP_H, "steel"));
  accents.push({ kind: "dot", at: v3(x + 0.3, y + 0.3, LAMP_H), r: 1.2, color: "cyan" });
}

/** Playa de maniobras: cinco vías E-O al norte de la fábrica, con vagones en huecos de 10 u elegidos por rng. */
function marshallingYard(out: Solid[], rng: Rng): void {
  for (const y of YARD_TRACKS_Y) for (const dy of [-0.8, 0.8]) out.push(strip([{ x: YARD_X.x0, y: y + dy }, { x: YARD_X.x1, y: y + dy }], 0.4, 0.1, "rail"));
  const slots = Math.floor((YARD_X.x1 - YARD_X.x0) / 10);
  for (const y of YARD_TRACKS_Y) {
    const n = rng.int(3, 6), used = new Set<number>();
    for (let i = 0; i < n; i++) {
      const s = rng.int(0, slots - 1);
      if (used.has(s)) continue;
      used.add(s);
      const x = YARD_X.x0 + s * 10 + 1;
      if (!onIndustrial(x, y - 1.2, 8, 2.4)) continue;
      out.push(prism(x, y - 1.2, 0, 8, 2.4, 3, rng.chance(0.5) ? "rust" : "steel"));
    }
  }
  out.push(prism(YARD_X.x0 + 60, YARD_TRACKS_Y[2]! - 1.3, 0, 9, 2.6, 3.6, "steel"), prism(YARD_X.x0 + 66, YARD_TRACKS_Y[2]! - 1.3, 3.6, 3, 2.6, 1, "steel")); // locomotora de maniobras
}

/** Dos galpones a dos aguas al norte de la playa, con un autoelevador en cada portón. */
function halls(out: Solid[]): void {
  for (const x of [-50, 24]) {
    if (!onIndustrial(x, -130, 60, 14)) continue;
    out.push(prism(x, -130, 0, 60, 14, 8, "concrete", "gable"));
    out.push(prism(x + 60 - 8, -128, 0, 2, 3, 2, "rust"));
  }
}

/** Parque de tanques: seis cilindros bajos en dos filas, con murete de contención. */
function tankFarm(out: Solid[], rng: Rng): void {
  TANKS.forEach((t, i) => {
    if (!onIndustrial(t.x - 9, t.y - 9, 18, 18)) return;
    out.push({ kind: "cylinder", at: v3(t.x, t.y, 0), r: rng.int(7, 9), h: rng.int(5, 8), mat: i % 3 === 1 ? "rust" : "steel", sides: 12 });
  });
  out.push(strip([{ x: 106, y: -152 }, { x: 184, y: -152 }, { x: 184, y: -100 }, { x: 106, y: -100 }, { x: 106, y: -152 }], 0.6, 0.15, "concrete"));
}

/** Batería de silos: 3×2 cilindros esbeltos de hormigón unidos por una galería arriba. */
function silos(out: Solid[]): void {
  const { x0, y0, cols, rows, step, r, h } = SILOS;
  if (!onIndustrial(x0 - r, y0 - r, (cols - 1) * step + 2 * r, (rows - 1) * step + 2 * r)) return;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) out.push({ kind: "cylinder", at: v3(x0 + i * step, y0 + j * step, 0), r, h, mat: "concrete", sides: 10 });
  out.push(prism(x0 - r, y0 + step / 2 - 1, h, (cols - 1) * step + 2 * r, 2, 1.5, "steel")); // galería
  out.push(prism(x0 + (cols - 1) * step + r - 0.5, y0 + step / 2 - 0.5, 0, 1, 1, h + 3, "steel")); // elevador de granos
}

/** Línea de alta tensión E-O detrás de todo: torres cada 48 u con dos travesaños y dos cables. */
function pylons(out: Solid[]): void {
  for (let k = 0; k < PYLON_N; k++) {
    const x = PYLON_X0 + k * PYLON_STEP, y = PYLON_Y;
    if (!onIndustrial(x - 3, y - 3, 6, 6)) continue;
    out.push(prism(x - 0.5, y - 0.5, 0, 1, 1, PYLON_H, "steel"));
    for (const z of [PYLON_H - 2, PYLON_H - 4.5]) out.push(prism(x - 0.3, y - 3, z, 0.6, 6, 0.5, "steel"));
    if (k + 1 < PYLON_N && onIndustrial(x + PYLON_STEP - 3, y - 3, 6, 6)) for (const dy of [-2.5, 2.5]) out.push(prism(x, y + dy - 0.12, PYLON_H - 1.7, PYLON_STEP, 0.24, 0.24, "steel"));
  }
}

/** Acopios de mineral y arena al NO de la playa, con una pala cargadora. */
function stockpiles(out: Solid[], rng: Rng): void {
  for (let i = 0; i < 8; i++) {
    const x = rng.int(-150, -70), y = rng.int(-140, -104), big = i < 5;
    if (!onIndustrial(x - 8, y - 8, 16, 16)) continue;
    out.push({ kind: "cone", at: v3(x, y, 0), r: big ? rng.int(6, 8) : 4, h: big ? rng.int(3, 5) : 2.5, mat: big ? "rust" : "sand", sides: 7 });
  }
  out.push(prism(-100, -98, 0, 4, 2.6, 2.4, "steel"), prism(-104, -98.3, 0.2, 4, 3.2, 1.2, "rust")); // pala cargadora
}

/** Camiones esperando frente a los galpones y farolas cian. */
function trucks(out: Solid[], accents: Accent[]): void {
  for (const [x, y] of [[-30, -104], [-16, -104], [40, -104], [54, -104], [70, -104]] as const) { out.push(prism(x, y, 0, 6, 2.4, 2.8, "rust")); out.push(prism(x + 6, y, 0, 2, 2.4, 2.2, "steel")); }
  for (const [x, y] of [[-190, -66], [-120, -66], [-40, -92], [60, -92], [130, -66], [100, -150], [190, -104], [-120, -150], [30, -150]] as const) if (onIndustrial(x, y, 1, 1)) lamp(out, accents, x, y);
}

/** Muelle de graneles sobre la bahía, al norte del astillero: plataforma de hormigón, bolardos, grúa torre y contenedores. */
function pier(out: Solid[], accents: Accent[]): void {
  const x = 190, y = -100, w = 18, d = 34;
  if (!onIndustrial(x, y, w - 4, d)) return;
  out.push(prism(x, y, WATER_Z, w, d, 1.5 - WATER_Z, "concrete"));
  for (let py = y + 4; py < y + d; py += 8) out.push({ kind: "cylinder", at: v3(x + w - 1.5, py, 1.5), r: 0.7, h: 1, mat: "steel", sides: 6 });
  towerCrane(out, accents, { at: { x: x + 6, y: y + 12 }, z: 1.5, mastH: 16, jibLen: 14, dir: "e", light: "cyan" });
  for (const [dx, dy, k] of [[1, 20, 2], [1, 24, 1], [8, 26, 3]] as const) for (let i = 0; i < k; i++) out.push(prism(x + dx, y + dy, 1.5 + i * 2.6, 6, 2.4, 2.6, i % 2 === 0 ? "rust" : "steel"));
  lamp(out, accents, x + 2, y + 2);
}

/** Columna oeste: dos vías N-S más, patio de contenedores con dos pórticos, galpones, depósito de agua y camiones. */
function containerYard(out: Solid[], rng: Rng): void {
  for (const x of WEST_TRACKS_X) for (const dx of [-0.8, 0.8]) out.push(strip([{ x: x + dx, y: -200 }, { x: x + dx, y: 100 }], 0.4, 0.1, "rail"));
  for (let i = 0; i < 6; i++) out.push(prism(WEST_TRACKS_X[i % 2]! - 1.1, -30 + i * 16, 0, 2.2, 7, 2.8, i % 2 === 0 ? "rust" : "steel"));
  const { x0, x1, y0, rows, rowStep } = CONTAINER_YARD;
  for (let r = 0; r < rows; r++) {
    const y = y0 + r * rowStep;
    for (let x = x0; x + 6 <= x1; x += 7) {
      const n = rng.int(0, 3);
      if (n === 0 || !onIndustrial(x, y, 6, 2.4)) continue;
      for (let k = 0; k < n; k++) out.push(prism(x, y, k * 2.6, 6, 2.4, 2.6, rng.chance(0.5) ? "rust" : "steel"));
    }
  }
  for (const x of [-180, -130]) { // pórticos sobre neumáticos que cruzan las filas
    for (const y of [y0 - 4, y0 + (rows - 1) * rowStep + 6]) out.push(prism(x - 0.6, y - 0.6, 0, 1.2, 1.2, 10, "steel"));
    out.push(prism(x - 0.6, y0 - 4, 9.2, 1.2, (rows - 1) * rowStep + 10, 1, "steel"));
    out.push(prism(x - 1.2, y0 + 20, 8.4, 2.4, 2.4, 0.8, "rust")); // carro
  }
}

/** Galpones del oeste, depósito de agua y la selva del cinturón verde. */
function westHalls(out: Solid[], accents: Accent[], rng: Rng): void {
  for (const y of [50, 76]) { if (onIndustrial(-190, y, 36, 14)) { out.push(prism(-190, y, 0, 36, 14, 7, "concrete", "gable")); out.push(prism(-152, y + 2, 0, 3, 2, 2, "steel")); } }
  if (onIndustrial(-140, 58, 60, 24)) out.push(prism(-140, 58, 0, 60, 24, 9, "brick")); // nave de ladrillo
  for (const [x, y] of [[-120, 92], [-108, 92], [-96, 92]] as const) { out.push(prism(x, y, 0, 6, 2.4, 2.8, "rust")); out.push(prism(x + 6, y, 0, 2, 2.4, 2.2, "steel")); }
  const wx = -100, wy = 40, legH = 8; // depósito de agua
  for (const [dx, dy] of [[-2, -2], [2, -2], [2, 2], [-2, 2]] as const) out.push(prism(wx + dx - 0.3, wy + dy - 0.3, 0, 0.6, 0.6, legH, "steel"));
  out.push({ kind: "cylinder", at: v3(wx, wy, legH), r: 3, h: 4, mat: "steel", sides: 10 });
  accents.push({ kind: "dot", at: v3(wx, wy, legH + 4.2), r: 0.6, color: "cyanMid" });
  for (const [x, y] of [[-190, 44], [-130, 96], [-70, 20], [-150, -50], [-180, 10]] as const) lamp(out, accents, x, y);
  jungle(out, rng, { x0: -238, x1: WORLD.x0 - 2, y0: GREEN_BELT.y0 + 2, y1: ZONE_SPLIT_Y - 5 }, 60, 0.4, { y: RAIL_Y, train: TRAIN_CLEAR }); // la mitad de Portfolio del cinturón verde (r ≤ 4: ningún cono cruza la costura y = 146); se siembran 60 porque los que caerían sobre las vías del oeste se descartan (quedan ~20 tras despejar el corredor del tren, #280)
}

/** Las vías del oeste del astillero siguen por el cinturón verde hasta el borde del sangrado: en pantalla salen por la izquierda, como si no terminaran. */
export const WEST_RAIL_X0 = WORLD.x0 - BLEED.x;
function westRails(out: Solid[]): void {
  for (const y of RAIL_Y) out.push(strip([{ x: WEST_RAIL_X0, y }, { x: 0, y }], 0.5, 0.05, "rail"));
  for (let x = -2; x > WEST_RAIL_X0; x -= 4) out.push(prism(x, RAIL_Y[0] - 1, 0, 1, 5, 0.3, "rust")); // durmientes, al paso de los del astillero
}

export const POWER = { x: 34, y: -276, w: 40, d: 16 } as const;
export const STACKS_N = [{ x: 78, y: -270 }, { x: 78, y: -260 }] as const;
export const COOLING = { x: 20, y: -236, r: 8 } as const;
export const PARKING = { x: 50, y: -200, w: 34, d: 24 } as const;
export const ROAD_Y = -176;
const inCover = (x: number, y: number): boolean => inCoverQuad(x, y, 16 / 9, COVER_MARGIN);
/** Huella entera sobre tierra industrial y dentro del cover: guarda cada pieza (o grupo) de la central y la calle. */
const ok = (x: number, y: number, w: number, d: number): boolean => onIndustrial(x, y, w, d) && inCover(x + w / 2, y + d / 2);

/** Central térmica: sala de turbinas, dos chimeneas (las puntas van a `stacks`), torre de refrigeración, carbón con cinta, transformadores. */
function powerPlant(out: Solid[], accents: Accent[], stacks: Vec3[], rng: Rng): void {
  const { x, y, w, d } = POWER;
  if (ok(x, y, w, d)) out.push({ kind: "prism", at: v3(x, y, 0), w, d, h: 12, mat: "concrete", facade: { floors: 1, cols: 5 } });
  for (const s of STACKS_N) if (ok(s.x - 2.5, s.y - 2.5, 5, 5)) { out.push(prism(s.x - 2.5, s.y - 2.5, 0, 5, 5, 2, "concrete")); out.push({ kind: "cylinder", at: v3(s.x, s.y, 2), r: 2, h: 26, mat: "concrete", sides: 10 }); stacks.push(v3(s.x, s.y, 28)); }
  if (ok(COOLING.x - COOLING.r, COOLING.y - COOLING.r, COOLING.r * 2, COOLING.r * 2)) out.push({ kind: "cylinder", at: v3(COOLING.x, COOLING.y, 0), r: COOLING.r, h: 12, mat: "concrete", sides: 14 }, { kind: "cylinder", at: v3(COOLING.x, COOLING.y, 12), r: COOLING.r - 1.5, h: 4, mat: "concrete", sides: 14 });
  for (let i = 0; i < 3; i++) { const cx = 10 + i * 9, cy = -252 + (i % 2) * 4, r = rng.int(5, 6); if (ok(cx - r, cy - r, r * 2, r * 2)) out.push({ kind: "cone", at: v3(cx, cy, 0), r, h: 3, mat: "rust", sides: 7 }); } // carbón
  if (ok(12, -255.4, 24, 0.8)) { // cinta transportadora: postes + tira plana, como una sola huella
    for (let cx = 14; cx <= 34; cx += 8) out.push(prism(cx - 0.2, -255.2, 0, 0.4, 0.4, 4, "steel")); // postes de la cinta
    out.push(strip([{ x: 12, y: -255 }, { x: 36, y: -255 }], 0.8, 4, "steel")); // la cinta es plana: `strip` a z 4 (se pinta en el suelo; los postes la sostienen visualmente)
  }
  for (let i = 0; i < 6; i++) { const tx = 40 + (i % 3) * 10, ty = -252 + Math.floor(i / 3) * 6; if (!ok(tx, ty, 3, 2)) continue; out.push(prism(tx, ty, 0, 3, 2, 3, "steel")); for (const dx of [0.5, 1.5, 2.5]) out.push({ kind: "cylinder", at: v3(tx + dx, ty + 1, 3), r: 0.4, h: 1, mat: "rust", sides: 6 }); }
  if (ok(38, -254, 32.3, 14.3)) for (const [fx, fy, fw, fd] of [[38, -254, 32, 0.3], [38, -240, 32, 0.3], [38, -254, 0.3, 14], [70, -254, 0.3, 14]] as const) out.push(prism(fx, fy, 0, fw, fd, 1.2, "steel")); // cerco, como una sola huella
  for (const [lx, ly] of [[38, -256], [72, -238]] as const) if (ok(lx, ly, 0.6, 0.6)) lamp(out, accents, lx, ly);
}

/** Calle de la central a la feria, camiones esperando y el estacionamiento de la feria del lado industrial. */
function fairRoad(out: Solid[], accents: Accent[], rng: Rng): void {
  if (ok(0, ROAD_Y - 4, 83.9, 7)) { // la calle y sus farolas, como una sola huella (83.9: el borde x=84 ya es la feria)
    out.push(strip([{ x: 0, y: ROAD_Y }, { x: 84, y: ROAD_Y }], 6, 0.1, "road"));
    for (const x of [4, 32, 60]) lamp(out, accents, x, ROAD_Y - 4);
  }
  for (const x of [8, 18, 28]) if (ok(x, ROAD_Y + 3.5, 8, 2.4)) { out.push(prism(x, ROAD_Y + 3.5, 0, 6, 2.4, 2.8, "rust")); out.push(prism(x + 6, ROAD_Y + 3.5, 0, 2, 2.4, 2.2, "steel")); }
  const { x, y, w, d } = PARKING;
  if (ok(x, y, w - 0.1, d)) { // la losa y sus autos, como una sola huella (w-0.1: el borde x=84 ya es la feria)
    out.push(prism(x, y, 0, w, d, 0.3, "paving"));
    for (let i = 0; i < 12; i++) { const px = x + 2 + (i % 6) * 5, py = y + 3 + Math.floor(i / 6) * 10; out.push(prism(px, py, 0.3, 2.2, 1.4, 1.2, rng.chance(0.5) ? "steel" : "rust")); }
  }
}

export function hinterland(rng: Rng): HinterlandScene {
  const solids: Solid[] = [], accents: Accent[] = [], stacks: Vec3[] = [];
  marshallingYard(solids, rng);
  halls(solids);
  tankFarm(solids, rng);
  silos(solids);
  pylons(solids);
  stockpiles(solids, rng);
  trucks(solids, accents);
  pier(solids, accents);
  containerYard(solids, rng);
  westHalls(solids, accents, rng);
  westRails(solids);
  powerPlant(solids, accents, stacks, rng);
  fairRoad(solids, accents, rng);
  return { ground: solids.filter((s) => s.kind === "strip"), solids: solids.filter((s) => s.kind !== "strip"), accents, stacks };
}
