import type { Accent } from "../iso/accent";
import { v3, type Vec2, type Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import type { Rng } from "../map/seed";
import { inHeadland } from "../map/geo";
import { headlandZ, terrainAt } from "./terrain";

/**
 * Blog, static part: the rock point with the lighthouse and the keeper's house
 * (they click through to Portfolio), the reef, two buoys, and in the trench the wreck with its
 * buoy (Blog landmark): a coaster split in two with the bow and
 * the stern house sticking out. The ships and the animated sea are in sea-anim.ts.
 * Spec §7.
 */
export interface SeaScene { ground: Solid[]; solids: Solid[]; accents: Accent[]; lantern: Vec3; buoys: Vec3[]; neon: { gallery: Vec3[]; coast: Vec3[]; keeperSign: Accent } }

export const LIGHTHOUSE = { x: 396, y: 118, z: 7 } as const;
export const KEEPER = { x: 372, y: 108 } as const;
// Relocated in #87: the outbound leg went through the old buoy (420, 80) and a ship west or north of a solid
// that overlaps it on screen ends up behind. The buoys mark the shoal south of the point, west of
// the outbound leg (35 and 40 u from the lane: the ships pass in front). The wreck stays in the trench (its stern sits
// ~16 u east of the slope, `abyssX(262)` ≈ 474), 30 u east of the return leg; no ship covers it or is covered by it.
export const BUOYS: readonly Vec2[] = [{ x: 398, y: 150 }, { x: 392, y: 200 }];
export const WRECK_BUOY = { x: 498, y: 272 } as const;
export const WRECK = { x: 490, y: 262, heading: Math.PI / 6 } as const;
const WATER_Z = -1;
export const DRUM_R0 = 3.2;
const DRUMS = 6, DRUM_H = 4, DRUM_STEP = 0.2, GALLERY_H = 0.6, LANTERN_H = 3, CAP_H = 2;
/** Top face of the gallery disc. */
const DECK_TOP_Z = LIGHTHOUSE.z + DRUMS * DRUM_H + GALLERY_H;
/** Center of the lantern, where the beam starts (sea-anim.ts). */
export const LANTERN_Z = DECK_TOP_Z + LANTERN_H / 2;
const DRUM_TOP_R = DRUM_R0 - (DRUMS - 1) * DRUM_STEP;
/** Neon gallery and railing posts: last drum + 0.5. */
export const GALLERY_R = DRUM_TOP_R + 0.5;
/** Railing posts; one neon light per post. */
export const GALLERY_POSTS = 8;
/** Neon lights of the gallery: 0.5 below the disc's top face, they do not follow the lantern. */
export const GALLERY_LIGHT_Z = DECK_TOP_Z - 0.5;
/** Section and height of the railing posts: their own measurements, they do not follow the shaft. */
export const POST_W = 0.3, POST_H = 1.2;
/** The disc extends half a post section beyond the railing. */
export const GALLERY_DECK_R = GALLERY_R + POST_W;
/** Lantern set back from the last drum; the cap covers it with a 0.2 overhang. */
export const LANTERN_R = DRUM_TOP_R - 0.6, CAP_R = LANTERN_R + 0.2;
/**
 * Coast beacons: arc at ~12.8 u from the point, from the northeast to the southeast along the east. The point and its shore
 * (12 u) are Portfolio for `worldZoneAt`; at this distance it is already Blog (sea.test.ts pins it).
 */
export const COAST: readonly Vec2[] = [{ x: 397.5, y: 99.5 }, { x: 403, y: 101.5 }, { x: 408, y: 104 }, { x: 411.5, y: 108.5 }, { x: 413, y: 114.5 }, { x: 413, y: 120.5 }, { x: 412, y: 126.5 }, { x: 408.5, y: 131.5 }];
export const COAST_Z = 1.2;
const REEF_CELLS = 20, BOULDERS = 20; // two cones per reef cell: up to 40

const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Material, roof?: "gable"): Solid => (roof ? { kind: "prism", at: v3(x, y, z), w, d, h, mat, roof } : { kind: "prism", at: v3(x, y, z), w, d, h, mat });
const cyl = (x: number, y: number, z: number, r: number, h: number, mat: Material, sides = 10): Solid => ({ kind: "cylinder", at: v3(x, y, z), r, h, mat, sides });

