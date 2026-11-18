import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import { BLEED, CELL, CELL_BLEED, WORLD, worldZoneAt } from "../map/geo";
import { CROWN_SITE, towerCrown } from "../scenes/sign-crown";
import { seaPlatformAt } from "../scenes/sign-platform";
import { TINKER_SITE, tinkerAnimator, tinkerSign } from "../scenes/sign-tinker";
import { world } from "../scenes/world";
import { ACCENT_DIM, VEIL_ALPHA, accentZone, accentsByZone, focusAlphas, veilCells, veilPolygons, veilRuns } from "./veil";

describe("veilCells", () => {
  const cells = veilCells();
  it("cover content + bleed with no gaps or overlaps", () => {
    const area = cells.reduce((s, c) => s + c.size * c.size, 0);
    expect(area).toBe((WORLD.x1 - WORLD.x0 + 2 * BLEED.x) * (WORLD.y1 - WORLD.y0 + 2 * BLEED.y));
    for (const c of cells) expect([CELL, CELL_BLEED]).toContain(c.size);
  });
  it("each cell is in the zone of its center according to worldZoneAt", () => {
    for (const c of cells) expect(c.zone).toBe(worldZoneAt(c.x + c.size / 2, c.y + c.size / 2));
  });
  it("the seams are subdivided to 6: there are small cells near x 344 and y 90 and none far away", () => {
    const small = cells.filter((c) => c.size === CELL);
    expect(small.length).toBeGreaterThan(50);
    expect(small.some((c) => Math.abs(c.x - 344) < 40)).toBe(true);
    expect(small.some((c) => Math.abs(c.y - 90) < 40 && c.x < 300)).toBe(true);
    expect(cells.filter((c) => c.size === CELL_BLEED && c.x < -300 && c.y < -300).length).toBeGreaterThan(20);
  });
  it("the lighthouse headland and its reef are Blog (#426), the promenade west of it stays Resume, the open sea is Blog", () => {
    const at = (x: number, y: number) => cells.find((c) => x >= c.x && x < c.x + c.size && y >= c.y && y < c.y + c.size)!.zone;
    expect(at(410, 290)).toBe("blog");
    expect(at(420, 290)).toBe("blog");
    expect(at(341, 284)).toBe("cv");
    expect(at(500, 200)).toBe("blog");
    expect(at(-30, 300)).toBe("cv");
  });
  it("the promenade lamps next to the moved headland veil with Resume (#426)", () => {
    const lamps = world(7).accents.filter((a): a is Extract<Accent, { kind: "dot" }> => a.kind === "dot" && a.at.x >= 341 && a.at.x <= 341.6 && a.at.y >= 266 && a.at.y <= 326);
    expect(lamps.length).toBeGreaterThanOrEqual(3);
    for (const a of lamps) expect(accentZone(a), `${a.at.x},${a.at.y}`).toBe("cv");
  });
  it("station land goes with Portfolio and the strip west of it with Resume; the cell 144..150 is classified by its centre", () => {
    const cell = (x: number, y: number) => cells.find((c) => x >= c.x && x < c.x + c.size && y >= c.y && y < c.y + c.size)!;
    expect(cell(99, 117).zone).toBe("portfolio");
    expect(cell(60, 95).zone).toBe("cv");
    expect(cell(150, 141)).toMatchObject({ size: CELL, zone: "portfolio" });
    expect(cell(150, 147)).toMatchObject({ size: CELL, zone: "cv" });
  });
});

describe("veilPolygons", () => {
  it("one projected quadrilateral per strip, split by zone", () => {
    const polys = veilPolygons();
    const total = polys.portfolio.length + polys.cv.length + polys.blog.length;
    expect(total).toBe(veilRuns().length);
    for (const z of ["portfolio", "cv", "blog"] as const) { expect(polys[z].length).toBeGreaterThan(100); for (const p of polys[z]) expect(p).toHaveLength(8); }
  });
});

