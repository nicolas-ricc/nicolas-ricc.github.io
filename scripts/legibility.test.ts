import { crc32, inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { v3 } from "../src/iso/geometry";
import { toWorld } from "../src/kit/lettering";
import { project } from "../src/iso/project";
import { COVER_LAPTOP, COVER_PHONE, relativeLuminance } from "../src/kit/legibility";
import { EXHIBITS } from "../src/lab/exhibits";
import { BLOG_SIGNS } from "../src/scenes/sign-platform";

/** The Writing sign at the wide site (#427), the one the site shows on a laptop. */
const BLOG_SIGN = BLOG_SIGNS.wide;
import type { Fit } from "../src/world/frame";
import {
  fillDisc, fillPolygon, LEVEL3, measure, median, normalizeOcr, ocrImage, parseEval, pickContexts, PREPROCESS, renderReport, reportFails,
  RES, scaleTag, signMasks, toImage, verdicts, wordCrop, type Masks, type ReportEntry, type Row,
} from "./legibility-measure";
import { encodePng } from "./png";

const count = (m: Uint8Array) => m.reduce((n, b) => n + b, 0);

describe("png", () => {
  const W = 3, H = 2, rgba = Uint8Array.from({ length: W * H * 4 }, (_, i) => (i * 37) & 255);
  const png = encodePng(rgba, W, H);
  /** Chunks after the signature: type, data, stored CRC. */
  const chunks = (() => {
    const out: { type: string; data: Buffer; crc: number; raw: Buffer }[] = [];
    for (let o = 8; o < png.length;) {
      const len = png.readUInt32BE(o), type = png.toString("latin1", o + 4, o + 8);
      out.push({ type, data: png.subarray(o + 8, o + 8 + len), crc: png.readUInt32BE(o + 8 + len), raw: png.subarray(o + 4, o + 8 + len) });
      o += 12 + len;
    }
    return out;
  })();
  it("starts with the PNG signature and an IHDR with the size", () => {
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.toString("latin1", 12, 16)).toBe("IHDR");
    expect(png.readUInt32BE(16)).toBe(W);
    expect(png.readUInt32BE(20)).toBe(H);
    expect([png[24], png[25]]).toEqual([8, 6]); // 8-bit RGBA
  });
  it("every chunk CRC is CRC32 of type + data", () => {
    for (const c of chunks) expect(c.crc, c.type).toBe(crc32(c.raw));
  });
  it("IDAT inflates to filter 0 + each row", () => {
    const idat = Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data));
    const rows: number[] = [];
    for (let y = 0; y < H; y++) rows.push(0, ...rgba.subarray(y * W * 4, (y + 1) * W * 4));
    expect([...inflateSync(idat)]).toEqual(rows);
  });
  it("ends with IEND", () => {
    expect([...png.subarray(png.length - 12)]).toEqual([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
  });
  it("throws when the bytes do not match the size", () => {
    expect(() => encodePng(new Uint8Array(5), 1, 1)).toThrow();
  });
  it("throws on an empty or fractional size", () => {
    expect(() => encodePng(new Uint8Array(0), 0, 0)).toThrow();
    expect(() => encodePng(new Uint8Array(8), 0.5, 4)).toThrow();
  });
});

/** Fit at `scale` that puts the projected word at the center of a w×h host, shifted by `dx` CSS px. */
function centered(scale: number, w: number, h: number, dx = 0): Fit {
  const pts = BLOG_SIGN.glyphs.flatMap((g) => g.quads.flat()).map(project);
  const cx = (Math.min(...pts.map((p) => p.x)) + Math.max(...pts.map((p) => p.x))) / 2;
  const cy = (Math.min(...pts.map((p) => p.y)) + Math.max(...pts.map((p) => p.y))) / 2;
  return { x: w / 2 - cx * scale + dx, y: h / 2 - cy * scale, scale };
}

