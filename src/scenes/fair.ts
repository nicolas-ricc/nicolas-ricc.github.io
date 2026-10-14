import type { Accent } from "../iso/accent";
import { polyline, v3, type PolyPoint, type Vec2, type Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { AccentColor, Material } from "../map/palette-iso";
import type { Rng } from "../map/seed";
import { FAIR, bayShoreX, bayWater, fairAt } from "./sprawl-grid";

/**
 * La feria de la playa, al norte de la fábrica sobre la bahía (estética
 * Coney Island): paseo de madera con faroles, muelle con pabellón, vuelta al
 * mundo, montaña rusa de madera, carrusel, torre de caída, salón de arcades,
 * puestos, autitos chocadores, sombrillas, portada. Es el único lugar con
 * acentos de los tres colores. Las piezas que se mueven (rueda, tren, góndola
 * de la torre) las arma el animador con los builders puros de acá.
 * Spec: docs/superpowers/specs/2026-09-15-mundo-3-tecnologico-feria-agua-barcos-design.md §4.3.
 */
export interface FairScene { ground: Solid[]; solids: Solid[]; accents: Accent[]; wheelAxis: Vec3; drop: { at: Vec3; h: number }; neon: { marquee: Vec3[]; lift: Vec3[]; column: Vec3[] }; arcadeSigns: [Accent, Accent] }

/** En la playa del sureste, entre el carrusel y el paseo de madera: 20 u de radio para que se lea desde el cover. Posición elegida para que nada estático quede delante de ella en pantalla (la regla del test). */
export const WHEEL = { x: 216, y: -204, r: 20, hub: 23, sides: 20 } as const;
export const COASTER = { x0: 94, x1: 156, y0: -226, y1: -196 } as const;
export const COASTER_PROFILE: readonly number[] = [4, 6, 8, 10, 12, 14, 13, 9, 5, 4, 6, 9, 12, 10, 6, 4, 5, 8, 11, 8, 5, 4, 4, 4];
/** Tramos del circuito que son la subida (lenta) del tren: los usan las luces de la subida y el animador. */
export const LIFT_SEGMENTS = 6;
export const DROP = { x: 150, y: -264, h: 24 } as const;
export const PIER = { y: -246, d: 10, len: 46 } as const;
export const BOARDWALK_W = 8;
export const CAROUSEL = { x: 178, y: -212 } as const;
export const ARCADE = { x: 96, y: -192 } as const;
export const BUMPER = { x: 130, y: -194 } as const;
/** Cartel ámbar del portal (cara sur): la marquesina de neón se alinea con él. */
const GATE_SIGN = { x0: 86.5, x1: 93.5, y: -177.98, z0: 6.1, z1: 7 } as const;
export const FAIR_MATS: readonly Material[] = ["deck", "whitewash", "rust", "steel", "copper", "stone", "concrete", "plaza", "paving", "sand", "rail", "glass", "hull", "leaf", "leafDark"];
const BOOTH_MATS: readonly Material[] = ["whitewash", "rust", "copper"];
const WATER_Z = -1;

const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Material, extra: { roof?: "gable"; facade?: { floors: number; cols: number; base?: "glass" } } = {}): Solid => ({ kind: "prism", at: v3(x, y, z), w, d, h, mat, ...extra });
const cyl = (x: number, y: number, z: number, r: number, h: number, mat: Material, sides = 8): Solid => ({ kind: "cylinder", at: v3(x, y, z), r, h, mat, sides });
const cone = (x: number, y: number, z: number, r: number, h: number, mat: Material, sides = 8): Solid => ({ kind: "cone", at: v3(x, y, z), r, h, mat, sides });
const dot = (x: number, y: number, z: number, r: number, color: AccentColor): Accent => ({ kind: "dot", at: v3(x, y, z), r, color });
/** Cartel: poly de luz en un plano vertical paralelo al eje x (cara sur), de `x0..x1` y `z0..z1`. */
const sign = (x0: number, x1: number, y: number, z0: number, z1: number, color: AccentColor): Accent => ({ kind: "poly", pts: [v3(x0, y, z0), v3(x1, y, z0), v3(x1, y, z1), v3(x0, y, z1)], color });
/** Caja rotada `heading` con centro en (cx, cy): para vías, vigas y autos del tren. */
const rotBox = (cx: number, cy: number, len: number, wid: number, heading: number, z: number, h: number, mat: Material): Solid => {
  const c = Math.cos(heading), s = Math.sin(heading), hl = len / 2, hw = wid / 2;
  const p = (dx: number, dy: number): Vec2 => ({ x: cx + dx * c - dy * s, y: cy + dx * s + dy * c });
  return { kind: "poly", footprint: [p(-hl, -hw), p(hl, -hw), p(hl, hw), p(-hl, hw)], z, h, mat };
};
const onFair = (x: number, y: number, w: number, d: number): boolean => [[x, y], [x + w, y], [x + w, y + d], [x, y + d]].every(([px, py]) => fairAt(px!, py!));

