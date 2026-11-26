import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import { shadowPolygon } from "../iso/light";
import { Z_SCALE } from "../iso/project";
import { campus } from "../kit/forms/modern";
import { recipe } from "../kit";
import { quayCraneAt } from "../kit/forms/industrial";
import type { SignSpec } from "../kit/legibility";
import { lamp, place } from "../kit/props";
import { STYLES } from "../kit/styles";
import type { Solid } from "../iso/solids";
import { MOUTH_Y, QUAY_X, type WorldZone } from "../map/geo";
import type { Material } from "../map/palette-iso";
import { createRng, SEED } from "../map/seed";
import type { Animator } from "../scenes/animator";
import { BLOCK_W, BRIDGE, COLLAPSED, EAST_COLS, PROMENADE, SIDEWALK, WEST_COLS } from "../scenes/city-grid";
import { HOTEL_LOT, PLAN_BOUNDS, PLAZA_MAYOR, parcels } from "../scenes/city-plan";
import { STAIR_TOWER } from "../scenes/boiler-house";
import { excavator, excavatorBox, excavatorWheel } from "../scenes/excavator";
import { COOLING as FACTORY_COOLING, PLANT, RAIL_YARD_X, STACK_BASE_H, STACKS } from "../scenes/factory";
import { waterTower } from "../scenes/maltings";
import { PUFF_LIFT, PUFF_RANGE } from "../scenes/factory-anim";
import { ARCADE, BUMPER, CAROUSEL, COASTER, DROP, PIER, WHEEL } from "../scenes/fair";
import { jungle } from "../scenes/flora";
import { CONTAINER_YARD, COOLING, POWER, PYLON_H, PYLON_N, PYLON_STEP, PYLON_X0, PYLON_Y, SILOS, STACKS_N, TANKS } from "../scenes/hinterland";
import { towerCrane } from "../scenes/pieces";
import { pieceTrain, trainPieceAnimator } from "../scenes/rail-animator";
import { BUOYS, DRUM_R0, KEEPER, LANTERN_Z, LIGHTHOUSE, WRECK } from "../scenes/sea";
import { BEAM_LEN } from "../scenes/sea-anim";
import { ship, shipAt, type ShipKind } from "../scenes/ships";
import { HOTEL_SLAB, hotelSign, hotelStandIn, RESUME_SIGN } from "../scenes/sign-hotel";
import { BLOG_SIGNS, seaPlatform, type WritingSite } from "../scenes/sign-platform";
import { hallStandIn, PIECE_AT, STAND_IN_HALL, TINKER_SIGN, tinkerAnimator, tinkerSign } from "../scenes/sign-tinker";
import { southParcels } from "../scenes/sprawl-grid";
import { SUBSTATION } from "../scenes/substation";
import { ARENA, AUDITORIUM } from "../scenes/tech";
import { CLUB, PLAZAS, SCHOOL } from "../scenes/tech-zoning";
import { TELECOM_CELL } from "../city/zoning";
import type { Box } from "../world/frame";

export type GroupId = "factory" | "shipyard" | "hinterland" | "fair" | "city" | "tech" | "sea";

/** Index groups, in order: the table of spec §3. */
export const GROUPS: readonly { id: GroupId; zone: WorldZone; title: string }[] = [
  { id: "factory", zone: "portfolio", title: "Portfolio: factory" },
  { id: "shipyard", zone: "portfolio", title: "Portfolio: shipyard" },
  { id: "hinterland", zone: "portfolio", title: "Portfolio: hinterland" },
  { id: "fair", zone: "portfolio", title: "Portfolio: fair" },
  { id: "city", zone: "cv", title: "Resume: city" },
  { id: "tech", zone: "cv", title: "Resume: tech district" },
  { id: "sea", zone: "blog", title: "Blog: sea" },
];

/** A structure to look at on its own: a box over the real world, a relocatable piece built at the origin (with optional `pad`: the ground material under it, and optional `animate`: its animator, which the storybook tags with the exhibit's zone), or a context exhibit: a crop of the real world (the sign is already in it, so it has no `build` or `animate`; with `writingSite`, the Writing platform of that site is added to the crop, since the world no longer carries it: see `contextScene`); `sign` is what the level-2 oracle checks. */
export type Exhibit = { id: string; title: string; zone: WorldZone; group: GroupId } & (
  | { kind: "region"; box: Box; h?: number }
  | { kind: "piece"; build: (out: Solid[], accents: Accent[]) => void; pad?: Material; animate?: (opts: { reducedMotion: boolean }) => Animator }
  | { kind: "context"; box: Box; h?: number; sign: SignSpec; writingSite?: WritingSite }
);

export type ContextExhibit = Extract<Exhibit, { kind: "context" }>;

