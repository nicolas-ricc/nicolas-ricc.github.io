import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import type { Bounds, Plate, Solid } from "../iso/solids";

/**
 * Mitre Line EMU train: real CSR Sifang model (2014–16), Trenes Argentinos livery (white body, cobalt blue band),
 * third-rail power, no pantograph. Spec scale §3: each car measures 11 × 3.4 × 4 (length × width × height of
 * body) on 1 u bogies; the floor sits at z 1 and the roof at 5.2 (with the air conditioning, 5.7). The train runs along x and
 * never turns, so there is no `heading`.
 *
 * `emu` returns `{ solids, lights }` in world coordinates, with the west end at `x0` on the `y` axis. Car k starts
 * at `x0 + COUPLER + k·(CAR_LEN + GAP)`. Each car carries body, roof, air conditioning, two bogies, frame, livery, three
 * doors per side and windows; the cab fronts, with windshield and coupler, go at both ends of the consist and the
 * gangway bellows between cars. `lights` brings:
 * saloon (`lit`) one `cyanBleed` per run of windows on the south wall; `amber` LED sign on both fronts; `cyan` headlights on the
 * `lead` front and `magenta` red lights on the other; with `lead: null`, neither headlights nor red lights.
 *
 * The alignment box (`trainBox`: x `x0..x0 + trainLen`, y ± 1.7, z `0..TRAIN_TOP`) is the contract with the animator and with the
 * station's occlusion rule: no solid leaves it (the lights may go 0.05 outside).
 *
 * Spec: docs/superpowers/specs/2026-10-27-estacion-terminal-design.md §5.4 (deviations in §12).
 */
export const CAR_LEN = 11, CAR_W = 3.4, CAR_H = 4, FLOOR_Z = 1, GAP = 0.6, COUPLER = 0.5;
export const trainLen = (cars: number) => cars * CAR_LEN + (cars - 1) * GAP + 2 * COUPLER;
export const TRAIN_TOP = 5.7; // roof 5.2 + air conditioning 0.5
export type Lead = "e" | "w" | null;
export interface EmuOpts { cars: 3 | 4; lead: Lead; lit: boolean }

const ROOF_Z = FLOOR_Z + CAR_H; // 5
const DOORS = [[0.07, 0.18], [0.445, 0.555], [0.82, 0.93]] as const;
const PANES = [[0.01, 0.07], [0.18, 0.445], [0.555, 0.82], [0.93, 0.99]] as const;

const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Solid["mat"], plates?: Plate[]): Solid =>
  ({ kind: "prism", at: { x, y, z }, w, d, h, mat, ...(plates && { plates }) });
const rect = (wall: number, u0: number, u1: number, z0: number, z1: number, mat: Plate["mat"]): Plate => ({ wall, shape: "rect", u0, u1, z0, z1, mat });
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** South wall of the body (painted in this order): frame, pinstripe, band, windows, doors and door windows. */
function southWall(): Plate[] {
  return [
    rect(2, 0, 1, FLOOR_Z, 1.25, "steel"), // frame
    rect(2, 0, 1, 1.4, 1.6, "livery"), // pinstripe
    rect(2, 0, 1, 3.9, 4.7, "livery"), // wide band
    ...PANES.map(([u0, u1]) => rect(2, u0, u1, 2.5, 3.8, "glass")), // window band, between doors and ends
    ...DOORS.map(([u0, u1]) => rect(2, u0, u1, 1.05, 3.9, "livery")),
    ...DOORS.map(([u0, u1]) => rect(2, r6(u0 + 0.02), r6(u1 - 0.02), 2.5, 3.4, "glass")), // window of each door
  ];
}

/** Cab front: blue stripe, blue upper half and windshield, on wall `wall` (1 east, 3 west). */
const cabFront = (wall: number): Plate[] => [rect(wall, 0, 1, 1.6, 2.6, "livery"), rect(wall, 0, 1, 4.3, 5, "livery"), rect(wall, 0.1, 0.9, 2.6, 4.3, "asphalt")];

