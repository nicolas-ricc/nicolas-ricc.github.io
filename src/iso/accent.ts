import { ISO_COLORS, type AccentColor } from "../map/palette-iso";
import type { Vec3 } from "./geometry";
import { project } from "./project";

/** Artificial light: drawn on top of everything with "add" blend. A dot (lamp, spark) or a polygon (lit window, beam). */
export type Accent =
  | { kind: "dot"; at: Vec3; r: number; color: AccentColor }
  | { kind: "poly"; pts: Vec3[]; color: AccentColor; alpha?: number };

export type AccentItem =
  | { kind: "dot"; x: number; y: number; r: number; color: number }
  | { kind: "poly"; pts: number[]; color: number; alpha: number };

export function accentItem(a: Accent): AccentItem {
  if (a.kind === "dot") {
    const p = project(a.at);
    return { kind: "dot", x: p.x, y: p.y, r: a.r, color: ISO_COLORS[a.color] };
  }
  return { kind: "poly", pts: a.pts.flatMap((v) => { const s = project(v); return [s.x, s.y]; }), color: ISO_COLORS[a.color], alpha: a.alpha ?? 1 };
}