function lighthouse(out: Solid[]): Vec3 {
  const { x, y } = LIGHTHOUSE;
  let z = LIGHTHOUSE.z;
  for (let i = 0; i < DRUMS; i++) { out.push(cyl(x, y, z, DRUM_R0 - i * DRUM_STEP, DRUM_H, i % 2 === 0 ? "whitewash" : "rust")); z += DRUM_H; }
  out.push(cyl(x, y, z, GALLERY_DECK_R, GALLERY_H, "steel")); z += GALLERY_H;
  for (let k = 0; k < GALLERY_POSTS; k++) { const a = (k / GALLERY_POSTS) * Math.PI * 2; out.push(prism(x + GALLERY_R * Math.cos(a) - POST_W / 2, y + GALLERY_R * Math.sin(a) - POST_W / 2, z, POST_W, POST_W, POST_H, "steel")); }
  out.push(cyl(x, y, z, LANTERN_R, LANTERN_H, "glass", 8));
  const lantern = v3(x, y, LANTERN_Z);
  z += LANTERN_H;
  out.push({ kind: "cone", at: v3(x, y, z), r: CAP_R, h: CAP_H, mat: "steel", sides: 8 });
  return lantern;
}

function keeperHouse(out: Solid[], accents: Accent[]): Accent {
  const z = headlandZ(KEEPER.x + 4);
  out.push(prism(KEEPER.x, KEEPER.y, z, 8, 6, 4, "whitewash", "gable"));
  const wx = KEEPER.x + 3, wy = KEEPER.y + 6.02; // window on the south face
  accents.push({ kind: "poly", pts: [v3(wx, wy, z + 1), v3(wx + 1.2, wy, z + 1), v3(wx + 1.2, wy, z + 2), v3(wx, wy, z + 2)], color: "magentaBleed", alpha: 0.9 });
  // 2 × 1 sign on the south face, resting on the eave, over a dark box like `sign()` in tech.ts: without it the additive
  // blend against the whitewashed roof reads white and the color change is not visible.
  const sx = KEEPER.x + 3, sy = KEEPER.y + 6;
  out.push(prism(sx - 0.2, sy, z + 3.8, 2.4, 0.4, 1.4, "steel"));
  const fy = sy + 0.42;
  return { kind: "poly", pts: [v3(sx, fy, z + 4), v3(sx + 2, fy, z + 4), v3(sx + 2, fy, z + 5), v3(sx, fy, z + 5)], color: "cyan", alpha: 1 };
}

/** Rock path from the breakwater to the lighthouse: ten stretches, each at the height of the point at its center (the point rises from 1 to 7). */
function path(ground: Solid[]): void {
  const from = { x: 332, y: 115 }, to = { x: 393, y: 118 }, n = 10;
  for (let i = 0; i < n; i++) {
    const a = { x: from.x + ((to.x - from.x) * i) / n, y: from.y + ((to.y - from.y) * i) / n };
    const b = { x: from.x + ((to.x - from.x) * (i + 1)) / n, y: from.y + ((to.y - from.y) * (i + 1)) / n };
    ground.push({ kind: "strip", path: [a, b], width: 1.5, z: headlandZ((a.x + b.x) / 2) + 0.15, mat: "rock" });
  }
}

