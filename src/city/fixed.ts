import type { Accent } from "../iso/accent";
import { facadeAccents, windowPatches, type Facade } from "../iso/facade";
import { centroid, v3, type Vec2, type Vec3 } from "../iso/geometry";
import { bounds, visibleWalls, type Solid } from "../iso/solids";
import type { Rng } from "../map/seed";
import { ESTUARY_Y0, QUAY_X, islandWestX } from "../map/geo";
import { AVENUE, BLOCK_W, BRIDGE, CITY_EDGE, COLLAPSED, CRATERS, DISTRICT_BANK_Y, DISTRICT_ROWS, EAST_RING, FALLEN_BLOCK, LIT_FLOOR, PROMENADE, PLAZA, ROWS, SIDEWALK, STREET, TOWER, TOWER_FLOORS, TOWER_H, WEST_QUAY, blocks, estuaryEast, inCrater } from "../scenes/city-grid";
import { jungle, type Rails } from "../scenes/flora";
import { CAR, awning, bench, bollard, car, chair, dockCrane, fountain, garland, kiosk, lamp, place, puddle, stoneArch, table } from "../kit/props";
import { PLINTH_H, plazaTone, prism, tiles } from "../scenes/city-pieces";

// ---------------------------------------------------------------- plaza and tower

/** Windows of the lit floor, tip of the antenna and the paper window: city-anim animates them. */
export interface TowerLights { litWindows: Accent[]; antenna: Vec3; paperWindow: Vec3 }

/** Lit windows and paper window from the raw visible walls of the tower, so `tone` does not matter. */
export function towerWindows(tower: Solid, facade: Facade): { litWindows: Accent[]; paperWindow: Vec3 } {
  const walls = visibleWalls(tower);
  const litWindows = facadeAccents(walls, facade, "amber");
  const east = walls.find((f) => f.normal.x > 0.5)!;
  const paperWindow = centroid(windowPatches(east, facade, facade.litFloor!)[facade.cols - 1]!);
  return { litWindows, paperWindow };
}

