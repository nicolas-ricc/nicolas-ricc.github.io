import type { Accent } from "../iso/accent";
import { v3, type Vec2 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import { lamp, place } from "../kit/props";
import { CONTAINER, stackContainers } from "../kit/forms/industrial";
import { STATION_LAND, WORLD } from "../map/geo";
import type { Rng } from "../map/seed";
import { CITY_EDGE, RAIL_LANDS } from "../scenes/city-grid";
import { RAIL_Y } from "../scenes/shipyard";
import { GAUGE, RAIL_W, RAIL_Z } from "../scenes/station";
import { prism } from "../scenes/city-pieces";

/** The west main line across Resume's new strip: from the west edge of the content to the station land. */
export const MAIN_LINE = { x0: WORLD.x0, x1: STATION_LAND.x0 } as const;

const BALLAST_Y = (RAIL_Y[0] + RAIL_Y[1]) / 2;

/** The four N-S streets of the strip that cross the main line at level. */
export const CROSSINGS: readonly { x0: number; x1: number }[] = [{ x0: -24, x1: -18 }, { x0: 6, x1: 12 }, { x0: 36, x1: 42 }, { x0: 66, x1: 72 }];

/** Stretch of street (y) taken by the fences, planks and posts of a crossing. */
export const CROSSING_GAP = { y0: 128, y1: 137 } as const;

/** Stretch (x) where the south fence opens for the rails of the siding's switch (see `freightYard`). */
export const SWITCH_GAP = { x0: 72, x1: 81 } as const;

const FENCE = { x0: CITY_EDGE.west, x1: MAIN_LINE.x1, north: RAIL_LANDS.y0 + 0.5, south: 136 } as const; // the south one keeps the train rule: 136 − 1.4·1 ≥ 134.5
const underCrossing = (x: number, w: number): boolean => CROSSINGS.some((c) => x + w > c.x0 && x < c.x1);

/**
 * Main line of the train through the asphalt of Resume (y 129..137): two rails over a ballast bed,
 * rust sleepers every 4 u in step with the shipyard's (none under a crossing: the planks are its
 * floor), steel fences on both sides with a gap at each level crossing, deck planks at the
 * crossings and a steel post on each side of them. Sleepers and planks are at most 0.3 high, so the train passes over them; the fences keep
 * the train rule (south ones far enough from the track). The siding comes with the district.
 * Rails and ballast go to `ground`; the rest to `solids`.
 */
export function railLands(ground: Solid[], solids: Solid[]): void {
  const span = (y: number): Vec2[] => [{ x: MAIN_LINE.x0, y }, { x: MAIN_LINE.x1, y }];
  ground.push({ kind: "strip", path: span(BALLAST_Y), width: 5, z: 0.03, mat: "rail" });
  for (const y of RAIL_Y) ground.push({ kind: "strip", path: span(y), width: 0.5, z: 0.05, mat: "rail" });
  for (let x = MAIN_LINE.x0 + 2; x < MAIN_LINE.x1; x += 4) if (!underCrossing(x, 1)) solids.push({ kind: "prism", at: v3(x, RAIL_Y[0] - 1, 0), w: 1, d: 5, h: 0.3, mat: "rust" });
  const fence = (y: number, gaps: readonly { x0: number; x1: number }[]): void => {
    let x: number = FENCE.x0;
    for (const c of [...gaps, { x0: FENCE.x1, x1: FENCE.x1 }]) {
      if (c.x0 > x) solids.push({ kind: "prism", at: v3(x, y, 0), w: c.x0 - x, d: 0.3, h: 1, mat: "steel" });
      x = c.x1;
    }
  };
  fence(FENCE.north, CROSSINGS);
  fence(FENCE.south, [...CROSSINGS, SWITCH_GAP]);
  for (const c of CROSSINGS) {
    const w = c.x1 - c.x0;
    for (const [y, d] of [[129.6, 1.1], [131.3, 2.4], [134.3, 1.1]] as const) solids.push({ kind: "prism", at: v3(c.x0, y, 0), w, d, h: 0.3, mat: "deck" });
    solids.push({ kind: "prism", at: v3(c.x0 - 0.6, 128.6, 0), w: 0.3, d: 0.3, h: 3, mat: "steel" });
    solids.push({ kind: "prism", at: v3(c.x1 + 0.3, 137.8, 0), w: 0.3, d: 0.3, h: 2, mat: "steel" });
  }
}

/** Axis of the siding, south of the main line. */
export const SIDING_Y = 141;
/** Switch from the main line (axis y 132.5) to the siding: the diagonal rails run between these two points, as `ladder()` in the station. */
export const SWITCH = [{ x: 82, y: 132.5 }, { x: 70, y: 141 }] as const;

const SIDING_X0 = -50, SIDING_X1 = 70;
const LAMPS_X = [-40, 0, 40, 80] as const, LAMP_Y = 150;

/** `n` distinct items of `items`, drawn by the rng. */
function draw<T>(rng: Rng, items: readonly T[], n: number): T[] {
  const left = [...items], out: T[] = [];
  for (let k = 0; k < n; k++) out.push(left.splice(rng.int(0, left.length - 1), 1)[0]!);
  return out;
}

/**
 * Freight yard south of the main line (x −54..94, y 136..157.5): a siding at y 141 (rails, rust
 * sleepers, buffer stop) fed by a switch that crosses the south fence through its gap, a parked
 * freight train (locomotive at the west end, five wagons), a concrete loading dock cut at the
 * level crossings with pallets, three trucks, 6..8 loose containers and four lamps.
 * Rails go to `ground`; the rest to `solids`/`accents`. Rng order: train, trucks, containers, pallets.
 */
export function freightYard(ground: Solid[], solids: Solid[], accents: Accent[], rng: Rng): void {
  const rail = (a: Vec2, b: Vec2): void => { ground.push({ kind: "strip", path: [a, b], width: RAIL_W, z: RAIL_Z, mat: "rail" }); };
  for (const dy of [-GAUGE / 2, GAUGE / 2]) rail({ x: SIDING_X0, y: SIDING_Y + dy }, { x: SIDING_X1, y: SIDING_Y + dy });
  const [a, b] = SWITCH, len = Math.hypot(b.x - a.x, b.y - a.y), nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
  for (const s of [-1, 1]) rail({ x: a.x + nx * s * GAUGE / 2, y: a.y + ny * s * GAUGE / 2 }, { x: b.x + nx * s * GAUGE / 2, y: b.y + ny * s * GAUGE / 2 });
  for (let k = 0; k < 30; k++) solids.push(prism(SIDING_X0 + 4 * k, SIDING_Y - 2.5, 0, 1, 5, 0.3, "rust"));
  solids.push(prism(SIDING_X0 - 1.5, SIDING_Y - 1.5, 0, 1.5, 3, 1.2, "steel"));

  const x0 = rng.int(-46, -20), ty = SIDING_Y - 1.2;
  solids.push(prism(x0, ty, 0, 9, 2.4, 3.4, "steel"));
  for (let k = 0; k < 5; k++) solids.push(prism(x0 + 10 + 9 * k, ty, 0, 8, 2.4, 3, k % 2 === 0 ? "rust" : "steel"));

  // dock: skips each crossing (its south post stands at c.x1 + 0.3)
  const spans: [number, number][] = [];
  let x = SIDING_X0;
  for (const c of CROSSINGS) {
    if (c.x0 > x) spans.push([x, c.x0]);
    x = c.x1 + 0.6;
  }
  for (const [u, v] of spans) solids.push(prism(u, 136.3, 0, v - u, 1.7, 1, "concrete"));

  for (const k of draw(rng, Array.from({ length: 10 }, (_, k) => k), 3)) {
    const tx = -40 + 10 * k;
    solids.push(prism(tx, 146, 0, 6, 2.4, 2.8, "boxGrey"), prism(tx + 6, 146, 0, 2, 2.4, 2.2, "steel"));
  }

  const slots = [...Array.from({ length: 20 }, (_, k) => ({ x: -50 + 7 * k, y: LAMP_Y })).filter((s) => !LAMPS_X.some((lx) => s.x < lx + 0.6 && s.x + CONTAINER.len > lx)),
    ...Array.from({ length: 20 }, (_, k) => ({ x: -50 + 7 * k, y: 153.5 }))];
  for (const s of draw(rng, slots, rng.int(6, 8))) solids.push(...stackContainers(v3(s.x, s.y, 0), 1, "x", rng));

  for (let px = -48; px + 1.2 <= 66; px += 6) {
    if (!spans.some(([u, v]) => px >= u && px + 1.2 <= v)) continue;
    if (rng.chance(0.5)) solids.push(prism(px, 137, 1, 1.2, 1, 0.5, "deck"));
  }

  for (const lx of LAMPS_X) place(solids, accents, lamp(v3(lx, LAMP_Y, 0)));
}