describe("veilRuns", () => {
  const runs = veilRuns();
  const cells = veilCells();
  it("cover the same area as the cells", () => {
    const area = runs.reduce((s, r) => s + (r.x1 - r.x0) * r.h, 0);
    expect(area).toBe((WORLD.x1 - WORLD.x0 + 2 * BLEED.x) * (WORLD.y1 - WORLD.y0 + 2 * BLEED.y));
  });
  it("each strip is a single zone: at its center and at the center of each cell it spans", () => {
    for (const r of runs) {
      const cx = (r.x0 + r.x1) / 2, cy = r.y + r.h / 2;
      expect(worldZoneAt(cx, cy)).toBe(r.zone);
      for (let x = r.x0; x < r.x1; x += r.h) expect(worldZoneAt(x + r.h / 2, cy)).toBe(r.zone);
    }
  });
  it("there are far fewer than cells", () => {
    expect(runs.length).toBeLessThan(cells.length / 4);
  });
  it("veilPolygons returns one quadrilateral per strip, split by zone", () => {
    const polys = veilPolygons();
    const total = polys.portfolio.length + polys.cv.length + polys.blog.length;
    expect(total).toBe(runs.length);
  });
});

describe("focusAlphas", () => {
  it("with no focus nothing is veiled", () => {
    expect(focusAlphas(null)).toEqual({ portfolio: { veil: 0, accents: 1 }, cv: { veil: 0, accents: 1 }, blog: { veil: 0, accents: 1 } });
  });
  it("with focus on cv, the other two are veiled and their accents drop", () => {
    const a = focusAlphas("cv");
    expect(a.cv).toEqual({ veil: 0, accents: 1 });
    expect(a.portfolio).toEqual({ veil: VEIL_ALPHA, accents: ACCENT_DIM });
    expect(a.blog).toEqual({ veil: VEIL_ALPHA, accents: ACCENT_DIM });
  });
});

describe("accentZone", () => {
  it("a point by its position, a polygon by its first vertex, in world space", () => {
    expect(accentZone({ kind: "dot", at: v3(10, 10, 5), r: 1, color: "cyan" })).toBe("portfolio");
    expect(accentZone({ kind: "poly", pts: [v3(500, 200, 0), v3(10, 10, 0)], color: "magenta" })).toBe("blog");
  });
});

describe("accentsByZone", () => {
  const dot = (x: number, y: number): Accent => ({ kind: "dot", at: v3(x, y, 1), r: 1, color: "amber" });
  const port = dot(380, 118), blog = dot(500, 200), cv = dot(-30, 300);
  it("without a zone, each light goes to the zone of its position (accentZone)", () => {
    expect(accentsByZone([port, blog, cv])).toEqual({ portfolio: [port], cv: [cv], blog: [blog] });
  });
  it("with a zone, all go to that zone even if they are in another", () => {
    expect(accentsByZone([port, blog, cv], "blog")).toEqual({ portfolio: [], cv: [], blog: [port, blog, cv] });
  });
  it("with no lights it returns the three zones empty", () => {
    expect(accentsByZone([])).toEqual({ portfolio: [], cv: [], blog: [] });
  });
});

describe("Writing platform accents (#390)", () => {
  it("every accent of the Writing platform (dots and polys) is Blog", () => {
    const out: Solid[] = [], accents: Accent[] = [];
    seaPlatformAt(out, accents);
    expect(accents.some((a) => a.kind === "dot") && accents.some((a) => a.kind === "poly")).toBe(true);
    for (const a of accents) expect(accentZone(a)).toBe("blog");
  });
});

describe("Resume crown accents (#391)", () => {
  it("every accent of the crown at CROWN_SITE (dots and polys) is Resume", () => {
    const out: Solid[] = [], accents: Accent[] = [];
    towerCrown(out, accents, CROWN_SITE);
    expect(accents.some((a) => a.kind === "dot") && accents.some((a) => a.kind === "poly")).toBe(true);
    for (const a of accents) expect(accentZone(a)).toBe("cv");
  });
});

describe("Portfolio tinker sign accents (#392)", () => {
  it("every accent of the tinker sign at TINKER_SITE and of its tinker.lights layer is Portfolio", () => {
    const out: Solid[] = [], accents: Accent[] = [];
    tinkerSign(out, accents, TINKER_SITE);
    expect(accents.some((a) => a.kind === "poly")).toBe(true); // lettering polys and the marquee bulbs, spots since #403
    expect(accents.filter((a) => a.kind === "dot")).toEqual([]);
    const l = tinkerAnimator({ reducedMotion: true }).layer("tinker.lights");
    if (l.kind !== "accent") throw new Error("tinker.lights is an accent layer");
    expect(l.accents.length).toBeGreaterThan(0);
    for (const a of [...accents, ...l.accents]) expect(accentZone(a)).toBe("portfolio");
  });
});
