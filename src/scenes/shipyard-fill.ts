import type { Accent } from "../iso/accent";
import { v3, type Vec3 } from "../iso/geometry";
import { isBehind, overlaps, screenBounds } from "../iso/depth";
import { bounds, type Bounds, type Solid } from "../iso/solids";
import { coils, hullSections, pipeBundle, sheetStack, stackContainers, storeroom } from "../kit/forms/industrial";
import { STYLES } from "../kit/styles";
import type { Rng } from "../map/seed";
import { towerCrane } from "./pieces";

/** Fill of the shipyard: one list of pieces per function; the pieces are the same objects pushed to `out` (rails go to the ground). */
export interface Fill { yard: Solid[][]; dock: Solid[][]; service: Solid[][] }

export const YARD = { x0: 104, y0: -59, x1: 192, y1: -36 };
export const SERVICE = { x0: 112, y0: 76.5, x1: 196, y1: 79.5, skip: [147, 156] as [number, number] };

const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Solid["mat"]): Solid => ({ kind: "prism", at: v3(x, y, z), w, d, h, mat });

type Plan = { x0: number; y0: number; x1: number; y1: number };
const planOf = (ss: Solid[]): Plan => {
  const bs = ss.map(bounds);
  return { x0: Math.min(...bs.map((b) => b.min.x)), y0: Math.min(...bs.map((b) => b.min.y)), x1: Math.max(...bs.map((b) => b.max.x)), y1: Math.max(...bs.map((b) => b.max.y)) };
};

/** Rejection placement of a `fw`×`fd` footprint in `area`, 0.5 clear of `taken`; 30 tries (x, then y if the area is deeper than the footprint, from `rng.next()`), `ok` may veto. Records the footprint in `taken`. */
function place(taken: Plan[], area: Plan, fw: number, fd: number, rng: Rng, ok: (x: number, y: number) => boolean = () => true, scan = false): { x: number; y: number } | null {
  for (let t = 0; t < 30; t++) {
    const x = area.x0 + rng.next() * (area.x1 - area.x0 - fw), y = area.y1 - area.y0 > fd + 1e-9 ? area.y0 + rng.next() * (area.y1 - area.y0 - fd) : area.y0; // an area no deeper than the footprint draws no y
    if (taken.some((q) => x - 0.5 < q.x1 && q.x0 - 0.5 < x + fw && y - 0.5 < q.y1 && q.y0 - 0.5 < y + fd) || !ok(x, y)) continue;
    taken.push({ x0: x, y0: y, x1: x + fw, y1: y + fd });
    return { x, y };
  }
  if (!scan) return null;
  for (let x = area.x0; x <= area.x1 - fw; x += 0.5) { // a tight strip: first fit from the west, no rng
    if (taken.some((q) => x - 0.5 < q.x1 && q.x0 - 0.5 < x + fw && area.y0 - 0.5 < q.y1 && q.y0 - 0.5 < area.y0 + fd) || !ok(x, area.y0)) continue;
    taken.push({ x0: x, y0: area.y0, x1: x + fw, y1: area.y0 + fd });
    return { x, y: area.y0 };
  }
  return null;
}

/** Gantry over the yard, at x 149 (the old hull sections start at x 150): rails y −59.5 and −35.5, legs 1×1×9 beam 1×24×1 at z 9, trolley at z 8. */
function yardGantry(out: Solid[]): Solid[] {
  const rail = (y: number): Solid => ({ kind: "strip", path: [{ x: YARD.x0, y }, { x: YARD.x1, y }], width: 0.5, z: 0.05, mat: "rail" });
  const piece = [
    rail(-59.5), rail(-35.5),
    prism(149, -59.5, 0, 1, 1, 9, "steel"), prism(149, -36.5, 0, 1, 1, 9, "steel"),
    prism(149, -59.5, 9, 1, 24, 1, "steel"),
    prism(148.5, -48.5, 8, 2, 2, 1, "rust"),
  ];
  out.push(...piece);
  return piece;
}

/** Up to 5 stock groups placed by rejection inside `YARD`, 0.5 clear of everything already in `out`; 30 tries each, then give up. */
export function yardFill(out: Solid[], rng: Rng): Solid[][] {
  const pieces = [yardGantry(out)];
  const makers: ((at: Vec3) => Solid[])[] = [];
  for (let i = rng.int(3, 5); i > 0; i--) {
    const sheets = rng.int(2, 4), len = rng.int(8, 14), n = rng.int(2, 4), m = rng.int(1, 2); // each maker draws its size once
    makers.push(rng.pick<(at: Vec3) => Solid[]>([(a) => sheetStack(a, sheets), (a) => pipeBundle(a, len), (a) => coils(a, n), (a) => hullSections(a, m)]));
  }
  const taken: Plan[] = out.map((s) => planOf([s]));
  for (const build of makers) {
    const p = planOf(build(v3(0, 0, 0))), fw = p.x1 - p.x0, fd = p.y1 - p.y0;
    const at = place(taken, YARD, fw, fd, rng);
    if (!at) continue;
    const group = build(v3(at.x - p.x0, at.y - p.y0, 0));
    out.push(...group);
    pieces.push(group);
  }
  return pieces;
}

