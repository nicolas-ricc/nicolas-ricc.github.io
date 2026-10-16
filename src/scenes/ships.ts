import type { Accent } from "../iso/accent";
import { v3, type Vec2 } from "../iso/geometry";
import type { Facade } from "../iso/facade";
import type { Solid, Tri } from "../iso/solids";
import type { Material } from "../map/palette-iso";

/**
 * Flota: casco lofteado (`hull` con obra muerta `topMat` y arrufo) más
 * superestructuras como `poly` con huella rotada y fachada (ventanas),
 * chimeneas y mástiles como cilindros y cajas. Popa en `at` (`shipAt` lo
 * deriva del centro de la unidad), sobre el agua (z −1). Luces: mástil magentaMid, babor magenta, estribor cyanMid; la
 * lancha de la feria suma una ámbar. `wake` arma la estela de espuma.
 * `barge` reproduce un empujador fluvial de tres cubiertas (tipo *Steel Trader*) empujando una barcaza tolva Jumbo Mississippi; ver `docs/superpowers/specs/2026-10-16-barcos-referencia.md`.
 */
export type ShipKind = "cargo" | "tug" | "barge" | "ferry";
export interface ShipSpec { len: number; beam: number; h: number; sheer: number; topMat: Material }
export const SHIP_SPECS: Record<ShipKind, ShipSpec> = {
  cargo: { len: 60, beam: 10, h: 5, sheer: 0.25, topMat: "hullBlue" },
  tug: { len: 18, beam: 6, h: 3, sheer: 0.35, topMat: "hullBlue" },
  barge: { len: 40, beam: 8, h: 1.2, sheer: 0, topMat: "rust" },
  ferry: { len: 26, beam: 7, h: 3, sheer: 0.2, topMat: "whitewash" },
};
export const SHIP_MATS: readonly Material[] = ["hull", "hullBlue", "whitewash", "steel", "rust", "deck", "glass"];
const WATER_Z = -1, WAKE_Z = -0.95;
const BRIDGE: Facade = { floors: 1, cols: 3, window: { w: 0.5, h: 0.5 } };

interface Kit {
  hull: (dx: number, len: number, beam: number, h: number, sheer: number, topMat: Material) => Solid;
  box: (dx: number, dy: number, w: number, d: number, z: number, h: number, mat: Material, facade?: Facade) => Solid;
  cyl: (dx: number, dy: number, z: number, r: number, h: number, mat: Material) => Solid;
  dot: (dx: number, dy: number, z: number, r: number, color: Accent["color"]) => Accent;
  poly: (pts: [number, number, number][], color: Accent["color"], alpha: number) => Accent;
}

/** Piezas en coordenadas locales del barco (x a proa, y a estribor), rotadas por `heading`. */
function kit(at: Vec2, heading: number): Kit {
  const c = Math.cos(heading), s = Math.sin(heading);
  const local = (dx: number, dy: number) => ({ x: at.x + dx * c - dy * s, y: at.y + dx * s + dy * c });
  return {
    hull: (dx, len, beam, h, sheer, topMat) => { const p = local(dx, 0); return { kind: "hull", at: v3(p.x, p.y, WATER_Z), len, beam, h, mat: "hull", topMat, heading, sheer }; },
    box: (dx, dy, w, d, z, h, mat, facade) => ({ kind: "poly", footprint: [local(dx, dy), local(dx + w, dy), local(dx + w, dy + d), local(dx, dy + d)], z, h, mat, ...(facade ? { facade } : {}) }),
    cyl: (dx, dy, z, r, h, mat) => { const p = local(dx, dy); return { kind: "cylinder", at: v3(p.x, p.y, z), r, h, mat, sides: 8 }; },
    dot: (dx, dy, z, r, color) => { const p = local(dx, dy); return { kind: "dot", at: v3(p.x, p.y, z), r, color }; },
    poly: (pts, color, alpha) => ({ kind: "poly", pts: pts.map(([dx, dy, z]) => { const p = local(dx, dy); return v3(p.x, p.y, z); }), color, alpha }),
  };
}