// ---------------------------------------------------------------- builders para el animador

export function wheelSolid(angle: number): Solid {
  return { kind: "wheel", at: v3(WHEEL.x, WHEEL.y, WHEEL.hub), r: WHEEL.r, width: 1.2, mat: "steel", sides: WHEEL.sides, angle, gondolas: { mat: "rust", w: 1.6, d: 1.2, h: 1.4 } };
}

/** Circuito rectangular de 24 puntos (sentido horario desde la esquina SO, por el lado sur hacia el este) con la z de `COASTER_PROFILE`. */
export function coasterPath(): Vec3[] {
  const { x0, x1, y0, y1 } = COASTER, w = x1 - x0, d = y1 - y0, per = 2 * (w + d);
  return COASTER_PROFILE.map((z, k) => {
    let t = (per * k) / COASTER_PROFILE.length;
    if (t < w) return v3(x0 + t, y1, z); t -= w;
    if (t < d) return v3(x1, y1 - t, z); t -= d;
    if (t < w) return v3(x1 - t, y0, z); t -= w;
    return v3(x0, y0 + t, z);
  });
}

// El circuito es constante (no depende del rng): se calcula una sola vez al cargar el módulo, no en
// cada llamada. `coasterAt`/`trainSolids` los llama el animador a cada cuadro (Task 18). El primer
// punto va otra vez al final: `polyline` es abierta y el circuito cierra.
const COASTER_PATH = coasterPath();
const COASTER_LINE = polyline([...COASTER_PATH, COASTER_PATH[0]!]);
const COASTER_LENGTH = COASTER_LINE.length;
export const coasterLength = (): number => COASTER_LENGTH;

/** Punto y rumbo del circuito a `dist` del inicio (z interpolada); el tren da vueltas, así que la distancia se envuelve. */
export function coasterAt(dist: number): PolyPoint {
  return COASTER_LINE.at(((dist % COASTER_LENGTH) + COASTER_LENGTH) % COASTER_LENGTH);
}

/** Tres autos del tren a `dist`, `dist − 2.6`, `dist − 5.2` sobre la vía: caja `rust` y asiento `steel`. */
export function trainSolids(dist: number): Solid[] {
  const out: Solid[] = [];
  for (let i = 0; i < 3; i++) { const p = coasterAt(dist - i * 2.6); out.push(rotBox(p.x, p.y, 2.2, 1.4, p.heading, p.z + 0.25, 1, "rust"), rotBox(p.x, p.y, 1.6, 1, p.heading, p.z + 1.25, 0.4, "steel")); }
  return out;
}

/** Góndola de la torre de caída a la altura `z`: anillo `rust` con ocho asientos. */
export function dropSolids(z: number): Solid[] {
  const out: Solid[] = [cyl(DROP.x, DROP.y, z, 2.4, 1.4, "rust")];
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; out.push(prism(DROP.x + 2.6 * Math.cos(a) - 0.3, DROP.y + 2.6 * Math.sin(a) - 0.3, z + 1.4, 0.6, 0.6, 0.8, "steel")); }
  return out;
}

