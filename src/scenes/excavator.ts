import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import type { Plate } from "../iso/plate";
import { bounds, type Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import type { Box } from "../world/frame";

/** SRs 1300 bucket-wheel excavator (TAKRAF) in the rail yard: chassis at `at`, bow to the NE (`heading`); the wheel axle sits `axleDx` from the chassis, at z `axleZ`. */
export const EXCAVATOR = {
  at: { x: -30, y: 70 }, heading: -Math.PI / 4, axleDx: 16 * Math.SQRT2, // ≈ 22.63: chosen so the axle lands at (−14, 54), 6 north so `excavatorBox()` ends at y ≤ 88.4, north of the seam fence
  axleZ: 9.2,
  wheel: { r: 5.5, width: 0.5, sides: 28, slots: 28, buckets: { n: 14, depth: 1.2, teeth: 2 } },
  pile: { r: 6.5, h: 4.5 },
} as const;

/** Local frame of the chassis (heading −π/4): dx runs NE, dy toward the camera. */
export const local = (dx: number, dy: number) => ({ x: EXCAVATOR.at.x + (dx + dy) / Math.SQRT2, y: EXCAVATOR.at.y + (dy - dx) / Math.SQRT2 });

/** The bucket wheel, hollow with a double rim, at the given angle. */
export function excavatorWheel(angle: number): Solid {
  const axle = local(EXCAVATOR.axleDx, 0), { r, width, sides, slots, buckets } = EXCAVATOR.wheel;
  return { kind: "wheel", at: v3(axle.x, axle.y, EXCAVATOR.axleZ), r, width, mat: "rust", sides, angle, hollow: true, slots, buckets: { ...buckets, mat: "rust" } };
}

type Poly = Solid & { kind: "poly" };
/** Rotated box: footprint `[local(dx0,dy0), local(dx1,dy0), local(dx1,dy1), local(dx0,dy1)]`; the wall the camera sees is edge 2 (max dy). */
const box = (dx0: number, dy0: number, dx1: number, dy1: number, z: number, h: number, mat: Material, extra: Pick<Poly, "facade" | "plates"> = {}): Solid =>
  ({ kind: "poly", footprint: [local(dx0, dy0), local(dx1, dy0), local(dx1, dy1), local(dx0, dy1)], z, h, mat, ...extra });
/** Beam between two `[dx, dy, z]` points of the local frame. */
const bar = (from: [number, number, number], to: [number, number, number], w: number, h: number, mat: Material): Solid => {
  const a = local(from[0], from[1]), b = local(to[0], to[1]);
  return { kind: "beam", from: v3(a.x, a.y, from[2]), to: v3(b.x, b.y, to[2]), w, h, mat };
};
const cyl = (dx: number, dy: number, z: number, r: number, h: number, mat: Material): Solid => { const p = local(dx, dy); return { kind: "cylinder", at: v3(p.x, p.y, z), r, h, mat, sides: 8 }; };

/** z of the wheel boom's axis at `dx` (drops from 17 at dx 4.5 to `axleZ` at the axle). */
const E = (dx: number) => 17 - (dx - 4.5) * (17 - EXCAVATOR.axleZ) / (EXCAVATOR.axleDx - 4.5);

/** Whole machine: chassis and platform, A-frame mast, superstructure, booms, shield and hoppers, cab and floodlights (the wheel is separate, animated). */
export function excavator(out: Solid[], accents: Accent[]): void {
  chassis(out);
  upperWorks(out, accents);
}

/** Chassis and platform level: crawler tracks with shoes and rollers, slewing ring, platform with railings, low house and stairs. */
function chassis(out: Solid[]): void {
  // Tracks: 12 shoes of 0.3 every 0.8 u on edge 2 (u=0 at the max-dx end; 10 u long → fractions /10)
  const shoes: Plate[] = Array.from({ length: 12 }, (_, k) => ({ wall: 2, shape: "rect", u0: (0.2 + 0.8 * k) / 10, u1: (0.5 + 0.8 * k) / 10, z0: 0, z1: 1.6, mat: "rust", toneOffset: -2 }));
  for (const [dy0, dy1] of [[-4.2, -1.8], [1.8, 4.2]] as const) {
    out.push(box(-5, dy0, 5, dy1, 0, 1.6, "rust", { plates: shoes }));
    for (const dx of [-3, 0, 3]) out.push(cyl(dx, dy1 + 0.3, 0.65, 0.3, 0.3, "steel"));
  }
  out.push({ kind: "cylinder", at: v3(EXCAVATOR.at.x, EXCAVATOR.at.y, 1.6), r: 4, h: 1, mat: "steel", sides: 16 }); // slewing ring
  out.push(box(-6, -4.5, 6, 4.5, 2.6, 0.8, "office")); // platform
  // railings: handrail at z 4.475 over the south edge (dy +4.3) and the NE edge (dx +5.8), 0.15 posts every 2 u
  out.push(bar([-6, 4.3, 4.475], [5.8, 4.3, 4.475], 0.15, 0.15, "safety"), bar([5.8, -4.5, 4.475], [5.8, 4.3, 4.475], 0.15, 0.15, "safety")); // the handrail (z 4.4..4.55) rests on the posts (top z 4.4)
  const post = (dx: number, dy: number) => out.push(box(dx - 0.075, dy - 0.075, dx + 0.075, dy + 0.075, 3.4, 1, "safety"));
  for (let dx = -5.85; dx < 5.8; dx += 2) post(dx, 4.3); // posts inside the platform (|dx| ≤ 5.925, |dy| ≤ 4.425)
  post(5.8, 4.3);
  for (let dy = -4.35; dy < 4.3; dy += 2) post(5.8, dy);
  out.push(box(-5, -4, 0, 0, 3.4, 2.5, "whitewash", { facade: { floors: 1, cols: 3 } }), box(-5, -4, 0, 0, 5.9, 0.2, "rust")); // low house and roof
  out.push(bar([-5, 5.2, 0.075], [-1, 5.2, 3.4], 0.6, 0.15, "safety"), bar([3, -0.8, 3.4], [0.2, -0.8, 6.1], 0.6, 0.15, "safety")); // stairs
}

/** Mast, superstructure, top beam, wheel boom with its stays, shield, discharge boom and cab. */
function upperWorks(out: Solid[], accents: Accent[]): void {
  const { axleDx, axleZ } = EXCAVATOR, off: Material = "office", steel: Material = "steel";
  // A-frame mast: line (−2, ±2.5, 3.4)→(−1, 0, 20); each arm is cut where it crosses the house (dy −2.5 starts at its roof, z 6.1) and the superstructure (z 11..16)
  const mast = (sy: number, z: number): [number, number, number] => { const t = (z - 3.4) / 16.6; return [-2 + t, sy * 2.5 * (1 - t), z]; };
  const dip = 0.35 * Math.sin(Math.atan(Math.hypot(1, 2.5) / 16.6)); // the arm's slanted cap (0.7) drops this below its cut: each cut is shifted
  for (const [sy, z0] of [[1, 3.4], [-1, 6.1]] as const) for (const [a, b] of [[z0 + dip, 11 - dip], [16 + dip, 20]] as const) out.push(bar(mast(sy, a), mast(sy, b), 0.7, 0.7, off));
  for (const z of [7, 9.5, 18]) out.push(bar(mast(-1, z), mast(1, z), 0.3, 0.3, off)); // crossbars between arms
  // superstructure hung from the mast, with a sign on the visible wall (3 of 9 u, centered)
  out.push(box(-6, -3, 3, 3, 11, 5, off, { facade: { floors: 1, cols: 4, window: { w: 0.7, h: 0.4 }, grid: { cols: 2, rows: 1 } }, plates: [{ wall: 2, shape: "rect", u0: 0.5 - 1.5 / 9, u1: 0.5 + 1.5 / 9, z0: 14.6, z1: 15.6, mat: "whitewash" }] }));
  out.push(bar([-1, 0, 20], [-20, 0, 20], 0.6, 0.6, off), box(-22, -0.75, -20, 0.75, 18.5, 1.5, off)); // top beam and counterweight box
  out.push(box(3, -1.85, 5, 1.85, 15, 1.75, off)); // pivot: joins the superstructure with the start of the chords
  // wheel boom: chords out to the axle, zigzag diagonals every 3 u, belt and V rollers
  for (const sy of [-1, 1]) out.push(bar([4.5, sy * 1.6, 17], [axleDx, sy * 1.6, axleZ], 0.5, 0.5, off));
  for (let k = 0, dx = 4.5; dx + 3 <= axleDx; k++, dx += 3) { const s = k % 2 ? -1 : 1; out.push(bar([dx, s * 1.6, E(dx)], [dx + 3, -s * 1.6, E(dx + 3)], 0.2, 0.2, off)); }
  out.push(bar([4.5, 0, 17 - 0.15], [19.5, 0, E(19.5) - 0.15], 2.6, 0.2, steel));
  out.push(bar([15, -1.3, E(15) + 0.35], [15, 0, E(15)], 0.2, 0.2, steel), bar([15, 0, E(15)], [15, 1.3, E(15) + 0.35], 0.2, 0.2, steel));
  out.push(bar([4.5, 1.6, 17.33], [15, 1.6, E(15) + 0.33], 0.6, 0.15, off), bar([4.5, 1.85, 18.33], [15, 1.85, E(15) + 1.33], 0.15, 0.15, "safety")); // walkway and railing
  out.push(bar([-1, 0, 20], [12, 0, E(12) + 0.4], 0.3, 0.3, off), bar([-1, 0, 20], [21, 0, E(21) + 0.4], 0.3, 0.3, off)); // stays
  for (const sy of [-1, 1]) out.push(bar([12, sy * 1.6, E(12) + 0.25], [12, sy * 1.6, 20], 0.4, 0.4, off)); // intermediate portal
  out.push(bar([12, -1.6, 20], [12, 1.6, 20], 0.4, 0.4, off));
  // shield, fixed hopper, curtain and head drum: all at dy ≤ −0.3, behind the wheel disc
  out.push(box(axleDx, -0.8, axleDx + 6, -0.5, axleZ, 6, off), box(21.1, -1.3, 24.1, -0.3, 5, 2.5, "rust"), box(21.6, -0.5, 23.6, -0.3, 7.5, 2.5, steel));
  out.push(bar([20, -1.3, E(20)], [20, -0.3, E(20)], 1, 1, steel));
  // discharge boom to the west with hanging hopper
  const dz = (dx: number) => 5.88 + (dx + 5.2) * (5.88 - 4) / 18.8;
  for (const sy of [-1, 1]) out.push(bar([-5.2, sy * 1.2, 5.88], [-24, sy * 1.2, 4], 0.4, 0.4, off));
  for (let k = 0, dx = -5.2; dx - 3 >= -24; k++, dx -= 3) { const s = k % 2 ? -1 : 1; out.push(bar([dx, s * 1.2, dz(dx)], [dx - 3, -s * 1.2, dz(dx - 3)], 0.2, 0.2, off)); }
  out.push(box(-25, -1, -23, 1, 2, 2, "rust"));
  // 2-story cab with an eaved roof and three floodlights
  out.push(box(13, 1.9, 15.5, 3.5, 9.5, 2.2, steel, { facade: { floors: 2, cols: 3, window: { w: 0.7, h: 0.6 } } }), box(12.75, 1.25, 15.65, 3.75, 11.71, 0.2, steel));
  for (const dx of [13.5, 14.25, 15]) { const p = local(dx, 3.5); accents.push({ kind: "dot", at: v3(p.x, p.y, 12), r: 0.6, color: "amber" }); }
}

/** Plan (x, y) box of the machine: union of the `bounds` of its solids and of the wheel at any angle (axle ± (r + depth)·√½). */
export function excavatorBox(): Box {
  const out: Solid[] = []; excavator(out, []);
  const ax = local(EXCAVATOR.axleDx, 0), { r, buckets } = EXCAVATOR.wheel, R = (r + buckets.depth) * Math.SQRT1_2;
  const box: Box = { x0: ax.x - R, y0: ax.y - R, x1: ax.x + R, y1: ax.y + R };
  for (const s of out) { const b = bounds(s); box.x0 = Math.min(box.x0, b.min.x); box.y0 = Math.min(box.y0, b.min.y); box.x1 = Math.max(box.x1, b.max.x); box.y1 = Math.max(box.y1, b.max.y); }
  return box;
}
