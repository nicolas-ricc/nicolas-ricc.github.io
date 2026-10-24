import { v3 } from "../iso/geometry";
import type { Plate, Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";

/**
 * Nave de calderas de la Fábrica de Luz, sobre la huella `x 44..120, y −46..−16`
 * de la planta. La cámara ve techo, este (+x) y sur (+y): el detalle va ahí.
 * Decisiones: .superpowers/sdd/2026-10-24-213-nave-calderas/decisions.md.
 */
export const NAVE = { x: 44, y: -46, w: 76, d: 30, h: 14 } as const;
export const STAIR_TOWER = { x0: 121, y0: -34, x1: 126, y1: -26 } as const;
export const METAL_STACK_X = [55, 70, 85, 100] as const;

const PIERS = 11; // 12 pilastras = 11 crujías
const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Material): Solid & { kind: "prism" } => ({ kind: "prism", at: v3(x, y, z), w, d, h, mat });

/** Celosía de ladrillo en damero: placas de 0.5 × 0.8 cada 1 u sobre la pared `wall` de largo `len`, bajo el alero (z 12.8..13.6). */
function lattice(wall: number, len: number): Plate[] {
  return Array.from({ length: len }, (_, i): Plate => ({ wall, shape: "rect", u0: i / len, u1: (i + 0.5) / len, z0: 12.8, z1: 13.6, mat: "brick", toneOffset: -2 }));
}

/** Muros, pilastras salientes con zapata, montante y ménsula, zócalo con tubos, techo de pizarra, remate sur y caperuzas. */
export function naveBody(out: Solid[]): void {
  const { x, y, w, d } = NAVE;
  const facade = (cols: number) => ({ floors: 1, cols, window: { w: 0.6, h: 0.55 }, grid: { cols: 3, rows: 4 }, head: "flat" as const, courses: { mat: "rust" as const, h: 0.4 } });
  out.push({ ...prism(x, y, 0, w, d, 7, "brick"), facade: facade(11) });
  out.push({ ...prism(x, y, 7, w, d, 7, "brick"), facade: facade(22), plates: [...lattice(2, w), ...lattice(1, d)] });

  // zócalo blanco delante del muro sur, con tubos alternados
  out.push({ ...prism(x, -16, 0, w, 1.5, 3.5, "whitewash"), facade: { floors: 1, cols: 20, window: { w: 0.7, h: 0.6 }, grid: { cols: 4, rows: 5 } } });
  for (let i = 0; i < 20; i++) out.push({ kind: "cylinder", at: v3(x + (i + 0.5) * 3.8, -14.8, 3.5), r: 0.3, h: 0.8, mat: i % 2 === 0 ? "whitewash" : "rust" });

  // pilastras: zapata sobre el zócalo, fuste a y −16..−15.5, montante de celosía al oeste y ménsula bajo el remate
  for (let k = 0; k <= PIERS; k++) {
    const c = x + (k * w) / PIERS;
    out.push(prism(c - 0.45, -16, 3.5, 0.9, 0.9, 0.6, "concrete"));
    out.push(prism(c - 0.25, -16, 4.1, 0.5, 0.5, 9.9, "rust"));
    out.push(prism(c - 0.6, -16, 4.1, 0.15, 0.15, 9.9, "rust"));
    out.push({ kind: "beam", from: v3(c, -15.5, 11.5), to: v3(c, -15.15, 13.55), w: 0.3, h: 0.3, mat: "rust" });
  }

  // techo de pizarra a dos aguas, cumbrera E-O a z 17 en y −31; sin alero oeste (el marcador de la maltería queda pegado)
  out.push({ kind: "ramp", at: v3(x, -46.6, 14), w: 75.5, d: 15.6, h: 3, mat: "steel", dir: "n" });
  out.push({ kind: "ramp", at: v3(x, -31, 14), w: 75.5, d: 15.6, h: 3, mat: "steel", dir: "s" });
  out.push(prism(x, -15.4, 13.7, 75.5, 0.3, 0.3, "whitewash")); // remate sur, bajo el borde del alero
  for (const cx of [62.5, 77.5, 92.5, 110]) out.push(prism(cx - 0.6, -31.6, 17, 1.2, 1.2, 0.8, "steel")); // caperuzas en la cumbrera
}

/** Testero este: marco, piñón escalonado con tapa y celosía. */
export function gableEnd(_out: Solid[]): void {}
/** Cuatro chimeneas metálicas sobre el faldón norte con sus tensores. */
export function metalStacks(_out: Solid[]): void {}
/** Torre de escalera de acero junto al testero. */
export function stairTower(_out: Solid[]): void {}
/** Cinta inclinada de la playa de camiones a la tolva junto al alero. */
export function inclineBelt(_out: Solid[]): void {}

export function boilerHouse(out: Solid[]): void {
  naveBody(out); gableEnd(out); metalStacks(out); stairTower(out); inclineBelt(out);
}