const M = 3; // margin: sidewalks, street lamps and short shadows
/** Box of the south parcel of a city-plan cell, with the margin. */
const cellBox = (c: { col: number; row: number }) => { const { x, y, w, d } = southParcels().find((p) => p.cell.col === c.col && p.cell.row === c.row)!.rect; return { x0: x - M, y0: y - M, x1: x + w + M, y1: y + d + M }; };
/** Plan parcel (−77, 201): a `moderno` parcel of the west, rectangular (`d` 227); the piece below rebuilds its tower alone on the lot. */
const TOWER_PARCEL = parcels(PLAN_BOUNDS).find((q) => q.cell.col === -77 && q.cell.row === 201)!.rect;

/** Rect ± M of the largest city parcel of a grid cell, for the region exhibits that frame one parcel. */
const parcelBox = (col: number, row: number): Box => {
  const r = parcels(PLAN_BOUNDS).filter((q) => q.cell.col === col && q.cell.row === row).sort((a, b) => b.area - a.area)[0]!.rect;
  return { x0: r.x - M, y0: r.y - M, x1: r.x + r.w + M, y1: r.y + r.d + M };
};
const union = (a: Box, b: Box): Box => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });

const stacksX = STACKS.map((s) => s.x), stacksY = STACKS.map((s) => s.y), stackR = Math.max(...STACKS.map((s) => s.r));
const tanksX = TANKS.map((t) => t.x), tanksY = TANKS.map((t) => t.y);
const stackTop = Math.max(...STACKS.map((s) => s.h)) + STACK_BASE_H;
const buoysX = BUOYS.map((b) => b.x), buoysY = BUOYS.map((b) => b.y);

// excavator: its plan box plus the cast shadow of each solid (wheel included)
const excavatorExtent = ((): Box => {
  const out: Solid[] = []; excavator(out, []); out.push(excavatorWheel(0));
  const b = { ...excavatorBox() };
  for (const s of out) for (const p of shadowPolygon(s) ?? []) { b.x0 = Math.min(b.x0, p.x); b.y0 = Math.min(b.y0, p.y); b.x1 = Math.max(b.x1, p.x); b.y1 = Math.max(b.y1, p.y); }
  return b;
})();

// a ship with the midpoint of the unit (pusher included) at the origin, afloat on water
const vessel = (kind: ShipKind) => (out: Solid[], accents: Accent[]): void => {
  const { solids, lights } = ship(kind, shipAt(kind, { x: 0, y: 0 }, 0), 0);
  out.push(...solids); accents.push(...lights);
};

