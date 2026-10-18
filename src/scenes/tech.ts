import type { Accent } from "../iso/accent";
import type { Facade } from "../iso/facade";
import { v3, type Vec2, type Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import type { Rng } from "../map/seed";
import { WORLD, ZONE_SPLIT_Y } from "../map/geo";
import { BLOCK_W, BOULEVARD, CITY_EDGE, SIDEWALK, WEST_QUAY } from "./city-grid";
import { campus } from "../kit/forms/modern";
import { lamp, sign } from "../kit/props";
import { STYLES } from "../kit/styles";
import { PLINTH_H, brokenTone, plazaTone, prism, tiles } from "./city-pieces";
import { jungle } from "./flora";
import { GREEN_BELT, REACH, SUBURB_COLS, suburbBlocks, type SprawlBlock } from "./sprawl-grid";

/**
 * Distrito tecnológico de Resume: la ciudad sigue hacia el oeste y el sur del
 * distrito sobre la misma grilla, como un parque de oficinas y campus: torres
 * de muro cortina cerca del contenido, campus de startups después, naves de
 * laboratorio y centros de datos con paneles solares al final. Tres hitos:
 * torre de telecomunicaciones, arena, auditorio. Todo edificio tiene fachada.
 * Solo existe con el mundo entero (vive sobre el sangrado).
 * Spec: docs/superpowers/specs/2026-09-15-mundo-3-tecnologico-feria-agua-barcos-design.md §3.
 */
export interface Tower { box: Solid & { kind: "prism" }; facade: Facade }
export interface TechScene { ground: Solid[]; solids: Solid[]; accents: Accent[]; towers: Tower[]; signs: Accent[]; telecom: Vec3; neon: { crowns: Accent[]; mastRing: Vec3[] } }

export const TOWER_D = 60, CAMPUS_D = 160;
export const MAX_TECH_H = 20;
export const TELECOM = { x: -114, y: 242 } as const;
export const ARENA = { x: 102, y: 448 } as const;
export const AUDITORIUM = { x: 12, y: 352 } as const;
export const TECH_MATS: readonly Material[] = ["office", "officeDark", "glass", "curtain", "paving", "plaza", "stone", "copper", "concrete", "leaf", "leafDark", "steel", "rust"];
const CURTAIN_WINDOW = { w: 0.85, h: 0.8 } as const;
const LAB_FACADE: Facade = { floors: 1, cols: 1, base: "glass" };

type Kind = "tower" | "campus" | "atrium" | "lab" | "park" | "telecom" | "arena" | "auditorium";

const strip = (path: Vec2[], width: number, z: number, mat: Material): Solid => ({ kind: "strip", path, width, z, mat });

function pickKind(rng: Rng, b: SprawlBlock): Kind {
  if (b.x === TELECOM.x && b.y === TELECOM.y) return "telecom";
  if (b.x === ARENA.x && b.y === ARENA.y) return "arena";
  if (b.x === AUDITORIUM.x && b.y === AUDITORIUM.y) return "auditorium";
  if (rng.chance(0.12)) return "park";
  if (b.dist < TOWER_D) return "tower";
  if (b.dist < CAMPUS_D) return rng.chance(0.5) ? "campus" : "atrium";
  return "lab";
}

/** Corona de neón: franja en la cara sur del cuerpo superior, pegada al borde de arriba; cian en torres pares, magenta en impares. */
function crown(k: number, x: number, y: number, top: number, w: number): Accent {
  const x0 = x + 0.4, x1 = x + w - 0.4, z0 = top - 0.6;
  return { kind: "poly", pts: [v3(x0, y, z0), v3(x1, y, z0), v3(x1, y, top), v3(x0, y, top)], color: k % 2 === 0 ? "cyan" : "magenta", alpha: 1 };
}

/** Torre de muro cortina en uno o dos cuerpos, con helipuerto o terraza verde y cartel de azotea. */
function tower(out: Solid[], accents: Accent[], signs: Accent[], crowns: Accent[], towers: Tower[], rng: Rng, b: SprawlBlock): void {
  out.push(prism(b.x, b.y, 0, b.w, b.d, PLINTH_H, "paving"));
  const h = rng.int(12, MAX_TECH_H - 2), bw = rng.int(12, 16), bd = rng.int(10, 13);
  const bx = b.x + (b.w - bw) / 2, by = b.y + (b.d - bd) / 2;
  const th0Full = Math.round(h * 0.7); // el segundo cuerpo solo entra si el primero no queda por debajo del mínimo de 12
  const tiers = th0Full >= 12 && rng.chance(0.5) ? 2 : 1, th0 = tiers === 2 ? th0Full : h;
  const facade: Facade = { floors: Math.max(2, Math.round(th0 / 3)), cols: Math.max(2, Math.round(bw / 2.5)), window: CURTAIN_WINDOW, base: "glass" };
  const box = prism(bx, by, PLINTH_H, bw, bd, th0, "curtain", { facade });
  const k = towers.length;
  out.push(box); towers.push({ box, facade });
  out.push(prism(bx - 0.3, by - 0.3, PLINTH_H + th0, bw + 0.6, bd + 0.6, 0.3, "officeDark"));
  let z = PLINTH_H + th0 + 0.3, tw = bw, td = bd, tx = bx, ty = by;
  if (tiers === 2) {
    const th1 = h - th0; tw = bw - 4; td = bd - 4; tx = bx + 2; ty = by + 2;
    out.push(prism(tx, ty, z, tw, td, th1, "curtain", { facade: { floors: Math.max(1, Math.round(th1 / 3)), cols: Math.max(2, Math.round(tw / 2.5)), window: CURTAIN_WINDOW } }));
    out.push(prism(tx - 0.3, ty - 0.3, z + th1, tw + 0.6, td + 0.6, 0.3, "officeDark"));
    z += th1 + 0.3;
  }
  if (rng.chance(0.5)) { out.push({ kind: "cylinder", at: v3(tx + tw / 2, ty + td / 2, z), r: 2.5, h: 0.3, mat: "paving", sides: 8 }); accents.push({ kind: "dot", at: v3(tx + tw / 2, ty + td / 2, z + 0.3), r: 0.6, color: "amberMid" }); }
  else { out.push(prism(tx + 0.5, ty + 0.5, z, tw - 1, td - 1, 0.3, "leafDark")); for (let k = 0, n = rng.int(1, 3); k < n; k++) out.push({ kind: "cone", at: v3(tx + 1.5 + rng.next() * (tw - 3), ty + 1.5 + rng.next() * (td - 3), z + 0.3), r: 1, h: 2, mat: "leaf" }); }
  { const s = sign(v3(tx + tw / 2 - 3, ty + td - 0.4, z), 6, 1.6); out.push(...s.solids); signs.push(...s.accents); } // cartel de azotea en el borde sur
  crowns.push(crown(k, tx, ty + td + 0.02, z - 0.3, tw));
  if (h >= 18) accents.push({ kind: "dot", at: v3(tx + tw, ty, z + 0.5), r: 0.5, color: "amberMid" });
  if (rng.chance(0.5)) { const l = lamp(v3(b.x + b.w - 1, b.y - 1.5, 0)); out.push(...l.solids); accents.push(...l.accents); }
}

/** Atrio: dos losas de muro cortina unidas por un atrio de vidrio más bajo, sobre una plaza de baldosas con cartel de pie. */
function atrium(out: Solid[], ground: Solid[], signs: Accent[], rng: Rng, b: SprawlBlock): void {
  ground.push(tiles(rng, b, 0.05, "plaza", plazaTone));
  const ix = b.x + SIDEWALK + 0.5, iy = b.y + SIDEWALK, h = rng.int(6, 9);
  const facade: Facade = { floors: Math.max(2, Math.round(h / 3)), cols: 3, window: CURTAIN_WINDOW, base: "glass" };
  out.push(prism(ix, iy, 0.05, 9, 13, PLINTH_H, "paving"), prism(ix + 12, iy, 0.05, 9, 13, PLINTH_H, "paving"));
  out.push(prism(ix, iy, PLINTH_H, 9, 13, h, "curtain", { facade }), prism(ix + 12, iy, PLINTH_H, 9, 13, h, "curtain", { facade }));
  out.push(prism(ix + 9, iy + 1, PLINTH_H, 3, 11, 4, "glass", { facade: { floors: 1, cols: 1, base: "glass" } }));
  for (const [dx, dy] of [[2, 15], [19, 15], [8, 16], [13, 16]] as const) out.push({ kind: "cone", at: v3(b.x + dx, b.y + dy, 0.05), r: 1.1, h: 2.5, mat: "leaf" });
  out.push(prism(b.x + b.w - 5, b.y + b.d - 3, 0.05, 0.4, 0.4, 2, "officeDark"));
  { const s = sign(v3(b.x + b.w - 6.3, b.y + b.d - 3, 2.05), 3, 1.2); out.push(...s.solids); signs.push(...s.accents); } // cartel de pie
}

/** Nave de laboratorio o centro de datos: banda de vidrio por pared, equipos en el techo, campo solar y estacionamiento. */
function lab(out: Solid[], rng: Rng, b: SprawlBlock): void {
  out.push(prism(b.x, b.y, 0, b.w, b.d, PLINTH_H, "paving"));
  const ix = b.x + SIDEWALK, iy = b.y + SIDEWALK;
  out.push(prism(ix, iy, PLINTH_H, 20, 13, 5, "officeDark", { facade: LAB_FACADE }));
  for (let k = 0, n = rng.int(4, 6); k < n; k++) out.push(prism(ix + 1 + k * 3.5, iy + 2 + (k % 2) * 6, PLINTH_H + 5, 1.5, 1.5, 1, "steel"));
  for (let x = ix; x + 3 <= ix + 20; x += 6) for (let y = iy + 13.4; y + 1.6 <= b.y + b.d - SIDEWALK; y += 2.2) out.push({ kind: "ramp", at: v3(x, y, PLINTH_H), w: 3, d: 1.6, h: 0.5, mat: "glass", dir: "s" });
  for (let k = 0, n = rng.int(6, 8); k < n; k++) out.push(prism(b.x + 1 + k * 3, b.y + b.d + 0.3, 0, 2.2, 1.4, 1.2, rng.chance(0.5) ? "steel" : "rust")); // autos en el cordón sur
}

/** Plaza de barrio: suelo de selva facetado, senderos en cruz y conos. */
function park(out: Solid[], ground: Solid[], rng: Rng, b: SprawlBlock): void {
  ground.push(tiles(rng, b, 0.05, "leafDark", brokenTone));
  ground.push(strip([{ x: b.x + b.w / 2, y: b.y }, { x: b.x + b.w / 2, y: b.y + b.d }], 1, 0.08, "paving"));
  ground.push(strip([{ x: b.x, y: b.y + b.d / 2 }, { x: b.x + b.w, y: b.y + b.d / 2 }], 1, 0.08, "paving"));
  jungle(out, rng, { x0: b.x + 2, x1: b.x + b.w - 2, y0: b.y + 2, y1: b.y + b.d - 2 }, rng.int(4, 6), 0.05);
}

/** Torre de telecomunicaciones: base de hormigón, mástil esbelto, tres platos y luz en la punta. */
function telecom(out: Solid[], b: SprawlBlock): Vec3 {
  out.push(prism(b.x, b.y, 0, b.w, b.d, PLINTH_H, "paving"));
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2;
  out.push(prism(cx - 2, cy - 2, PLINTH_H, 4, 4, 2, "concrete"), prism(cx - 0.5, cy - 0.5, PLINTH_H + 2, 1, 1, 20, "steel"));
  for (const z of [10, 14, 18]) out.push({ kind: "cylinder", at: v3(cx + 1.2, cy, PLINTH_H + z), r: 1.2, h: 0.4, mat: "steel", sides: 8 });
  return v3(cx, cy, PLINTH_H + 22.2);
}

const octagon = (cx: number, cy: number, rx: number, ry: number): Vec2[] => Array.from({ length: 8 }, (_, i) => { const a = ((i + 0.5) / 8) * Math.PI * 2; return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }; });