function cargo(k: Kit, spec: ShipSpec, solids: Solid[], lights: Accent[]): void {
  const deck = WATER_Z + spec.h;
  for (const dx of [8, 18, 28]) solids.push(k.box(dx, -3, 9, 6, deck, 1.2, "rust")); // escotillas
  solids.push(k.box(54, -3.5, 6, 7, deck, 1.2, "hullBlue")); // castillo de proa
  solids.push(k.box(40, -4, 10, 8, deck, 2.4, "whitewash", BRIDGE), k.box(40.5, -3.5, 9, 7, deck + 2.4, 2.4, "whitewash", BRIDGE), k.box(41, -3, 8, 6, deck + 4.8, 2.4, "whitewash", BRIDGE));
  solids.push(k.box(46, -6, 4, 12, deck + 7.2, 2.2, "whitewash", { floors: 1, cols: 4, base: "glass" })); // puente con alerones
  solids.push(k.cyl(43, 0, deck + 7.2, 1.4, 4, "rust"), k.cyl(43, 0, deck + 11.2, 1.6, 0.6, "steel")); // chimenea y tapa
  solids.push(k.box(56, -0.2, 0.4, 0.4, deck + 1.2, 7, "steel"), k.box(54.5, -0.15, 3, 0.3, deck + 7.5, 0.3, "steel")); // mástil y cruceta
  for (const dx of [16, 36]) { solids.push(k.box(dx, 3.2, 0.8, 0.8, deck, 8, "steel")); solids.push(k.box(dx + 0.8, 3.3, 7, 0.6, deck + 6.5, 0.6, "steel")); } // grúas de cubierta
  solids.push(k.box(11, -5, 23, 0.3, deck, 0.8, "hullBlue"), k.box(11, 4.7, 23, 0.3, deck, 0.8, "hullBlue")); // amurada sobre el tramo recto de la cubierta
  lights.push(k.dot(56.2, 0, deck + 8.5, 0.7, "magentaMid"), k.dot(46, -6, deck + 9.4, 0.4, "magenta"), k.dot(46, 6, deck + 9.4, 0.4, "cyanMid"));
  lights.push(k.poly([[50.02, -5, deck + 7.6], [50.02, 5, deck + 7.6], [50.02, 5, deck + 8.8], [50.02, -5, deck + 8.8]], "magentaBleed", 0.8)); // ventanas del puente encendidas, cara de proa
}

function tug(k: Kit, spec: ShipSpec, solids: Solid[], lights: Accent[]): void {
  const deck = WATER_Z + spec.h;
  solids.push(k.box(5, -1.75, 4, 3.5, deck, 2.6, "whitewash", { floors: 1, cols: 3, base: "glass" }), k.box(4.8, -1.95, 4.4, 3.9, deck + 2.6, 0.3, "steel"));
  solids.push(k.cyl(3.5, 0, deck, 0.9, 2.5, "rust"));
  solids.push(k.box(9.5, -0.15, 0.3, 0.3, deck + 2.9, 3.5, "steel"));
  for (const dx of [4, 8, 12]) for (const dy of [-2.9, 2.9]) solids.push(k.cyl(dx, dy, deck - 0.6, 0.45, 0.9, "rust")); // defensas
  solids.push(k.cyl(1.5, 0, deck, 0.4, 0.8, "steel")); // bita
  solids.push(k.box(16.5, -0.3, 1, 0.6, deck + 0.4, 0.6, "rust")); // pudding de proa
  lights.push(k.dot(9.65, 0, deck + 6.6, 0.7, "magentaMid"), k.dot(12, -3, deck + 0.4, 0.4, "magenta"), k.dot(12, 3, deck + 0.4, 0.4, "cyanMid"));
}

