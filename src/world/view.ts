import { BLEED, COVER_INSET, WORLD, type WorldZone } from "../map/geo";
import { coverFrame, fitTransform, zoneFrame } from "./frame";

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

/** Cover framing: the rectangle with the host's aspect inscribed in the bleed (coverQuad) fills the host exactly. No sky. */
export function coverView(w: number, h: number): View {
  return fitTransform(coverFrame(w / h), w, h, 0);
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

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

function frameCenter(zone: WorldZone): { x: number; y: number } {
  const pts = zoneFrame(zone)[0]!.pts;
  const xs = pts.filter((_, i) => i % 2 === 0), ys = pts.filter((_, i) => i % 2 === 1);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

/** The zone's box fitted with a 4 % margin; if that falls below cover × ZONE_MIN_ZOOM, that scale centered on the box. Always inside the bleed. */
export function zoneView(zone: WorldZone, w: number, h: number): View {
  const floor = coverView(w, h).scale * ZONE_MIN_ZOOM;
  const fit = fitTransform(zoneFrame(zone), w, h, 0.04);
  if (fit.scale >= floor) return clampToBleed(fit, w, h);
  const c = frameCenter(zone);
  return clampToBleed({ x: w / 2 - c.x * floor, y: h / 2 - c.y * floor, scale: floor }, w, h);
}
