import type { Facade } from "../iso/facade";
import { v3, type Vec2, type Vec3 } from "../iso/geometry";
import { bounds, type Solid } from "../iso/solids";
import type { Rng } from "../map/seed";
import { ESTUARY_Y0, QUAY_X, islandWestX } from "../map/geo";
import { AVENUE, BRIDGE, CITY_EDGE, COLLAPSED, CRATERS, DISTRICT_BANK_Y, DISTRICT_ROW_Y, EAST_COLS, EAST_RING, FALLEN_BLOCK, FREIGHT_ROW, PROMENADE, ROWS, STREET, WEST_QUAY, blocks, estuaryEast, inCrater, type Rect } from "../scenes/city-grid";
import { BRIDGE_LANDING, CITY_BOUNDS, HOTEL_LOT, PLAZA_CENTER, PLAZA_MAYOR, inCrossingPlaza, inParcel, inPlazaMayor, inRect, onAxis } from "../scenes/city-plan";
import { builtParcels } from "./zoning";
import { jungle, type Rails } from "../scenes/flora";
import { CAR, awning, bench, bollard, car, chair, dockCrane, fountain, garland, kiosk, lamp, stoneArch, table } from "../kit/props";
import { fixedLights, placeLit, type FixedLight } from "./lights";
import { PLINTH_H, plazaTone, prism, tiles } from "../scenes/city-pieces";

// ---------------------------------------------------------------- plaza

export function plazaMayor(solids: Solid[], ground: Solid[], lights: FixedLight[], rng: Rng): void {
  const P = PLAZA_MAYOR, L = BRIDGE_LANDING, x1 = P.x + P.w, y1 = P.y + P.d, ly1 = L.y + L.d;
  // the Plaza Mayor minus the bridge landing: one strip of tiles south of the landing (the 1 u strip north of it is all curb)
  ground.push(tiles(rng, { x: P.x, y: ly1, w: P.w, d: y1 - ly1 }, 0.05, "plaza", plazaTone));
  ground.push(tiles(rng, L, 0.05, "paving", plazaTone)); // the landing of the bridge: paving, no curb
  // curb: a band of `paving` 1.2 wide on the four sides, wide so the outline reads at world zoom; north it is 1 u (the landing starts at y 207),
  // east only south of the landing (the bridge lands at y 207..217), west from the landing's south edge to the south end (the Diagonal Norte comes in at the landing)
  const curb = 1.2;
  solids.push(prism(P.x, P.y, 0, P.w, L.y - P.y, PLINTH_H, "paving"), prism(P.x, y1 - curb, 0, P.w, curb, PLINTH_H, "paving"));
  solids.push(prism(x1 - curb, ly1, 0, curb, y1 - ly1, PLINTH_H, "paving"), prism(P.x, ly1, 0, curb, y1 - ly1, PLINTH_H, "paving"));
  // benches 4 in from the curb at the four corners; the north pair sits just south of the landing
  for (const [x, y] of [[P.x + 4, 222], [x1 - 6, 222], [P.x + 4, y1 - 4.6], [x1 - 6, y1 - 4.6]] as const) solids.push(...bench(v3(x, y, 0.05)));
  placeLit(solids, lights, fountain(v3(PLAZA_CENTER.x, PLAZA_CENTER.y, 0.05)));
  // kiosks at the north corners: just south of the landing (y 217.4), the east one inside the curb
  for (const x of [P.x + 3.5, x1 - 4.2]) solids.push(...kiosk(v3(x, ly1 + 0.4, 0.05)));
  placeLit(solids, lights, lamp(v3(P.x + 2, 248.5, 0.05)));
  placeLit(solids, lights, lamp(v3(P.x + P.w - 2.6, 248.5, 0.05)));
}

// ---------------------------------------------------------------- bridge, west quay and promenade

