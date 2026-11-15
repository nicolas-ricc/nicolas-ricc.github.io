import { COVER_LAPTOP, COVER_PHONE } from "../kit/legibility";
import type { Fit } from "../world/frame";

/**
 * Cover scales the storybook `c` key cycles through after the real one: 1.17 = `coverView` on a
 * 1366-wide laptop with browser chrome, aspect 2.12; 0.83 = phone 390×750; see
 * `2026-11-11-encuadre-por-aspecto-design.md` §1.
 */
export const COVER_SCALES = [COVER_LAPTOP, COVER_PHONE] as const;

/** Next step of the cycle real (null) → 1.17 → 0.83 → real. */
export function nextCoverScale(current: number | null): number | null {
  if (current === null) return COVER_SCALES[0];
  const i = (COVER_SCALES as readonly number[]).indexOf(current);
  return COVER_SCALES[i + 1] ?? null;
}

/** `fit` at another scale, keeping the world point at the host center where it was; an empty host (scale 0) only takes the scale. */
export function fixedScaleFit(fit: Fit, w: number, h: number, scale: number): Fit {
  if (!(fit.scale > 0)) return { ...fit, scale };
  const k = scale / fit.scale;
  return { x: w / 2 - (w / 2 - fit.x) * k, y: h / 2 - (h / 2 - fit.y) * k, scale };
}
