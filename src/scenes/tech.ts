import type { Accent } from "../iso/accent";
import type { Facade } from "../iso/facade";
import { v3, type Vec2, type Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import type { Rng } from "../map/seed";
import { WORLD } from "../map/geo";
import { BLOCK_W, BOULEVARD, CITY_EDGE, SIDEWALK } from "./city-grid";
import { campus } from "../kit/forms/modern";
import { beacon, helipad, lamp, place, rooftopGarden, sign, streetTree } from "../kit/props";
import { STYLES } from "../kit/styles";
import { PLINTH_H, brokenTone, prism, tiles } from "./city-pieces";
import { jungle } from "./flora";
import { GREEN_BELT, SUBURB_COLS, suburbBlocks, type SprawlBlock } from "./sprawl-grid";
import type { NeighborhoodCtx, HomeWindow } from "./neighborhood";
import { houses } from "./neighborhood-houses";
import { club } from "./neighborhood-club";
import { school } from "./neighborhood-school";
import { monoblock } from "./neighborhood-monoblock";
import { plaza } from "./neighborhood-plaza";
import { waterfront } from "./waterfront";
import { RAIL_Y } from "./shipyard";
import { TRAIN_CLEAR } from "./station";
import { ARENA, AUDITORIUM, TELECOM, TOWER_D, zoneKinds } from "./tech-zoning";

/**
 * Tech district of Resume: the city continues to the west and south of the
 * district on the same grid, like an office and campus park: curtain wall
 * towers near the content, monoblocks and startup campuses after that
 * and, to the south, a coastal residential neighborhood (monoblocks, houses, school, club,
 * plazas and waterfront). Three landmarks: telecommunications tower, arena, auditorium.
 * Every office building has a facade; the windows of the neighborhood are accents (`homes`).
 * It only exists with the whole world (it lives over the bleed).
 * Spec: docs/superpowers/specs/2026-09-15-mundo-3-tecnologico-feria-agua-barcos-design.md §3
 * and docs/superpowers/specs/2026-10-27-barrio-costero-design.md.
 */
export interface Tower { box: Solid & { kind: "prism" }; facade: Facade }
export interface TechScene { ground: Solid[]; solids: Solid[]; accents: Accent[]; towers: Tower[]; signs: Accent[]; telecom: Vec3; neon: { crowns: Accent[]; mastRing: Vec3[] }; homes: HomeWindow[] }

export { ARENA, AUDITORIUM, TELECOM, TOWER_D };
export const MAX_TECH_H = 20;
export const TECH_MATS: readonly Material[] = ["office", "officeDark", "glass", "curtain", "paving", "plaza", "stone", "copper", "concrete", "leaf", "leafDark", "steel", "rust", "tile", "brick", "whitewash", "signal", "safety", "hullBlue", "sand"];
const CURTAIN_WINDOW = { w: 0.85, h: 0.8 } as const;

const strip = (path: Vec2[], width: number, z: number, mat: Material): Solid => ({ kind: "strip", path, width, z, mat });

/** Neon crown: strip on the south face of the upper body, attached to the top edge; cyan on even towers, magenta on odd ones. */
function crown(k: number, x: number, y: number, top: number, w: number): Accent {
  const x0 = x + 0.4, x1 = x + w - 0.4, z0 = top - 0.6;
  return { kind: "poly", pts: [v3(x0, y, z0), v3(x1, y, z0), v3(x1, y, top), v3(x0, y, top)], color: k % 2 === 0 ? "cyan" : "magenta", alpha: 1 };
}

/** Curtain wall tower in one or two bodies, with a helipad or green terrace and a rooftop sign. */
function tower(out: Solid[], accents: Accent[], signs: Accent[], crowns: Accent[], towers: Tower[], rng: Rng, b: SprawlBlock): void {
  out.push(prism(b.x, b.y, 0, b.w, b.d, PLINTH_H, "paving"));
  const h = rng.int(12, MAX_TECH_H - 2), bw = rng.int(12, 16), bd = rng.int(10, 13);
  const bx = b.x + (b.w - bw) / 2, by = b.y + (b.d - bd) / 2;
  const th0Full = Math.round(h * 0.7); // the second body only fits if the first does not fall below the minimum of 12
  const tiers = th0Full >= 12 && rng.chance(0.5) ? 2 : 1, th0 = tiers === 2 ? th0Full : h;
  const facade: Facade = { floors: Math.max(2, Math.round(th0 / 3)), cols: Math.max(2, Math.round(bw / 2.5)), window: CURTAIN_WINDOW, base: "glass" };
  const box = prism(bx, by, PLINTH_H, bw, bd, th0, "curtain", { facade });
  const k = towers.length;
  out.push(box); towers.push({ box, facade });
  out.push(prism(bx - 0.3, by - 0.3, PLINTH_H + th0, bw + 0.6, bd + 0.6, 0.3, "officeDark"));
  let z = PLINTH_H + th0 + 0.3, tw = bw, td = bd, tx = bx, ty = by;
  if (tiers === 2) {
    const th1 = h - th0; tw = bw - 4; td = bd - 4; tx = bx + 2; ty = by + 2;
    out.push(prism(tx, ty, z, tw, td, th1, "curtain", { facade: { floors: Math.max(1, Math.round(th1 / 3)), cols: Math.max(2, Math.round(tw / 2.5)), window: CURTAIN_WINDOW } }));
    out.push(prism(tx - 0.3, ty - 0.3, z + th1, tw + 0.6, td + 0.6, 0.3, "officeDark"));
    z += th1 + 0.3;
  }
  if (rng.chance(0.5)) place(out, accents, helipad(v3(tx + tw / 2, ty + td / 2, z), 2.5));
  else out.push(...rooftopGarden(v3(tx + 0.5, ty + 0.5, z), tw - 1, td - 1, rng, [1, 3]));
  place(out, signs, sign(v3(tx + tw / 2 - 3, ty + td - 0.4, z), 6, 1.6)); // rooftop sign on the south edge
  crowns.push(crown(k, tx, ty + td + 0.02, z - 0.3, tw));
  if (h >= 18) accents.push(...beacon(v3(tx + tw, ty, z + 0.5)).accents);
  if (rng.chance(0.5)) place(out, accents, lamp(v3(b.x + b.w - 1, b.y - 1.5, 0)));
}

/** Neighborhood plaza: faceted jungle ground, crossing paths and cones. */
function park(out: Solid[], ground: Solid[], rng: Rng, b: SprawlBlock): void {
  ground.push(tiles(rng, b, 0.05, "leafDark", brokenTone));
  ground.push(strip([{ x: b.x + b.w / 2, y: b.y }, { x: b.x + b.w / 2, y: b.y + b.d }], 1, 0.08, "paving"));
  ground.push(strip([{ x: b.x, y: b.y + b.d / 2 }, { x: b.x + b.w, y: b.y + b.d / 2 }], 1, 0.08, "paving"));
  jungle(out, rng, { x0: b.x + 2, x1: b.x + b.w - 2, y0: b.y + 2, y1: b.y + b.d - 2 }, rng.int(4, 6), 0.05);
}

/** Telecommunications tower: concrete base, slender mast, three dishes and a light at the tip. */
function telecom(out: Solid[], b: SprawlBlock): Vec3 {
  out.push(prism(b.x, b.y, 0, b.w, b.d, PLINTH_H, "paving"));
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2;
  out.push(prism(cx - 2, cy - 2, PLINTH_H, 4, 4, 2, "concrete"), prism(cx - 0.5, cy - 0.5, PLINTH_H + 2, 1, 1, 20, "steel"));
  for (const z of [10, 14, 18]) out.push({ kind: "cylinder", at: v3(cx + 1.2, cy, PLINTH_H + z), r: 1.2, h: 0.4, mat: "steel", sides: 8 });
  return v3(cx, cy, PLINTH_H + 22.2);
}

const octagon = (cx: number, cy: number, rx: number, ry: number): Vec2[] => Array.from({ length: 8 }, (_, i) => { const a = ((i + 0.5) / 8) * Math.PI * 2; return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }; });