function barge(k: Kit, spec: ShipSpec, solids: Solid[], lights: Accent[]): void {
  // barcaza: el anillo fijo del casco tiene popa redonda y proa en punta; cajas que lo cuadran, rake en dos escalones y placas que tapan la muesca de la flotación
  solids.push(k.box(0, -4, 7.2, 8, -0.9, 1.15, "rust"), k.box(22.8, -4, 13.6, 8, -0.9, 1.15, "rust"));
  solids.push(k.box(36.4, -4, 2, 8, -0.5, 0.75, "rust"), k.box(38.4, -4, 1.6, 8, -0.1, 0.35, "rust"));
  solids.push(k.box(0, -4, 36.4, 0.15, -0.9, 1.15, "rust"), k.box(0, 3.85, 36.4, 0.15, -0.9, 1.15, "rust"));
  const deck = WATER_Z + spec.h, top = deck + 0.05; // tope de los bloques que cuadran el casco
  solids.push(k.box(3, -3.6, 31.2, 0.4, top, 0.9, "rust"), k.box(3, 3.2, 31.2, 0.4, top, 0.9, "rust")); // brazola: bandas
  solids.push(k.box(3, -3.2, 0.4, 6.4, top, 0.9, "rust"), k.box(33.8, -3.2, 0.4, 6.4, top, 0.9, "rust")); // y testeros
  for (let i = 0; i < 4; i++) solids.push(k.box(3.2 + i * 7.7, -3.6, 7.5, 7.2, top + 0.9, 0.4, "steel"), k.box(3.55 + i * 7.7, -2.2, 6.8, 4.4, top + 1.3, 0.3, "steel")); // tapas abovedadas en dos escalones
  for (const dx of [1.5, 35.5]) for (const dy of [-2.8, 2.8]) solids.push(k.cyl(dx, dy, top, 0.3, 0.5, "steel")); // bitas
  // empujador pegado a la popa, con proa cuadrada
  solids.push(k.hull(-20, 20, 7, 1.6, 0, "hullBlue"), k.box(-5.5, -3.5, 5.5, 7, -0.9, 1.55, "hullBlue"));
  const pDeck = WATER_Z + 1.6 + 0.05; // tope del bloque de proa del empujador
  solids.push(k.box(-1.2, -3, 1.2, 1.2, pDeck, 1.6, "whitewash"), k.box(-1.2, 1.8, 1.2, 1.2, pDeck, 1.6, "whitewash")); // pechos de empuje, sobre la barcaza
  solids.push(k.box(-17.5, -2.6, 15.9, 5.2, pDeck, 1.55, "whitewash", { floors: 1, cols: 10 })); // nivel 1, la casilla larga
  solids.push(k.box(-6.2, -2.3, 4.6, 4.6, pDeck + 1.55, 1.55, "whitewash", { floors: 1, cols: 4 })); // nivel 2
  solids.push(k.box(-5.7, -2, 3.6, 4, pDeck + 3.1, 1.7, "whitewash", { floors: 1, cols: 4, base: "glass" }), k.box(-5.9, -2.2, 4, 4.4, pDeck + 4.8, 0.15, "steel")); // timonera y techo
  solids.push(k.cyl(-7.4, -1.3, pDeck + 1.55, 0.8, 1.5, "whitewash"), k.cyl(-7.4, 1.3, pDeck + 1.55, 0.8, 1.5, "whitewash")); // chimeneas gemelas, una por banda
  solids.push(k.box(-3.9, -0.125, 0.25, 0.25, pDeck + 4.95, 2.6, "steel"), k.box(-5.4, -0.5, 0.8, 1, pDeck + 4.95, 0.5, "steel")); // mástil y radar
  solids.push(k.box(-14, 0.6, 4.2, 1.5, pDeck + 1.55, 0.5, "steel")); // bote
  solids.push(k.box(-17.4, -2.6, 9, 0.1, pDeck + 1.55, 0.4, "steel"), k.box(-17.4, 2.5, 9, 0.1, pDeck + 1.55, 0.4, "steel")); // barandas
  lights.push(k.dot(-3.775, 0, 8.3, 0.7, "magentaMid"), k.dot(-2.3, -2.15, 5, 0.4, "magenta"), k.dot(-2.3, 2.15, 5, 0.4, "cyanMid"));
  lights.push(k.dot(-2.3, -1.7, 5.85, 0.35, "amber"), k.dot(-2.3, 1.7, 5.85, 0.35, "amber")); // proyectores
  lights.push(k.poly([[-2.08, -1.6, 4.1], [-2.08, 1.6, 4.1], [-2.08, 1.6, 5.2], [-2.08, -1.6, 5.2]], "magentaBleed", 0.8)); // ventanas encendidas de la timonera
}