function rocks(out: Solid[], rng: Rng): void {
  for (const [cx, cy, r] of [[350, 112, 4], [362, 124, 3.5], [385, 110, 4.5], [378, 126, 3], [340, 104, 3], [392, 126, 2.5]] as const) { // outcrops
    const n = rng.int(5, 6);
    const footprint: Vec2[] = Array.from({ length: n }, (_, k) => { const a = (k / n) * Math.PI * 2; const rr = r * (0.7 + rng.next() * 0.3); return { x: cx + rr * Math.cos(a), y: cy + rr * Math.sin(a) }; });
    out.push({ kind: "poly", footprint, z: headlandZ(cx) - 1.5, h: rng.int(2, 3), mat: "rock" });
  }
  let placed = 0; // boulders: small cones on the point, not stepping on the path (y 113..120) or the lighthouse
  while (placed < BOULDERS) {
    const x = rng.int(340, 398), y = rng.int(99, 133);
    if (!inHeadland(x, y) || (y > 112 && y < 121) || Math.hypot(x - LIGHTHOUSE.x, y - LIGHTHOUSE.y) < 5) continue;
    out.push({ kind: "cone", at: v3(x, y, headlandZ(x) - 0.5), r: 1, h: 1.5, mat: "rock", sides: 5 });
    placed++;
  }
  const cells: Vec2[] = [];
  for (let y = 87; y < 147; y += 6) for (let x = 327; x < 417; x += 6) if (terrainAt(x, y) === "reef") cells.push({ x, y });
  for (let i = cells.length - 1; i > 0; i--) { const j = rng.int(0, i); [cells[i], cells[j]] = [cells[j]!, cells[i]!]; } // shuffle
  for (const c of cells.slice(0, REEF_CELLS)) for (let k = 0; k < 2; k++) {
    const x = c.x + (rng.next() - 0.5) * 2, y = c.y + (rng.next() - 0.5) * 2;
    const p = terrainAt(x, y) === "reef" ? { x, y } : c; // the ring measures 6: an offset can land on shore or rock; then it goes to the center
    out.push({ kind: "cone", at: v3(p.x, p.y, 0.5), r: 1.5, h: 1, mat: "rock", sides: 5 });
  }
}

function buoysAndWreck(out: Solid[], ground: Solid[], accents: Accent[]): Vec3[] {
  const bases = BUOYS.map((b) => { out.push(cyl(b.x, b.y, WATER_Z, 0.8, 1.5, "rust", 6)); return v3(b.x, b.y, WATER_Z + 1.5); });
  out.push(cyl(WRECK_BUOY.x, WRECK_BUOY.y, WATER_Z, 1, 2, "steel", 6));
  accents.push({ kind: "dot", at: v3(WRECK_BUOY.x, WRECK_BUOY.y, 1), r: 1, color: "magentaMid" });
  const ring = Array.from({ length: 8 }, (_, k): { pts: [Vec3, Vec3, Vec3] } => {
    const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2, r0 = 1.6, r1 = 2.5;
    return { pts: [v3(WRECK_BUOY.x + r0 * Math.cos(a0), WRECK_BUOY.y + r0 * Math.sin(a0), -0.95), v3(WRECK_BUOY.x + r1 * Math.cos(a0), WRECK_BUOY.y + r1 * Math.sin(a0), -0.95), v3(WRECK_BUOY.x + r1 * Math.cos(a1), WRECK_BUOY.y + r1 * Math.sin(a1), -0.95)] };
  });
  ground.push({ kind: "ground", mat: "foam", tris: ring });
  wreck(out, ground);
  return bases;
}

/**
 * Wreck (#83): a 40 u coaster split in two and sunk in the trench. The stern (`WRECK`) sits
 * ~16 u east of the slope (`abyssX(262)` ≈ 474) and the whole hull falls in `abyss`. It is not moved up to the
 * slope: that would require revalidating the lanes with the #87 validator, because the return leg passes 30 u from the wreck.
 * The center of the hull is underwater; the bow sticks out (a rusty wedge with its deck and the bitt) and the
 * stern house (rusty hull band, whitewashed deckhouse with windows, funnel and mast). Local coordinates as
 * in the ships.ts kit: x from stern (0) to bow (`WRECK_LEN`), y to starboard, rotated by `WRECK.heading`.
 * All the pieces stay above the water (z ≥ −1): the engine draws solids over the water, so
 * a fully "sunk" hull would look afloat.
 */
