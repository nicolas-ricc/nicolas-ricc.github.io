/** Pure parts of npm run legibility (level 3 of the sign guardrails): mapping, masks, metrics, OCR preprocess and report. scripts/legibility.ts drives the browser. */
import type { Vec2, Vec3 } from "../src/iso/geometry";
import { project, Z_SCALE } from "../src/iso/project";
import { COVER_LAPTOP, COVER_PHONE, relativeLuminance, SIGN_RULES, signXHeight, type SignSpec, type Violation } from "../src/kit/legibility";
import type { ContextExhibit, Exhibit } from "../src/lab/exhibits";
import { toWorld } from "../src/kit/lettering";
import type { Fit } from "../src/world/frame";

/** Image px per CSS px. */
export const RES = 2;

/** Crop of the host in CSS px, integers. */
export interface Crop { x: number; y: number; w: number; h: number }
/** Pixel masks of a crop (w·h, 1 = in): ink, the ring of background around it, the holes (counters and air between letters) and the backed area (every ink box grown by `backingW·width`). */
export interface Masks { w: number; h: number; core: Uint8Array; ring: Uint8Array; holes: Uint8Array; backed: Uint8Array }

/** World point → image px of the crop: project, fit, crop origin, RES. */
export function toImage(p: Vec3, fit: Fit, crop: Crop): Vec2 {
  const q = project(p);
  return { x: (q.x * fit.scale + fit.x - crop.x) * RES, y: (q.y * fit.scale + fit.y - crop.y) * RES };
}

/** Bounding box of every projected quad point of the sign ± 3·width·1.4·scale, in integer CSS px clamped to the host. */
export function wordCrop(sign: SignSpec, fit: Fit, host: { w: number; h: number }): Crop {
  const pts = sign.glyphs.flatMap((g) => g.quads.flat()).map((p) => { const q = project(p); return { x: q.x * fit.scale + fit.x, y: q.y * fit.scale + fit.y }; });
  const m = 3 * sign.width * Z_SCALE * fit.scale;
  const x0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.x)) - m)), y0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.y)) - m));
  const x1 = Math.min(host.w, Math.ceil(Math.max(...pts.map((p) => p.x)) + m)), y1 = Math.min(host.h, Math.ceil(Math.max(...pts.map((p) => p.y)) + m));
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

/** Sets to 1 the pixels of `mask` (w×h) whose centers lie inside or on the edge of the convex `poly`. */
export function fillPolygon(mask: Uint8Array, w: number, h: number, poly: Vec2[]): void {
  for (let j = 0; j < h; j++) {
    const y = j + 0.5;
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < poly.length; k++) {
      const a = poly[k]!, b = poly[(k + 1) % poly.length]!;
      if (y < Math.min(a.y, b.y) || y > Math.max(a.y, b.y)) continue;
      if (a.y === b.y) { lo = Math.min(lo, a.x, b.x); hi = Math.max(hi, a.x, b.x); continue; }
      const x = a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y);
      lo = Math.min(lo, x); hi = Math.max(hi, x);
    }
    if (lo > hi) continue;
    for (let i = Math.max(0, Math.ceil(lo - 0.5)); i <= Math.min(w - 1, Math.floor(hi - 0.5)); i++) mask[j * w + i] = 1;
  }
}

/** Masks of `sign` in the image of `crop`: core = quads; ring = ⋃(ink box + 3w) − ⋃(box + w) − core − holes; holes = (counters ∪ air between letters) − core. */
export function signMasks(sign: SignSpec, fit: Fit, crop: Crop): Masks {
  const w = crop.w * RES, h = crop.h * RES, n = w * h, img = (p: Vec3) => toImage(p, fit, crop);
  const core = new Uint8Array(n), holes = new Uint8Array(n), outer = new Uint8Array(n), backed = new Uint8Array(n);
  const xH = signXHeight(sign), G = sign.glyphs;
  for (const g of G) for (const q of g.quads) fillPolygon(core, w, h, q.map(img));
  const grown = (g: (typeof G)[number], k: number) => {
    const { x0, y0, x1, y1 } = g.layout.box, m = k * sign.width;
    return [[x0 - m, y0 - m], [x1 + m, y0 - m], [x1 + m, y1 + m], [x0 - m, y1 + m]].map(([a, b]) => img(toWorld(g.plane, a!, b!)));
  };
  for (const g of G) { fillPolygon(outer, w, h, grown(g, 3)); fillPolygon(backed, w, h, grown(g, SIGN_RULES.backingW)); }
  for (const g of G) {
    g.layout.counters.forEach((lc, i) => {
      const r = g.counters[i]!.r;
      fillPolygon(holes, w, h, Array.from({ length: 16 }, (_, k) => img(toWorld(g.plane, lc.at.x + r * Math.cos((2 * Math.PI * k) / 16), lc.at.y + r * Math.sin((2 * Math.PI * k) / 16)))));
    });
  }
  for (let i = 0; i + 1 < G.length; i++) {
    const a = G[i]!, b = G[i + 1]!;
    if (a.layout.box.x1 < b.layout.box.x0) fillPolygon(holes, w, h, [toWorld(a.plane, a.layout.box.x1, 0), toWorld(b.plane, b.layout.box.x0, 0), toWorld(b.plane, b.layout.box.x0, xH), toWorld(a.plane, a.layout.box.x1, xH)].map(img));
  }
  const ring = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (core[i]) holes[i] = 0;
    ring[i] = outer[i] && !backed[i] && !core[i] && !holes[i] ? 1 : 0;
  }
  return { w, h, core, ring, holes, backed };
}

