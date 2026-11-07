import { v3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { Rng } from "../map/seed";

/** Planting area in world coordinates (not to be confused with `city-grid.Rect`, which is x/y/w/d). */
export interface Area { x0: number; x1: number; y0: number; y1: number }

/** E-W tracks the jungle cannot step on: a cone is discarded if its canopy touches the `y ± RAIL_CLEAR` strip. */
export interface Rails {
  y: readonly number[];
  /**
   * Footprint box of the train (x up to the front `x1`, y `y0..y1`, z 0..5.7).
   * A cone is discarded if no SAT axis separates it from the box on screen:
   * `p = y − 1.4z` against `y1 + 0.3`, `sx = x − y` against `x1 − y0` and
   * `q = x − 1.4z` against `x1` (with r and h of the canopy); one separating
   * axis is enough for it to stay. Only applies south of the tracks (greater
   * `y`): the animated layers are painted on top of the static ones, so what
   * lies to the north stays behind the train and does not cover it. Needs at
   * least one track in `y`: with no tracks everything counts as south.
   */
  train?: { y0: number; y1: number; x1: number };
}
const RAIL_CLEAR = 1.5;

/**
 * Jungle shared by all zones: `n` cones with r 2..4 and h 5..9, 60 % in
 * `leaf` and the rest in `leafDark`, with the base at `z`. The order of rng
 * calls (material, x, y, r, h) is the one shipyard.ts had: its output does
 * not change. With `rails`, the cones that would fall on those tracks are
 * discarded (the rng already consumed them: the remaining planting does not
 * move). With `rails.train`, so are those that would cover the train from the
 * south.
 */
export function jungle(out: Solid[], rng: Rng, area: Area, n: number, z = 0.4, rails?: Rails): void {
  for (let i = 0; i < n; i++) {
    const mat = rng.chance(0.6) ? "leaf" : "leafDark";
    const cone: Solid = { kind: "cone", at: v3(rng.int(area.x0, area.x1), rng.int(area.y0, area.y1), z), r: rng.int(2, 4), h: rng.int(5, 9), mat };
    if (rails && rails.y.some((ry) => Math.abs(cone.at.y - ry) < cone.r + RAIL_CLEAR)) continue;
    const t = rails?.train;
    if (rails && t && cone.at.y > Math.max(...rails.y)) {
      const { at, r, h } = cone;
      if (at.y - r - 1.4 * (at.z + h) < t.y1 + 0.3
        && at.x - r - (at.y + r) < t.x1 - t.y0
        && at.x - r - 1.4 * (at.z + h) < t.x1) continue;
    }
    out.push(cone);
  }
}
