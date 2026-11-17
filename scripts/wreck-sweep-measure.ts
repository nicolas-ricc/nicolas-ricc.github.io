/** Pure parts of the wreck vertical-line sweep (#404): sky oracle, envelope of the drawn frame, frame picking. scripts/wreck-sweep.ts drives the browser. */
import type { RenderItem } from "../src/iso/render-list";
import { v3 } from "../src/iso/geometry";
import { project } from "../src/iso/project";
import { ISO_COLORS } from "../src/map/palette-iso";
import type { BloomMode } from "../src/world/stage";
import { fitTransform, type Box, type Fit } from "../src/world/frame";

/** ISO_COLORS.sky as RGB. */
export const SKY: readonly [number, number, number] = [(ISO_COLORS.sky >> 16) & 255, (ISO_COLORS.sky >> 8) & 255, ISO_COLORS.sky & 255];

/** Host CSS px: bounds of the drawn items and the y above which nothing may be drawn (2 px over the higher of the north vertex and the solid tops). */
export interface Envelope { x0: number; y0: number; x1: number; y1: number; ceiling: number }

/** Bounds of `items` and the ceiling, mapped to host CSS px with `fit`. */
export function envelopeOf(items: readonly RenderItem[], fit: Fit, box: Box): Envelope {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, top = Infinity;
  for (const it of items) for (let k = 0; k < it.pts.length; k += 2) {
    const x = it.pts[k]!, y = it.pts[k + 1]!;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    if (it.layer === "solid") top = Math.min(top, y);
  }
  const north = project(v3(box.x0, box.y0, 0)).y;
  return {
    x0: x0 * fit.scale + fit.x, y0: y0 * fit.scale + fit.y, x1: x1 * fit.scale + fit.x, y1: y1 * fit.scale + fit.y,
    ceiling: Math.min(north, top) * fit.scale + fit.y - 2,
  };
}

/** Counts the non-sky texture pixels (w·res × h·res RGBA) whose centre lies outside the envelope or above its ceiling; `first` in integer host CSS px, row order. */
export function offSky(rgba: Uint8Array, host: { w: number; h: number }, res: number, env: Envelope): { count: number; first: { x: number; y: number } | null } {
  const wPx = host.w * res, hPx = host.h * res;
  if (rgba.length !== wPx * hPx * 4) throw new Error(`expected ${wPx * hPx * 4} bytes, got ${rgba.length}`);
  let count = 0, first: { x: number; y: number } | null = null;
  for (let j = 0; j < hPx; j++) {
    const y = (j + 0.5) / res;
    for (let i = 0; i < wPx; i++) {
      const o = (j * wPx + i) * 4;
      if (rgba[o] === SKY[0] && rgba[o + 1] === SKY[1] && rgba[o + 2] === SKY[2]) continue;
      const x = (i + 0.5) / res;
      if (x >= env.x0 && x <= env.x1 && y >= env.y0 && y <= env.y1 && y >= env.ceiling) continue;
      count++;
      first ??= { x: Math.floor(i / res), y: Math.floor(j / res) };
    }
  }
  return { count, first };
}

/** Host CSS px → world screen coordinates (inverse of the fit). */
export function toScreen(p: { x: number; y: number }, fit: Fit): { x: number; y: number } {
  return { x: (p.x - fit.x) / fit.scale, y: (p.y - fit.y) / fit.scale };
}

/** The candidate whose `fitTransform` reproduces `fit` (relative 1e-6), or null. */
export function pickFrame<T extends { name: string; items: readonly RenderItem[] }>(candidates: readonly T[], fit: Fit, host: { w: number; h: number }): T | null {
  const same = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
  return candidates.find((c) => {
    const f = fitTransform([...c.items], host.w, host.h);
    return same(f.x, fit.x) && same(f.y, fit.y) && same(f.scale, fit.scale);
  }) ?? null;
}

export interface SweepArgs { origin: string | null; frames: number; modes: BloomMode[]; viewports: [number, number][]; hide: number[] }

const MODES: readonly BloomMode[] = ["off", "on", "fallback"];

/** Parses the runner's flags (`--origin`, `--frames`, `--modes a,b`, `--viewports WxH,…`, `--hide i,j`); throws on an unknown flag or value. */
export function parseSweepArgs(argv: readonly string[]): SweepArgs {
  const out: SweepArgs = { origin: null, frames: 40, modes: [...MODES], viewports: [[900, 1015], [412, 915]], hide: [] };
  const int = (s: string, min: number, what: string): number => {
    if (!/^\d+$/.test(s) || Number(s) < min) throw new Error(`wreck-sweep: bad ${what} "${s}"`);
    return Number(s);
  };
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i]!, v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new Error(`wreck-sweep: ${flag} needs a value`);
    if (flag === "--origin") out.origin = v;
    else if (flag === "--frames") out.frames = int(v, 1, "--frames");
    else if (flag === "--modes") out.modes = v.split(",").map((m) => {
      if (!MODES.includes(m as BloomMode)) throw new Error(`wreck-sweep: unknown mode "${m}"; choose from ${MODES.join(", ")}`);
      return m as BloomMode;
    });
    else if (flag === "--viewports") out.viewports = v.split(",").map((s) => {
      const m = /^(\d+)x(\d+)$/.exec(s);
      if (!m) throw new Error(`wreck-sweep: bad viewport "${s}", expected WxH`);
      return [Number(m[1]), Number(m[2])] as [number, number];
    });
    else if (flag === "--hide") out.hide = v.split(",").map((s) => int(s, 0, "--hide index"));
    else throw new Error(`wreck-sweep: unknown flag "${flag}"`);
  }
  return out;
}

/** One output line per viewport × mode combination. */
export function formatSweepRow(r: { viewport: string; mode: string; clock: "tick" | "live"; frame: string; frames: number; count: number; first: { x: number; y: number } | null }): string {
  const head = `${r.viewport} ${r.mode} ${r.clock} ${r.frame} ${r.frames} frames: ${r.count} off-sky px`;
  return r.first ? `${head}, first at (${r.first.x}, ${r.first.y})` : head;
}