/** Level-3 thresholds (§4.3): contrast per scale, halo ceiling. */
export const LEVEL3 = { contrast: { [COVER_LAPTOP]: 4.5, [COVER_PHONE]: 3 }, halo: 0.5 } as const;

/** Median; NaN for an empty list. */
export function median(xs: readonly number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Relative luminance of each RGB pixel inside `mask`. */
export function luminances(px: Uint8Array | Uint8ClampedArray, mask: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < mask.length; i++) if (mask[i]) out.push(relativeLuminance((px[i * 4]! << 16) | (px[i * 4 + 1]! << 8) | px[i * 4 + 2]!));
  return out;
}

/** Median luminances of core, ring and holes; contrast = (lighter+.05)/(darker+.05) of core and ring, symmetric as WCAG; halo = the darker over the lighter of holes and core: with light ink it is holes/core; with dark ink it measures how much the holes darken. */
export interface Measures { core: number; ring: number; holes: number; contrast: number; halo: number }

/** Level-3 measures of the RGBA pixels `px` inside the masks `m`. */
export function measure(px: Uint8Array | Uint8ClampedArray, m: Masks): Measures {
  const core = median(luminances(px, m.core)), ring = median(luminances(px, m.ring)), holes = median(luminances(px, m.holes));
  return { core, ring, holes, contrast: (Math.max(core, ring) + 0.05) / (Math.min(core, ring) + 0.05), halo: Math.min(core, holes) / Math.max(core, holes) };
}

