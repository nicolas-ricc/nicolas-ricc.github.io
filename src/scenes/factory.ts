import type { Accent } from "../iso/accent";
import { v3, type Vec2, type Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import type { Rng } from "../map/seed";
import { WORLD } from "../map/geo";
import { boilerHouse, HALL } from "./boiler-house";
import { EXCAVATOR, excavator, excavatorBox, local } from "./excavator";
import { jungle } from "./flora";
import { MALT, maltings, waterTower } from "./maltings";
import { towerCrane } from "./pieces";
import { PLANT_SHIFT, emitPlant } from "./plant-frame";
import { TRAIN_CLEAR } from "./station";
import { SUBSTATION, substation } from "./substation";

/**
 * Portfolio factory, where the shipyard sheds used to stand (region x 4..98.7, y −4..99). The plant
 * (Mistley's maltings, x 5..29, y 44..74; the boiler hall of the Fábrica de Luz, x 29..92, y 44..74, with its
 * stair tower at x 93..98; the water tower on legs at (15, 32)), the truck yard and its lamps are
 * built in the local frame and moved with `PLANT_SHIFT` from `plant-frame.ts`: the truck yard and the lamps
 * sit at y 76..89, with the inclined belt running down to it from the hopper (y 74..76). North of the plant,
 * three smoking chimneys (at (58, 32), (72, 26) and (86, 32)), the cooling tower at (40, 14) and the outdoor
 * substation (`substation.ts`, x 54..95, y −2..11). Gone are the long belt, the `SPUR_Y` spur, the spur
 * set into the street, the flatcars and the hall→slipway rails.
 * The north band (`x > 0, y −60..−4`) keeps the rail siding, the tower crane and, behind the factory, the assembly
 * halls, the workshops and the shipyard's material yard (`shipyard.ts`). West column `x ≤ 0` (`x -60..0,
 * y 0..146`), as before: rail yard, bucket-wheel excavator and ore piles, jungle to the south
 * and the lamp at (−30, 20). The terrain is `slab`.
 * Spec: docs/superpowers/specs/2026-09-14-mundo-2-fabrica-distrito-blog-design.md §5.
 * Plant, chimney, substation and excavator detail: docs/superpowers/specs/2026-10-24-fabrica-detalle-design.md.
 * Move: docs/superpowers/specs/2026-10-27-fabrica-mudanza-design.md.
 */
export interface FactoryScene { ground: Solid[]; solids: Solid[]; accents: Accent[]; stacks: Vec3[]; excavator: Solid[] }

export const PLANT = { x: MALT.x, y: MALT.y, w: MALT.w + HALL.w, d: 30, h: 14 } as const;
export { MALT };
export const STACKS = [{ x: 58, y: 32, r: 2.8, h: 22 }, { x: 72, y: 26, r: 2.6, h: 26 }, { x: 86, y: 32, r: 2.4, h: 24 }] as const;
export const STACK_BASE_H = 3;
const DECK_H = 0.3; // slab of the chimney platform
export const SIDING_Y = -8;
export const RAIL_YARD_X = [-56, -48, -40] as const; // N-S tracks of the yard; the piles go east of them
export const COOLING = { x: 40, y: 14, r: 9 } as const; // cooling tower: north of the hall's old spot, x 31..49, y 5..23
const LAMP_H = 5;

const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Material): Solid => ({ kind: "prism", at: v3(x, y, z), w, d, h, mat });
const strip = (path: Vec2[], width: number, z: number, mat: Material): Solid => ({ kind: "strip", path, width, z, mat });

function lamp(out: Solid[], accents: Accent[], x: number, y: number): void {
  out.push(prism(x, y, 0, 0.6, 0.6, LAMP_H, "steel"));
  accents.push({ kind: "dot", at: v3(x + 0.3, y + 0.3, LAMP_H), r: 1.2, color: "cyan" });
}

function plant(out: Solid[]): void {
  maltings(out);
  waterTower(out);
  boilerHouse(out);
  const localE = PLANT.x + PLANT.w - PLANT_SHIFT.x;
  emitPlant(out, (o) => o.push(prism(localE - 0.2, -23, 0, 0.5, 6, 8, "concrete"))); // east gate
}

export type Stack = (typeof STACKS)[number];

