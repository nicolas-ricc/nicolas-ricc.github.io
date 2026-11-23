import type { Accent } from "../iso/accent";
import { v3, type Vec2 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import type { Rng } from "../map/seed";
import { WORLD } from "../map/geo";
import { SIDEWALK } from "./city-grid";
import { place, sign } from "../kit/props";
import { STYLES } from "../kit/styles";
import { PLINTH_H, prism } from "./city-pieces";
import { jungle } from "./flora";
import { recipe } from "../kit";
import { seat } from "../kit/piece";
import { parcelOpenSides, tooSmall } from "../city/zoning";
import { GREEN_BELT, techBlocks, type SprawlBlock } from "./sprawl-grid";
import { base, type NeighborhoodCtx, type HomeWindow } from "./neighborhood";
import { houses } from "./neighborhood-houses";
import { club } from "./neighborhood-club";
import { school } from "./neighborhood-school";
import { monoblock } from "./neighborhood-monoblock";
import { plaza } from "./neighborhood-plaza";
import { waterfront } from "./waterfront";
import { southStreets } from "./tech-streets";
import { RAIL_Y } from "./shipyard";
import { TRAIN_CLEAR } from "./station";
import { ARENA, AUDITORIUM, zoneKinds } from "./tech-zoning";

/**
 * Tech district of Resume: a coastal residential neighborhood to the south of
 * y 318, built on the city-plan parcels (`southParcels`; the city builds
 * those north of 318) with the avenues continuing through it (monoblocks,
 * houses, low rows, school, club, plazas and waterfront). Two landmarks: arena and auditorium.
 * The windows of the neighborhood are accents (`homes`). The west of the map is the city's (#479).
 * It only exists with the whole world (it lives over the bleed).
 * Spec: docs/superpowers/specs/2026-09-15-mundo-3-tecnologico-feria-agua-barcos-design.md §3
 * and docs/superpowers/specs/2026-10-27-barrio-costero-design.md.
 */
export interface TechScene { ground: Solid[]; solids: Solid[]; accents: Accent[]; signs: Accent[]; homes: HomeWindow[] }

export { ARENA, AUDITORIUM };
export const MAX_TECH_H = 20;
export const TECH_MATS: readonly Material[] = ["office", "officeDark", "glass", "curtain", "paving", "plaza", "stone", "copper", "concrete", "leaf", "leafDark", "steel", "rust", "tile", "brick", "whitewash", "signal", "safety", "hullBlue", "sand", "plaster", "terracotta"];

const octagon = (cx: number, cy: number, rx: number, ry: number): Vec2[] => Array.from({ length: 8 }, (_, i) => { const a = ((i + 0.5) / 8) * Math.PI * 2; return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }; });

/** Arena: octagonal stone ring with the lawn on top and four light towers. */
function arena(ctx: NeighborhoodCtx, b: SprawlBlock): void {
  const { solids: out, accents } = ctx;
  base(ctx, b, PLINTH_H, "paving");
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2, h = 5;
  out.push({ kind: "poly", footprint: octagon(cx, cy, 11, 8), z: PLINTH_H, h, mat: "stone" });
  out.push({ kind: "poly", footprint: octagon(cx, cy, 8.5, 5.8), z: PLINTH_H + h, h: 0.3, mat: "leafDark" });
  for (const [dx, dy] of [[-9, -6], [9, -6], [9, 6], [-9, 6]] as const) {
    out.push(prism(cx + dx - 0.3, cy + dy - 0.3, PLINTH_H, 0.6, 0.6, 12, "steel"));
    accents.push({ kind: "dot", at: v3(cx + dx, cy + dy, PLINTH_H + 12), r: 0.9, color: "amber" });
  }
}

/** Auditorium: curtain wall drum with a copper roof, canopy on two columns and a sign. */
function auditorium(ctx: NeighborhoodCtx, signs: Accent[], b: SprawlBlock): void {
  const out = ctx.solids;
  base(ctx, b, PLINTH_H, "paving");
  const cx = b.x + b.w / 2, cy = b.y + 8;
  out.push({ kind: "cylinder", at: v3(cx, cy, PLINTH_H), r: 8, h: 8, mat: "curtain", sides: 12 });
  out.push({ kind: "cone", at: v3(cx, cy, PLINTH_H + 8), r: 8.5, h: 2.5, mat: "copper", sides: 12 });
  for (const dx of [-4, 4]) out.push(prism(cx + dx - 0.3, b.y + b.d - 2.3, PLINTH_H, 0.6, 0.6, 3, "steel"));
  out.push(prism(cx - 5, b.y + b.d - 4, PLINTH_H + 3, 10, 3, 0.4, "officeDark"));
  place(out, signs, sign(v3(cx - 3, b.y + b.d - 1.4, PLINTH_H + 3.4), 6, 1.2));
}

const LOW_RECIPES = [["rowHouses", 40], ["patioResidential", 35], ["courtyardU", 25]] as const;
const LOW_MAX_H = 6;

/** Low residential parcel: a kit recipe on the lot (the rect minus the sidewalk), plinth on the parcel polygon, windows in one `homes` group. */
function low(ctx: NeighborhoodCtx, b: SprawlBlock): void {
  const pc = b.parcel!, roll = ctx.rng.next() * 100;
  let acc = 0;
  const name = LOW_RECIPES.find(([, w]) => roll < (acc += w))![0];
  const lot = { x: b.x + SIDEWALK, y: b.y + SIDEWALK, w: b.w - 2 * SIDEWALK, d: b.d - 2 * SIDEWALK, z: 0, open: parcelOpenSides(pc), maxH: LOW_MAX_H };
  if (tooSmall(lot)) { base(ctx, b, PLINTH_H, "paving"); return; }
  const { piece, plinth } = seat(recipe(name), lot, ctx.rng, STYLES.residential);
  if (plinth) base(ctx, b, PLINTH_H, "paving");
  ctx.solids.push(...piece.solids); ctx.ground.push(...piece.ground); ctx.accents.push(...piece.accents);
  const group = `${pc.rect.x},${pc.rect.y}:low`, lit = ctx.rng.chance(0.55);
  for (const w of piece.windows) ctx.homes.push({ pts: w.pts, lit, group });
}

export function tech(rng: Rng): TechScene {
  const ground: Solid[] = [], solids: Solid[] = [], accents: Accent[] = [], signs: Accent[] = [], homes: HomeWindow[] = [];
  const blocks = techBlocks(), kinds = zoneKinds(rng, blocks), ctx: NeighborhoodCtx = { solids, ground, accents, homes, rng };
  blocks.forEach((b, i) => {
    switch (kinds[i]) {
      case "monoblock": monoblock(ctx, b); break;
      case "houses": houses(ctx, b); break;
      case "school": school(ctx, b); break;
      case "club": club(ctx, b); break;
      case "plaza": plaza(ctx, b); break;
      case "low": low(ctx, b); break;
      case "arena": arena(ctx, b); break;
      case "auditorium": auditorium(ctx, signs, b); break;
    }
  });
  waterfront(ctx);
  const south = southStreets();
  ground.push(...south.ground); solids.push(...south.solids); accents.push(...south.accents);
  // the green belt west of the content, around the west line: no cones in front of the train (#280)
  jungle(solids, rng, { x0: -238, x1: WORLD.x0 - 2, y0: GREEN_BELT.y0 + 2, y1: GREEN_BELT.y1 - 2 }, 48, 0.4, { y: RAIL_Y, train: TRAIN_CLEAR });
  return { ground, solids, accents, signs, homes };
}