const WRECK_LEN = 40;
function wreck(out: Solid[], ground: Solid[]): void {
  const c = Math.cos(WRECK.heading), s = Math.sin(WRECK.heading);
  const local = (dx: number, dy: number): Vec2 => ({ x: WRECK.x + dx * c - dy * s, y: WRECK.y + dx * s + dy * c });
  const plate = (pts: [number, number][], z: number, h: number, mat: Material, facade?: { floors: number; cols: number }): Solid => ({ kind: "poly", footprint: pts.map(([dx, dy]) => local(dx, dy)), z, h, mat, ...(facade ? { facade } : {}) });
  const foam = (dx: number, dy: number, r0: number, r1: number): void => {
    const o = local(dx, dy);
    ground.push({ kind: "ground", mat: "foam", tris: Array.from({ length: 8 }, (_, k): { pts: [Vec3, Vec3, Vec3] } => {
      const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2;
      return { pts: [v3(o.x + r0 * Math.cos(a0), o.y + r0 * Math.sin(a0), -0.95), v3(o.x + r1 * Math.cos(a0), o.y + r1 * Math.sin(a0), -0.95), v3(o.x + r1 * Math.cos(a1), o.y + r1 * Math.sin(a1), -0.95)] };
    }) });
  };
  // bow: wedge with dark underwater hull, rusty topsides stripe, wooden deck and the bitt; the water laps around
  const bow: [number, number][] = [[27, -3.6], [37, -2.4], [WRECK_LEN, 0], [37, 2.4], [27, 3.6]];
  out.push(plate(bow, WATER_Z, 0.8, "hull"), plate(bow, WATER_Z + 0.8, 0.9, "rust"));
  out.push(plate([[28, -2.8], [36.5, -1.9], [39, 0], [36.5, 1.9], [28, 2.8]], WATER_Z + 1.7, 0.2, "deck"));
  const bitt = local(36, 0);
  out.push(cyl(bitt.x, bitt.y, WATER_Z + 1.9, 0.4, 0.5, "steel", 6));
  foam(33, 0, 5.5, 6.8);
  // stern: rusty hull band sticking out, two-level deckhouse with windows, funnel and mast
  out.push(plate([[3, -3.6], [12, -3.6], [12, 3.6], [3, 3.6]], WATER_Z, 1, "rust"));
  out.push(plate([[4, -3], [11, -3], [11, 3], [4, 3]], WATER_Z + 1, 1.5, "whitewash", { floors: 1, cols: 4 }));
  out.push(plate([[6, -2.2], [10.5, -2.2], [10.5, 2.2], [6, 2.2]], WATER_Z + 2.5, 1.3, "whitewash", { floors: 1, cols: 3 }));
  const funnel = local(5, 0);
  out.push(cyl(funnel.x, funnel.y, WATER_Z + 2.5, 0.7, 2.2, "rust", 8));
  out.push({ kind: "poly", footprint: [local(9.8, -0.25), local(10.2, -0.25), local(10.2, 0.25), local(9.8, 0.25)], z: WATER_Z + 3.8, h: 4.5, mat: "steel" }); // mast over the deckhouse
  foam(7.5, 0, 5.5, 6.8);
}

export function sea(rng: Rng): SeaScene {
  const ground: Solid[] = [], solids: Solid[] = [], accents: Accent[] = [];
  const lantern = lighthouse(solids);
  const keeperSign = keeperHouse(solids, accents);
  path(ground);
  rocks(solids, rng);
  const buoys = buoysAndWreck(solids, ground, accents);
  const gallery = Array.from({ length: GALLERY_POSTS }, (_, k) => { const a = (k / GALLERY_POSTS) * Math.PI * 2; return v3(LIGHTHOUSE.x + GALLERY_R * Math.cos(a), LIGHTHOUSE.y + GALLERY_R * Math.sin(a), GALLERY_LIGHT_Z); });
  return { ground, solids, accents, lantern, buoys, neon: { gallery, coast: COAST.map((p) => v3(p.x, p.y, COAST_Z)), keeperSign } };
}