/** Piers of the avenue bridge: three in the water every 21 from `BRIDGE.x0` and one under the east abutment. */
const BRIDGE_PIERS = [213, 234, 255, 274] as const;
const OBELISK = 1.2, POST_STEP = 3; // side of the obelisk and maximum step between balustrade posts
const ARCH_KEY = 0.4; // slab left at the keystone of the arch, as on the footbridge

/** Pier with a cutwater centered at `cx`: hexagon 2 wide in x that extends 1 north and south of the deck, pointed. */
function cutwater(cx: number, y0: number, y1: number, z: number): Solid {
  const footprint: Vec2[] = [{ x: cx, y: y0 - 1 }, { x: cx + 1, y: y0 }, { x: cx + 1, y: y1 }, { x: cx, y: y1 + 1 }, { x: cx - 1, y: y1 }, { x: cx - 1, y: y0 }];
  return { kind: "poly", footprint, z: -1, h: z + 1, mat: "stone" };
}

export function bridge(solids: Solid[], lights: FixedLight[]): void {
  const { x0, x1, y0, y1, z, deckH } = BRIDGE;
  const top = z + deckH, d = y1 - y0;
  solids.push(prism(x0, y0, z, x1 - x0, d, deckH, "asphalt"));
  solids.push({ kind: "ramp", at: v3(x0 - STREET, y0, 0), w: STREET, d, h: top, mat: "asphalt", dir: "w" });
  solids.push({ kind: "ramp", at: v3(x1, y0, 0), w: STREET, d, h: top, mat: "asphalt", dir: "e" });
  for (const cx of BRIDGE_PIERS) solids.push(cutwater(cx, y0, y1, z));
  // three arches between piers: they start at z − r (never below z −1) and rise toward the keystone, like the footbridge.
  // The issue's literal formula (z − r·s) hung the longest slabs at the center: an inverted arch.
  for (let i = 0; i < BRIDGE_PIERS.length - 1; i++) {
    const a = BRIDGE_PIERS[i]! + 1, span = BRIDGE_PIERS[i + 1]! - 1 - a, r = Math.min(span / 2, z + 1);
    solids.push(...stoneArch(a, y0, span, d, z, (s) => z - r + (r - ARCH_KEY) * s));
  }
  solids.push(prism(WEST_QUAY.x0, y0, 0.6, WEST_QUAY.x1 - WEST_QUAY.x0, d, z - 0.6, "plaza")); // abutment (0.6, the top of the quay): the deck rests, it doesn't float
  const run = x1 - x0 - 2 * OBELISK, posts = Math.ceil((run - 0.3) / POST_STEP), step = (run - 0.3) / posts;
  for (const ry of [y0, y1 - 0.3]) {
    for (let i = 0; i <= posts; i++) solids.push(prism(x0 + OBELISK + i * step, ry, top, 0.3, 0.3, 0.9, "stone"));
    solids.push(prism(x0 + OBELISK, ry + 0.05, top + 0.9, run, 0.2, 0.2, "stone"));
  }
  for (const ox of [x0, x1 - OBELISK]) for (const oy of [y0, y1 - OBELISK]) {
    const cx = ox + OBELISK / 2, cy = oy + OBELISK / 2;
    const i = solids.length; // the prism and its cone are the point's own solids
    solids.push(prism(ox, oy, top, OBELISK, OBELISK, 4, "stone"), { kind: "cone", at: v3(cx, cy, top + 4), r: 0.6, h: 1, mat: "stone", sides: 4 });
    lights.push(...fixedLights([{ kind: "dot", at: v3(cx, cy, top + 5.3), r: 0.6, color: "amber" }], [i, i + 2]));
  }
  solids.push(...car(v3(x0 + 40, y0 + 1.5, top), "steel"), ...car(v3(x0 + 58, y1 - 3, top), "rust")); // stopped cars
}

