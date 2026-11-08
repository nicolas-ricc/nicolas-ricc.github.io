import type { Accent } from "../iso/accent";
import { v3, type Vec2, type Vec3 } from "../iso/geometry";
import { bounds, type Solid } from "../iso/solids";
import { BOTTOM, DOCK, QUAY_W, QUAY_X, WORLD, ZONE_SPLIT_Y, eastBank, northCoastY } from "../map/geo";
import type { Rng } from "../map/seed";
import { jungle as flora } from "./flora";
import { RIPRAP_KEEP_OUT, shipyardEast } from "./shipyard-east";
import { station } from "./station";
import { clearOfWater } from "./terrain-classify";


/**
 * Portfolio: 2.5D shipyard. Same plan as terrain.ts: slipways east of
 * the N-S transfer street, ending in the water; dredged straight
 * bank at QUAY_X, dry dock to the NE, fitting-out quay on the
 * other side of the river. The assembly halls, the workshops and the material
 * yard go north, behind the factory, in the band `y −58..−16`; the
 * Portfolio factory sits between the street and the rail yard. South of the
 * slipways, at the end of the west track, is the terminus station
 * (`station.ts`). The Portfolio/Resume seam is at `y 90` (a steel fence marks it from
 * x −60 to 96) and the station land (`STATION_LAND`) is the only part of Portfolio south of it. Coordinates in old-map units (1 u ≈ 1 px).
 */

export interface Scene {
  ground: Solid[];     // sunken dock floor and strips (streets, rails)
  solids: Solid[];
  accents: Accent[];
  trolley: Solid & { kind: "prism" };
  trolleyRange: [number, number];
  weldSpots: Vec3[];
}

export const AREA_W = 344, AREA_H = 146;

const STREET_X = 100, STREET_W = 8;
export const STREET_EDGE = STREET_X + STREET_W; // x where the lamps start
const ROW_Y = [36, 56] as const;
const ROW_H = 16;
const HALL_X = 10, HALL_W = 90, HALL_H = 10;
const HALL_ROWS_Y = [-52, -32] as const; // assembly halls, in the north band
const SLIP_X = 110;
export const RAIL_Y = [131, 134] as const; // west tracks: the station draws them from x 96, Resume and the hinterland west of it
const GANTRY_X = 150, GANTRY_H = 24;
const WATER_Z = -1;

// ---------------------------------------------------------------- pieces

const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Solid["mat"], roof?: "flat" | "gable" | "step"): Solid & { kind: "prism" } =>
  roof ? { kind: "prism", at: v3(x, y, z), w, d, h, mat, roof } : { kind: "prism", at: v3(x, y, z), w, d, h, mat };

const strip = (path: Vec2[], width: number, z: number, mat: Solid["mat"]): Solid => ({ kind: "strip", path, width, z, mat });

function quay(out: Solid[], accents: Accent[]): void {
  out.push(prism(QUAY_X, WORLD.y0, WATER_Z, QUAY_W, BOTTOM - WORLD.y0, 1.5, "concrete"));
  for (let y = WORLD.y0 + 6; y < BOTTOM; y += 12) out.push({ kind: "cylinder", at: v3(QUAY_X + 2, y, 0.5), r: 0.7, h: 1, mat: "steel", sides: 6 });
  for (const y of [20, 80]) { // lamps
    out.push(prism(QUAY_X - 1.4, y, 0, 0.6, 0.6, 5, "steel"));
    accents.push({ kind: "dot", at: v3(QUAY_X - 1.4 + 0.3, y + 0.3, 5), r: 1.2, color: "cyan" });
  }
}

function halls(out: Solid[]): void {
  for (const y of HALL_ROWS_Y) {
    out.push(prism(HALL_X, y, 0, HALL_W, ROW_H, HALL_H, "concrete", "gable"));
    out.push(prism(HALL_X + HALL_W - 8, y + 2, 0, 2, 3, 2, "rust"));   // forklift waiting at the east gate
    out.push(prism(HALL_X + 2, y + ROW_H - 5, 0, 3, 2, 2, "steel"));   // another at the west gate
  }
}

function street(out: Solid[]): void {
  out.push(strip([{ x: STREET_X + STREET_W / 2, y: 0 }, { x: STREET_X + STREET_W / 2, y: BOTTOM }], STREET_W, -0.4, "road"));
  out.push(prism(STREET_X + 5, 88, -0.4, 3, 7, 2.5, "rust"));     // truck going down the street
}