/** Arena: anillo octogonal de piedra con el césped encima y cuatro torres de luz. */
function arena(out: Solid[], accents: Accent[], b: SprawlBlock): void {
  out.push(prism(b.x, b.y, 0, b.w, b.d, PLINTH_H, "paving"));
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2, h = 5;
  out.push({ kind: "poly", footprint: octagon(cx, cy, 11, 8), z: PLINTH_H, h, mat: "stone" });
  out.push({ kind: "poly", footprint: octagon(cx, cy, 8.5, 5.8), z: PLINTH_H + h, h: 0.3, mat: "leafDark" });
  for (const [dx, dy] of [[-9, -6], [9, -6], [9, 6], [-9, 6]] as const) {
    out.push(prism(cx + dx - 0.3, cy + dy - 0.3, PLINTH_H, 0.6, 0.6, 12, "steel"));
    accents.push({ kind: "dot", at: v3(cx + dx, cy + dy, PLINTH_H + 12), r: 0.9, color: "amber" });
  }
}

/** Auditorio: tambor de muro cortina con cubierta de cobre, marquesina sobre dos columnas y cartel. */
function auditorium(out: Solid[], signs: Accent[], b: SprawlBlock): void {
  out.push(prism(b.x, b.y, 0, b.w, b.d, PLINTH_H, "paving"));
  const cx = b.x + b.w / 2, cy = b.y + 8;
  out.push({ kind: "cylinder", at: v3(cx, cy, PLINTH_H), r: 8, h: 8, mat: "curtain", sides: 12 });
  out.push({ kind: "cone", at: v3(cx, cy, PLINTH_H + 8), r: 8.5, h: 2.5, mat: "copper", sides: 12 });
  for (const dx of [-4, 4]) out.push(prism(cx + dx - 0.3, b.y + b.d - 2.3, PLINTH_H, 0.6, 0.6, 3, "steel"));
  out.push(prism(cx - 5, b.y + b.d - 4, PLINTH_H + 3, 10, 3, 0.4, "officeDark"));
  { const s = sign(v3(cx - 3, b.y + b.d - 1.4, PLINTH_H + 3.4), 6, 1.2); out.push(...s.solids); signs.push(...s.accents); }
}

