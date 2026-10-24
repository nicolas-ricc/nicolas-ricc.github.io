import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import type { Plate } from "../iso/plate";
import type { Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";

/** Excavadora de rueda de cangilones SRs 1300 (TAKRAF) en la playa de vías: chasis en `at`, proa al NE (`heading`); el eje de la rueda queda a `axleDx` del chasis, a z `axleZ`. */
export const EXCAVATOR = {
  at: { x: -30, y: 76 }, heading: -Math.PI / 4, axleDx: 16 * Math.SQRT2, // ≈ 22.63: elegido para que el eje caiga en (−14, 60)
  axleZ: 9.2,
  wheel: { r: 5.5, width: 0.5, sides: 28, slots: 28, buckets: { n: 14, depth: 1.2, teeth: 2 } },
  pile: { r: 6.5, h: 4.5 },
} as const;

/** Marco local del chasis (heading −π/4): dx corre al NE, dy hacia la cámara. */
export const local = (dx: number, dy: number) => ({ x: EXCAVATOR.at.x + (dx + dy) / Math.SQRT2, y: EXCAVATOR.at.y + (dy - dx) / Math.SQRT2 });

/** La rueda de cangilones, hueca con llanta doble, en el ángulo dado. */
export function excavatorWheel(angle: number): Solid {
  const axle = local(EXCAVATOR.axleDx, 0), { r, width, sides, slots, buckets } = EXCAVATOR.wheel;
  return { kind: "wheel", at: v3(axle.x, axle.y, EXCAVATOR.axleZ), r, width, mat: "rust", sides, angle, hollow: true, slots, buckets: { ...buckets, mat: "rust" } };
}

type Poly = Solid & { kind: "poly" };
/** Caja girada: huella `[local(dx0,dy0), local(dx1,dy0), local(dx1,dy1), local(dx0,dy1)]`; la pared que ve la cámara es la arista 2 (dy máximo). */
export const box = (dx0: number, dy0: number, dx1: number, dy1: number, z: number, h: number, mat: Material, extra: Pick<Poly, "facade" | "plates"> = {}): Solid =>
  ({ kind: "poly", footprint: [local(dx0, dy0), local(dx1, dy0), local(dx1, dy1), local(dx0, dy1)], z, h, mat, ...extra });
/** Viga entre dos puntos `[dx, dy, z]` del marco local. */
export const bar = (from: [number, number, number], to: [number, number, number], w: number, h: number, mat: Material): Solid => {
  const a = local(from[0], from[1]), b = local(to[0], to[1]);
  return { kind: "beam", from: v3(a.x, a.y, from[2]), to: v3(b.x, b.y, to[2]), w, h, mat };
};
const cyl = (dx: number, dy: number, z: number, r: number, h: number, mat: Material): Solid => { const p = local(dx, dy); return { kind: "cylinder", at: v3(p.x, p.y, z), r, h, mat, sides: 8 }; };

/** Chasis y nivel de plataforma: orugas con zapatas y rodillos, anillo de giro, plataforma con barandas, casa baja y escaleras. */
export function excavator(out: Solid[], _accents: Accent[]): void {
  // Orugas: 12 zapatas de 0.3 cada 0.8 u sobre la arista 2 (u=0 en el extremo dx máximo; 10 u de largo → fracciones /10)
  const shoes: Plate[] = Array.from({ length: 12 }, (_, k) => ({ wall: 2, shape: "rect", u0: (0.2 + 0.8 * k) / 10, u1: (0.5 + 0.8 * k) / 10, z0: 0, z1: 1.6, mat: "rust", toneOffset: -2 }));
  for (const [dy0, dy1] of [[-4.2, -1.8], [1.8, 4.2]] as const) {
    out.push(box(-5, dy0, 5, dy1, 0, 1.6, "rust", { plates: shoes }));
    for (const dx of [-3, 0, 3]) out.push(cyl(dx, dy1 + 0.3, 0.65, 0.3, 0.3, "steel"));
  }
  out.push({ kind: "cylinder", at: v3(EXCAVATOR.at.x, EXCAVATOR.at.y, 1.6), r: 4, h: 1, mat: "steel", sides: 16 }); // anillo de giro
  out.push(box(-6, -4.5, 6, 4.5, 2.6, 0.8, "office")); // plataforma
  // barandas: pasamanos a z 4.4 sobre el borde sur (dy +4.3) y el borde NE (dx +5.8), postes de 0.15 cada 2 u
  out.push(bar([-6, 4.3, 4.475], [5.8, 4.3, 4.475], 0.15, 0.15, "safety"), bar([5.8, -4.5, 4.475], [5.8, 4.3, 4.475], 0.15, 0.15, "safety")); // el pasamanos apoya sobre los postes (tope z 4.4)
  const post = (dx: number, dy: number) => out.push(box(dx - 0.075, dy - 0.075, dx + 0.075, dy + 0.075, 3.4, 1, "safety"));
  for (let dx = -5.85; dx < 5.8; dx += 2) post(dx, 4.3); // postes dentro de la plataforma (|dx| ≤ 5.925, |dy| ≤ 4.425)
  post(5.8, 4.3);
  for (let dy = -4.35; dy < 4.3; dy += 2) post(5.8, dy);
  out.push(box(-5, -4, 0, 0, 3.4, 2.5, "whitewash", { facade: { floors: 1, cols: 3 } }), box(-5, -4, 0, 0, 5.9, 0.2, "rust")); // casa baja y techo
  out.push(bar([-5, 5.2, 0.075], [-1, 5.2, 3.4], 0.6, 0.15, "safety"), bar([3, -0.8, 3.4], [0.2, -0.8, 6.1], 0.6, 0.15, "safety")); // escaleras
}
