import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import { project } from "../iso/project";
import type { RenderItem } from "../iso/render-list";
import { BLEED, STATION_LAND, WORLD, ZONE_SPLIT_X, ZONE_SPLIT_Y } from "../map/geo";
import { HALO_BASE, HALO_FALLBACK, type HaloStyle, boxFrame, coverFrame, drawAccents, fitTransform, zoneFrame } from "./frame";

describe("fitTransform", () => {
  it("scales so the bounding box fits with a margin and is centered", () => {
    const items = [{ layer: "ground" as const, pts: [0, 0, 100, 0, 100, 50, 0, 50], color: 0 }];
    const f = fitTransform(items, 1000, 1000, 0.1);
    expect(f.scale).toBeCloseTo(8); // 800 / 100
    expect(f.x).toBeCloseTo(100);
    expect(f.y).toBeCloseTo(500 - 25 * 8);
  });
  it("does not blow up with an empty list", () => {
    expect(fitTransform([], 100, 100)).toEqual({ x: 0, y: 0, scale: 1 });
  });
});

describe("zoneFrame", () => {
  it("a zone's box contains its four projected corners, from z 0 to 30", () => {
    const [it] = zoneFrame("blog");
    expect(it!.pts).toHaveLength(8);
    const xs = it!.pts.filter((_, i) => i % 2 === 0), ys = it!.pts.filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBe(344 - 336);   // SW corner: x - y
    expect(Math.max(...xs)).toBe(570 + 60);     // NE corner
    expect(Math.min(...ys)).toBe((344 - 60) / 2 - 30 * 1.4); // NW corner, raised
    expect(Math.max(...ys)).toBe((570 + 336) / 2);
  });
  it("Portfolio includes the whole station land, Resume starts at the seam", () => {
    expect(zoneFrame("portfolio")[0]!.pts).toEqual(boxFrame({ x0: WORLD.x0, y0: WORLD.y0, x1: ZONE_SPLIT_X, y1: STATION_LAND.y1 })[0]!.pts);
    expect(zoneFrame("cv")[0]!.pts).toEqual(boxFrame({ x0: WORLD.x0, y0: ZONE_SPLIT_Y, x1: ZONE_SPLIT_X, y1: WORLD.y1 })[0]!.pts);
  });
  it("all covers the world", () => {
    const [it] = zoneFrame("all");
    expect(Math.max(...it!.pts.filter((_, i) => i % 2 === 0))).toBe(630);
  });
});

describe("boxFrame", () => {
  it("projects the four corners of the box and the north one carries h", () => {
    const [it] = boxFrame({ x0: 10, y0: 20, x1: 30, y1: 50 }, 12);
    expect(it!.pts).toHaveLength(8);
    const n = project(v3(10, 20, 12));
    expect(it!.pts.slice(0, 2)).toEqual([n.x, n.y]);
    const rest = [[30, 20], [30, 50], [10, 50]].flatMap(([x, y]) => { const p = project(v3(x!, y!, 0)); return [p.x, p.y]; });
    expect(it!.pts.slice(2)).toEqual(rest);
  });
  it("without h it uses zoneFrame's reference height", () => {
    const [a] = boxFrame({ x0: WORLD.x0, y0: WORLD.y0, x1: WORLD.x1, y1: WORLD.y1 });
    expect(a!.pts).toEqual(zoneFrame("all")[0]!.pts);
  });
});

describe("coverFrame", () => {
  it("the 16:9 cover rectangle contains the content box with the tower", () => {
    const box = (items: RenderItem[]) => {
      const xs = items.flatMap((i) => i.pts.filter((_, k) => k % 2 === 0)), ys = items.flatMap((i) => i.pts.filter((_, k) => k % 2 === 1));
      return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
    };
    const cover = box(coverFrame(16 / 9)), all = box(zoneFrame("all"));
    expect(all.minX).toBeGreaterThanOrEqual(cover.minX); expect(all.maxX).toBeLessThanOrEqual(cover.maxX);
    expect(all.minY).toBeGreaterThanOrEqual(cover.minY); expect(all.maxY).toBeLessThanOrEqual(cover.maxY);
    expect((cover.maxX - cover.minX) / (cover.maxY - cover.minY)).toBeCloseTo(16 / 9, 6);
  });

  it("the four corners of the cover fall inside the bleed parallelogram (no sky)", () => {
    const x0 = WORLD.x0 - BLEED.x, y0 = WORLD.y0 - BLEED.y, x1 = WORLD.x1 + BLEED.x, y1 = WORLD.y1 + BLEED.y;
    const wx = x1 - x0, wy = y1 - y0;
    const top = project(v3(x0, y0, 0));
    const [item] = coverFrame(16 / 9);
    const pts = item!.pts;
    for (let i = 0; i < pts.length; i += 2) {
      const px = pts[i]!, py = pts[i + 1]!;
      const u = px - top.x, v = py - top.y;
      const s = (u + 2 * v) / (2 * wx), t = (2 * v - u) / (2 * wy);
      expect(s).toBeGreaterThanOrEqual(-1e-9); expect(s).toBeLessThanOrEqual(1 + 1e-9);
      expect(t).toBeGreaterThanOrEqual(-1e-9); expect(t).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});

describe("accent halo", () => {
  const dot: Accent = { kind: "dot", at: v3(0, 0, 0), r: 1, color: "cyan" };
  const poly: Accent = { kind: "poly", pts: [v3(0, 0, 0), v3(1, 0, 0), v3(1, 1, 0)], color: "magenta" };
  /** Graphics double: in Pixi each `fill` adds an instruction to the context; here they are counted. */
  const fills = (accents: Accent[], halo?: HaloStyle): number => {
    let n = 0;
    const g = { clear: () => g, circle: () => g, poly: () => g, fill: () => { n++; return g; } };
    drawAccents(g as unknown as Parameters<typeof drawAccents>[0], accents, halo);
    return n;
  };

  it("the fallback adds a larger and fainter disc than the base", () => {
    expect(HALO_FALLBACK.length).toBeGreaterThan(HALO_BASE.length);
    const maxK = (h: HaloStyle): number => Math.max(...h.map((d) => d.k));
    const big = HALO_FALLBACK.find((d) => d.k === maxK(HALO_FALLBACK))!;
    expect(big.k).toBeGreaterThan(maxK(HALO_BASE));
    expect(big.alpha).toBeLessThan(Math.min(...HALO_BASE.map((d) => d.alpha)));
  });
  it("by default it draws today's halo: one disc plus the dot", () => {
    expect(fills([dot])).toBe(2);
    expect(fills([dot], HALO_BASE)).toBe(2);
  });
  it("each halo disc is one more fill per dot", () => {
    expect(fills([dot], HALO_FALLBACK)).toBe(HALO_FALLBACK.length + 1);
  });
  it("polys carry no halo", () => {
    expect(fills([poly], HALO_FALLBACK)).toBe(1);
  });
});
