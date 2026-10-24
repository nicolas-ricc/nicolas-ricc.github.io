import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import type { Plate } from "../iso/plate";
import type { Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import { bounds } from "../iso/solids";
import type { Box } from "../world/frame";

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

/** z del eje de la pluma de la rueda en `dx` (baja de 17 en dx 4.5 a `axleZ` en el eje). */
const E = (dx: number) => 17 - (dx - 4.5) * (17 - EXCAVATOR.axleZ) / (EXCAVATOR.axleDx - 4.5);

/** Máquina entera: chasis y plataforma, mástil en A, superestructura, plumas, escudo y tolvas, cabina y reflectores (la rueda va aparte, animada). */
export function excavator(out: Solid[], accents: Accent[]): void {
  chassis(out);
  upperWorks(out, accents);
}

/** Chasis y nivel de plataforma: orugas con zapatas y rodillos, anillo de giro, plataforma con barandas, casa baja y escaleras. */
function chassis(out: Solid[]): void {
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

/** Mástil, superestructura, viga superior, pluma de la rueda con sus tirantes, escudo, pluma de descarga y cabina. */
function upperWorks(out: Solid[], accents: Accent[]): void {
  const { axleDx, axleZ } = EXCAVATOR, off: Material = "office", steel: Material = "steel";
  // mástil en A: línea (−2, ±2.5, 3.4)→(−1, 0, 20); cada brazo se corta donde cruza la casa (dy −2.5 arranca en su techo, z 6.1) y la superestructura (z 11..16)
  const mast = (sy: number, z: number): [number, number, number] => { const t = (z - 3.4) / 16.6; return [-2 + t, sy * 2.5 * (1 - t), z]; };
  const dip = 0.35 * Math.sin(Math.atan(Math.hypot(1, 2.5) / 16.6)); // la tapa inclinada del brazo (0.7) baja esto por debajo de su corte: se corre cada corte
  for (const [sy, z0] of [[1, 3.4], [-1, 6.1]] as const) for (const [a, b] of [[z0 + dip, 11 - dip], [16 + dip, 20]] as const) out.push(bar(mast(sy, a), mast(sy, b), 0.7, 0.7, off));
  for (const z of [7, 9.5, 18]) out.push(bar(mast(-1, z), mast(1, z), 0.3, 0.3, off)); // travesaños entre brazos
  // superestructura colgada del mástil, con cartel en la pared visible (3 de 9 u, centrado)
  out.push(box(-6, -3, 3, 3, 11, 5, off, { facade: { floors: 1, cols: 4, window: { w: 0.7, h: 0.4 }, grid: { cols: 2, rows: 1 } }, plates: [{ wall: 2, shape: "rect", u0: 0.5 - 1.5 / 9, u1: 0.5 + 1.5 / 9, z0: 14.6, z1: 15.6, mat: "whitewash" }] }));
  out.push(bar([-1, 0, 20], [-20, 0, 20], 0.6, 0.6, off), box(-22, -0.75, -20, 0.75, 18.5, 1.5, off)); // viga superior y cajón del contrapeso
  out.push(box(3, -1.85, 5, 1.85, 15, 1.75, off)); // pivote: une la superestructura con el arranque de los cordones
  // pluma de la rueda: cordones hasta el eje, diagonales en zigzag cada 3 u, cinta y rodillos en V
  for (const sy of [-1, 1]) out.push(bar([4.5, sy * 1.6, 17], [axleDx, sy * 1.6, axleZ], 0.5, 0.5, off));
  for (let k = 0, dx = 4.5; dx + 3 <= axleDx; k++, dx += 3) { const s = k % 2 ? -1 : 1; out.push(bar([dx, s * 1.6, E(dx)], [dx + 3, -s * 1.6, E(dx + 3)], 0.2, 0.2, off)); }
  out.push(bar([4.5, 0, 17 - 0.15], [19.5, 0, E(19.5) - 0.15], 2.6, 0.2, steel));
  out.push(bar([15, -1.3, E(15) + 0.35], [15, 0, E(15)], 0.2, 0.2, steel), bar([15, 0, E(15)], [15, 1.3, E(15) + 0.35], 0.2, 0.2, steel));
  out.push(bar([4.5, 1.6, 17.33], [15, 1.6, E(15) + 0.33], 0.6, 0.15, off), bar([4.5, 1.85, 18.33], [15, 1.85, E(15) + 1.33], 0.15, 0.15, "safety")); // pasarela y baranda
  out.push(bar([-1, 0, 20], [12, 0, E(12) + 0.4], 0.3, 0.3, off), bar([-1, 0, 20], [21, 0, E(21) + 0.4], 0.3, 0.3, off)); // tirantes
  for (const sy of [-1, 1]) out.push(bar([12, sy * 1.6, E(12) + 0.25], [12, sy * 1.6, 20], 0.4, 0.4, off)); // pórtico intermedio
  out.push(bar([12, -1.6, 20], [12, 1.6, 20], 0.4, 0.4, off));
  // escudo, tolva fija, cortina y tambor de cabeza: todo en dy ≤ −0.3, detrás del disco de la rueda
  out.push(box(axleDx, -0.8, axleDx + 6, -0.5, axleZ, 6, off), box(21.1, -1.3, 24.1, -0.3, 5, 2.5, "rust"), box(21.6, -0.5, 23.6, -0.3, 7.5, 2.5, steel));
  out.push(bar([20, -1.3, E(20)], [20, -0.3, E(20)], 1, 1, steel));
  // pluma de descarga hacia el oeste con tolva colgante
  const dz = (dx: number) => 5.88 + (dx + 5.2) * (5.88 - 4) / 18.8;
  for (const sy of [-1, 1]) out.push(bar([-5.2, sy * 1.2, 5.88], [-24, sy * 1.2, 4], 0.4, 0.4, off));
  for (let k = 0, dx = -5.2; dx - 3 >= -24; k++, dx -= 3) { const s = k % 2 ? -1 : 1; out.push(bar([dx, s * 1.2, dz(dx)], [dx - 3, -s * 1.2, dz(dx - 3)], 0.2, 0.2, off)); }
  out.push(box(-25, -1, -23, 1, 2, 2, "rust"));
  // cabina de 2 pisos con techo con alero y tres reflectores
  out.push(box(13, 1.9, 15.5, 3.5, 9.5, 2.2, steel, { facade: { floors: 2, cols: 3, window: { w: 0.7, h: 0.6 } } }), box(12.75, 1.25, 15.65, 3.75, 11.71, 0.2, steel));
  for (const dx of [13.5, 14.25, 15]) { const p = local(dx, 3.5); accents.push({ kind: "dot", at: v3(p.x, p.y, 12), r: 0.6, color: "amber" }); }
}

/** Caja en planta (x, y) de la máquina: unión de los `bounds` de sus sólidos y de la rueda a cualquier ángulo (eje ± (r + depth)·√½). */
export function excavatorBox(): Box {
  const out: Solid[] = []; excavator(out, []);
  const ax = local(EXCAVATOR.axleDx, 0), { r, buckets } = EXCAVATOR.wheel, R = (r + buckets.depth) * Math.SQRT1_2;
  const box: Box = { x0: ax.x - R, y0: ax.y - R, x1: ax.x + R, y1: ax.y + R };
  for (const s of out) { const b = bounds(s); box.x0 = Math.min(box.x0, b.min.x); box.y0 = Math.min(box.y0, b.min.y); box.x1 = Math.max(box.x1, b.max.x); box.y1 = Math.max(box.y1, b.max.y); }
  return box;
}