function ferry(k: Kit, spec: ShipSpec, solids: Solid[], lights: Accent[]): void {
  const deck = WATER_Z + spec.h;
  solids.push(k.box(3, -3, 20, 6, deck, 2.4, "whitewash", { floors: 1, cols: 6, base: "glass" }));
  solids.push(k.box(6, -2.5, 12, 5, deck + 2.4, 2.2, "whitewash", { floors: 1, cols: 4, base: "glass" }));
  solids.push(k.cyl(8, 0, deck + 4.6, 0.7, 2, "rust"), k.box(15, -0.15, 0.3, 0.3, deck + 4.6, 3, "steel"));
  lights.push(k.dot(15.15, 0, deck + 7.8, 0.7, "magentaMid"), k.dot(22, -3, deck, 0.4, "magenta"), k.dot(22, 3, deck, 0.4, "cyanMid"), k.dot(15.15, 0, deck + 6.8, 0.9, "amber"));
}

const BUILD: Record<ShipKind, (k: Kit, spec: ShipSpec, solids: Solid[], lights: Accent[]) => void> = { cargo, tug, barge, ferry };

export function ship(kind: ShipKind, at: Vec2, heading: number): { solids: Solid[]; lights: Accent[] } {
  const spec = SHIP_SPECS[kind], k = kit(at, heading);
  const solids: Solid[] = [k.hull(0, spec.len, spec.beam, spec.h, spec.sheer, spec.topMat)];
  const lights: Accent[] = [];
  BUILD[kind](k, spec, solids, lights);
  return { solids, lights };
}

/** Popa de la unidad en coordenadas locales: el empujador va 20 u detrás de la barcaza. */
const sternOf = (kind: ShipKind): number => (kind === "barge" ? -20 : 0);

/** `at` de popa para que el punto medio de la unidad completa (empujador incluido) caiga en `center`. */
export function shipAt(kind: ShipKind, center: Vec2, heading: number): Vec2 {
  const half = (SHIP_SPECS[kind].len + sternOf(kind)) / 2;
  return { x: center.x - half * Math.cos(heading), y: center.y - half * Math.sin(heading) };
}

/** Estela: ola de proa (2, más clara), V de 6 triángulos finos por banda desde el 80 % de la eslora hacia atrás, remolino de popa (3). 17 triángulos a z −0.95. */
export function wake(kind: ShipKind, at: Vec2, heading: number): Tri[] {
  const { len, beam } = SHIP_SPECS[kind], half = beam / 2;
  const c = Math.cos(heading), s = Math.sin(heading);
  const p = (dx: number, dy: number) => v3(at.x + dx * c - dy * s, at.y + dx * s + dy * c, WAKE_Z);
  const tri = (a: [number, number], b: [number, number], d: [number, number], toneOffset = 0): Tri => ({ pts: [p(...a), p(...b), p(...d)], toneOffset });
  const out: Tri[] = [tri([len, 0], [len - 3, -half - 1.2], [len - 3, -half], 1), tri([len, 0], [len - 3, half], [len - 3, half + 1.2], 1)];
  const spread = Math.tan((12 * Math.PI) / 180), stern = sternOf(kind), tail = stern - 0.4 * len;
  for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
    const x0 = len * 0.8 - ((len * 0.8 - tail) * i) / 6, x1 = len * 0.8 - ((len * 0.8 - tail) * (i + 1)) / 6;
    const y0 = side * (half + (len * 0.8 - x0) * spread), y1 = side * (half + (len * 0.8 - x1) * spread);
    out.push(tri([x0, y0], [x1, y1], [x1, y1 + side * 0.8], i === 0 ? 1 : 0));
  }
  for (const [l, w] of [[3, 1.2], [5, 2], [7, 2.8]] as const) out.push(tri([stern, 0], [stern - l, -w], [stern - l, w]));
  return out;
}
