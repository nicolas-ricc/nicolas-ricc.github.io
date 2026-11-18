import { BLEED, COVER_INSET, WORLD, type WorldZone } from "../map/geo";
import type { RenderItem } from "../iso/render-list";
import { BLOG_SIGNS, type WritingSite } from "../scenes/sign-platform";
import { coverFrame, fitTransform, zoneFrame } from "./frame";
import { WRITING_SITE_MARGIN, signBox } from "./sign-box";

/** Camera state of the world container: `screen = projected_world × scale + (x, y)`. Same as CameraState. */
export interface View { x: number; y: number; scale: number }

/** The same margin coverQuad uses (COVER_INSET), so the viewport stays inside the bleed. */
export const VIEW_INSET = COVER_INSET;
/** zoneView never goes below coverView × this: with the inset, a viewport at exactly cover scale does not fit. */
export const ZONE_MIN_ZOOM = 1.01;

const X0 = WORLD.x0 - BLEED.x + VIEW_INSET, X1 = WORLD.x1 + BLEED.x - VIEW_INSET;
const Y0 = WORLD.y0 - BLEED.y + VIEW_INSET, Y1 = WORLD.y1 + BLEED.y - VIEW_INSET;

/** Inverse of project() at z 0 (the same one coverQuad uses). */
export function unproject(sx: number, sy: number): { x: number; y: number } {
  return { x: sx / 2 + sy, y: sy - sx / 2 };
}

/** Host point (px from the canvas corner) → world at z 0, through the camera. */
export function pointerToWorld(v: View, px: number, py: number): { x: number; y: number } {
  return unproject((px - v.x) / v.scale, (py - v.y) / v.scale);
}