/** La avenida del distrito sigue hacia el oeste: cordones, cantero central con árboles y faroles. */
function avenue(ground: Solid[], solids: Solid[], accents: Accent[]): void {
  const x0 = SUBURB_COLS[SUBURB_COLS.length - 1]!, x1 = CITY_EDGE.west;
  for (const y of [BOULEVARD.y0 - 0.3, BOULEVARD.y1 + 0.3]) ground.push(strip([{ x: x0, y }, { x: x1, y }], 0.4, 0.05, "paving"));
  for (const x of SUBURB_COLS) {
    solids.push(prism(x, BOULEVARD.y0, 0, BLOCK_W, BOULEVARD.y1 - BOULEVARD.y0, 0.3, "leafDark"));
    for (const dx of [12]) solids.push({ kind: "cone", at: v3(x + dx, BOULEVARD.y0 + 2, 0.3), r: 1.5, h: 4, mat: "leaf" });
    const l = lamp(v3(x + 12, BOULEVARD.y0 - 5.3, 0)); solids.push(...l.solids); accents.push(...l.accents);
  }
}

/** El muro de la ribera oeste sigue al sur del distrito hasta donde llega el distrito tecnológico. */
function quay(solids: Solid[]): void {
  const { x0, x1 } = WEST_QUAY;
  solids.push(prism(x0, CITY_EDGE.south, -1, x1 - x0, WORLD.y1 + REACH.s - CITY_EDGE.south, 1.6, "plaza"));
  for (let y = CITY_EDGE.south + 8; y < WORLD.y1 + REACH.s; y += 24) solids.push({ kind: "cylinder", at: v3(x0 + 3, y, 0.6), r: 0.4, h: 0.8, mat: "rust", sides: 6 });
}