/** OCR input: RGBA ×3 nearest; pixels on the core side of (core+ring)/2 are black, the rest white; with `keep`, pixels where it is 0 are white. */
export function ocrImage(px: Uint8Array | Uint8ClampedArray, w: number, h: number, core: number, ring: number, keep?: Uint8Array): { data: Uint8Array; w: number; h: number } {
  const k = 3, W = w * k, H = h * k, t = (core + ring) / 2, data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const s = (Math.floor(y / k) * w + Math.floor(x / k)) * 4;
      const lum = relativeLuminance((px[s]! << 16) | (px[s + 1]! << 8) | px[s + 2]!), v = (keep ? keep[s / 4] : 1) && (lum - t) * (core - ring) > 0 ? 0 : 255, o = (y * W + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return { data, w: W, h: H };
}

/** Characters the OCR may emit. */
export const OCR_WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** OCR text without any whitespace. */
export const normalizeOcr = (s: string): string => s.replace(/\s+/g, "");

/** One row of a report table. */
export interface Row { metric: string; value: string; limit: string; ok: boolean }

/** The three rows (contraste, halo, OCR) of a sign at `scale`; NaN fails. Throws on a scale with no rules. */
export function verdicts(m: Measures, ocr: string, text: string, scale: number): Row[] {
  if (scale !== COVER_LAPTOP && scale !== COVER_PHONE) throw new Error(`legibility: no level-3 rules for scale ${scale}`);
  const min = LEVEL3.contrast[scale], exact = scale === COVER_LAPTOP, got = normalizeOcr(ocr);
  return [
    { metric: "contraste", value: `${m.contrast.toFixed(2)}:1`, limit: `≥ ${min}:1`, ok: m.contrast >= min },
    { metric: "halo", value: m.halo.toFixed(2), limit: `≤ ${LEVEL3.halo}`, ok: m.halo <= LEVEL3.halo },
    { metric: "OCR", value: `\`${got}\``, limit: exact ? `= \`${text}\`` : `≈ \`${text}\` (sin mayúsculas)`, ok: exact ? got === text : got.toLowerCase() === text.toLowerCase() },
  ];
}

/** One sign at one scale in the report; file names are relative to the report. */
export interface ReportEntry { id: string; text: string; scale: number; rows: Row[]; crop: string; ocrCrop: string }

/** The fixed OCR preprocess, as written in the report. */
export const PREPROCESS = "Preproceso del OCR, igual para todos los carteles: luminancia relativa (WCAG) por píxel, escalado ×3 por vecino más cercano y umbral binario en el punto medio entre la mediana del núcleo y la del anillo; la tinta (el lado del núcleo) queda negra sobre blanco. tesseract.js con datos `eng` 4.0.0_best_int locales, modo de página palabra única (PSM 8) y lista blanca A–Z a–z. En un cartel de suelo (`ground`) el OCR solo ve lo que el oráculo garantiza respaldado: los píxeles fuera de la caja de tinta de cada letra más el margen de respaldo (`backingW` · ancho, en su plano) quedan blancos, así el borde de la balsa no entra como un marco.";

/** File-name tag of a scale: 1.17 → "117", 0.83 → "083". */
export const scaleTag = (scale: number): string => String(Math.round(scale * 100)).padStart(3, "0");

/** The whole REPORT.md. */
export function renderReport(r: { date: string; viewport: string; entries: ReportEntry[]; violations: { id: string; scale: number; list: Violation[] }[]; tick?: number | null }): string {
  const out = ["# Legibilidad, nivel 3", "", "Generado por `npm run legibility`; no se edita a mano.", "", `Fecha: ${r.date}`, "", `Viewport: ${r.viewport}`, "", ...(r.tick == null ? [] : [`Tick: ${r.tick} ms`, ""]), PREPROCESS, ""];
  for (const e of r.entries) {
    out.push(`## ${e.id} a ${e.scale}`, "", "| Métrica | Valor | Umbral | ✓/✗ |", "| --- | --- | --- | --- |");
    for (const row of e.rows) out.push(`| ${row.metric} | ${row.value} | ${row.limit} | ${row.ok ? "✓" : "✗"} |`);
    out.push("", `![${e.id} ${e.scale}](${e.crop}) ![OCR](${e.ocrCrop})`, "");
  }
  out.push("## Nivel 2 (checkSign)", "");
  const bullets = r.violations.flatMap((v) => v.list.map((x) => `- ${v.id} a ${v.scale}: ${x.rule} = ${Number(x.value.toFixed(2))} (${x.limit})${x.detail ? `, ${x.detail}` : ""}`));
  out.push(...(bullets.length ? bullets : ["Sin violaciones."]), "");
  return out.join("\n");
}

/** True when any table row is ✗ or any level-2 violation exists. */
export const reportFails = (r: { entries: ReportEntry[]; violations: { list: Violation[] }[] }): boolean =>
  r.entries.some((e) => e.rows.some((x) => !x.ok)) || r.violations.some((v) => v.list.length > 0);

/** Parses `agent-browser eval` stdout (the JSON of the value); errors are prefixed `${label}:`. */
export function parseEval<T>(stdout: string, label = "legibility"): T {
  try { return JSON.parse(stdout.trim()) as T; } catch { throw new Error(`${label}: unexpected eval output: ${stdout.trim().slice(0, 80)}`); }
}

/** Context exhibits to measure: all, or the one of `--only <id>`; throws listing the context ids when unknown. */
export function pickContexts(exhibits: readonly Exhibit[], argv: readonly string[]): ContextExhibit[] {
  const all = exhibits.filter((e): e is ContextExhibit => e.kind === "context"), i = argv.indexOf("--only");
  if (i < 0) return all;
  const id = argv[i + 1];
  if (id === undefined || id.startsWith("--")) throw new Error("legibility: --only needs an exhibit id");
  const hit = all.filter((e) => e.id === id);
  if (!hit.length) throw new Error(`legibility: unknown context "${id}"; choose one of: ${all.map((e) => e.id).join(", ")}`);
  return hit;
}

/** The number after `--tick` (ms of simulated time), or null without it; throws on a missing, non-numeric or negative one. */
export function pickTick(argv: readonly string[]): number | null {
  if (argv.some((a) => a.startsWith("--tick="))) throw new Error("legibility: write --tick <ms>, not --tick=<ms>");
  const i = argv.indexOf("--tick");
  if (i < 0) return null;
  const raw = argv[i + 1];
  if (raw === undefined || !/^\d+$/.test(raw)) throw new Error(`legibility: --tick needs a whole non-negative number of ms, got ${raw === undefined ? "nothing" : `"${raw}"`}`);
  return Number(raw);
}

/** File-name tag of a tick: "" without it, "-t<ms>" with it. */
export const tickTag = (tick: number | null): string => (tick === null ? "" : `-t${tick}`);

/** Name of the report file: REPORT.md, or REPORT-t<ms>.md for a tick. */
export const reportName = (tick: number | null): string => `REPORT${tickTag(tick)}.md`;
