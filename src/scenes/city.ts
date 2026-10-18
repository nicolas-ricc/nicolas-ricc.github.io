import type { Accent } from "../iso/accent";
import type { Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { Rng } from "../map/seed";
import { recipe } from "../kit";
import { STYLES } from "../kit/styles";
import type { Piece } from "../kit/types";
import { prism, PLINTH_H } from "./city-pieces";
import { streets } from "../city/streets";
import { bridge, collapsed, cars, greenery, malecon, plazaAndTower, westQuay } from "../city/fixed";
import { FOOTBRIDGE_LOT, NO_PLINTH, WATER_TOWER_BLOCK, assign, waterTowerLot, type Placed } from "../city/zoning";

/**
 * Resume: orquestador de la ciudad. La zonificación (src/city/zoning.ts) reparte
 * barrio, receta, lote y tono por manzana; acá se arma cada pieza con el kit, se
 * suman las piezas fijas (plaza y torre, puente, ribera, malecón, derrumbe, selva,
 * autos; src/city/fixed.ts) y las calles. El terreno (terrain.ts) es el asfalto.
 * Spec: docs/superpowers/specs/2026-09-14-resume-ciudad-design.md §6.
 */
export { PLINTH_H } from "./city-pieces";
export { TOWER_H } from "./city-grid";

/** Una pieza colocada: `solidOffset` es el índice de su primer sólido en `scene.solids`. */
export interface PlacedPiece { placed: Placed; piece: Piece; solidOffset: number }

export interface CityScene {
  ground: Solid[];   // baldosas de la plaza, suelo de manzanas devoradas, carriles
  solids: Solid[];
  accents: Accent[]; // faroles y derrame de luz; las ventanas encendidas y la antena las anima city-anim
  tower: { litWindows: Accent[]; antenna: Vec3; paperWindow: Vec3 };
  neon: { signs: Accent[]; malecon: Vec3[] }; // carteles del distrito y luces del malecón; los anima city-anim
  placed: PlacedPiece[];
}

export function city(rng: Rng, districtRng: Rng): CityScene {
  const ground: Solid[] = [], solids: Solid[] = [], accents: Accent[] = [], signs: Accent[] = [], placed: PlacedPiece[] = [];
  const add = (piece: Piece): void => { solids.push(...piece.solids); ground.push(...piece.ground); accents.push(...piece.accents); };
  for (const p of assign(rng, districtRng)) {
    const b = p.block, r = p.barrio === "distrito" ? districtRng : rng;
    if (!NO_PLINTH.includes(p.recipe)) solids.push(prism(b.x, b.y, 0, b.w, b.d, PLINTH_H, "paving"));
    const piece = recipe(p.recipe)(p.lot, r, { ...STYLES[p.barrio], tone: p.tone });
    placed.push({ placed: p, piece, solidOffset: solids.length });
    add(piece);
    // el cartel consume el rng después de la receta, así las tiradas de la receta no dependen de cuántos slots haya
    if (p.barrio === "distrito") for (const s of piece.slots) if (s.kind === "sign") signs.push({ kind: "poly", pts: s.pts, color: districtRng.chance(0.5) ? "cyan" : "magenta", alpha: 1 });
  }
  const tower = plazaAndTower(solids, ground, accents, rng);
  // torre de agua en el patio de (12, 164) y puente peatonal sobre el estuario
  const host = placed.find((q) => q.placed.block.x === WATER_TOWER_BLOCK.x && q.placed.block.y === WATER_TOWER_BLOCK.y)!;
  add(recipe("waterTower")(waterTowerLot(host.piece.courtyard!, host.placed.lot.z), rng, STYLES.residencial));
  add(recipe("footbridge")(FOOTBRIDGE_LOT, rng, STYLES.residencial));
  streets(ground, solids, accents);
  bridge(solids, accents);
  westQuay(solids);
  const maleconLights = malecon(solids, accents);
  collapsed(solids, rng);
  greenery(solids, rng);
  cars(solids, rng);
  return { ground, solids, accents, tower, neon: { signs, malecon: maleconLights }, placed };
}
