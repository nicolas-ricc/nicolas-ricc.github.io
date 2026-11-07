/**
 * Move of the plant to its new spot (#246): `PLANT_SHIFT (−15, +90)`.
 * The plant's local frame is the world coordinates from before the move: maltings `x 20..44`,
 * hall `x 44..107`, tower `x 108..113`, `y −46..−1`.
 * Everything built in that frame is emitted moved with `translate`.
 * The water tower is NOT moved: it goes to a new spot, `WATER_TOWER` in `maltings.ts`.
 */
import type { Accent } from "../iso/accent";
import type { Solid } from "../iso/solids";
import { translate, translateAccent } from "../iso/translate";

export const PLANT_SHIFT = { x: -15, y: 90 } as const;

/** Builds with `build` in the plant's local frame and pushes solids (and accents, if `accents` is given) moved with `PLANT_SHIFT`. */
export function emitPlant(out: Solid[], build: (o: Solid[], a: Accent[]) => void, accents?: Accent[]): void {
  const o: Solid[] = [], a: Accent[] = [];
  build(o, a);
  if (a.length > 0 && !accents) throw new Error("emitPlant: accents without a destination");
  for (const s of o) out.push(translate(s, PLANT_SHIFT.x, PLANT_SHIFT.y));
  for (const c of a) accents?.push(translateAccent(c, PLANT_SHIFT.x, PLANT_SHIFT.y));
}