// ---------------------------------------------------------------- escena estática

function boardwalk(out: Solid[], accents: Accent[]): void {
  for (let y = -300; y < -172; y += 18) {
    const x = Math.min(bayShoreX(y), bayShoreX(y + 9), bayShoreX(y + 18)) - 16; // la orilla se corre hasta 25 u en 18 de largo: el tramo entero queda en arena
    if (!onFair(x, y, BOARDWALK_W, 18)) continue;
    out.push(prism(x, y, 0, BOARDWALK_W, 18, 0.6, "deck"));
    for (let py = y + 3; py < y + 18; py += 6) out.push(prism(x + BOARDWALK_W - 0.4, py, 0.6, 0.3, 0.3, 1, "steel")); // baranda del lado del agua
    out.push(prism(x + 0.6, y + 9, 0.6, 0.4, 0.4, 4, "steel")); accents.push(dot(x + 0.8, y + 9.2, 4.6, 0.7, "amber"));
    out.push(prism(x + 2, y + 4, 0.6, 2, 0.6, 0.5, "deck"));
  }
}

function pier(out: Solid[], accents: Accent[]): void {
  const x0 = bayShoreX(PIER.y + PIER.d / 2) - 16 + BOARDWALK_W - 2, y = PIER.y;
  out.push(prism(x0, y, WATER_Z, PIER.len, PIER.d, 1.8, "deck"));
  for (let px = x0 + 4; px < x0 + PIER.len; px += 8) out.push(cyl(px, y + PIER.d + 0.4, WATER_Z, 0.4, 1.4, "rust", 6)); // pilotes del lado visible (sur)
  for (let px = x0 + 2; px < x0 + PIER.len - 8; px += 4) for (const py of [y + 0.5, y + PIER.d - 0.5]) { out.push(prism(px - 0.15, py - 0.15, 0.8, 0.3, 0.3, 3, "steel")); accents.push(dot(px, py, 3.8, 0.35, "amber")); }
  const cx = x0 + PIER.len - 5, cy = y + PIER.d / 2;
  out.push(cyl(cx, cy, 0.8, 5, 4, "whitewash", 8), cone(cx, cy, 4.8, 5.6, 2.5, "copper", 8));
  accents.push(dot(cx, cy, 7.5, 1, "magenta"));
}

function wheelSupport(out: Solid[], accents: Accent[]): void {
  const s = Math.SQRT1_2, { x, y } = WHEEL;
  for (const su of [-1, 1]) out.push(prism(x + su * 2.5 * s - 1.5 * s - 0.4, y - su * 2.5 * s - 1.5 * s - 0.4, 0, 0.8, 0.8, WHEEL.hub, "steel")); // dos columnas detrás del plano (lado −(1,1))
  out.push(rotBox(x - 1.2 * s, y - 1.2 * s, 6, 0.8, -Math.PI / 4, WHEEL.hub - 0.4, 0.8, "steel")); // viga del eje, detrás
  out.push(prism(x - 6, y - 4, 0, 12, 8, 0.6, "concrete"));
  out.push(prism(x - 12, y - 8, 0, 3, 3, 2.5, "whitewash", { roof: "gable" })); accents.push(sign(x - 11.7, x - 9.3, y - 4.98, 0.8, 1.8, "amber")); // boletería, detrás del plano de la rueda
  accents.push(dot(x, y, WHEEL.hub, 0.9, "amber"));
}