export const EXHIBITS: readonly Exhibit[] = [
  // {2, 41, 98, 76}: x1 = east edge of the stair tower (STAIR_TOWER.x1); plinth and hopper inside; street lamps and trucks outside, the lamp at (5, 76) included: it touches the south edge (y1 76) and the strict crop leaves it out; chimneys (y ≤ 36.05) and tank (y ≤ 36.8, with the stairs) outside to the north; h 26: apex of the malting kiln
  { id: "planta", title: "Boiler house and malting", zone: "portfolio", group: "factory", kind: "region",
    box: { x0: PLANT.x - M, y0: PLANT.y - M, x1: STAIR_TOWER.x1, y1: PLANT.y + PLANT.d + 2 }, h: 26 },
  // the tank (WATER_TOWER, north of the malting) is outside the plant box: alone, you can see legs, bracing, stairs and walkway
  { id: "tanque-agua", title: "Water tank", zone: "portfolio", group: "factory", kind: "piece", pad: "slab", build: (out) => waterTower(out, { x: 0, y: 0 }) },
  // the smoke drifts NNE up to PUFF_RANGE: the box stretches north so as not to cut the column
  // the smoke drifts 0.45·PUFF_RANGE ≈ 12.6 east (hence the 13); the platform juts out r + 1.2 to the south; the substation and its lamp are inside, behind
  { id: "chimeneas", title: "Chimneys and cooling tower", zone: "portfolio", group: "factory", kind: "region",
    box: { x0: FACTORY_COOLING.x - FACTORY_COOLING.r - M, y0: Math.min(...stacksY) - stackR - PUFF_RANGE, x1: Math.max(...stacksX) + stackR + M + 13, y1: Math.max(...stacksY) + stackR + 1.2 + M },
    h: stackTop + PUFF_RANGE * PUFF_LIFT },
  // SUBSTATION fence plus margin (3, and 1 to the south): {51, −5, 98, 12}; it does not touch the siding wagons (y ≤ −6.8) nor cross x 99 (`calle-faroles`). h 13: the masts reach z 12; the smoke passes above.
  { id: "subestacion", title: "Substation", zone: "portfolio", group: "factory", kind: "region", box: { x0: SUBSTATION.x0 - 3, y0: SUBSTATION.y0 - 3, x1: SUBSTATION.x1 + 3, y1: SUBSTATION.y1 + 1 }, h: 13 },
  // by hand {2, 76, 98, 92}: trucks and pallets of truckYard; the hopper (z 13.5) crosses the north edge; the tallest trestle inside reaches 8.3; the crane is gone
  { id: "playa-camiones", title: "Truck yard", zone: "portfolio", group: "factory", kind: "region", box: { x0: 2, y0: 76, x1: 98, y1: 92 }, h: 16 },
  { id: "playa-vias", title: "Rail yard", zone: "portfolio", group: "factory", kind: "region",
    box: { x0: RAIL_YARD_X[0] - 4, y0: 28, x1: -4, y1: 90 }, h: 21 }, // by hand in y: the ore stockpiles (rng, x −25..−13, centres y 38..78, r ≤ 9, private in factory.ts) with tracks and wagons; h covers the excavator (≈20.3)
  // x1 capped at 4, west edge of the new region: the shadow falls ENE over the shipyard
  { id: "excavadora", title: "Bucket-wheel excavator", zone: "portfolio", group: "factory", kind: "region",
    box: { x0: excavatorExtent.x0 - M, y0: excavatorExtent.y0 - M, x1: Math.min(excavatorExtent.x1 + M, 4), y1: excavatorExtent.y1 + M }, h: 21 }, // box + shadows; h covers the machine (≈20.3), which is an animated layer
  // the constants of shipyard.ts are private: boxes by hand
  // slipways x 110..QUAY_X, y 36..72; the gantry (x 150) straddles them and stays inside
  { id: "gradas", title: "Slipways", zone: "portfolio", group: "shipyard", kind: "region", box: { x0: 108, y0: 33, x1: QUAY_X + 2, y1: 75 }, h: 28 },
  // the water between the quay and the breakwater, from the river mouth; no ships since #87 (the lanes start at the river mouth); h 2 since #323 (inside and neighbor 1.5, no accents), the box ends at y 72 where the floating dock begins
  { id: "darsena", title: "Basin", zone: "portfolio", group: "shipyard", kind: "region", box: { x0: QUAY_X - 2, y0: MOUTH_Y, x1: 275, y1: 72 }, h: 2 },
  { id: "grua-portico", title: "Gantry crane", zone: "portfolio", group: "shipyard", kind: "region", box: { x0: 146, y0: 30, x1: 156, y1: 78 }, h: 28 },
  // transfer street x 100..108 with the lamps at 108.5; west of the slipways (x ≥ 110)
  { id: "calle-faroles", title: "Lamp street", zone: "portfolio", group: "shipyard", kind: "region", box: { x0: 99, y0: 8, x1: 111, y1: 128 }, h: 14 }, // #324: the counter-jib and counterweight of the y 31 tower crane (x 108..116, top z 13.8–14) reach into x ≤ 111
  // the two assembly halls: x 10..100, rows y −52 and −32 of 16; y1 −14 leaves out the crane counterweight (y −13..−11, z 18.5..20) and x1 102 the yard (x ≥ 104)
  // h 32: the tinker sign (#392) tops out at z ≈ 31.76 (its top beam, cut by the box); smallest integer that passes framing and neighbors
  { id: "naves", title: "Assembly halls", zone: "portfolio", group: "shipyard", kind: "region", box: { x0: 7, y0: -55, x1: 102, y1: -14 }, h: 32 },
  // the island's north coast facing the sheds: x 270..350, y 0..60; h is the smallest integer that passes framing and neighbors (measured with the `measure` of exhibits.test.ts): 18 since #323, set by the mast of the quay crane at y 34 (z 17.5; the one at y 62 is outside) and the stacks it now crops (inside 18, accents 0 since #402)
  { id: "punta-norte", title: "North point of the island", zone: "portfolio", group: "shipyard", kind: "region", box: { x0: 270, y0: 0, x1: 350, y1: 60 }, h: 18 },
  // the terminal station: x 108..198, y 98..143; h measured as in punta-norte: set by the top of the clock tower, z 29 (the station emits no smoke)
  { id: "estacion", title: "Terminal station", zone: "portfolio", group: "shipyard", kind: "region", box: { x0: 108, y0: 98, x1: 198, y1: 143 }, h: 29 },
  // the level crossing: x 95..112, y 124..142; x0 95 (not 98) so the entry signal (pole at x 96.1..96.4) is inside: without that `cropAnimators` drops the train animator at ms 0; h measured the same way: set by the street lamp at (108.5, 124), at z 5 (the crossing posts reach z 3 and the entry signal 4.7; the exit one is outside)
  { id: "paso-a-nivel", title: "Level crossing", zone: "portfolio", group: "shipyard", kind: "region", box: { x0: 95, y0: 124, x1: 112, y1: 142 }, h: 5 },
  // the floating dock in the river: x 204..246, y 74..88, with its gangway to the quay at x 202; h measured as in punta-norte: set by the lamp posts on the service towers (inside 14.3, accents 13.15), so h 15
  { id: "dique-flotante", title: "Floating dock", zone: "portfolio", group: "shipyard", kind: "region", box: { x0: 202, y0: 72, x1: 248, y1: 90 }, h: 15 },
  // the east bank container yard: x 288..304, y 30..84, with the two quay cranes (x 280.6..287.4) inside; h measured as in punta-norte: set by the quay cranes (inside 17.5, accents 0.48 since #402), so h 18
  { id: "patio-contenedores", title: "Container yard (east bank)", zone: "portfolio", group: "shipyard", kind: "region", box: { x0: 278, y0: 27, x1: 305, y1: 84 }, h: 18 },
  // the quay crane facing west, centered at the origin, nothing above z 17.5 (the mast head); no accents, since the tip light went in #402
  { id: "grua-muelle", title: "Quay crane", zone: "portfolio", group: "shipyard", kind: "piece", pad: "concrete",
    build: (out, accents) => quayCraneAt({ x: 0, y: 0 }, "w", out, accents, { light: false }) },
  // jib 24 to the east and counter-jib 8 to the west: with the mast at x −8 it spans −16..16
  { id: "grua-torre", title: "Tower crane", zone: "portfolio", group: "shipyard", kind: "piece",
    build: (out, accents) => towerCrane(out, accents, { at: { x: -8, y: 0 }, mastH: 20, jibLen: 24, dir: "e", light: "amber" }) },
  { id: "farol", title: "Street lamp", zone: "portfolio", group: "shipyard", kind: "piece", build: (out, accents) => place(out, accents, lamp(v3(-0.3, -0.3, 0))) },
  // the 4-car EMU centered at the origin: `build` puts only the solids; the lights (saloon, sign, headlights and red ones) come from the `tren.lights` layer of its animator, which flips the head every 4 s
  { id: "tren", title: "Mitre EMU train", zone: "portfolio", group: "shipyard", kind: "piece", pad: "paving",
    build: (out) => { out.push(...pieceTrain("e").solids); },
    animate: trainPieceAnimator },
  { id: "cartel-taller", title: "Portfolio tinker sign", zone: "portfolio", group: "shipyard", kind: "piece", pad: "concrete",
    build: (out, accents) => { hallStandIn(out); tinkerSign(out, accents, PIECE_AT, [STAND_IN_HALL]); },
    animate: (o) => tinkerAnimator({ ...o, at: PIECE_AT }) },
  // h 32: the sign's top beam reaches z ≈ 31.76, smallest integer that passes framing and neighbors; the sign and its animator come from the world (shipyard() and assembleWorld, #392): no build, no animate
  { id: "cartel-taller-escena", title: "Portfolio tinker sign in its scene", zone: "portfolio", group: "shipyard", kind: "context", box: { x0: 20, y0: -58, x1: 100, y1: 0 }, h: 32,
    sign: TINKER_SIGN },
  { id: "central-termica", title: "Power plant and cooling tower", zone: "portfolio", group: "hinterland", kind: "region",
    box: { x0: COOLING.x - COOLING.r - M, y0: POWER.y - M, x1: STACKS_N[0].x + 2 + M, y1: COOLING.y + COOLING.r + M }, h: 30 }, // 28-high chimneys
  // tank radius rng 7..9
  { id: "tanques", title: "Tanks", zone: "portfolio", group: "hinterland", kind: "region",
    box: { x0: Math.min(...tanksX) - 9 - M, y0: Math.min(...tanksY) - 9 - M, x1: Math.max(...tanksX) + 9 + M, y1: Math.max(...tanksY) + 9 + M }, h: 12 },
  { id: "silos", title: "Silos", zone: "portfolio", group: "hinterland", kind: "region",
    box: { x0: SILOS.x0 - SILOS.r - M, y0: SILOS.y0 - SILOS.r - M, x1: SILOS.x0 + (SILOS.cols - 1) * SILOS.step + SILOS.r + M, y1: SILOS.y0 + (SILOS.rows - 1) * SILOS.step + SILOS.r + M },
    h: SILOS.h + 4 }, // grain elevator h + 3
  // the whole line, 336 u: thin framing; the roller coaster and the bumper cars are cut by the south edge, lower down
  { id: "alta-tension", title: "High-voltage line", zone: "portfolio", group: "hinterland", kind: "region",
    box: { x0: PYLON_X0 - 4, y0: PYLON_Y - 4, x1: PYLON_X0 + (PYLON_N - 1) * PYLON_STEP + 4, y1: PYLON_Y + 4 }, h: PYLON_H + 2 },
  // the yard cranes run from y0 − 4 to the last row + 6
  { id: "playa-contenedores", title: "Container yard", zone: "portfolio", group: "hinterland", kind: "region",
    box: { x0: CONTAINER_YARD.x0 - M, y0: CONTAINER_YARD.y0 - 4 - M, x1: CONTAINER_YARD.x1 + M, y1: CONTAINER_YARD.y0 + (CONTAINER_YARD.rows - 1) * CONTAINER_YARD.rowStep + 6 + M }, h: 13 },
  { id: "noria", title: "Ferris wheel", zone: "portfolio", group: "fair", kind: "region",
    box: { x0: WHEEL.x - WHEEL.r - M, y0: WHEEL.y - WHEEL.r - M, x1: WHEEL.x + WHEEL.r + M, y1: WHEEL.y + WHEEL.r + M }, h: WHEEL.hub + WHEEL.r },
  { id: "montana-rusa", title: "Roller coaster", zone: "portfolio", group: "fair", kind: "region",
    box: { x0: COASTER.x0 - M, y0: COASTER.y0 - M, x1: COASTER.x1 + M, y1: COASTER.y1 + M }, h: 17 }, // profile up to 14
  { id: "torre-caida", title: "Drop tower", zone: "portfolio", group: "fair", kind: "region",
    box: { x0: DROP.x - 5, y0: DROP.y - 5, x1: DROP.x + 5, y1: DROP.y + 5 }, h: DROP.h + 3 },
  { id: "carrusel", title: "Carousel", zone: "portfolio", group: "fair", kind: "region",
    box: { x0: CAROUSEL.x - 9, y0: CAROUSEL.y - 9, x1: CAROUSEL.x + 9, y1: CAROUSEL.y + 9 }, h: 11 }, // lights at r 6.5
  // to the west flush with the eave (x − 1): the fair gate reaches x 94.75; to the north the roller coaster reaches y −193
  { id: "arcade", title: "Arcade", zone: "portfolio", group: "fair", kind: "region",
    box: { x0: ARCADE.x - 1, y0: ARCADE.y - 0.5, x1: ARCADE.x + 24 + M, y1: ARCADE.y + 14 + M }, h: 10 },
  // flush to the north: the roller coaster reaches y −193
  { id: "autitos-chocadores", title: "Bumper cars", zone: "portfolio", group: "fair", kind: "region",
    box: { x0: BUMPER.x - M, y0: BUMPER.y - 0.5, x1: BUMPER.x + 14 + M, y1: BUMPER.y + 10 + M }, h: 6 },
  // the pier starts at x 227 (bayShoreX in fair.ts, private)
  { id: "muelle", title: "Fair pier", zone: "portfolio", group: "fair", kind: "region",
    box: { x0: 227 - M, y0: PIER.y - M, x1: 227 + PIER.len + M, y1: PIER.y + PIER.d + 6 }, h: 10 },
  // the gothic tower and its cone reach z 18 (accents 0.7); nothing cut by the edge (0.05)
  { id: "tren-fantasma", title: "Ghost train", zone: "portfolio", group: "fair", kind: "region",
    box: { x0: 96, y0: -260, x1: 120, y1: -244 }, h: 18 },
  // the pediment reaches z 7.5 (accents 2.1); nothing cut by the edge
  { id: "casa-espejos", title: "Mirror house", zone: "portfolio", group: "fair", kind: "region",
    box: { x0: 122, y0: -260, x1: 142, y1: -244 }, h: 8 },
  // the mast tops out at z 16.62; plan extent x 112.6…123.9, y −297.6…−286 (steps and mats included) plus 1 u, rounded out; nothing cut by the edge
  { id: "tobogan", title: "Giant slide", zone: "portfolio", group: "fair", kind: "region",
    box: { x0: 111, y0: -299, x1: 125, y1: -285 }, h: 16.7 },
  // the trough top is z 6, the water prism 6.05 (logs 6.75 in the animator, neighbors up to 2.7); the 6 splash dots are inside the box
  { id: "tronco-acuatico", title: "Log flume", zone: "portfolio", group: "fair", kind: "region",
    box: { x0: 158, y0: -300, x1: 226, y1: -290 }, h: 7 },
  // PLAZA_MAYOR ± 3; h 17 (#474): smallest integer that passes; measured inside 5.05, accents 16.12, cut neighbor 13.3
  { id: "plaza", title: "Plaza", zone: "cv", group: "city", kind: "region",
    box: { x0: PLAZA_MAYOR.x - M, y0: PLAZA_MAYOR.y - M, x1: PLAZA_MAYOR.x + PLAZA_MAYOR.w + M, y1: PLAZA_MAYOR.y + PLAZA_MAYOR.d + M }, h: 17 },
  // HOTEL_LOT ± 3; h 53: smallest integer that passes; measured inside 52.5 (machine room, z 51 + 1.5), accents 22.65, cut neighbor 0.02
  { id: "hotel", title: "Hotel with the Resume sign", zone: "cv", group: "city", kind: "region",
    box: { x0: HOTEL_LOT.x - M, y0: HOTEL_LOT.y - M, x1: HOTEL_LOT.x + HOTEL_LOT.w + M, y1: HOTEL_LOT.y + HOTEL_LOT.d + M }, h: 53 },
  // from ramp to ramp; to the west and east flush with the neighboring blocks (buildings up to 10.7), to the north the riverside trees
  { id: "puente", title: "Bridge", zone: "cv", group: "city", kind: "region",
    box: { x0: WEST_COLS[WEST_COLS.length - 1]! + BLOCK_W + 0.5, y0: BRIDGE.y0 - 1, x1: EAST_COLS[0]! + 1, y1: BRIDGE.y1 + M }, h: 8 },
  // whole, 168 u: thin framing. Flush to the west and 2 u inside to the north; h 10 for the belt trees that peek out (up to 9.4 measured since #472, before 8.4)
  { id: "malecon", title: "Seawall", zone: "cv", group: "city", kind: "region",
    box: { x0: PROMENADE.x0 - 1, y0: PROMENADE.y0 + 2, x1: PROMENADE.x1 + M, y1: PROMENADE.y1 + M }, h: 10 },
  // the fallen slab reaches x − 16; flush to the south, the jungle; h 8: the neighbour measured 7.4 once the singular pieces sat on their named parcels (#477)
  { id: "manzana-derrumbada", title: "Collapsed block", zone: "cv", group: "city", kind: "region",
    box: { x0: COLLAPSED.x - 16 - M, y0: COLLAPSED.y - M, x1: COLLAPSED.x + COLLAPSED.w + M, y1: COLLAPSED.y + COLLAPSED.d + 1 }, h: 8 },
  // clasico parcel (133, 351), rect y 353, 24 × 20, whole and rectangular, in the 348..378 row (#493: (43, 231) became transicion when the plaza centre moved, so the exhibit moved here); its world-seed recipe is `cornerCupola` (city() with zoneRng(SEED, "cv"), (…, 1), (…, 3)); the eval pins it. h 9 (A9): smallest integer that passes; measured inside 8.8, accents 0, cut neighbor 0.02
  { id: "manzana-casco", title: "Classic block", zone: "cv", group: "city", kind: "region", box: parcelBox(133, 351), h: 9 },
  // transicion parcel (13, 201): rectangular and not fixed, whose world-seed recipe is `chamfer` since #493 (was `balconyBlock`), the barrio's own; the eval pins the barrio. h 16 (A9): smallest integer that passes; measured inside 15.9, no cut neighbor above it
  { id: "manzana-transicion", title: "Transition block", zone: "cv", group: "city", kind: "region", box: parcelBox(13, 201), h: 16 },
  // FIXED parcel (43, 261) ± 3: the construction site with its crane and fence. h 22 (A9): smallest integer that passes; measured inside 21.3 (crane), accents 14.02, cut neighbor 0.02
  { id: "obra", title: "Construction site", zone: "cv", group: "city", kind: "region", box: parcelBox(43, 261), h: 22 },
  // the south point: x 270..380, y 300..400; it needs the world with no zone filter (the storybook builds it with `assembleWorld(undefined, …)`); h is the smallest integer that passes framing and neighbors (measured with the `measure` of exhibits.test.ts)
  { id: "punta-sur", title: "South point of the island", zone: "cv", group: "city", kind: "region", box: { x0: 270, y0: 300, x1: 380, y1: 400 }, h: 10 },
  // the warehouse strip and the freight railyard: x -54..98, west of the station; h is the smallest integer that passes framing and neighbors (measured with the `measure` of exhibits.test.ts); galpones (#325, warehouses and freight lots): h 12; playa-carga (#325, freight yard): the lamps top out at 5, so h 5
  { id: "galpones", title: "Warehouse strip", zone: "cv", group: "city", kind: "region", box: { x0: -54, y0: 90, x1: 98, y1: 130 }, h: 12 },
  { id: "playa-carga", title: "Freight railyard", zone: "cv", group: "city", kind: "region", box: { x0: -54, y0: 126, x1: 98, y1: 160 }, h: 5 },
  // the dock inlet of #326 (x 276..306, east bank): measured the same way, inside 7.3, accents 0, cut neighbor 9.4 since #474 (belt trees: the Plaza Mayor draws fewer tiles without the tower island, so the city rng re-rolls greenery and cars downstream; 1.2 before), so h 10
  { id: "mercado-pescado", title: "Fish market and dock inlet", zone: "cv", group: "city", kind: "region", box: { x0: 276, y0: 92, x1: 306, y1: 160 }, h: 10 },
  // `glassTower` (a landmark, so the kit cap RECIPE_MAX_H does not apply) in the moderno style on the lot (rect − SIDEWALK) of plan parcel (−77, 201), centred at the origin; maxH 50 is the tower zone's
  { id: "manzana-distrito", title: "Modern block with a tower", zone: "cv", group: "city", kind: "piece",
    build: (out, accents) => {
      const w = TOWER_PARCEL.w - 2 * SIDEWALK, d = TOWER_PARCEL.d - 2 * SIDEWALK;
      const p = recipe("glassTower")({ x: -w / 2, y: -d / 2, w, d, z: 0, open: [], maxH: 50 }, createRng(SEED), STYLES.moderno);
      out.push(...p.ground, ...p.solids);
      accents.push(...p.accents);
    } },
  // `campus` recipe of the kit on a district block; the piece's ground goes to `out` with the solids
  { id: "campus", title: "Campus", zone: "cv", group: "city", kind: "piece",
    build: (out, accents) => {
      const p = campus({ x: -12.5, y: -9.5, w: 25, d: 19, z: 0, open: [], maxH: 24 }, createRng(SEED), STYLES.district);
      out.push(...p.ground, ...p.solids);
      accents.push(...p.accents);
    } },
  { id: "selva", title: "Jungle", zone: "cv", group: "city", kind: "piece", build: (out) => jungle(out, createRng(SEED), { x0: -12, x1: 12, y0: -12, y1: 12 }, 14, 0) },
  { id: "cartel-torre", title: "Resume sign on the hotel facade", zone: "cv", group: "city", kind: "piece",
    build: (out, accents) => { hotelStandIn(out, accents); hotelSign(out, accents, v3(-HOTEL_SLAB.center.x, -HOTEL_SLAB.center.y, 0)); } },
  // h 53: smallest integer that passes; measured inside 52.5 (machine room, z 51 + 1.5), accents 22.65, cut neighbor 0.02. The hotel and its sign come from the world (city() builds them): no `build`.
  { id: "cartel-torre-escena", title: "Resume sign in its scene", zone: "cv", group: "city", kind: "context", h: 53, sign: RESUME_SIGN,
    box: { x0: HOTEL_LOT.x - M, y0: HOTEL_LOT.y - M, x1: HOTEL_LOT.x + HOTEL_LOT.w + M, y1: HOTEL_LOT.y + HOTEL_LOT.d + M } },
  // tech district: each structure takes one parcel
  { id: "mastil", title: "Telecom mast", zone: "cv", group: "tech", kind: "region",
    box: parcelBox(TELECOM_CELL.col, TELECOM_CELL.row), h: 26 },
  { id: "arena", title: "Arena", zone: "cv", group: "tech", kind: "region",
    box: cellBox(ARENA), h: 15 },
  { id: "auditorio", title: "Auditorium", zone: "cv", group: "tech", kind: "region",
    box: cellBox(AUDITORIUM), h: 14 },
  // the parcels of cells (−107, 171) and (−77, 171), built by the city (#479); south of the train track they are capped at ≈ 26.9 (A2: y_min − 1.4·z_max ≥ 134.5), so h 19: the smallest integer that passes exhibits.test.ts (structure measured 18.3)
  { id: "torres", title: "Tech district towers", zone: "cv", group: "tech", kind: "region",
    box: union(parcelBox(-107, 171), parcelBox(-77, 171)), h: 19 },
  { id: "monoblock", title: "Monoblock", zone: "cv", group: "tech", kind: "region",
    box: cellBox({ col: 133, row: 441 }), h: 14.7 }, // the monoblock parcel of cell (133, 441), 24 × 24; #493: h 14.7 (was 23.6, measured 14.6 inside): the south rng draws shifted, the parcel redrew a lower slab
  { id: "casas", title: "Houses with tile roofs", zone: "cv", group: "tech", kind: "region",
    box: cellBox({ col: 103, row: 471 }), h: 8 }, // the houses parcel of cell (103, 471), 24 × 24
  { id: "escuela", title: "School", zone: "cv", group: "tech", kind: "region",
    box: cellBox(SCHOOL), h: 11 },
  { id: "club", title: "Club", zone: "cv", group: "tech", kind: "region",
    box: cellBox(CLUB), h: 10 },
  { id: "plaza-barrio", title: "Neighborhood plaza", zone: "cv", group: "tech", kind: "region",
    box: cellBox(PLAZAS[0]), h: 5.6 },
  { id: "costanera", title: "Waterfront", zone: "cv", group: "tech", kind: "region",
    box: { x0: 184, y0: 480, x1: 199, y1: 568 }, h: 8 },
  { id: "barrio", title: "Coastal neighborhood", zone: "cv", group: "tech", kind: "region",
    box: { x0: 40, y0: 438, x1: 199, y1: 623 }, h: 18 }, // h 18: tallest solid inside measures 17.6 (smallest integer that frames it); NEIGHBORHOOD_REGION (43..186 × 441..620) plus the margin and the costanera
  // the beam starts at the lantern and rotates: pointing north its tip rises BEAM_LEN/√2 on screen, and the box's north vertex is already DRUM_R0 + M above the lighthouse
  { id: "faro", title: "Lighthouse", zone: "blog", group: "sea", kind: "region",
    box: { x0: LIGHTHOUSE.x - DRUM_R0 - M, y0: LIGHTHOUSE.y - DRUM_R0 - M, x1: LIGHTHOUSE.x + DRUM_R0 + M, y1: LIGHTHOUSE.y + DRUM_R0 + M },
    h: LANTERN_Z + (BEAM_LEN * Math.SQRT1_2 - DRUM_R0 - M) / Z_SCALE },
  // the house is 8 × 6 (private in sea.ts)
  { id: "casa-farero", title: "Keeper's house", zone: "blog", group: "sea", kind: "region",
    box: { x0: KEEPER.x - M, y0: KEEPER.y - M, x1: KEEPER.x + 8 + M, y1: KEEPER.y + 6 + M }, h: 13 }, // on the point, z ≈ 7
  // the two buoys of the open sea off the east coast, west of the outbound lane and well north of the moved point (y ≈ 290), 50 u apart
  { id: "boyas", title: "Buoys", zone: "blog", group: "sea", kind: "region",
    box: { x0: Math.min(...buoysX) - 5, y0: Math.min(...buoysY) - 5, x1: Math.max(...buoysX) + 5, y1: Math.max(...buoysY) + 5 }, h: 1 }, // the tallest thing in the box is a buoy (top 0.5; accents reach no higher): h is the smallest integer above it. The Writing platform sign (top 23.21) left the box with #427: it is no longer in the world scene
  // the hull is 40 u long at 30°: it reaches (WRECK.x + 35, WRECK.y + 20); the wreck's buoy is inside
  { id: "pecio", title: "Wreck", zone: "blog", group: "sea", kind: "region",
    box: { x0: WRECK.x - 5, y0: WRECK.y - 5, x1: WRECK.x + 38, y1: WRECK.y + 26 }, h: 9 },
  // the engine beam alone, rotated in plan and in height at once: the section looks level; mounted, on the freighter's booms
  { id: "viga", title: "Beam", zone: "blog", group: "sea", kind: "piece", pad: "water",
    build: (out) => { out.push({ kind: "beam", from: v3(-3, -1.5, 0.5), to: v3(3, 1.5, 6.5), w: 0.8, h: 1, mat: "steel" }); } },
  { id: "carguero", title: "Freighter", zone: "blog", group: "sea", kind: "piece", build: vessel("cargo"), pad: "water" },
  { id: "remolcador", title: "Tug", zone: "blog", group: "sea", kind: "piece", build: vessel("tug"), pad: "water" },
  { id: "convoy", title: "Convoy with barge", zone: "blog", group: "sea", kind: "piece", build: vessel("barge"), pad: "water" },
  { id: "lancha", title: "Tigre river bus", zone: "blog", group: "sea", kind: "piece", build: vessel("ferry"), pad: "water" },
  { id: "plataforma", title: "Writing platform sign", zone: "blog", group: "sea", kind: "piece", build: seaPlatform, pad: "water" },
  // h 1 (both): the crop holds only the raft, top −0.4: the least positive integer not below it. Boxes: the plan of `bounds(raftAt(site, REST_POSE))` ± 3 u, rounded outward to integers (wide x 523.056..616.944, y 58.056..151.944; tall x 393.056..486.944, y 353.056..446.944). The boxes grew (from 90 × 90 to 100 × 100) because the foam and contact-shadow rings (#455) extend 3 u past the envelope. The raft of `writingSite` is added by `contextScene`, and the world's platform animator is dropped (`contextAnimators`): no `build`.
  { id: "plataforma-escena", title: "Writing platform sign in its scene", zone: "blog", group: "sea", kind: "context", box: { x0: 520, y0: 55, x1: 620, y1: 155 }, h: 1, sign: BLOG_SIGNS.wide, writingSite: "wide" },
  { id: "plataforma-escena-angosta", title: "Writing platform sign in its scene, tall site", zone: "blog", group: "sea", kind: "context", box: { x0: 390, y0: 350, x1: 490, y1: 450 }, h: 1, sign: BLOG_SIGNS.tall, writingSite: "tall" },
];

/** The exhibit of the hash (`#id` or `id`); empty or unknown, the first. */
export function pickExhibit(hash: string, list: readonly Exhibit[] = EXHIBITS): Exhibit {
  let id: string;
  try { id = decodeURIComponent(hash.replace(/^#/, "")); } catch { id = ""; } // broken %-escape: treated as unknown
  return list.find((e) => e.id === id) ?? list[0]!;
}

/** Neighbor in index order, wrapping around at the ends. */
export function stepExhibit(id: string, delta: 1 | -1, list: readonly Exhibit[] = EXHIBITS): Exhibit {
  const i = list.findIndex((e) => e.id === id);
  if (i < 0) return list[0]!;
  return list[(i + delta + list.length) % list.length]!;
}

/** The entry does not fit whole in the index view (`getBoundingClientRect` rectangles). */
export function outOfView(entry: { top: number; bottom: number }, view: { top: number; bottom: number }): boolean {
  return entry.top < view.top || entry.bottom > view.bottom;
}
