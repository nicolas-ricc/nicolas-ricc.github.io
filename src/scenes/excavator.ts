import { v3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";

/** Excavadora de rueda de cangilones SRs 1300 (TAKRAF) en la playa de vías: chasis en `at`, proa al NE (`heading`); el eje de la rueda queda a `axleDx` del chasis, a z `axleZ`. */
export const EXCAVATOR = {
  at: { x: -30, y: 76 }, heading: -Math.PI / 4, axleDx: 22.6, axleZ: 9.2,
  wheel: { r: 5.5, width: 0.5, sides: 28, slots: 28, buckets: { n: 14, depth: 1.2, teeth: 2 } },
  pile: { r: 6.5, h: 4.5 },
} as const;

/** Eje = `local(22.6, 0)` redondeado a la grilla: C + 16·(1, −1) = (−14, 60) (22.6 ≈ 16·√2 = 22.63). */
const axle = () => v3(EXCAVATOR.at.x + 16, EXCAVATOR.at.y - 16, EXCAVATOR.axleZ);

/** La rueda de cangilones, hueca con llanta doble, en el ángulo dado. */
export function excavatorWheel(angle: number): Solid {
  const { r, width, sides, slots, buckets } = EXCAVATOR.wheel;
  return { kind: "wheel", at: axle(), r, width, mat: "rust", sides, angle, hollow: true, slots, buckets: { ...buckets, mat: "rust" } };
}