function slipways(out: Solid[], weldSpots: Vec3[]): void {
  const w = QUAY_X - SLIP_X, deckZ = 1.5;
  ROW_Y.forEach((y, i) => {
    out.push({ kind: "ramp", at: v3(SLIP_X, y, 0), w, d: ROW_H, h: deckZ, mat: "concrete", dir: "e" });
    const cy = y + ROW_H / 2;
    if (i === 0) {
      // keel and frames: the hull is still a skeleton
      out.push(prism(SLIP_X + 10, cy - 0.3, deckZ, 70, 0.6, 1, "rust"));
      for (let x = SLIP_X + 12; x < SLIP_X + 80; x += 4) {
        const t = (x - SLIP_X - 12) / 68;
        const half = t > 0.75 ? Math.max(1, 5 * (1 - t) / 0.25) : 5;
        out.push(prism(x, cy - half, deckZ, 0.6, half * 2, 4, "rust"));
        weldSpots.push(v3(x + 0.3, cy - half, deckZ + 4));
        weldSpots.push(v3(x + 0.3, cy + half, deckZ + 4));
      }
    } else {
      out.push({ kind: "hull", at: v3(SLIP_X + 8, cy, deckZ), len: 74, beam: 10, h: 4, mat: "hull" });
      out.push(prism(SLIP_X + 14, cy - 2.5, deckZ + 4, 8, 5, 3, "concrete")); // superstructure at the stern
    }
    for (let x = SLIP_X + 6; x < QUAY_X - 8; x += 9) { // scaffolding
      out.push(prism(x, y + 1, deckZ, 0.6, 0.6, 5, "steel"));
      out.push(prism(x + 4, y + ROW_H - 1.6, deckZ, 0.6, 0.6, 5, "steel"));
    }
  });
}

function gantry(out: Solid[]): { trolley: Solid & { kind: "prism" }; range: [number, number] } {
  const y0 = ROW_Y[0] - 3, y1 = ROW_Y[1] + ROW_H + 1;
  out.push(strip([{ x: SLIP_X, y: y0 + 1.5 }, { x: QUAY_X, y: y0 + 1.5 }], 0.5, 0.05, "rail"));
  out.push(strip([{ x: SLIP_X, y: y1 + 1.5 }, { x: QUAY_X, y: y1 + 1.5 }], 0.5, 0.05, "rail"));
  out.push(prism(GANTRY_X, y0, 0, 3, 3, GANTRY_H, "steel"));
  out.push(prism(GANTRY_X, y1, 0, 3, 3, GANTRY_H, "steel"));
  out.push(prism(GANTRY_X, y0, GANTRY_H, 3, y1 + 3 - y0, 2, "steel")); // beam
  const range: [number, number] = [y0 + 5, y1 - 6];
  const trolley = prism(GANTRY_X - 1, range[0], GANTRY_H + 2, 5, 4, 2, "rust");
  return { trolley, range };
}

// ---------------------------------------------------------------- material yard (north band)

function materialYard(out: Solid[], rng: Rng): void {
  for (const [x, y] of [[104, -58], [118, -58], [104, -50], [118, -50], [132, -56]] as const) { // sheets stacked with an offset
    const layers = rng.int(2, 4);
    for (let l = 0; l < layers; l++) out.push(prism(x + l * 0.4, y + l * 0.4, l * 0.5, 10, 2, 0.5, "steel"));
  }
  for (const [x, y] of [[104, -42], [122, -42], [140, -44]] as const) { // bundles of pipes
    for (let i = 0; i < 4; i++) out.push(prism(x, y + i * 1.2, 0, 14, 1, 1, "rust"));
  }
  for (let i = 0; i < 6; i++) out.push({ kind: "cylinder", at: v3(149 + (i % 3) * 5, -57 + Math.floor(i / 3) * 5, 0), r: 1.5, h: 1.5, mat: "rust", sides: 8 }); // coils
  for (let i = 0; i < 4; i++) out.push(prism(150 + (i % 2) * 12, -46 + Math.floor(i / 2) * 6, 0, 9, 4, 3, "steel", "step")); // hull sections
  out.push({ kind: "cylinder", at: v3(174, -54, 0), r: 5, h: 8, mat: "concrete" });
  out.push({ kind: "cylinder", at: v3(186, -42, 0), r: 4, h: 6, mat: "concrete" });
}

// ---------------------------------------------------------------- dry dock (NE)

function dryDock(out: Solid[], ground: Solid[]): void {
  const { x, y, w, d, depth } = DOCK;
  const z = -depth;
  ground.push({ kind: "ground", mat: "concrete", tris: [
    { pts: [v3(x, y, z), v3(x + w, y, z), v3(x + w, y + d, z)], toneOffset: -1 },
    { pts: [v3(x, y, z), v3(x + w, y + d, z), v3(x, y + d, z)], toneOffset: -1 },
  ] });
  out.push(prism(x - 2, y - 2, z, w + 4, 2, depth, "concrete"));        // north wall
  out.push(prism(x - 2, y + d, z, w + 4, 2, depth, "concrete"));        // south wall
  out.push(prism(x - 2, y, z, 2, d, depth, "concrete"));                // west wall
  out.push(prism(x + w, y, z, QUAY_X - x - w, d, depth, "concrete"));   // east wall up to the quay
  out.push(prism(QUAY_X - 3, y + 2, z, 3, d - 4, depth + 1, "rust"));   // gate
  out.push({ kind: "hull", at: v3(x + 6, y + d / 2, z), len: 60, beam: 10, h: 5, mat: "hull" });
  out.push(prism(x + 12, y + d / 2 - 2.5, z + 5, 8, 5, 3, "concrete")); // superstructure
  out.push(prism(x + w - 10, 0, 0, 8, 4, 4, "concrete", "step"));       // pump house (x 182..190, does not cover the quay at 198..202)
}