/** Emits a detailed chimney into `out`/`accents` and returns its mouth. */
export function chimney(s: Stack, out: Solid[], accents: Accent[]): Vec3 {
  const B = STACK_BASE_H, M = B + s.h;
  const cyl = (z: number, r: number, h: number, mat: Material): Solid => ({ kind: "cylinder", at: v3(s.x, s.y, z), r, h, mat });
  out.push(prism(s.x - 3.5, s.y - 3.5, 0, 7, 7, B, "concrete"));
  out.push(cyl(B, s.r + 1.0, 1.5, "brick"), cyl(B + 1.5, s.r + 0.6, 1.5, "brick")); // stepped base
  const z0 = B + 3, z1 = M - 0.6, half = (z1 - z0) / 2, seg = half / 4;
  const radii = [0.5, (0.5 * 2) / 3, 0.5 / 3, 0].map((d) => s.r + d);              // lower half: tapers down to r
  radii.forEach((r, i) => out.push(cyl(z0 + i * seg, r, seg, "brick")));
  for (let k = 0; k < 3; k++) out.push(cyl(z0 + (k + 1) * seg - 0.2, radii[k]! + 0.1, 0.2, "steel")); // hoops at the top joint of each section: with the center over the section's, painter order draws them afterwards
  const bh = (half - DECK_H) / 7, dz = z0 + half + 6 * bh;                            // the platform fills the joint between the 6th and 7th band: nothing on the shaft shares its z and painter order has no tie
  for (let i = 0; i < 7; i++) out.push(cyl(z0 + half + i * bh + (i === 6 ? DECK_H : 0), s.r, bh, i % 2 === 0 ? "signal" : "whitewash"));
  out.push(cyl(dz, s.r + 1.2, DECK_H, "concrete"));                                   // platform
  const pTop = dz + DECK_H;
  const pr = (cx: number, cy: number, z: number, h: number): Solid => prism(cx - 0.075, cy - 0.075, z, 0.15, 0.15, h, "steel");
  const pRad = (s.r + 1.2) * Math.cos(Math.PI / 8) - 0.15;            // posts at the middle of each octagon face, inset 0.15
  const post = (k: number) => v3(s.x + pRad * Math.cos((k * Math.PI) / 4), s.y + pRad * Math.sin((k * Math.PI) / 4), pTop);
  for (let k = 0; k < 8; k++) {
    const p = post(k), q = post((k + 1) % 8);
    out.push(pr(p.x, p.y, pTop, 1.1));
    out.push({ kind: "beam", from: v3(p.x, p.y, pTop + 1.025), to: v3(q.x, q.y, pTop + 1.025), w: 0.15, h: 0.15, mat: "steel" }); // handrail
  }
  out.push(cyl(M - 0.6, s.r + 0.4, 0.6, "brick"));                                    // crown
  for (const [dx, dy] of [[1, 0], [0, 1], [0, -1], [-1, 0]] as const) out.push(pr(s.x + dx * (s.r + 0.1), s.y + dy * (s.r + 0.1), M, 1.5)); // lightning rods
  const ly = s.y + (s.r + 1.2) * Math.cos(Math.PI / 8) + 0.2;                         // ladder to the south, outside the platform: separated in y from bands and slab, painter order has no tie
  for (const dx of [-0.35, 0.35]) out.push(pr(s.x + dx, ly, z0, pTop + 1.1 - z0));
  for (let z = z0 + 2; z < pTop + 1.1; z += 2) out.push({ kind: "beam", from: v3(s.x - 0.35, ly, z), to: v3(s.x + 0.35, ly, z), w: 0.15, h: 0.15, mat: "steel" }); // rungs
  accents.push({ kind: "dot", at: v3(s.x + s.r, s.y, M - 1), r: 0.5, color: "magenta" }, { kind: "dot", at: v3(s.x, s.y + s.r, M - 1), r: 0.5, color: "magenta" });
  out.push(prism(s.x - 0.45, s.y + 3.5, 0, 0.9, 0.3, 1.4, "steel"));                  // door on the south face of the pedestal
  return v3(s.x, s.y, M);
}

function chimneys(out: Solid[], accents: Accent[]): Vec3[] {
  return STACKS.map((s) => chimney(s, out, accents));
}

function coolingTower(out: Solid[]): void {
  let z = 0;
  for (const r of [COOLING.r, 8, 7, 7.5]) { out.push({ kind: "cylinder", at: v3(COOLING.x, COOLING.y, z), r, h: 4, mat: "concrete", sides: 12 }); z += 4; }
}

function siding(out: Solid[]): void {
  for (const dy of [-0.8, 0.8]) out.push(strip([{ x: WORLD.x0, y: SIDING_Y + dy }, { x: 110, y: SIDING_Y + dy }], 0.4, 0.1, "steel"));
  for (let i = 0; i < 6; i++) out.push(prism(-50 + i * 9, SIDING_Y - 1.2, 0, 8, 2.4, 3, i % 2 === 0 ? "rust" : "steel")); // wagons with a 1 u gap
  out.push(prism(6, SIDING_Y - 1.3, 0, 9, 2.6, 3.6, "steel"), prism(12, SIDING_Y - 1.3, 3.6, 3, 2.6, 1, "steel"));      // locomotive and cab
}

