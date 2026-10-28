/**
 * Traslado de la planta al lugar nuevo (#246): `PLANT_SHIFT (−15, +90)`.
 * El marco local de la planta son las coordenadas de mundo de antes del traslado: maltería `x 20..44`,
 * nave `x 44..107`, torre `x 108..113`, `y −46..−1`.
 * Todo lo que se arma en ese marco se emite trasladado con `translate`.
 * El tanque de agua NO se traslada: va a un lugar nuevo, `WATER_TOWER` en `maltings.ts`.
 */
import type { Accent } from "../iso/accent";
import type { Solid } from "../iso/solids";
import { translate, translateAccent } from "../iso/translate";

export const PLANT_SHIFT = { x: -15, y: 90 } as const;

/** Arma con `build` en el marco local de la planta y empuja sólidos (y acentos, si hay `accents`) trasladados con `PLANT_SHIFT`. */
export function emitPlant(out: Solid[], build: (o: Solid[], a: Accent[]) => void, accents?: Accent[]): void {
  const o: Solid[] = [], a: Accent[] = [];
  build(o, a);
  if (a.length > 0 && !accents) throw new Error("emitPlant: acentos sin destino");
  for (const s of o) out.push(translate(s, PLANT_SHIFT.x, PLANT_SHIFT.y));
  for (const c of a) accents!.push(translateAccent(c, PLANT_SHIFT.x, PLANT_SHIFT.y));
}