export function westQuay(solids: Solid[], lights: FixedLight[]): void {
  const { x0, x1 } = WEST_QUAY, w = x1 - x0;
  solids.push(prism(x0, ESTUARY_Y0, -1, w, 194 - ESTUARY_Y0, 1.6, "plaza"), prism(x0, 200, -1, w, CITY_EDGE.south - 200, 1.6, "plaza"));
  solids.push({ kind: "ramp", at: v3(x0, 194, -1), w, d: 6, h: 1.6, mat: "plaza", dir: "e" }); // stairs to the water
  // sheds right at the water's edge (x 193..198): this way the bollards at x 192.5 fit in the free strip next to them
  for (const y of [164, 178]) solids.push({ kind: "vault", at: v3(193, y, 0.6), len: 12, w: 5, h: 2.5, axis: "y", mat: "rust", segments: 6 });
  for (let y = 160; y <= 202; y += 6) if (y !== 196) solids.push(...bollard(v3(192.5, y, 0.6))); // 196 is the stairs (194..200)
  solids.push(...dockCrane(v3(195, 202, 0.6), "e"));
  // terraces on the quay street (x 185..188.5), facing the bars parcel of column 163 (y 174..195)
  // the awning goes against the parcel wall (x 182.5), at the height of the shop-window awnings; if the
  // parcel's recipe already put one at that height, the table shares its own
  const shopAwnings = solids.filter((s) => s.mat === "awning").map(bounds);
  for (const y of [177, 183, 189]) {
    solids.push(...table(v3(186, y, 0)), ...chair(v3(185, y + 0.25, 0)), ...chair(v3(187.5, y + 0.25, 0)));
    const own = awning(v3(182.5, y - 1, 2.3), 3, "e"), b = bounds(own[0]!);
    if (!shopAwnings.some((o) => o.min.x < b.max.x && o.max.x > b.min.x && o.min.y < b.max.y && o.max.y > b.min.y && o.min.z < b.max.z && o.max.z > b.min.z)) solids.push(...own);
  }
  for (let y = 164; y <= 200; y += 6) solids.push(prism(191, y, 0, 0.3, 0.3, 3, "steel")); // garland posts
  lights.push(...fixedLights(garland([v3(191.15, 164.15, 3), v3(191.15, 200.15, 3)])));
}

export function promenade(solids: Solid[], lights: FixedLight[]): Vec3[] {
  const { x0, x1, y0, y1, z } = PROMENADE, w = x1 - x0, stairsY = 227;
  const arcade = (d: number): Facade => ({ floors: 1, cols: Math.round(d / 6), base: "arcade", bands: false }); // arcade on the two long walls
  const dN = stairsY - y0, dS = y1 - stairsY - 6;
  solids.push(prism(x0, y0, -1, w, dN, z + 1, "paving", { facade: arcade(dN) }), prism(x0, stairsY + 6, -1, w, dS, z + 1, "paving", { facade: arcade(dS) }));
  solids.push({ kind: "ramp", at: v3(x1 - 6, stairsY, -1), w: 6, d: 6, h: z + 1, mat: "paving", dir: "e" }); // stairs, toward the inside of the zone
  solids.push(prism(x0, stairsY, -1, w - 6, 6, z + 1, "paving"));
  solids.push(prism(x1 - 1.5, y0, z, 1.5, stairsY - y0, 0.8, "paving"), prism(x1 - 1.5, stairsY + 6, z, 1.5, y1 - stairsY - 6, 0.8, "paving")); // parapet
  // pergola at x0..x0+4 (not x0+2..x0+6): the stairs descend toward the east from x1 − 6, a post there would be left floating
  for (const x of [x0, x0 + 3.6]) for (const y of [221, 232.6]) solids.push(prism(x, y, z, 0.4, 0.4, 3, "deck"));
  for (const x of [x0 + 0.05, x0 + 3.65]) solids.push(prism(x, 221, z + 3, 0.3, 12, 0.3, "deck")); // beams over the west and east posts
  lights.push(...fixedLights(garland([v3(x0 + 3.8, 221, z + 3), v3(x0 + 3.8, 233, z + 3)])));
  solids.push(...kiosk(v3(x0 + 2, 240, z)));
  for (const y of [170, 200, 245, 258]) solids.push(...bench(v3(x0 + 2, y, z))); // benches
  // street lamps every 12 u; the district's new stretch (266..326) shares none with the old one
  const bulbs = [180, 210, 250, 272, 284, 296, 308, 320].map((y) => { const l = lamp(v3(x1 - 3, y, z)); placeLit(solids, lights, l); return l.bulb; });
  for (const y of [stairsY - 1.5, stairsY + 6.5]) solids.push(...bollard(v3(x1 - 3, y, z)));
  return bulbs.map((b) => v3(b.x, b.y, b.z + 0.4));
}