export function plazaAndTower(solids: Solid[], ground: Solid[], accents: Accent[], rng: Rng): TowerLights {
  ground.push(tiles(rng, PLAZA, 0.05, "plaza", plazaTone));
  // curb: a band of `paving` 1.2 wide around the plaza, wide so the outline reads at world zoom
  const curb = 1.2;
  solids.push(prism(PLAZA.x, PLAZA.y, 0, PLAZA.w, curb, PLINTH_H, "paving"), prism(PLAZA.x, PLAZA.y + PLAZA.d - curb, 0, PLAZA.w, curb, PLINTH_H, "paving"));
  solids.push(prism(PLAZA.x, PLAZA.y, 0, curb, PLAZA.d, PLINTH_H, "paving"), prism(PLAZA.x + PLAZA.w - curb, PLAZA.y, 0, curb, PLAZA.d, PLINTH_H, "paving"));

  const facade: Facade = { floors: TOWER_FLOORS, cols: 4, litFloor: LIT_FLOOR, base: "portico" };
  const tower = prism(TOWER.x, TOWER.y, 0, TOWER.w, TOWER.d, TOWER_H, "officeDark", { facade });
  solids.push(tower);
  solids.push(prism(TOWER.x - 0.5, TOWER.y - 0.5, TOWER_H, TOWER.w + 1, TOWER.d + 1, 0.4, "office"));       // cornice
  solids.push(prism(TOWER.x + 5, TOWER.y + 5, TOWER_H + 0.4, 6, 4, 2.5, "officeDark"));                     // machine room
  const mast = v3(TOWER.x + 8, TOWER.y + 7, TOWER_H + 2.9);
  solids.push({ kind: "cylinder", at: mast, r: 0.3, h: 5, mat: "steel", sides: 4 });                        // antenna
  // climbing jungle: cones at the base and two thin prisms on the northwest and southeast edges
  for (const [dx, dy] of [[-1.5, -1.5], [TOWER.w + 1.5, -1.5], [TOWER.w + 1.5, TOWER.d + 1.5], [-1.5, TOWER.d + 1.5]] as const) solids.push({ kind: "cone", at: v3(TOWER.x + dx, TOWER.y + dy, 0.05), r: 2.5, h: 6, mat: "leaf" });
  solids.push(prism(TOWER.x - 0.6, TOWER.y - 0.6, 0, 0.6, 0.6, 12, "leaf"), prism(TOWER.x + TOWER.w, TOWER.y + TOWER.d, 0, 0.6, 0.6, 12, "leaf"));
  // lit-floor windows, only on the walls the camera sees (east and south)
  const { litWindows, paperWindow } = towerWindows(tower, facade);
  // light spill: flat puddles on the tiles, only in the east strip of
  // the plaza (between the tower's east wall and the curb), which is the part
  // the camera sees free of walls, roofs and trees.
  // deviation from the brief: the free strip of the plaza (without the east wall, the
  // corner cones and the roofs of the row opposite) is this diagonal,
  // not the very foot of the wall; the two puddles overlap and read as a
  // single spill stretched toward the east.
  for (const [x, y] of [[TOWER.x + TOWER.w + 6.5, TOWER.y + 2], [TOWER.x + TOWER.w + 9, TOWER.y + 4]] as const) accents.push(...puddle(x, y, "amberBleed"));
  for (const [x, y] of [[PLAZA.x + 4, PLAZA.y + 3], [PLAZA.x + PLAZA.w - 6, PLAZA.y + 3], [PLAZA.x + 4, PLAZA.y + PLAZA.d - 4.2], [PLAZA.x + PLAZA.w - 6, PLAZA.y + PLAZA.d - 4.2]] as const) solids.push(...bench(v3(x, y, 0.05)));
  place(solids, accents, fountain(v3(150, 227, 0.05)));
  // kiosks at the north corners, just inside the curb, so they don't overlap the benches
  for (const x of [PLAZA.x + 1.4, PLAZA.x + PLAZA.w - 3.4]) solids.push(...kiosk(v3(x, PLAZA.y + 1.4, 0.05)));
  place(solids, accents, lamp(v3(PLAZA.x + 2, PLAZA.y + PLAZA.d / 2, 0.05)));
  place(solids, accents, lamp(v3(PLAZA.x + PLAZA.w - 2.6, PLAZA.y + PLAZA.d / 2, 0.05)));
  return { litWindows, antenna: v3(mast.x, mast.y, mast.z + 5), paperWindow };
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

export function bridge(solids: Solid[], accents: Accent[]): void {
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
    solids.push(prism(ox, oy, top, OBELISK, OBELISK, 4, "stone"), { kind: "cone", at: v3(cx, cy, top + 4), r: 0.6, h: 1, mat: "stone", sides: 4 });
    accents.push({ kind: "dot", at: v3(cx, cy, top + 5.3), r: 0.6, color: "amber" });
  }
  solids.push(...car(v3(x0 + 40, y0 + 1.5, top), "steel"), ...car(v3(x0 + 58, y1 - 3, top), "rust")); // stopped cars
}

