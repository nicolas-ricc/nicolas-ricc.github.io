import type { Accent } from "../iso/accent";
import { v3, type Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { Rng } from "../map/seed";
import { recipe } from "../kit";
import { seat } from "../kit/piece";
import { STYLES } from "../kit/styles";
import type { Piece } from "../kit/types";
import { prism, PLINTH_H } from "./city-pieces";
import { blocks } from "./city-grid";
import { PLAN_BOUNDS, parcels, type Parcel } from "./city-plan";
import { lights, solidBoxes, visibleLights, WINDOW_ALPHA, type CityLights, type FixedLight } from "../city/lights";
import { streets } from "../city/streets";
import { freightYard, railLands } from "../city/rail-lands";
import { harbor } from "../city/harbor";
import { bridge, collapsed, cars, greenery, promenade, plazaMayor, telecom, westQuay } from "../city/fixed";
import { hotel, type HotelLights } from "./sign-hotel";
import { FOOTBRIDGE_LOT, WATER_TOWER_CELL, WEST_DISTRICT_X, assign, fixedParcel, isBare, isHotelLot, tooSmall, waterTowerLot, type Placed } from "../city/zoning";

/**
 * Resume: orchestrator of the city. The zoning (src/city/zoning.ts) assigns
 * neighborhood, recipe, lot and tone per block; here each piece is built with
 * the kit, the fixed pieces are added (plaza, the hotel with the Resume sign of src/scenes/sign-hotel.ts; bridge, riverside,
 * promenade, collapse, jungle, cars; src/city/fixed.ts; the inlet works, src/city/harbor.ts) and the streets. The
 * terrain (terrain.ts) is the asphalt.
 * Spec: docs/superpowers/specs/2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md §6.
 */
export { PLINTH_H } from "./city-pieces";

/** A placed piece: `solidOffset` is the index of its first solid in `scene.solids`. */
export interface PlacedPiece { placed: Placed; piece: Piece; solidOffset: number }

export interface CityScene {
  ground: Solid[];   // plaza tiles, ground of devoured blocks, lanes
  solids: Solid[];
  accents: Accent[]; // kit accents, visible lights of the fixed pieces (street lamps, plaza, garlands, puddles), the sign's letters and bulbs, fixed lit windows, bar neons and bathed facades of lights(); the animatable windows, the flickering neon (lights().flicker) and the hotel's rooms are animated by city-anim
  fixedLights: FixedLight[]; // every light of the fixed pieces, hidden ones included; `accents` has only those `visibleLights` lets through
  hotel: HotelLights;
  neon: { signs: Accent[]; promenade: Vec3[]; mastRing: Vec3[] }; // signs of the district, lights of the promenade and the three rings of the telecom mast; city-anim animates them
  placed: PlacedPiece[];
  lights: CityLights;
  telecom: Vec3 | null; // tip of the telecom mast; null when its parcel is cut off (`opts.west`, the lab)
}

/** Plinth of a parcel: its polygon, raised PLINTH_H, in paving. */
const parcelPlinth = (pc: Parcel): Solid => ({ kind: "poly", footprint: pc.poly, z: 0, h: PLINTH_H, mat: "paving" });

const emptyPiece = (): Piece => ({ solids: [], ground: [], accents: [], windows: [], slots: [], walls: [] });

export function city(rng: Rng, districtRng: Rng, lightsRng: Rng, opts: { west: number } = { west: -Infinity }): CityScene {
  const fixed: FixedLight[] = [], ground: Solid[] = [], solids: Solid[] = [], accents: Accent[] = [], signs: Accent[] = [], placed: PlacedPiece[] = [];
  const add = (piece: Piece): void => { solids.push(...piece.solids); ground.push(...piece.ground); accents.push(...piece.accents); };
  let telecomTip: Vec3 | null = null;
  for (const p of assign(rng, districtRng, opts.west)) {
    // the west (every parcel west of WEST_DISTRICT_X, transicion included) seats with districtRng, so rng's later consumers keep their draws
    const b = p.block, r = (p.neighborhood === "district" || p.neighborhood === "moderno" || (p.parcel && p.parcel.c.x < WEST_DISTRICT_X)) ? districtRng : rng;
    const empty = p.parcel !== undefined && tooSmall(p.lot); // a sliver parcel: plinth, no building
    if (p.recipe === "telecom") { // not a kit recipe: the parcel plinth and the tower of fixed.ts
      const piece = emptyPiece();
      solids.push(parcelPlinth(p.parcel!));
      placed.push({ placed: { ...p, lot: { ...p.lot, z: PLINTH_H } }, piece, solidOffset: solids.length });
      telecomTip = telecom(piece.solids, p.parcel!.rect);
      add(piece);
      continue;
    }
    const { piece, lot, plinth } = empty ? { piece: emptyPiece(), lot: p.lot, plinth: true } : seat(recipe(p.recipe), p.lot, r, { ...STYLES[p.neighborhood], tone: p.tone });
    if (plinth) solids.push(p.parcel ? parcelPlinth(p.parcel) : prism(b.x, b.y, 0, b.w, b.d, PLINTH_H, "paving"));
    placed.push({ placed: { ...p, lot }, piece, solidOffset: solids.length });
    add(piece);
    // the sign consumes the rng after the recipe, so the recipe draws do not depend on how many slots there are
    if (p.neighborhood === "district" || p.neighborhood === "moderno") for (const s of piece.slots) if (s.kind === "sign") signs.push({ kind: "poly", pts: s.pts, color: districtRng.chance(0.5) ? "cyan" : "magenta", alpha: 1 });
  }
  for (const b of blocks()) if (isBare(b)) solids.push(prism(b.x, b.y, 0, b.w, b.d, PLINTH_H, "paving"));
  for (const pc of parcels(PLAN_BOUNDS)) if (isHotelLot(pc)) solids.push(parcelPlinth(pc)); // the hotel lot: plinth only
  const hotelLights = hotel(solids, accents, fixed);
  plazaMayor(solids, ground, fixed, rng);
  // the tank goes after the placed loop (as before #472): it needs its host's courtyard, and its draws come after every piece's
  const host = placed.find((q) => q.placed.parcel?.cell.col === WATER_TOWER_CELL.col && q.placed.parcel.cell.row === WATER_TOWER_CELL.row && fixedParcel(q.placed.parcel));
  if (!host?.piece.courtyard) throw new Error("the water tower host has no courtyard");
  add(recipe("waterTower")(waterTowerLot(host.piece.courtyard, host.placed.lot.z), rng, STYLES.residential));
  add(recipe("footbridge")(FOOTBRIDGE_LOT, rng, STYLES.residential));
  streets(ground, solids, fixed, opts.west);
  railLands(ground, solids);
  bridge(solids, fixed);
  westQuay(solids, fixed);
  harbor(solids, fixed, rng);
  freightYard(ground, solids, fixed, rng);
  const promenadeLights = promenade(solids, fixed);
  collapsed(solids, rng);
  greenery(solids, rng);
  cars(solids, rng, opts.west);
  const boxes = solidBoxes(solids);
  accents.push(...visibleLights(fixed, boxes));
  const lit = lights({ solids, placed }, lightsRng, boxes);
  for (const w of lit.windows) if (w.on && !w.animable) accents.push({ kind: "poly", pts: w.window.pts, color: w.color, alpha: WINDOW_ALPHA });
  lit.neons.forEach((n, i) => { if (i !== lit.flicker) accents.push(...n.accents); });
  accents.push(...lit.bathed);
  const tip = telecomTip;
  return { ground, solids, accents, fixedLights: fixed, hotel: hotelLights, neon: { signs, promenade: promenadeLights, mastRing: tip ? [3, 6, 9].map((dz) => v3(tip.x, tip.y + 0.6, tip.z - dz)) : [] }, placed, lights: lit, telecom: telecomTip };
}