describe("masks", () => {
  it("fillPolygon fills the pixels whose centers are inside a square", () => {
    const m = new Uint8Array(8 * 6);
    fillPolygon(m, 8, 6, [{ x: 2, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 4 }, { x: 2, y: 4 }]);
    const want = new Uint8Array(8 * 6);
    for (let j = 1; j <= 3; j++) for (let i = 2; i <= 4; i++) want[j * 8 + i] = 1;
    expect([...m]).toEqual([...want]);
  });
  it("fillPolygon counts a center on the edge as inside", () => {
    const m = new Uint8Array(4 * 4);
    fillPolygon(m, 4, 4, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 4 }]); // the edge x + y = 4 crosses the center (1.5, 2.5)
    expect(m[2 * 4 + 1]).toBe(1);
  });
  it("fillDisc fills exactly the centers within r", () => {
    const m = new Uint8Array(8 * 8);
    fillDisc(m, 8, 8, { x: 4, y: 4 }, 1.5);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) expect(m[j * 8 + i], `${i},${j}`).toBe(Math.hypot(i + 0.5 - 4, j + 0.5 - 4) <= 1.5 ? 1 : 0);
    expect(count(m)).toBe(4);
  });
  it("toImage applies project, the fit and the crop at RES", () => {
    expect(RES).toBe(2);
    const fit = { x: 10, y: 20, scale: 2 }, crop = { x: 4, y: 6, w: 50, h: 50 };
    expect(toImage(v3(0, 0, 0), fit, crop)).toEqual({ x: 12, y: 28 });
    expect(toImage(v3(0, 0, 1), fit, crop).y).toBeCloseTo(28 - 1.4 * 2 * 2);
  });
  it("wordCrop holds every projected quad point with a 3·w·1.4·scale margin", () => {
    const host = { w: 1600, h: 900 }, fit = centered(COVER_LAPTOP, host.w, host.h), crop = wordCrop(BLOG_SIGN, fit, host);
    const margin = 3 * BLOG_SIGN.width * 1.4 * fit.scale - 1;
    for (const q of BLOG_SIGN.glyphs.flatMap((g) => g.quads.flat())) {
      const p = project(q), x = p.x * fit.scale + fit.x, y = p.y * fit.scale + fit.y;
      expect(x - crop.x).toBeGreaterThanOrEqual(margin);
      expect(crop.x + crop.w - x).toBeGreaterThanOrEqual(margin);
      expect(y - crop.y).toBeGreaterThanOrEqual(margin);
      expect(crop.y + crop.h - y).toBeGreaterThanOrEqual(margin);
    }
    for (const k of [crop.x, crop.y, crop.w, crop.h]) expect(Number.isInteger(k)).toBe(true);
  });
  it("wordCrop is clamped to the host", () => {
    const host = { w: 1600, h: 900 }, crop = wordCrop(BLOG_SIGN, centered(COVER_PHONE, host.w, host.h, -790), host);
    expect(crop.x).toBe(0);
    expect(crop.w).toBeGreaterThan(0);
    expect(crop.x + crop.w).toBeLessThanOrEqual(host.w);
  });
  it("the ring is the 1w–3w band around the ink box", () => {
    const host = { w: 1600, h: 900 }, fit = centered(COVER_LAPTOP, host.w, host.h), crop = wordCrop(BLOG_SIGN, fit, host);
    const m = signMasks(BLOG_SIGN, fit, crop), g = BLOG_SIGN.glyphs[0]!, w = BLOG_SIGN.width, mid = (g.layout.box.y0 + g.layout.box.y1) / 2;
    const px = (a: number) => toImage(toWorld(g.plane, a, mid), fit, crop), at = (a: number) => { const p = px(a); return Math.floor(p.y) * m.w + Math.floor(p.x); };
    expect(m.ring[at(g.layout.box.x0 - 2 * w)]).toBe(1);
    expect(m.ring[at(g.layout.box.x0 - 0.5 * w)]).toBe(0);
    // beyond 3 w: not ring, or already outside the crop (whose margin is 3 w; an index there would wrap to the row above)
    const far = px(g.layout.box.x0 - 3.5 * w);
    if (far.x >= 0) expect(m.ring[at(g.layout.box.x0 - 3.5 * w)]).toBe(0);
  });
  it("signMasks of the Blog sign: core, ring and holes are disjoint and non-empty; counters land in holes", () => {
    const host = { w: 1600, h: 900 }, fit = centered(COVER_LAPTOP, host.w, host.h), crop = wordCrop(BLOG_SIGN, fit, host);
    const m = signMasks(BLOG_SIGN, fit, crop);
    expect([m.w, m.h]).toEqual([crop.w * RES, crop.h * RES]);
    for (const k of ["core", "ring", "holes"] as const) expect(count(m[k]), k).toBeGreaterThan(0);
    for (let i = 0; i < m.w * m.h; i++) expect(m.core[i]! + m.ring[i]! + m.holes[i]!, `pixel ${i}`).toBeLessThanOrEqual(1);
    for (const c of BLOG_SIGN.glyphs.flatMap((g) => g.counters)) {
      const p = toImage(c.at, fit, crop);
      expect(m.holes[Math.floor(p.y) * m.w + Math.floor(p.x)], `counter at ${p.x},${p.y}`).toBe(1);
    }
  });
});