// ---------------------------------------------------------------- collapse, craters, jungle, cars

export function collapsed(solids: Solid[], rng: Rng): void {
  const c = COLLAPSED;
  // the low lip (west) has to reach the water: estuaryEast is around 274.6 on this row, not 280
  solids.push({ kind: "ramp", at: v3(c.x - 6, c.y, -1.2), w: 12, d: c.d, h: 1.5, mat: "asphalt", dir: "w" }); // the west half sinks into the estuary
  solids.push(prism(c.x + 6, c.y, 0, 18, c.d, PLINTH_H, "paving")); // flush with the ramp's high lip (286), no step
  solids.push(prism(c.x + 14, c.y + 4, PLINTH_H, 8, 10, rng.int(2, 3), "officeDark")); // ruin with no facade, inside the platform
  // the large slab of the fallen building, plus two pieces of rubble; all three entirely in water (x + w < estuaryEast) and west of the ramp's lip
  for (const [x, y, z, w, d] of [[c.x - 14, c.y + 8, -0.9, 8, 6], [c.x - 12, c.y + 1, -0.5, 4, 3], [c.x - 16, c.y + 16, -0.7, 3, 4]] as const) solids.push(prism(x, y, z, w, d, 1.2, "officeDark"));
  solids.push(prism(FALLEN_BLOCK.x, FALLEN_BLOCK.y, 0, FALLEN_BLOCK.w, FALLEN_BLOCK.d, 1, "officeDark")); // the fourth, fallen in the street facing the promenade (the water facing the promenade is the Blog zone)
  // fallen dome fragment: cap sunk in the water, south of the large slab (the issue's (x − 9, y + 12) falls inside it)
  solids.push({ kind: "dome", at: v3(c.x - 9.5, c.y + 17.5, -0.9), r: 3, h: 1.3, mat: "officeDark", sides: 8, rings: 2, tone: -1 });
}

/**
 * Like `jungle`, but discards the cones that would fall in open water of the
 * estuary, whose shore is `islandWestX` (it consumes the rng in the same order,
 * so it doesn't misalign the seed).
 */
export function jungleOnLand(out: Solid[], rng: Rng, rect: { x0: number; x1: number; y0: number; y1: number }, n: number, z = 0.4, rails?: Rails): void {
  const tmp: Solid[] = [];
  jungle(tmp, rng, rect, n, z, rails);
  for (const s of tmp) {
    if (s.kind === "cone" && s.at.x > QUAY_X - s.r && s.at.x <= islandWestX(s.at.y) + s.r) continue;
    out.push(s);
  }
}

export function greenery(solids: Solid[], rng: Rng): void {
  for (let y = ROWS[1]; y < COLLAPSED.y; y += 8) {                                                        // east bank of the estuary, old city
    const x0 = Math.ceil(islandWestX(y + 6)) + 2, x1 = EAST_RING.x0 - 3;
    if (x1 - x0 >= 2) jungleOnLand(solids, rng, { x0, x1, y0: y, y1: y + 6 }, rng.int(1, 2));
  }
  // east bank of the district: jungle between the estuary and the promenade, south of the old avenue
  jungleOnLand(solids, rng, { x0: Math.ceil(islandWestX(DISTRICT_ROW_Y)) + 2, x1: PROMENADE.x0 - 3, y0: DISTRICT_BANK_Y, y1: PROMENADE.y1 - 2 }, 10);
  for (const c of CRATERS) { // inscribed square (0.7·r): every cone stays inside the circle
    const k = Math.floor(c.r * 0.7);
    jungle(solids, rng, { x0: c.x - k, x1: c.x + k, y0: c.y - k, y1: c.y + k }, rng.int(4, 6), 0.2);
  }
}