// ---------------------------------------------------------------- workshops (north band)

function workshops(out: Solid[]): void {
  for (const x of [106, 134]) {
    out.push(prism(x, -33, 0, 24, 14, 7, "concrete", "step"));
    out.push(prism(x + 3, -30, 7, 2, 2, 1, "steel"));
    out.push(prism(x + 18, -23, 7, 2, 2, 1, "steel"));
  }
}

// ---------------------------------------------------------------- east bank: silo and riprap (the sheds, the yard and the cranes are in shipyard-east.ts)

function siloAndRiprap(out: Solid[]): void {
  out.push({ kind: "cylinder", at: v3(310, 86, 0), r: 4, h: 6, mat: "concrete" });
  const riprap = (x: number, y: number): void => { // skips rocks over the yard slab or the crane legs
    const rock: Solid = { kind: "cone", at: v3(x, y, 0), r: 1.6, h: 1.2, mat: "rock", sides: 5 }, b = bounds(rock);
    if (!RIPRAP_KEEP_OUT.some((k) => b.min.x < k.x1 && k.x0 < b.max.x && b.min.y < k.y1 && k.y0 < b.max.y)) out.push(rock);
  };
  for (let y = 0; y < AREA_H; y += 3) { // river riprap: only where there is already land
    const x = eastBank(y) + 1.5;
    if (y < ZONE_SPLIT_Y && y >= northCoastY(x)) riprap(x, y);
  }
  for (let x = Math.ceil(eastBank(30)) + 6; x < 300; x += 3) riprap(x, northCoastY(x) + 1.5); // cove riprap; starts 6 u east of the bank (eastBank(30) = 277) so as not to cover the river's last cone
}

// ---------------------------------------------------------------- jungle and lamps

function jungle(out: Solid[], rng: Rng): void {
  // seeds the same (the rng does not move) and discards whatever ends up within 3 u of the water
  const cluster = (x0: number, x1: number, y0: number, y1: number, n: number) => {
    const tmp: Solid[] = [];
    flora(tmp, rng, { x0, x1, y0, y1 }, n, 0.4);
    for (const s of tmp) {
      const b = bounds(s);
      if (clearOfWater(b.min.x, b.min.y, b.max.x, b.max.y, 3)) out.push(s);
    }
  };
  cluster(332, 340, 50, 88, 6);   // east edge, between the bay and the headland (y0 50, Task 6: leaves out of the diagonal reach of the freighter leaving the bay)
}

function lamps(out: Solid[], accents: Accent[]): void {
  for (const y of [12, 40, 68, 96, 124]) {
    out.push(prism(STREET_EDGE + 0.5, y, 0, 0.6, 0.6, 5, "steel"));
    accents.push({ kind: "dot", at: v3(STREET_EDGE + 0.8, y + 0.3, 5), r: 1.2, color: "cyan" });
  }
}

/** Steel mesh fence on the seam, x −60..96 at y 89.4, with posts and six cyan lamps on the Portfolio side. */
function seamFence(out: Solid[], accents: Accent[]): void {
  out.push(prism(-60, 89.4, 0, 156, 0.6, 1.2, "steel"));
  for (let x = -60; x < 96; x += 6) out.push(prism(x, 89.3, 0, 0.3, 0.3, 1.6, "steel")); // posts every 6 u (26)
  for (const x of [-48, -24, 0, 24, 48, 72]) {
    out.push(prism(x, 88.2, 0, 0.6, 0.6, 5, "steel"));
    accents.push({ kind: "dot", at: v3(x + 0.3, 88.5, 5), r: 1.2, color: "cyan" });
  }
}

export function shipyard(rng: Rng): Scene {
  const ground: Solid[] = [];
  const solids: Solid[] = [];
  const accents: Accent[] = [];
  const weldSpots: Vec3[] = [];
  quay(solids, accents);
  materialYard(solids, rng);
  dryDock(solids, ground);
  halls(solids);
  street(solids);
  slipways(solids, weldSpots);
  const g = gantry(solids);
  workshops(solids);
  station(solids, accents);
  siloAndRiprap(solids);
  jungle(solids, rng);
  lamps(solids, accents);
  seamFence(solids, accents);
  shipyardEast(solids, accents, weldSpots, rng);
  ground.push(...solids.filter((s) => s.kind === "strip"));
  const raised = solids.filter((s) => s.kind !== "strip");
  return { ground, solids: raised, accents, trolley: g.trolley, trolleyRange: g.range, weldSpots };
}