export function westQuay(solids: Solid[], accents: Accent[]): void {
  const { x0, x1 } = WEST_QUAY, w = x1 - x0;
  solids.push(prism(x0, ESTUARY_Y0, -1, w, 194 - ESTUARY_Y0, 1.6, "plaza"), prism(x0, 200, -1, w, CITY_EDGE.south - 200, 1.6, "plaza"));
  solids.push({ kind: "ramp", at: v3(x0, 194, -1), w, d: 6, h: 1.6, mat: "plaza", dir: "e" }); // stairs to the water
  // sheds right at the water's edge (x 193..198): this way the bollards at x 192.5 fit in the free strip next to them
  for (const y of [164, 178]) solids.push({ kind: "vault", at: v3(193, y, 0.6), len: 12, w: 5, h: 2.5, axis: "y", mat: "rust", segments: 6 });
  for (let y = 160; y <= 202; y += 6) if (y !== 196) solids.push(...bollard(v3(192.5, y, 0.6))); // 196 is the stairs (194..200)
  solids.push(...dockCrane(v3(195, 202, 0.6), "e"));
  // terraces on the quay street (x 186..192), facing the two bar blocks of column 162 (y0 164 and 188)
  // the awning goes against the lot wall (x 184.5: the block's sidewalk stays in front), at the height of the
  // shop-window awnings; if the block's recipe already put one at that height, the table shares its own
  const shopAwnings = solids.filter((s) => s.mat === "awning").map(bounds);
  for (const y0 of [164, 188]) for (const y of [y0 + 3, y0 + 9, y0 + 15]) {
    solids.push(...table(v3(188.5, y, 0)), ...chair(v3(187.5, y + 0.25, 0)), ...chair(v3(190, y + 0.25, 0)));
    const own = awning(v3(162 + BLOCK_W - SIDEWALK, y - 1, 2.3), 3, "e"), b = bounds(own[0]!);
    if (!shopAwnings.some((o) => o.min.x < b.max.x && o.max.x > b.min.x && o.min.y < b.max.y && o.max.y > b.min.y && o.min.z < b.max.z && o.max.z > b.min.z)) solids.push(...own);
  }
  for (let y = 164; y <= 200; y += 6) solids.push(prism(191, y, 0, 0.3, 0.3, 3, "steel")); // garland posts
  accents.push(...garland([v3(191.15, 164.15, 3), v3(191.15, 200.15, 3)]));
}

export function promenade(solids: Solid[], accents: Accent[]): Vec3[] {
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
  accents.push(...garland([v3(x0 + 3.8, 221, z + 3), v3(x0 + 3.8, 233, z + 3)]));
  solids.push(...kiosk(v3(x0 + 2, 240, z)));
  for (const y of [170, 200, 245, 258]) solids.push(...bench(v3(x0 + 2, y, z))); // benches
  // street lamps every 12 u; the district's new stretch (266..326) shares none with the old one
  const bulbs = [180, 210, 250, 272, 284, 296, 308, 320].map((y) => { const l = lamp(v3(x1 - 3, y, z)); place(solids, accents, l); return l.bulb; });
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
function jungleOnLand(out: Solid[], rng: Rng, rect: { x0: number; x1: number; y0: number; y1: number }, n: number, z = 0.4, rails?: Rails): void {
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
  jungleOnLand(solids, rng, { x0: Math.ceil(islandWestX(DISTRICT_ROWS[0])) + 2, x1: PROMENADE.x0 - 3, y0: DISTRICT_BANK_Y, y1: PROMENADE.y1 - 2 }, 10);
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
  for (const b of blocks()) {
    if (b.kind === "plaza" || b.kind === "freight") continue;
    const n = rng.int(1, 3);
    for (let i = 0; i < n; i++) {
      const x = b.x + rng.int(2, b.w - 5);
      const y = rng.chance(0.5) ? b.y + b.d + 0.4 : b.y - 1.9; // south or north sidewalk of the block
      if (y < CITY_EDGE.north || y + 1.5 > CITY_EDGE.south) continue;
      if (y >= AVENUE.y0 - 2 && y <= AVENUE.y1) continue;      // the avenue has no cars at the curb
      if (inCrater(x + 1.5, y + 0.75) || CRATERS.some((c) => Math.hypot(x + 1.5 - c.x, y + 0.75 - c.y) <= c.r + 2)) continue;
      if (x > QUAY_X && x <= estuaryEast(y) + 1) continue;    // over the estuary there is no sidewalk where to leave a car
      if (rectsOverlap(x, y, CAR.w, CAR.d, FALLEN_BLOCK.x, FALLEN_BLOCK.y, FALLEN_BLOCK.w, FALLEN_BLOCK.d)) continue;
      if (placed.some((p) => rectsOverlap(x, y, CAR.w, CAR.d, p.x, p.y, CAR.w, CAR.d, 1))) continue; // no car overlaps another, with 1 u of margin
      placed.push({ x, y });
      solids.push(...car(v3(x, y, 0), rng.chance(0.6) ? "steel" : "rust"));
    }
  }
}
