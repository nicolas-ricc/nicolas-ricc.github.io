import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import { shadowPolygon } from "../iso/light";
import { Z_SCALE } from "../iso/project";
import { campus } from "../kit/forms/modern";
import { lamp, place } from "../kit/props";
import { STYLES } from "../kit/styles";
import type { Solid } from "../iso/solids";
import { MOUTH_Y, QUAY_X, type WorldZone } from "../map/geo";
import type { Material } from "../map/palette-iso";
import { createRng, SEED } from "../map/seed";
import type { Animator } from "../scenes/animator";
import { BLOCK_D, BLOCK_W, BRIDGE, COLLAPSED, DISTRICT_COLS, DISTRICT_ROWS, EAST_COLS, PROMENADE, PLAZA, ROWS, SITE, TOWER, TOWER_H, WEST_COLS } from "../scenes/city-grid";
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
import { SUBURB_COLS } from "../scenes/sprawl-grid";
import { SUBSTATION } from "../scenes/substation";
import { ARENA, AUDITORIUM, TELECOM } from "../scenes/tech";
import { CLUB, PLAZAS, SCHOOL } from "../scenes/tech-zoning";
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

/** A structure to look at on its own: a box over the real world or a relocatable piece built at the origin (with optional `pad`: the ground material under it, and optional `animate`: its animator, which the storybook tags with the exhibit's zone). */
export type Exhibit = { id: string; title: string; zone: WorldZone; group: GroupId } & (
  | { kind: "region"; box: Box; h?: number }
  | { kind: "piece"; build: (out: Solid[], accents: Accent[]) => void; pad?: Material; animate?: (opts: { reducedMotion: boolean }) => Animator }
);

