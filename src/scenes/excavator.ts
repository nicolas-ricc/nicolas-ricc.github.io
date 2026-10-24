import { v3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";

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