function coaster(out: Solid[]): void {
  const path = coasterPath(), n = path.length;
  for (let k = 0; k < n; k++) {
    const a = path[k]!, b = path[(k + 1) % n]!, len = Math.hypot(b.x - a.x, b.y - a.y), heading = Math.atan2(b.y - a.y, b.x - a.x), zm = (a.z + b.z) / 2;
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, px = -Math.sin(heading), py = Math.cos(heading);
    for (const side of [-1, 1]) out.push(rotBox(cx + px * side, cy + py * side, len, 0.3, heading, zm, 0.25, "rail"));
    out.push(prism(a.x - 0.25, a.y - 0.25, 0, 0.5, 0.5, a.z, "rust")); // columna
    out.push(rotBox(a.x, a.y, 2.4, 0.4, heading + Math.PI / 2, a.z - 0.3, 0.3, "deck")); // travesaño
    out.push(rotBox(cx, cy, len, 0.3, heading, Math.min(a.z, b.z) / 2, 0.3, "rust")); // celosía
  }
  const s = path[0]!; // estación sobre el primer segmento
  for (const [dx, dy] of [[0, -3], [8, -3], [0, 1], [8, 1]] as const) out.push(prism(s.x + dx, s.y + dy, 0, 0.4, 0.4, 7, "steel"));
  out.push(prism(s.x, s.y - 3, 7, 8, 4, 0.3, "whitewash"));
}

function carousel(out: Solid[], accents: Accent[]): void {
  const { x, y } = CAROUSEL;
  out.push(cyl(x, y, 0, 6, 0.6, "stone", 12));
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; out.push(cyl(x + 4.5 * Math.cos(a), y + 4.5 * Math.sin(a), 0.6, 0.25, 3, "steel", 6)); accents.push(dot(x + 6.5 * Math.cos(a), y + 6.5 * Math.sin(a), 3.4, 0.3, "amber")); }
  out.push(cone(x, y, 3.6, 7, 3, "whitewash", 12), cone(x, y, 6.6, 1.2, 1.5, "copper", 8));
}

function neon(drop: { at: Vec3; h: number }): FairScene["neon"] {
  const z0 = drop.at.z + 2, z1 = drop.h - 2;
  return {
    marquee: Array.from({ length: 8 }, (_, k) => v3(GATE_SIGN.x0 + (k * (GATE_SIGN.x1 - GATE_SIGN.x0)) / 7, GATE_SIGN.y - 0.02, 7.6)),
    lift: COASTER_PATH.slice(0, LIFT_SEGMENTS + 1).map((p) => v3(p.x, p.y, p.z + 0.8)),
    column: Array.from({ length: 6 }, (_, k) => v3(DROP.x, DROP.y + 0.8, z0 + (k * (z1 - z0)) / 5)),
  };
}

function dropTower(out: Solid[], accents: Accent[]): void {
  out.push(prism(DROP.x - 2, DROP.y - 2, 0, 4, 4, 0.6, "concrete"), prism(DROP.x - 0.5, DROP.y - 0.5, 0.6, 1, 1, DROP.h, "steel"));
  accents.push(dot(DROP.x, DROP.y, DROP.h + 0.8, 0.8, "cyan"));
}

function arcade(out: Solid[]): [Accent, Accent] {
  const { x, y } = ARCADE;
  out.push(prism(x, y, 0, 24, 12, 6, "whitewash", { facade: { floors: 1, cols: 5, base: "glass" } }));
  out.push(prism(x - 1, y + 12, 4, 26, 2, 0.4, "copper"), prism(x, y + 12, 3.6, 24, 1.5, 0.2, "rust"));
  out.push(prism(x + 7, y + 11, 6, 10, 0.4, 2.4, "steel"));
  return [sign(x + 7.3, x + 16.7, y + 11.42, 6.3, 8.1, "magenta"), sign(x + 7.3, x + 16.7, y + 11.42, 6.3, 8.1, "amber")]; // los dibuja solo la capa animada `fair.signs`
}

