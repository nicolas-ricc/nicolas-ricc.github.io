import type { Scene } from "./shipyard";

/** What a tick moved: only the trolley (#403: no lamp and no sparks since the cyan lamp and the welding sparks were dots). */
export interface AnimChanges { trolley: boolean }
export interface ShipyardAnim {
  tick(dtMs: number): AnimChanges;
}

export const TROLLEY_CYCLE_MS = 14000;
export const TROLLEY_PAUSE_MS = 2000;
const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Position 0..1 of the trolley within the cycle: pause, outbound, pause, return. */
function trolleyPhase(ms: number): number {
  const move = (TROLLEY_CYCLE_MS - 2 * TROLLEY_PAUSE_MS) / 2;
  const t = ms % TROLLEY_CYCLE_MS;
  if (t < TROLLEY_PAUSE_MS) return 0;
  if (t < TROLLEY_PAUSE_MS + move) return easeInOut((t - TROLLEY_PAUSE_MS) / move);
  if (t < 2 * TROLLEY_PAUSE_MS + move) return 1;
  return 1 - easeInOut((t - 2 * TROLLEY_PAUSE_MS - move) / move);
}

/** Shipyard animation: the gantry trolley runs along its beam (pause, outbound, pause, return). Frozen with reduced motion; a non-finite or non-positive dt changes nothing. */
export function createShipyardAnim(scene: Scene, opts: { reducedMotion: boolean }): ShipyardAnim {
  const [y0, y1] = scene.trolleyRange;
  let clock = 0;

  return {
    tick(dtMs) {
      if (opts.reducedMotion || !Number.isFinite(dtMs) || dtMs <= 0) return { trolley: false };
      clock += dtMs;
      const y = y0 + (y1 - y0) * trolleyPhase(clock);
      if (y === scene.trolley.at.y) return { trolley: false };
      scene.trolley.at.y = y;
      return { trolley: true };
    },
  };
}