const M = 3; // margin: sidewalks, street lamps and short shadows

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
  // {2, 41, 98, 76}: x1 = east edge of the stair tower (STAIR_TOWER.x1); plinth and hopper inside; street lamps and trucks outside except the lamp at (5, 76), which touches the south edge (y1 76); chimneys (y ≤ 36.05) and tank (y ≤ 36.8, with the stairs) outside to the north; h 26: apex of the malting kiln
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
  // the water between the quay and the breakwater, from the river mouth; no ships since #87 (the lanes start at the river mouth)
  { id: "darsena", title: "Basin", zone: "portfolio", group: "shipyard", kind: "region", box: { x0: QUAY_X - 2, y0: MOUTH_Y, x1: 275, y1: 80 }, h: 5 },
  { id: "grua-portico", title: "Gantry crane", zone: "portfolio", group: "shipyard", kind: "region", box: { x0: 146, y0: 30, x1: 156, y1: 78 }, h: 28 },
  // transfer street x 100..108 with the lamps at 108.5; west of the slipways (x ≥ 110)
  { id: "calle-faroles", title: "Lamp street", zone: "portfolio", group: "shipyard", kind: "region", box: { x0: 99, y0: 8, x1: 111, y1: 128 }, h: 7 },
  // the two assembly halls: x 10..100, rows y −52 and −32 of 16; y1 −14 leaves out the crane counterweight (y −13..−11, z 18.5..20) and x1 102 the yard (x ≥ 104)
  { id: "naves", title: "Assembly halls", zone: "portfolio", group: "shipyard", kind: "region", box: { x0: 7, y0: -55, x1: 102, y1: -14 }, h: 14 },
  // the island's north coast facing the sheds: x 270..350, y 0..60; h is the smallest integer that passes framing and neighbors (measured with the `measure` of exhibits.test.ts)
  { id: "punta-norte", title: "North point of the island", zone: "portfolio", group: "shipyard", kind: "region", box: { x0: 270, y0: 0, x1: 350, y1: 60 }, h: 9 },
  // the terminal station: x 108..198, y 98..143; h measured as in punta-norte: set by the top of the clock tower, z 29 (the station emits no smoke)
  { id: "estacion", title: "Terminal station", zone: "portfolio", group: "shipyard", kind: "region", box: { x0: 108, y0: 98, x1: 198, y1: 143 }, h: 29 },
  // the level crossing: x 95..112, y 124..142; x0 95 (not 98) so the entry signal (pole at x 96.1..96.4) is inside: without that `cropAnimators` drops the train animator at ms 0; h measured the same way: set by the street lamp at (108.5, 124), at z 5 (the crossing posts reach z 3 and the entry signal 4.7; the exit one is outside)
  { id: "paso-a-nivel", title: "Level crossing", zone: "portfolio", group: "shipyard", kind: "region", box: { x0: 95, y0: 124, x1: 112, y1: 142 }, h: 5 },
  // jib 24 to the east and counter-jib 8 to the west: with the mast at x −8 it spans −16..16
  { id: "grua-torre", title: "Tower crane", zone: "portfolio", group: "shipyard", kind: "piece",
    build: (out, accents) => towerCrane(out, accents, { at: { x: -8, y: 0 }, mastH: 20, jibLen: 24, dir: "e", light: "amber" }) },
  { id: "farol", title: "Street lamp", zone: "portfolio", group: "shipyard", kind: "piece", build: (out, accents) => place(out, accents, lamp(v3(-0.3, -0.3, 0))) },
  // the 4-car EMU centered at the origin: `build` puts only the solids; the lights (saloon, sign, headlights and red ones) come from the `tren.lights` layer of its animator, which flips the head every 4 s
  { id: "tren", title: "Mitre EMU train", zone: "portfolio", group: "shipyard", kind: "piece", pad: "paving",
    build: (out) => { out.push(...pieceTrain("e").solids); },
    animate: trainPieceAnimator },
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
  // the office tower is at the center of the plaza: it stays inside
  { id: "plaza", title: "Plaza", zone: "cv", group: "city", kind: "region",
    box: { x0: PLAZA.x - M, y0: PLAZA.y - M, x1: PLAZA.x + PLAZA.w + M, y1: PLAZA.y + PLAZA.d + M }, h: TOWER_H + 8 },
  // h + 8: the antenna reaches z 37.9
  { id: "torre", title: "Office tower", zone: "cv", group: "city", kind: "region",
    box: { x0: TOWER.x - M, y0: TOWER.y - M, x1: TOWER.x + TOWER.w + M, y1: TOWER.y + TOWER.d + M }, h: TOWER_H + 8 },
  // from ramp to ramp; to the west and east flush with the neighboring blocks (buildings up to 10.7), to the north the riverside trees
  { id: "puente", title: "Bridge", zone: "cv", group: "city", kind: "region",
    box: { x0: WEST_COLS[WEST_COLS.length - 1]! + BLOCK_W + 0.5, y0: BRIDGE.y0 - 1, x1: EAST_COLS[0]! + 1, y1: BRIDGE.y1 + M }, h: 8 },
  // whole, 168 u: thin framing. Flush to the west and 2 u inside to the north; h 9 for the belt trees that peek out (up to 8.4)
  { id: "malecon", title: "Seawall", zone: "cv", group: "city", kind: "region",
    box: { x0: PROMENADE.x0 - 1, y0: PROMENADE.y0 + 2, x1: PROMENADE.x1 + M, y1: PROMENADE.y1 + M }, h: 9 },
  // the fallen slab reaches x − 16; flush to the south, the jungle
  { id: "manzana-derrumbada", title: "Collapsed block", zone: "cv", group: "city", kind: "region",
    box: { x0: COLLAPSED.x - 16 - M, y0: COLLAPSED.y - M, x1: COLLAPSED.x + COLLAPSED.w + M, y1: COLLAPSED.y + COLLAPSED.d + 1 }, h: 6 },
  { id: "manzana-distrito", title: "District block", zone: "cv", group: "city", kind: "region",
    box: { x0: DISTRICT_COLS[0] - M, y0: DISTRICT_ROWS[1] - M, x1: DISTRICT_COLS[0] + BLOCK_W + M, y1: DISTRICT_ROWS[1] + BLOCK_D + M }, h: 20 },
  { id: "obra", title: "Construction site", zone: "cv", group: "city", kind: "region",
    box: { x0: SITE.x - M, y0: SITE.y - M, x1: SITE.x + SITE.w + M, y1: SITE.y + SITE.d + M }, h: 25 },
  // the south point: x 270..380, y 300..400; it needs the world with no zone filter (the storybook builds it with `assembleWorld(undefined, …)`); h is the smallest integer that passes framing and neighbors (measured with the `measure` of exhibits.test.ts)
  { id: "punta-sur", title: "South point of the island", zone: "cv", group: "city", kind: "region", box: { x0: 270, y0: 300, x1: 380, y1: 400 }, h: 10 },
  // `campus` recipe of the kit on a district block; the piece's ground goes to `out` with the solids
  { id: "campus", title: "Campus", zone: "cv", group: "city", kind: "piece",
    build: (out, accents) => {
      const p = campus({ x: -12.5, y: -9.5, w: 25, d: 19, z: 0, open: [], maxH: 24 }, createRng(SEED), STYLES.district);
      out.push(...p.ground, ...p.solids);
      accents.push(...p.accents);
    } },
  { id: "selva", title: "Jungle", zone: "cv", group: "city", kind: "piece", build: (out) => jungle(out, createRng(SEED), { x0: -12, x1: 12, y0: -12, y1: 12 }, 14, 0) },
  // tech district: each structure takes one block BLOCK_W × BLOCK_D
  { id: "mastil", title: "Telecom mast", zone: "cv", group: "tech", kind: "region",
    box: { x0: TELECOM.x - M, y0: TELECOM.y - M, x1: TELECOM.x + BLOCK_W + M, y1: TELECOM.y + BLOCK_D + M }, h: 26 },
  { id: "arena", title: "Arena", zone: "cv", group: "tech", kind: "region",
    box: { x0: ARENA.x - M, y0: ARENA.y - M, x1: ARENA.x + BLOCK_W + M, y1: ARENA.y + BLOCK_D + M }, h: 15 },
  { id: "auditorio", title: "Auditorium", zone: "cv", group: "tech", kind: "region",
    box: { x0: AUDITORIUM.x - M, y0: AUDITORIUM.y - M, x1: AUDITORIUM.x + BLOCK_W + M, y1: AUDITORIUM.y + BLOCK_D + M }, h: 14 },
  // the two towers of row ROWS[2], columns SUBURB_COLS[1] and [0]; the height comes from the rng: the test watches it
  { id: "torres", title: "Tech district towers", zone: "cv", group: "tech", kind: "region",
    box: { x0: SUBURB_COLS[1] - M, y0: ROWS[2] - M, x1: SUBURB_COLS[0] + BLOCK_W + M, y1: ROWS[2] + BLOCK_D + M }, h: 22 },
  { id: "monoblock", title: "Monoblock", zone: "cv", group: "tech", kind: "region",
    box: { x0: 132 - M, y0: 448 - M, x1: 132 + BLOCK_W + M, y1: 448 + BLOCK_D + M }, h: 23.6 },
  { id: "casas", title: "Houses with tile roofs", zone: "cv", group: "tech", kind: "region",
    box: { x0: 132 - M, y0: 520 - M, x1: 132 + BLOCK_W + M, y1: 520 + BLOCK_D + M }, h: 8 },
  { id: "escuela", title: "School", zone: "cv", group: "tech", kind: "region",
    box: { x0: SCHOOL.x - M, y0: SCHOOL.y - M, x1: SCHOOL.x + BLOCK_W + M, y1: SCHOOL.y + BLOCK_D + M }, h: 11 },
  { id: "club", title: "Club", zone: "cv", group: "tech", kind: "region",
    box: { x0: CLUB.x - M, y0: CLUB.y - M, x1: CLUB.x + BLOCK_W + M, y1: CLUB.y + BLOCK_D + M }, h: 10 },
  { id: "plaza-barrio", title: "Neighborhood plaza", zone: "cv", group: "tech", kind: "region",
    box: { x0: PLAZAS[0].x - M, y0: PLAZAS[0].y - M, x1: PLAZAS[0].x + BLOCK_W + M, y1: PLAZAS[0].y + BLOCK_D + M }, h: 5.6 },
  { id: "costanera", title: "Waterfront", zone: "cv", group: "tech", kind: "region",
    box: { x0: 184, y0: 480, x1: 199, y1: 568 }, h: 8 },
  { id: "barrio", title: "Coastal neighborhood", zone: "cv", group: "tech", kind: "region",
    box: { x0: 40, y0: 470, x1: 199, y1: 612 }, h: 11 },
  // the beam starts at the lantern and rotates: pointing north its tip rises BEAM_LEN/√2 on screen, and the box's north vertex is already DRUM_R0 + M above the lighthouse
  { id: "faro", title: "Lighthouse", zone: "blog", group: "sea", kind: "region",
    box: { x0: LIGHTHOUSE.x - DRUM_R0 - M, y0: LIGHTHOUSE.y - DRUM_R0 - M, x1: LIGHTHOUSE.x + DRUM_R0 + M, y1: LIGHTHOUSE.y + DRUM_R0 + M },
    h: LANTERN_Z + (BEAM_LEN * Math.SQRT1_2 - DRUM_R0 - M) / Z_SCALE },
  // the house is 8 × 6 (private in sea.ts)
  { id: "casa-farero", title: "Keeper's house", zone: "blog", group: "sea", kind: "region",
    box: { x0: KEEPER.x - M, y0: KEEPER.y - M, x1: KEEPER.x + 8 + M, y1: KEEPER.y + 6 + M }, h: 13 }, // on the point, z ≈ 7
  // the two buoys of the shoal south of the point, 50 u apart
  { id: "boyas", title: "Buoys", zone: "blog", group: "sea", kind: "region",
    box: { x0: Math.min(...buoysX) - 5, y0: Math.min(...buoysY) - 5, x1: Math.max(...buoysX) + 5, y1: Math.max(...buoysY) + 5 }, h: 4 },
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