/** A 1-row image of RGB grays with a mask per pixel class. */
function strip(grays: number[], cls: ("core" | "ring" | "holes" | "")[]): { px: Uint8Array; m: Masks } {
  const n = grays.length, px = new Uint8Array(n * 4), m: Masks = { w: n, h: 1, core: new Uint8Array(n), ring: new Uint8Array(n), holes: new Uint8Array(n) };
  grays.forEach((g, i) => { px.set([g, g, g, 255], i * 4); const c = cls[i]; if (c) m[c][i] = 1; });
  return { px, m };
}

describe("metrics", () => {
  it("median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNaN();
  });
  it("measure: contrast of core over ring medians, halo of holes over core", () => {
    const { px, m } = strip([255, 0, 128, 255], ["core", "ring", "holes", "core"]);
    const r = measure(px, m);
    expect(r.core).toBeCloseTo(1);
    expect(r.ring).toBeCloseTo(0);
    expect(r.contrast).toBeCloseTo(1.05 / 0.05);
    expect(r.halo).toBeCloseTo(relativeLuminance(0x808080));
  });
  it("measure: contrast is symmetric, dark letters on a light ring score like light on dark", () => {
    const { px, m } = strip([0, 255, 128], ["core", "ring", "holes"]);
    expect(measure(px, m).contrast).toBeCloseTo(1.05 / 0.05);
  });
  it("measure with an empty mask gives NaN", () => {
    const { px, m } = strip([255, 0], ["core", "ring"]);
    expect(measure(px, m).halo).toBeNaN();
  });
  it("ocrImage: ×3 nearest, bright letters become black on white", () => {
    const px = Uint8Array.from([255, 255, 255, 255, 0, 0, 0, 255]), o = ocrImage(px, 2, 1, 1, 0);
    expect([o.w, o.h]).toEqual([6, 3]);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 6; x++) expect([...o.data.subarray((y * 6 + x) * 4, (y * 6 + x) * 4 + 4)], `${x},${y}`).toEqual(x < 3 ? [0, 0, 0, 255] : [255, 255, 255, 255]);
  });
  it("ocrImage: dark letters on a light ring also become black", () => {
    const px = Uint8Array.from([255, 255, 255, 255, 0, 0, 0, 255]), o = ocrImage(px, 2, 1, 0, 1);
    expect([...o.data.subarray(0, 4)]).toEqual([255, 255, 255, 255]);
    expect([...o.data.subarray(5 * 4, 5 * 4 + 4)]).toEqual([0, 0, 0, 255]);
  });
  it("normalizeOcr drops whitespace", () => {
    expect(normalizeOcr(" Bl og\n")).toBe("Blog");
  });
  it("verdicts: OCR exact at 1.17, caseless at 0.83; contrast and halo limits", () => {
    const ok = { core: 0.8, ring: 0.01, holes: 0.1, contrast: 14, halo: 0.125 };
    const row = (rows: Row[], metric: string) => rows.find((r) => r.metric === metric)!;
    expect(verdicts(ok, "Blog", "Blog", COVER_LAPTOP).map((r) => r.ok)).toEqual([true, true, true]);
    expect(row(verdicts(ok, "blog", "Blog", COVER_LAPTOP), "OCR").ok).toBe(false);
    expect(row(verdicts(ok, "blog", "Blog", COVER_PHONE), "OCR").ok).toBe(true);
    expect(row(verdicts({ ...ok, contrast: 4.4 }, "Blog", "Blog", COVER_LAPTOP), "contraste").ok).toBe(false);
    expect(row(verdicts({ ...ok, contrast: 4.4 }, "Blog", "Blog", COVER_PHONE), "contraste").ok).toBe(true);
    expect(row(verdicts({ ...ok, halo: 0.51 }, "Blog", "Blog", COVER_LAPTOP), "halo").ok).toBe(false);
    const nan = verdicts({ core: NaN, ring: 0, holes: 0, contrast: NaN, halo: NaN }, "Blog", "Blog", COVER_LAPTOP);
    expect([row(nan, "contraste").ok, row(nan, "halo").ok]).toEqual([false, false]);
    expect(() => verdicts(ok, "Blog", "Blog", 1)).toThrow(/legibility: no level-3 rules for scale 1/);
    expect(LEVEL3.halo).toBe(0.5);
    expect([LEVEL3.contrast[COVER_LAPTOP], LEVEL3.contrast[COVER_PHONE]]).toEqual([4.5, 3]);
  });
  it("parseEval reads agent-browser eval output", () => {
    expect(parseEval('"ab"\n')).toBe("ab");
    expect(parseEval('{"x":1,"y":2,"scale":3}')).toEqual({ x: 1, y: 2, scale: 3 });
    expect(parseEval("true")).toBe(true);
    expect(() => parseEval("[object Object]")).toThrow(/legibility: unexpected eval output/);
    expect(() => parseEval("[object Object]", "wreck-sweep")).toThrow(/^wreck-sweep: unexpected eval output/);
  });
  it("pickContexts: every context, --only one, unknown or non-context ids throw listing the contexts", () => {
    const all = EXHIBITS.filter((e) => e.kind === "context");
    expect(pickContexts(EXHIBITS, []).map((e) => e.id)).toEqual(all.map((e) => e.id));
    expect(pickContexts(EXHIBITS, ["--only", "plataforma-escena"]).map((e) => e.id)).toEqual(["plataforma-escena"]);
    expect(() => pickContexts(EXHIBITS, ["--only", "faro"])).toThrow(/plataforma-escena/);
    expect(() => pickContexts(EXHIBITS, ["--only", "nope"])).toThrow(/plataforma-escena/);
    expect(() => pickContexts(EXHIBITS, ["--only"])).toThrow(/--only needs an exhibit id/);
  });
});