/** Arena: octagonal stone ring with the lawn on top and four light towers. */
function arena(out: Solid[], accents: Accent[], b: SprawlBlock): void {
  out.push(prism(b.x, b.y, 0, b.w, b.d, PLINTH_H, "paving"));
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2, h = 5;
  out.push({ kind: "poly", footprint: octagon(cx, cy, 11, 8), z: PLINTH_H, h, mat: "stone" });
  out.push({ kind: "poly", footprint: octagon(cx, cy, 8.5, 5.8), z: PLINTH_H + h, h: 0.3, mat: "leafDark" });
  for (const [dx, dy] of [[-9, -6], [9, -6], [9, 6], [-9, 6]] as const) {
    out.push(prism(cx + dx - 0.3, cy + dy - 0.3, PLINTH_H, 0.6, 0.6, 12, "steel"));
    accents.push({ kind: "dot", at: v3(cx + dx, cy + dy, PLINTH_H + 12), r: 0.9, color: "amber" });
  }
}

/** Auditorium: curtain wall drum with a copper roof, canopy on two columns and a sign. */
function auditorium(out: Solid[], signs: Accent[], b: SprawlBlock): void {
  out.push(prism(b.x, b.y, 0, b.w, b.d, PLINTH_H, "paving"));
  const cx = b.x + b.w / 2, cy = b.y + 8;
  out.push({ kind: "cylinder", at: v3(cx, cy, PLINTH_H), r: 8, h: 8, mat: "curtain", sides: 12 });
  out.push({ kind: "cone", at: v3(cx, cy, PLINTH_H + 8), r: 8.5, h: 2.5, mat: "copper", sides: 12 });
  for (const dx of [-4, 4]) out.push(prism(cx + dx - 0.3, b.y + b.d - 2.3, PLINTH_H, 0.6, 0.6, 3, "steel"));
  out.push(prism(cx - 5, b.y + b.d - 4, PLINTH_H + 3, 10, 3, 0.4, "officeDark"));
  place(out, signs, sign(v3(cx - 3, b.y + b.d - 1.4, PLINTH_H + 3.4), 6, 1.2));
}