export function tech(rng: Rng): TechScene {
  const ground: Solid[] = [], solids: Solid[] = [], accents: Accent[] = [], towers: Tower[] = [], signs: Accent[] = [], crowns: Accent[] = [];
  let telecomTop = v3(TELECOM.x, TELECOM.y, 0);
  for (const b of suburbBlocks()) {
    switch (pickKind(rng, b)) {
      case "tower": tower(solids, accents, signs, crowns, towers, rng, b); break;
      case "campus": {
        const p = campus({ x: b.x + SIDEWALK, y: b.y + SIDEWALK, w: b.w - 2 * SIDEWALK, d: b.d - 2 * SIDEWALK, z: 0, open: [], maxH: MAX_TECH_H }, rng, STYLES.distrito);
        solids.push(...p.solids); ground.push(...p.ground); accents.push(...p.accents);
        break;
      }
      case "atrium": atrium(solids, ground, signs, rng, b); break;
      case "lab": lab(solids, rng, b); break;
      case "park": park(solids, ground, rng, b); break;
      case "telecom": telecomTop = telecom(solids, b); break;
      case "arena": arena(solids, accents, b); break;
      case "auditorium": auditorium(solids, signs, b); break;
    }
  }
  avenue(ground, solids, accents);
  quay(solids);
  jungle(solids, rng, { x0: -238, x1: WORLD.x0 - 2, y0: ZONE_SPLIT_Y + 2, y1: GREEN_BELT.y1 - 2 }, 2);
  return { ground, solids, accents, towers, signs, telecom: telecomTop, neon: { crowns, mastRing: [3, 6, 9].map((dz) => v3(telecomTop.x, telecomTop.y + 0.6, telecomTop.z - dz)) } };
}