/** Whether rectangles `w0×d0` and `w1×d1` with corners at (x0,y0)/(x1,y1) touch, enlarging the first by `gap` units. */
const rectsOverlap = (x0: number, y0: number, w0: number, d0: number, x1: number, y1: number, w1: number, d1: number, gap = 0): boolean =>
  x0 - gap < x1 + w1 && x0 + w0 + gap > x1 && y0 - gap < y1 + d1 && y0 + d0 + gap > y1;

export function cars(solids: Solid[], rng: Rng): void {
  const placed: { x: number; y: number }[] = [];
  const lots: (Rect & { grid: boolean })[] = [
    ...blocks().filter((b) => b.kind !== "freight").map((b) => ({ x: b.x, y: b.y, w: b.w, d: b.d, grid: true })),
    ...builtParcels().map((pc) => ({ ...pc.rect, grid: false })),
  ];
  for (const b of lots) {
    const n = rng.int(1, 3);
    for (let i = 0; i < n; i++) {
      const x = b.x + rng.int(2, Math.max(2, Math.floor(b.w) - 5));
      const y = rng.chance(0.5) ? b.y + b.d + 0.4 : b.y - 1.9; // south or north sidewalk of the lot
      if (b.grid) { // the grid blocks of the strip and the east bank; the parcels have no such rules
        if (b.x === EAST_COLS[0] && b.y === FREIGHT_ROW.y && y < b.y) continue; // its north sidewalk is the south wall of the dock inlet (#326)
        if (b.y === ROWS[0] && y < b.y) continue;              // row 92 has the seam fence to the north, not a street
        if (y >= AVENUE.y0 - 2 && y <= AVENUE.y1) continue;    // the avenue has no cars at the curb
      }
      if (y < CITY_EDGE.north || y + 1.5 > CITY_EDGE.south) continue;
      if (inCrater(x + 1.5, y + 0.75) || CRATERS.some((c) => Math.hypot(x + 1.5 - c.x, y + 0.75 - c.y) <= c.r + 2)) continue;
      if (x > QUAY_X && x <= estuaryEast(y) + 1) continue;    // over the estuary there is no sidewalk where to leave a car
      if (rectsOverlap(x, y, CAR.w, CAR.d, FALLEN_BLOCK.x, FALLEN_BLOCK.y, FALLEN_BLOCK.w, FALLEN_BLOCK.d)) continue;
      // west of the quay (the strip included: its cars fall clear of the axes and parcels) the layout decides; the corners count (a wedge's `poly` reaches past its `rect`)
      if (x < CITY_BOUNDS.x1 + 8 && y < CITY_BOUNDS.y1 + 8) {
        const corners = [[x, y], [x + CAR.w, y], [x + CAR.w, y + CAR.d], [x, y + CAR.d]] as const;
        if (corners.some(([cx, cy]) => onAxis(cx, cy) || inPlazaMayor(cx, cy) || inCrossingPlaza(cx, cy) || inRect(HOTEL_LOT, cx, cy) || inParcel(cx, cy))) continue;
      }
      if (placed.some((p) => rectsOverlap(x, y, CAR.w, CAR.d, p.x, p.y, CAR.w, CAR.d, 1))) continue; // no car overlaps another, with 1 u of margin
      placed.push({ x, y });
      solids.push(...car(v3(x, y, 0), rng.chance(0.6) ? "steel" : "rust"));
    }
  }
}
