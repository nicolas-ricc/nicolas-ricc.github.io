import type { Accent } from "../iso/accent";
import { v3, type Vec3 } from "../iso/geometry";
import { createRng, type Rng } from "../map/seed";
import type { Scene } from "./shipyard";

export interface AnimChanges { trolley: boolean; sparks: boolean }
export interface ShipyardAnim {
  tick(dtMs: number): AnimChanges;
  sparks(): Accent[];
  trolleyLamp(): Accent;
  /** Eventos de soldadura arrancados (cada uno con sus tres cuadros). */
  fired(): { sparks: number };
}

export const TROLLEY_CYCLE_MS = 14000;
export const TROLLEY_PAUSE_MS = 2000;
const SPARK_FRAME_MS = 100;
const SPARK_FRAMES = 3;
export const SPARK_GAP_MS: [number, number] = [1000, 3000];
const SEED_MAX = 2 ** 32 - 1; // semilla de un Rng derivado (sin literal 0x…: el guard de paleta lo tomaría por color)

const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Posición 0..1 del carro dentro del ciclo: pausa, ida, pausa, vuelta. */
function trolleyPhase(ms: number): number {
  const move = (TROLLEY_CYCLE_MS - 2 * TROLLEY_PAUSE_MS) / 2;
  const t = ms % TROLLEY_CYCLE_MS;
  if (t < TROLLEY_PAUSE_MS) return 0;
  if (t < TROLLEY_PAUSE_MS + move) return easeInOut((t - TROLLEY_PAUSE_MS) / move);
  if (t < 2 * TROLLEY_PAUSE_MS + move) return 1;
  return 1 - easeInOut((t - 2 * TROLLEY_PAUSE_MS - move) / move);
}

export function createShipyardAnim(scene: Scene, rng: Rng, opts: { reducedMotion: boolean }): ShipyardAnim {
  const [y0, y1] = scene.trolleyRange;

  const sparkRng = createRng(rng.int(0, SEED_MAX)); // flujo propio de las chispas
  const nextGap = () => sparkRng.int(SPARK_GAP_MS[0], SPARK_GAP_MS[1]);

  let clock = 0;
  let sparkTimer = nextGap();
  let sparkFrame = -1;
  let spot: Vec3 | null = null;
  let live: Accent[] = [];
  let sparksFired = 0;

  const trolleyLamp = (): Accent => ({ kind: "dot", at: v3(scene.trolley.at.x + 2.5, scene.trolley.at.y + 2, scene.trolley.at.z - 1), r: 1.4, color: "cyanMid" });

  // Reutiliza `spot` (fijado al arrancar el evento) para las 3 frames del flicker:
  // solo el jitter alrededor se re-randomiza, la cuaderna elegida es la misma.
  const burst = (): void => {
    const s = spot!;
    live = [];
    const n = sparkRng.int(4, 6);
    for (let i = 0; i < n; i++) {
      live.push({ kind: "dot", at: v3(s.x + (sparkRng.next() * 2 - 1) * 1.5, s.y + (sparkRng.next() * 2 - 1) * 1.5, s.z + sparkRng.next() * 1.5), r: 0.6, color: sparkRng.chance(0.6) ? "cyan" : "cyanMid" });
    }
  };

  return {
    trolleyLamp,
    sparks: () => live,
    fired: () => ({ sparks: sparksFired }),
    tick(dtMs) {
      if (opts.reducedMotion || !Number.isFinite(dtMs) || dtMs <= 0) return { trolley: false, sparks: false };
      clock += dtMs;
      const changes: AnimChanges = { trolley: false, sparks: false };

      const y = y0 + (y1 - y0) * trolleyPhase(clock);
      if (y !== scene.trolley.at.y) { scene.trolley.at.y = y; changes.trolley = true; }

      // El exceso se arrastra: cada vuelta es un paso de idle → cuadro 0 → 1 → 2 → idle.
      const before = live;
      sparkTimer -= dtMs;
      while (sparkTimer <= 0) {
        if (sparkFrame < 0) { sparkFrame = 0; sparksFired++; spot = sparkRng.pick(scene.weldSpots); sparkTimer += SPARK_FRAME_MS; burst(); }
        else if (sparkFrame + 1 >= SPARK_FRAMES) { sparkFrame = -1; spot = null; live = []; sparkTimer += nextGap(); }
        else { sparkFrame++; sparkTimer += SPARK_FRAME_MS; burst(); }
      }
      changes.sparks = live !== before && (before.length > 0 || live.length > 0); // un evento entero dentro del tick no se ve
      return changes;
    },
  };
}