function truckYard(out: Solid[], accents: Accent[]): void {
  emitPlant(out, (o, a) => {
    for (const [x, y] of [[40, -12], [70, -6], [95, -12]] as const) { o.push(prism(x, y, 0, 6, 2.4, 2.8, "rust")); o.push(prism(x + 6, y, 0, 2, 2.4, 2.2, "steel")); } // box and cab
    for (let i = 0; i < 6; i++) o.push(prism(22 + i * 4, -3, 0, 3, 2, 0.5 + (i % 3) * 0.4, "steel")); // sheet-metal pallets by the west gate
    for (const [x, y] of [[20, -14], [110, -3]] as const) lamp(o, a, x, y);
  }, accents);
}

/** West column: three N-S tracks that join the shipyard's west tracks, the excavator (in `machine`: drawn separately, in its own frame), ore piles east of them, jungle to the south. */
function railYard(out: Solid[], machine: Solid[], accents: Accent[], rng: Rng): void {
  for (const x of RAIL_YARD_X) for (const dx of [-0.8, 0.8]) out.push(strip([{ x: x + dx, y: WORLD.y0 }, { x: x + dx, y: 128 }], 0.4, 0.1, "steel"));
  for (const dy of [-0.8, 0.8]) out.push(strip([{ x: -40 + dy, y: 128 }, { x: -30, y: 132.5 + dy }, { x: 2, y: 132.5 + dy }], 0.4, 0.1, "steel")); // junction
  excavator(machine, accents);
  const axle = local(EXCAVATOR.axleDx, 0);
  out.push({ kind: "cone", at: v3(axle.x, axle.y, 0), r: EXCAVATOR.pile.r, h: EXCAVATOR.pile.h, mat: "rust", sides: 7 }); // fixed pile under the wheel
  const box = excavatorBox();
  for (let i = 0; i < 5; i++) {
    const big = i < 3;
    for (let tries = 0; ; tries++) {
      if (tries >= 1000) throw new Error("railYard: no room for a pile outside the excavator");
      const x = rng.int(-25, -13), y = rng.int(44, 96), r = big ? rng.int(6, 9) : 5, h = big ? rng.int(4, 6) : 3;
      if (x + r > box.x0 - 1 && x - r < box.x1 + 1 && y + r > box.y0 - 1 && y - r < box.y1 + 1) continue; // touches the box inflated by 1: the whole draw is repeated
      out.push({ kind: "cone", at: v3(x, y, 0), r, h, mat: big ? "rust" : "sand", sides: 7 });
      break;
    }
  }
  for (let i = 0; i < 8; i++) out.push(prism(RAIL_YARD_X[i % 3]! - 1.1, -46 + i * 14, 0, 2.2, 7, 2.8, i % 2 === 0 ? "rust" : "steel")); // wagons parked N-S on the tracks; -46: the third ends at y -11, not touching the E-W siding (y -9.2..-6.8)
  jungle(out, rng, { x0: -58, x1: -6, y0: 110, y1: 140 }, 14, 0.4, { y: [128, 131, 134], train: TRAIN_CLEAR }); // y1 140: a cone of r 4 cannot cross the seam y = 146; no cone covers the junction or the west tracks
}

function lamps(out: Solid[], accents: Accent[]): void {
  emitPlant(out, (o, a) => { for (const [x, y] of [[24, -13], [64, -13], [50, -13.5]] as const) lamp(o, a, x, y); }, accents); // the plant's three, in the local frame
  // the fourth lamp is the substation's: SW corner of the fence
  for (const [x, y] of [[SUBSTATION.x0 - 1, SUBSTATION.y1 + 1], [-30, 20]] as const) lamp(out, accents, x, y);
}

export function factory(rng: Rng): FactoryScene {
  const solids: Solid[] = [], accents: Accent[] = [];
  plant(solids);
  const stacks = chimneys(solids, accents);
  coolingTower(solids);
  towerCrane(solids, accents, { at: { x: 60, y: -12 }, mastH: 20, jibLen: 30, dir: "e", light: "cyan" });
  siding(solids);
  substation(solids);
  truckYard(solids, accents);
  const machine: Solid[] = [];
  railYard(solids, machine, accents, rng);
  lamps(solids, accents);
  return { ground: solids.filter((s) => s.kind === "strip"), solids: solids.filter((s) => s.kind !== "strip"), accents, stacks, excavator: machine };
}