/** Consist of `cars` cars with the west end at `x0` on the `y` axis; `lead` is the end with headlights (the other carries red lights); `lit`, the saloon lit. */
export function emu(x0: number, y: number, opts: EmuOpts): { solids: Solid[]; lights: Accent[] } {
  const { cars } = opts;
  const solids: Solid[] = [];
  const lights: Accent[] = [];
  const yNorth = y - CAR_W / 2, ySouth = y + CAR_W / 2 + 0.05;
  for (let k = 0; k < cars; k++) {
    const xk = x0 + COUPLER + k * (CAR_LEN + GAP), c = xk + CAR_LEN / 2;
    const plates = [...southWall(), ...(k === cars - 1 ? cabFront(1) : []), ...(k === 0 ? cabFront(3) : [])];
    solids.push(prism(xk, yNorth, FLOOR_Z, CAR_LEN, CAR_W, CAR_H, "whitewash", plates)); // body
    solids.push(prism(xk, yNorth, ROOF_Z, CAR_LEN, CAR_W, 0.2, "paving")); // roof
    solids.push(prism(c - 1.8, y - 1, ROOF_Z + 0.2, 3.6, 2, 0.5, "steel", [rect(2, 0.1, 0.45, 5.3, 5.6, "asphalt"), rect(2, 0.55, 0.9, 5.3, 5.6, "asphalt")])); // air conditioning and grilles
    for (const dx of [-3.2, 3.2]) solids.push(prism(c + dx - 1.2, y - 1.4, 0, 2.4, 2.8, FLOOR_Z, "steel")); // bogies
    if (opts.lit) for (const [u0, u1] of PANES) { // saloon: one glow per run of windows on the south wall
      const xa = xk + CAR_LEN - u1 * CAR_LEN, xb = xk + CAR_LEN - u0 * CAR_LEN;
      lights.push({ kind: "poly", pts: [v3(xa, ySouth, 2.5), v3(xb, ySouth, 2.5), v3(xb, ySouth, 3.8), v3(xa, ySouth, 3.8)], color: "cyanBleed", alpha: 0.7 });
    }
    if (k < cars - 1) solids.push(prism(xk + CAR_LEN, y - 1.5, 1.2, GAP, 3, 3.6, "asphalt")); // gangway bellows toward the next car
  }
  solids.push(prism(x0, y - 0.3, 1.3, COUPLER, 0.6, 0.4, "safety")); // west coupler
  solids.push(prism(x0 + trainLen(cars) - COUPLER, y - 0.3, 1.3, COUPLER, 0.6, 0.4, "safety")); // east coupler
  const xW = x0 + COUPLER - 0.05, xE = x0 + trainLen(cars) - COUPLER + 0.05; // cab fronts, lights 0.05 outside
  const ya = yNorth + 0.35 * CAR_W, yb = yNorth + 0.65 * CAR_W;
  for (const x of [xW, xE]) { // amber LED sign on both fronts, even with no `lead`
    lights.push({ kind: "poly", pts: [v3(x, ya, 4.4), v3(x, yb, 4.4), v3(x, yb, 4.75), v3(x, ya, 4.75)], color: "amber", alpha: 0.9 });
  }
  if (opts.lead) {
    const head = opts.lead === "e" ? xE : xW, tail = opts.lead === "e" ? xW : xE;
    for (const dy of [-1.3, 1.3]) {
      lights.push({ kind: "dot", at: v3(head, y + dy, 1.8), r: 0.3, color: "cyan" }); // headlights
      lights.push({ kind: "dot", at: v3(tail, y + dy, 1.8), r: 0.25, color: "magenta" }); // red lights
    }
  }
  return { solids, lights };
}

/** Alignment box of the consist: contract with the animator and with the occlusion rules. */
export function trainBox(x0: number, y: number, cars: 3 | 4): Bounds {
  return { min: { x: x0, y: y - CAR_W / 2, z: 0 }, max: { x: x0 + trainLen(cars), y: y + CAR_W / 2, z: TRAIN_TOP } };
}
