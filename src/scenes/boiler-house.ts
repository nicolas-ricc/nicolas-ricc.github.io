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

const BAYS = 11; // 12 pilastras = 11 crujías
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
  for (let k = 0; k <= BAYS; k++) {
    const c = x + (k * w) / BAYS;
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

/** Testero este: marco de pilastras, bandas y cornisa blancas; piñón escalonado de ladrillo con tapa blanca y celosía. */
export function gableEnd(out: Solid[]): void {
  for (const y of [-46, -36, -26, -17]) out.push(prism(120, y, 0, 1, 1, 13.7, "whitewash"));
  for (const [y0, y1] of [[-45, -36], [-35, -26], [-25, -23]] as const) out.push(prism(120, y0, 7, 0.3, y1 - y0, 0.3, "whitewash")); // bandas solo entre pilastras; la última se corta en el portón
  out.push(prism(120, -46, 13.7, 1, 30, 0.3, "whitewash")); // cornisa

  // escalones del piñón: ladrillo de 1.2 y tapa blanca de 0.3; celosía en la cara este, del pie a 0.2 bajo la tapa
  for (const [y0, y1, z] of [[-44, -18, 14], [-38, -24, 15.5], [-33, -29, 17]] as const) {
    const d = y1 - y0;
    const plates = Array.from({ length: d }, (_, i): Plate => ({ wall: 1, shape: "rect", u0: i / d, u1: (i + 0.5) / d, z0: z, z1: z + 1, mat: "brick", toneOffset: -2 }));
    out.push({ ...prism(119.5, y0, z, 1, d, 1.2, "brick"), plates });
    out.push(prism(119.5, y0, z + 1.2, 1, d, 0.3, "whitewash"));
  }
}

/** Cuatro chimeneas metálicas sobre el faldón norte, cada una con cuatro tensores a los faldones. */
export function metalStacks(out: Solid[]): void {
  for (const cx of METAL_STACK_X) {
    out.push({ kind: "cylinder", at: v3(cx, -33, 16.6), r: 0.5, h: 6, mat: "rust" });
    for (const sx of [-1, 1]) {
      out.push({ kind: "beam", from: v3(cx + sx * 0.35, -33.35, 21), to: v3(cx + sx * 2, -35, 16.23), w: 0.15, h: 0.15, mat: "rust" }); // faldón norte
      out.push({ kind: "beam", from: v3(cx + sx * 0.35, -32.65, 21), to: v3(cx + sx * 2, -31, 17), w: 0.15, h: 0.15, mat: "rust" });    // faldón sur
    }
  }
}
/** Torre de escalera de acero junto al testero. */
export function stairTower(_out: Solid[]): void {}
/** Cinta inclinada de la playa de camiones a la tolva junto al alero. */
export function inclineBelt(_out: Solid[]): void {}

/** Nave de calderas completa: cuerpo, testero, chimeneas metálicas, torre de escalera y cinta inclinada. */
export function boilerHouse(out: Solid[]): void {
  naveBody(out); gableEnd(out); metalStacks(out); stairTower(out); inclineBelt(out);
}