/** Scaffolding row along the dock: 7 steel posts 0.4×0.4 every 8 from x 128, z −6..0.5, and 6 deck planks 8×0.6×0.2 at z 0 on the pit side of the posts. */
function scaffold(postY: number, plankY: number): Solid[] {
  const xs = [0, 1, 2, 3, 4, 5, 6].map((i) => 128 + 8 * i);
  return [...xs.map((x) => prism(x, postY, -6, 0.4, 0.4, 6.5, "steel")), ...xs.slice(0, -1).map((x) => prism(x, plankY, 0, 8, 0.6, 0.2, "deck"))];
}

/** Dry dock works: scaffolding rows (north y 8.5, south y 27), tower cranes at (116, 5) and (116, 31) with a cyan light, and two site containers on the slab north of the dock. */
export function dockWorks(out: Solid[], accents: Accent[], rng: Rng): Solid[][] {
  const pieces = [scaffold(8.5, 8.9), scaffold(27, 26.4)];
  for (const y of [5, 31]) {
    const crane: Solid[] = [];
    towerCrane(crane, accents, { at: { x: 116, y }, mastH: 14, jibLen: 12, dir: "e", light: "cyan" });
    pieces.push(crane);
  }
  for (const x of [124, 132]) pieces.push(stackContainers(v3(x, 2.5, 0), 1, "x", rng));
  out.push(...pieces.flat());
  return pieces;
}

/** Service strip between the slipways and the station: up to 12 pieces (2 storerooms, 2 forklifts, 3 pallet stacks, 3 toilets, 2 tool containers) placed by rejection at y 76.5, never across `SERVICE.skip`. */
export function serviceStrip(out: Solid[], rng: Rng): Solid[][] {
  const pallets = (x: number, y: number) => Array.from({ length: rng.int(1, 4) }, (_, k) => prism(x, y, k * 0.5, 1.2, 1, 0.5, "deck"));
  const items: { fw: number; fd: number; fh: number; build: (x: number, y: number) => Solid[] }[] = [
    ...[0, 1].map(() => ({ fw: 4, fd: 3, fh: 2.6, build: (x: number, y: number) => storeroom({ x, y, w: 4, d: 3, z: 0, open: ["s"], maxH: 3 }, rng, STYLES.industrial).solids })),
    ...[0, 1].map(() => ({ fw: 2, fd: 3, fh: 2, build: (x: number, y: number) => [prism(x, y, 0, 2, 3, 2, "rust")] })),
    ...[0, 1, 2].map(() => ({ fw: 1.2, fd: 1, fh: 2, build: pallets })),
    ...[0, 1, 2].map(() => ({ fw: 1, fd: 1, fh: 2.2, build: (x: number, y: number) => [prism(x, y, 0, 1, 1, 2.2, "boxBlue")] })),
    ...[0, 1].map(() => ({ fw: 6, fd: 2.4, fh: 2.6, build: (x: number, y: number) => stackContainers(v3(x, y, 0), 1, "x", rng) })),
  ];
  const taken: Plan[] = out.map((s) => planOf([s]));
  // gantry legs (steel, x 150, 24 high): the strip must not hide them on screen
  const legs = out.filter((s) => s.kind === "prism" && s.mat === "steel" && s.at.x === 150 && s.h === 24).map(bounds);
  const hides = (b: Bounds) => legs.some((l) => overlaps(screenBounds(l), screenBounds(b)) && isBehind(l, b));
  const pieces: Solid[][] = [];
  for (const { fw, fd, fh, build } of items) {
    const ok = (x: number, y: number) => (x + fw <= SERVICE.skip[0] || x >= SERVICE.skip[1]) && !hides({ min: v3(x, y, 0), max: v3(x + fw, y + fd, fh) });
    const at = place(taken, { x0: SERVICE.x0, y0: SERVICE.y0, x1: SERVICE.x1, y1: SERVICE.y0 + fd }, fw, fd, rng, ok, true);
    if (!at) continue;
    const piece = build(at.x, at.y);
    out.push(...piece);
    pieces.push(piece);
  }
  return pieces;
}
