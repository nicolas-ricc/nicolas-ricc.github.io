import type { Accent } from "../iso/accent";
import type { Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { Rng } from "../map/seed";
import { recipe } from "../kit";
import { STYLES } from "../kit/styles";
import type { Piece } from "../kit/types";
import { prism, PLINTH_H } from "./city-pieces";
import { blocks } from "./city-grid";
import { lights, WINDOW_ALPHA, type CityLights } from "../city/lights";
import { streets } from "../city/streets";
import { railLands } from "../city/rail-lands";
import { harbor } from "../city/harbor";
import { bridge, collapsed, cars, greenery, promenade, plazaAndTower, westQuay, type TowerLights } from "../city/fixed";
import { FOOTBRIDGE_LOT, NO_PLINTH, WATER_TOWER_BLOCK, assign, waterTowerLot, type Placed } from "../city/zoning";

/**
 * Resume: orchestrator of the city. The zoning (src/city/zoning.ts) assigns
 * neighborhood, recipe, lot and tone per block; here each piece is built with
 * the kit, the fixed pieces are added (plaza and tower, bridge, riverside,
 * promenade, collapse, jungle, cars; src/city/fixed.ts) and the streets. The
 * terrain (terrain.ts) is the asphalt.
 * Spec: docs/superpowers/specs/2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md §6.
 */
export { PLINTH_H } from "./city-pieces";
export { TOWER_H } from "./city-grid";

/** A placed piece: `solidOffset` is the index of its first solid in `scene.solids`. */
export interface PlacedPiece { placed: Placed; piece: Piece; solidOffset: number }

export interface CityScene {
  ground: Solid[];   // plaza tiles, ground of devoured blocks, lanes
  solids: Solid[];
  accents: Accent[]; // street lamps, light spill, fixed lit windows, bar neons and bathed facades of lights(); the animatable windows, the flickering neon (lights().flicker), the lit floor of the tower and the antenna are animated by city-anim
  tower: TowerLights;
  neon: { signs: Accent[]; promenade: Vec3[] }; // signs of the district and lights of the promenade; city-anim animates them
  placed: PlacedPiece[];
  lights: CityLights;
}

export function city(rng: Rng, districtRng: Rng, lightsRng: Rng): CityScene {
  const ground: Solid[] = [], solids: Solid[] = [], accents: Accent[] = [], signs: Accent[] = [], placed: PlacedPiece[] = [];
  const add = (piece: Piece): void => { solids.push(...piece.solids); ground.push(...piece.ground); accents.push(...piece.accents); };
  for (const p of assign(rng, districtRng)) {
    const b = p.block, r = p.neighborhood === "district" ? districtRng : rng;
    if (!NO_PLINTH.includes(p.recipe)) solids.push(prism(b.x, b.y, 0, b.w, b.d, PLINTH_H, "paving"));
    const piece = recipe(p.recipe)(p.lot, r, { ...STYLES[p.neighborhood], tone: p.tone });
    placed.push({ placed: p, piece, solidOffset: solids.length });
    add(piece);
    // the sign consumes the rng after the recipe, so the recipe draws do not depend on how many slots there are
    if (p.neighborhood === "district") for (const s of piece.slots) if (s.kind === "sign") signs.push({ kind: "poly", pts: s.pts, color: districtRng.chance(0.5) ? "cyan" : "magenta", alpha: 1 });
  }
  for (const b of blocks()) if (b.kind === "freight") solids.push(prism(b.x, b.y, 0, b.w, b.d, PLINTH_H, "paving"));
  const tower = plazaAndTower(solids, ground, accents, rng);
  const host = placed.find((q) => q.placed.block.x === WATER_TOWER_BLOCK.x && q.placed.block.y === WATER_TOWER_BLOCK.y);
  if (!host?.piece.courtyard) throw new Error("the water tower block has no courtyard");
  add(recipe("waterTower")(waterTowerLot(host.piece.courtyard, host.placed.lot.z), rng, STYLES.residential));
  add(recipe("footbridge")(FOOTBRIDGE_LOT, rng, STYLES.residential));
  streets(ground, solids, accents);
  railLands(ground, solids);
  bridge(solids, accents);
  westQuay(solids, accents);
  harbor(solids, accents, rng);
  const promenadeLights = promenade(solids, accents);
  collapsed(solids, rng);
  greenery(solids, rng);
  cars(solids, rng);
  const lit = lights({ solids, placed }, lightsRng);
  for (const w of lit.windows) if (w.on && !w.animable) accents.push({ kind: "poly", pts: w.window.pts, color: w.color, alpha: WINDOW_ALPHA });
  lit.neons.forEach((n, i) => { if (i !== lit.flicker) accents.push(...n.accents); });
  accents.push(...lit.bathed);
  return { ground, solids, accents, tower, neon: { signs, promenade: promenadeLights }, placed, lights: lit };
}