describe("report", () => {
  const rows = (ok: boolean): Row[] => [
    { metric: "contraste", value: "9.10:1", limit: "≥ 4.5:1", ok },
    { metric: "halo", value: "0.20", limit: "≤ 0.5", ok: true },
    { metric: "OCR", value: "`Blog`", limit: "= `Blog`", ok: true },
  ];
  const entries: ReportEntry[] = [
    { id: "plataforma-escena", text: "Blog", scale: COVER_LAPTOP, rows: rows(true), crop: "plataforma-escena-117.png", ocrCrop: "plataforma-escena-117-ocr.png" },
    { id: "plataforma-escena", text: "Blog", scale: COVER_PHONE, rows: rows(false), crop: "plataforma-escena-083.png", ocrCrop: "plataforma-escena-083-ocr.png" },
  ];
  it("scaleTag", () => {
    expect(scaleTag(COVER_LAPTOP)).toBe("117");
    expect(scaleTag(COVER_PHONE)).toBe("083");
  });
  it("renders the date, viewport, preprocess, one table per entry, the crops and the level-2 footer", () => {
    const md = renderReport({ date: "2026-11-15", viewport: "1600×900 @2", entries, violations: [] });
    expect(md).toMatch(/^# Legibilidad, nivel 3\n/);
    expect(md).toContain("Generado por `npm run legibility`; no se edita a mano.");
    expect(md).toContain("2026-11-15");
    expect(md).toContain("1600×900 @2");
    expect(md).toContain(PREPROCESS);
    expect(md.split("| Métrica | Valor | Umbral | ✓/✗ |").length - 1).toBe(2);
    expect(md).toMatch(/\| contraste \| 9\.10:1 \| ≥ 4\.5:1 \| ✓ \|/);
    expect(md).toMatch(/\| contraste \| 9\.10:1 \| ≥ 4\.5:1 \| ✗ \|/);
    for (const f of ["plataforma-escena-117.png", "plataforma-escena-083.png", "plataforma-escena-117-ocr.png", "plataforma-escena-083-ocr.png"]) expect(md).toContain(`(${f})`);
    expect(md).toContain("Sin violaciones.");
  });
  it("lists level-2 violations", () => {
    const md = renderReport({ date: "d", viewport: "v", entries, violations: [{ id: "plataforma-escena", scale: COVER_PHONE, list: [{ rule: "air", value: 1.2, limit: "≥ 1.5 px", detail: "Bl" }] }] });
    expect(md).not.toContain("Sin violaciones.");
    expect(md).toMatch(/plataforma-escena a 0\.83: air = 1\.2 \(≥ 1\.5 px\), Bl/);
  });
  it("reportFails on a ✗ row or a violation", () => {
    expect(reportFails({ entries: entries.slice(0, 1), violations: [] })).toBe(false);
    expect(reportFails({ entries, violations: [] })).toBe(true);
    expect(reportFails({ entries: entries.slice(0, 1), violations: [{ list: [{ rule: "air", value: 1, limit: "x" }] }] })).toBe(true);
  });
});