/** The avenue of the district continues to the west: curbs, central planter with trees and street lamps. */
function avenue(ground: Solid[], solids: Solid[], accents: Accent[]): void {
  const x0 = SUBURB_COLS[SUBURB_COLS.length - 1]!, x1 = CITY_EDGE.west;
  for (const y of [BOULEVARD.y0 - 0.3, BOULEVARD.y1 + 0.3]) ground.push(strip([{ x: x0, y }, { x: x1, y }], 0.4, 0.05, "paving"));
  for (const x of SUBURB_COLS) {
    solids.push(prism(x, BOULEVARD.y0, 0, BLOCK_W, BOULEVARD.y1 - BOULEVARD.y0, 0.3, "leafDark"));
    for (const dx of [12]) solids.push(...streetTree(v3(x + dx, BOULEVARD.y0 + 2, 0.3)));
    place(solids, accents, lamp(v3(x + 12, BOULEVARD.y0 - 5.3, 0)));
  }
}

export function tech(rng: Rng): TechScene {
  const ground: Solid[] = [], solids: Solid[] = [], accents: Accent[] = [], towers: Tower[] = [], signs: Accent[] = [], crowns: Accent[] = [], homes: HomeWindow[] = [];
  const blocks = suburbBlocks(), kinds = zoneKinds(rng, blocks), ctx: NeighborhoodCtx = { solids, ground, accents, homes, rng };
  let telecomTop = v3(TELECOM.x, TELECOM.y, 0);
  blocks.forEach((b, i) => {
    switch (kinds[i]) {
      case "tower": tower(solids, accents, signs, crowns, towers, rng, b); break;
      case "campus": {
        const p = campus({ x: b.x + SIDEWALK, y: b.y + SIDEWALK, w: b.w - 2 * SIDEWALK, d: b.d - 2 * SIDEWALK, z: 0, open: [], maxH: MAX_TECH_H }, rng, STYLES.district);
        solids.push(...p.solids); ground.push(...p.ground); accents.push(...p.accents);
        break;
      }
      case "monoblock": monoblock(ctx, b); break;
      case "houses": houses(ctx, b); break;
      case "school": school(ctx, b); break;
      case "club": club(ctx, b); break;
      case "plaza": plaza(ctx, b); break;
      case "park": park(solids, ground, rng, b); break;
      case "telecom": telecomTop = telecom(solids, b); break;
      case "arena": arena(solids, accents, b); break;
      case "auditorium": auditorium(solids, signs, b); break;
    }
  });
  avenue(ground, solids, accents);
  waterfront(ctx);
  // the green belt west of the content, around the west line: no cones in front of the train (#280)
  jungle(solids, rng, { x0: -238, x1: WORLD.x0 - 2, y0: GREEN_BELT.y0 + 2, y1: GREEN_BELT.y1 - 2 }, 48, 0.4, { y: RAIL_Y, train: TRAIN_CLEAR });
  return { ground, solids, accents, towers, signs, homes, telecom: telecomTop, neon: { crowns, mastRing: [3, 6, 9].map((dz) => v3(telecomTop.x, telecomTop.y + 0.6, telecomTop.z - dz)) } };
}