export function viewCorners(v: View, w: number, h: number): { x: number; y: number }[] {
  return [[0, 0], [w, 0], [w, h], [0, h]].map(([px, py]) => pointerToWorld(v, px!, py!));
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

const COVER_ASPECT = 16 / 9;
/** Fraction of the 16:9 cover's width, from its left edge, where narrow screens center the view. Centered on the column of signs: with 0.35 PORTFOLIO was cut and the lighthouse did not fit at 390 px (#428). */
export const COVER_FOCUS_U = 0.39;

/**
 * Cover framing, no sky. At 16:9 or wider, the rectangle with the host's aspect inscribed in the
 * bleed (coverQuad) fills the host exactly. Narrower: the 16:9 cover fills the height and the
 * host is a window of it, centered on COVER_FOCUS_U and clamped to the cover's edges.
 */
export function coverView(w: number, h: number): View {
  const a = w / h;
  if (a >= COVER_ASPECT) return fitTransform(coverFrame(a), w, h, 0);
  const vw = h * COVER_ASPECT;
  const base = fitTransform(coverFrame(COVER_ASPECT), vw, h, 0);
  const off = clamp(COVER_FOCUS_U * vw - w / 2, 0, vw - w);
  return { x: base.x - off, y: base.y, scale: base.scale };
}

/**
 * Shifts the view the minimum needed for the four corners of the viewport to fall
 * inside the bleed rectangle (with VIEW_INSET). Since unproject is
 * linear, the world x of each corner is `cX − a` and the y is `cY − b`, with
 * `a = (v.x/2 + v.y)/s`, `b = (v.y − v.x/2)/s` and (cX, cY) fixed per corner:
 * the constraints are two independent intervals on a and b. If an
 * interval is empty the viewport does not fit at that scale and coverView is returned.
 */
export function clampToBleed(v: View, w: number, h: number): View {
  const s = v.scale;
  const aMin = (w / 2 + h) / s - X1, aMax = -X0;
  const bMin = h / s - Y1, bMax = -w / (2 * s) - Y0;
  if (aMin > aMax || bMin > bMax) return coverView(w, h);
  const a = clamp((v.x / 2 + v.y) / s, aMin, aMax), b = clamp((v.y - v.x / 2) / s, bMin, bMax);
  const x = s * (a - b), y = (s * (a + b)) / 2;
  // no floating-point noise when it was already inside
  return Math.abs(x - v.x) < 1e-9 && Math.abs(y - v.y) < 1e-9 ? { ...v } : { x, y, scale: s };
}

/** Drags the view by (dx, dy) host px, stopped at the bleed edge (scale unchanged). */
export function panView(v: View, dx: number, dy: number, w: number, h: number): View {
  return clampToBleed({ x: v.x + dx, y: v.y + dy, scale: v.scale }, w, h);
}

/** True when the views differ by at most 0.5 px on x/y and 1e-9 relative on scale. */
export function sameView(a: View, b: View): boolean {
  return Math.abs(a.x - b.x) <= 0.5 && Math.abs(a.y - b.y) <= 0.5 && Math.abs(a.scale - b.scale) <= 1e-9 * b.scale;
}

/** Projected box [x0, x1, y0, y1] of a single-item frame. */
function frameBox(items: RenderItem[]): [number, number, number, number] {
  const pts = items[0]!.pts;
  const xs = pts.filter((_, i) => i % 2 === 0), ys = pts.filter((_, i) => i % 2 === 1);
  return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
}

const [CQX0, CQX1, CQY0, CQY1] = frameBox(coverFrame(COVER_ASPECT));

/**
 * Clamps per axis to the 16:9 cover (its projected box), only where the cover fits at that scale.
 */
export function clampToCover(v: View, w: number, h: number): View {
  const s = v.scale;
  const x = (CQX1 - CQX0) * s >= w ? clamp(v.x, w - CQX1 * s, -CQX0 * s) : v.x;
  const y = (CQY1 - CQY0) * s >= h ? clamp(v.y, h - CQY1 * s, -CQY0 * s) : v.y;
  return Math.abs(x - v.x) < 1e-9 && Math.abs(y - v.y) < 1e-9 ? { ...v } : { x, y, scale: s };
}

function frameCenter(zone: WorldZone, site: WritingSite): { x: number; y: number } {
  const [x0, x1, y0, y1] = frameBox(zoneFrame(zone, site));
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}

/** Per axis, the minimum shift that puts [lo, hi] at ≥ margin from 0 and size; none if it already fits or if it plus the margins does not fit. */
function axisShift(lo: number, hi: number, size: number): number {
  if (hi - lo + 2 * WRITING_SITE_MARGIN > size) return 0;
  return lo < WRITING_SITE_MARGIN ? WRITING_SITE_MARGIN - lo : Math.min(0, size - WRITING_SITE_MARGIN - hi);
}

/** Shifts the view the minimum for the active Writing sign to sit ≥ WRITING_SITE_MARGIN px from the host edges (per axis, where it fits). */
function keepSignInside(v: View, w: number, h: number, site: WritingSite): View {
  const b = signBox(BLOG_SIGNS[site]), s = v.scale;
  return { x: v.x + axisShift(b.minX * s + v.x, b.maxX * s + v.x, w), y: v.y + axisShift(b.minY * s + v.y, b.maxY * s + v.y, h), scale: s };
}

/** The zone's box fitted with a 4 % margin; if that falls below cover × ZONE_MIN_ZOOM, that scale centered on the box. Inside the bleed, and inside the 16:9 cover on each axis it covers. The Blog view also keeps the active Writing sign inside the host. */
export function zoneView(zone: WorldZone, w: number, h: number, site: WritingSite = "wide"): View {
  const floor = coverView(w, h).scale * ZONE_MIN_ZOOM;
  const fit = fitTransform(zoneFrame(zone, site), w, h, 0.04);
  const inside = (v: View): View => clampToBleed(clampToCover(v, w, h), w, h);
  let v = fit;
  if (fit.scale < floor) { const c = frameCenter(zone, site); v = { x: w / 2 - c.x * floor, y: h / 2 - c.y * floor, scale: floor }; }
  return zone === "blog" ? inside(keepSignInside(inside(v), w, h, site)) : inside(v);
}
