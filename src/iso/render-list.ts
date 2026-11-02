import { ISO_COLORS, stepTone, toneColor } from "../map/palette-iso";
import { sortByDepth } from "./depth";
import { v3, type Vec3 } from "./geometry";
import { SHADOW_CORE_H, shadowPolygon } from "./light";
import { project } from "./project";
import { isFlat, tessellate, type Face, type Solid } from "./solids";

export type Layer = "ground" | "shadow" | "shadowCore" | "solid";
export interface RenderItem { layer: Layer; pts: number[]; color: number }

/**
 * Alpha of each shadow band. The runtime draws each band as a union
 * (a container with AlphaFilter): overlaps do not darken twice. Core and
 * full add up: ≈ 0.51 near the solid, 0.30 at the tip.
 */
export const SHADOW_BAND_ALPHA = 0.3;

const flatten = (pts: Vec3[]): number[] => pts.flatMap((p) => { const s = project(p); return [s.x, s.y]; });

const faceItem = (layer: Layer, f: Face): RenderItem => ({ layer, pts: flatten(f.pts), color: toneColor(f.mat, stepTone(f.tone, f.toneOffset)) });
const shadowItem = (layer: Layer, poly: { x: number; y: number }[]): RenderItem => ({ layer, pts: flatten(poly.map((p) => v3(p.x, p.y, 0))), color: ISO_COLORS.shadow });

export function buildRenderList(solids: Solid[], heading?: number): RenderItem[] {
  const ground: RenderItem[] = [], shadow: RenderItem[] = [], solid: RenderItem[] = [];
  const raised: Solid[] = [];
  // The ground is painted in insertion order, not sorted by depth: sunken
  // ground (dry dock) has to be covered by a solid wall drawn afterwards.
  for (const s of solids) {
    if (isFlat(s)) for (const f of tessellate(s)) ground.push(faceItem("ground", f));
    else raised.push(s);
  }
  for (const s of raised) {
    const full = shadowPolygon(s), core = shadowPolygon(s, SHADOW_CORE_H);
    if (full) shadow.push(shadowItem("shadow", full));
    if (core) shadow.push(shadowItem("shadowCore", core));
  }
  for (const s of sortByDepth(raised, heading)) for (const f of tessellate(s)) solid.push(faceItem("solid", f));
  return [...ground, ...shadow, ...solid];
}