function booths(out: Solid[], accents: Accent[]): void {
  for (let k = 0; k < 8; k++) {
    const y = -294 + k * 12, x = bayShoreX(y + 1.5) - 16 - 6;
    if (!onFair(x, y, 4, 3)) continue;
    out.push(prism(x, y, 0, 4, 3, 2.8, BOOTH_MATS[k % 3]!, { roof: "gable" }));
    accents.push(sign(x + 0.8, x + 3.2, y + 3.02, 1.2, 2, "amber"));
    accents.push(dot(x + 2, y + 3.2, 2.9, 0.4, k % 3 === 2 ? "magenta" : "cyan"));
  }
}

function bumperCars(out: Solid[], accents: Accent[]): void {
  const { x, y } = BUMPER;
  out.push(prism(x, y, 0, 14, 10, 0.3, "plaza"));
  for (const [dx, dy] of [[0, 0], [7, 0], [14, 0], [0, 10], [7, 10], [14, 10], [0, 5], [14, 5]] as const) out.push(prism(x + dx - 0.2, y + dy - 0.2, 0.3, 0.4, 0.4, 4, "steel"));
  out.push(prism(x - 0.3, y - 0.3, 4.3, 14.6, 10.6, 0.4, "steel"), prism(x - 0.3, y + 10, 3.7, 14.6, 0.3, 0.6, "rust"));
  for (let i = 0; i < 6; i++) out.push(prism(x + 1.5 + (i % 3) * 4, y + 2 + Math.floor(i / 3) * 4, 0.3, 1.8, 1.2, 0.8, i % 2 === 0 ? "rust" : "steel"));
  for (let i = 0; i < 6; i++) accents.push(dot(x + 2 + (i % 3) * 5, y + 2.5 + Math.floor(i / 3) * 5, 3.6, 0.4, "cyan"));
}

function beach(out: Solid[], rng: Rng): void {
  let placed = 0, tries = 0;
  while (placed < 12 && tries++ < 200) {
    const y = rng.int(-298, -176), x = bayShoreX(y) - rng.int(3, 7);
    if (!fairAt(x, y) || bayWater(x, y)) continue;
    out.push(prism(x - 0.12, y - 0.12, 0, 0.25, 0.25, 2, "steel"), cone(x, y, 2, 1.6, 0.7, rng.chance(0.5) ? "whitewash" : "rust", 8));
    placed++;
  }
  for (let k = 0; k < 4; k++) { const y = -284 + k * 28, x = bayShoreX(y) - 9; if (fairAt(x, y)) out.push({ kind: "hull", at: v3(x, y, 0), len: 5, beam: 1.8, h: 0.8, mat: "whitewash", heading: rng.next() * Math.PI, sheer: 0.3 }); }
}

function gate(out: Solid[], accents: Accent[]): void {
  for (const x of [86, 93]) out.push(prism(x, -179.5, 0, 1.5, 1.5, 6, "stone"));
  out.push(prism(85.75, -179.5, 6, 9, 1.5, 1, "copper"));
  accents.push(sign(GATE_SIGN.x0, GATE_SIGN.x1, GATE_SIGN.y, GATE_SIGN.z0, GATE_SIGN.z1, "amber"));
  for (const [y0, y1] of [[FAIR.y0 + 8, -182], [-172, FAIR.y1]] as const) if (y1 > y0) out.push(prism(FAIR.x0, y0, 0, 0.3, y1 - y0, 1.2, "steel"));
}

export function fair(rng: Rng): FairScene {
  const solids: Solid[] = [], accents: Accent[] = [];
  boardwalk(solids, accents);
  pier(solids, accents);
  wheelSupport(solids, accents);
  coaster(solids);
  carousel(solids, accents);
  dropTower(solids, accents);
  const arcadeSigns = arcade(solids);
  booths(solids, accents);
  bumperCars(solids, accents);
  beach(solids, rng);
  gate(solids, accents);
  const drop = { at: v3(DROP.x, DROP.y, 1), h: DROP.h };
  return { ground: [], solids, accents, wheelAxis: v3(WHEEL.x, WHEEL.y, WHEEL.hub), drop, neon: neon(drop), arcadeSigns };
}
