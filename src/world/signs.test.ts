import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { project } from "../iso/project";
import { tessellate } from "../iso/solids";
import type { SignSpec } from "../kit/legibility";
import { pointInPolygon, worldZoneAt } from "../map/geo";
import { ZONE_IDS, type ZoneId } from "../map/zones";
import { BLOG_SIGNS, type WritingSite } from "../scenes/sign-platform";
import { RESUME_SIGN, SIGN_SITE } from "../scenes/sign-hotel";
import { TINKER_SIGN } from "../scenes/sign-tinker";
import { labelLayout, SIGN_ORDER, signBox, signPolygons, writingSite, zoneAtScreen, zoneSigns, type ScreenBox } from "./signs";
import { coverView, pointerToWorld, type View } from "./view";

const SITES: readonly WritingSite[] = ["wide", "tall"];
/** Every sign at either Writing site, once (#427): the Resume and Portfolio signs are the same at both. */
const ALL: (readonly [ZoneId, SignSpec, WritingSite])[] = [...new Map(SITES.flatMap((site) => SIGN_ORDER.map((id) => [zoneSigns(site)[id], [id, zoneSigns(site)[id], site]] as const))).values()];
const ID: View = { x: 0, y: 0, scale: 1 };

/** Screen bounding box of a set of flat polygons. */
function boundsOf(polys: number[][]): ScreenBox {
  const xs = polys.flatMap((p) => p.filter((_, i) => i % 2 === 0)), ys = polys.flatMap((p) => p.filter((_, i) => i % 2 === 1));
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}
const inSign = (s: SignSpec, x: number, y: number): boolean => signPolygons(s).some((p) => pointInPolygon(x, y, p));
const toHost = (b: ScreenBox, v: View): ScreenBox =>
  ({ minX: b.minX * v.scale + v.x, minY: b.minY * v.scale + v.y, maxX: b.maxX * v.scale + v.x, maxY: b.maxY * v.scale + v.y });

describe("zoneSigns (#393, #427)", () => {
  it("zoneSigns(site) maps each zone to its sign, Writing at that site, and SIGN_ORDER is portfolio, cv, blog", () => {
    for (const site of SITES) {
      expect(zoneSigns(site).portfolio).toBe(TINKER_SIGN);
      expect(zoneSigns(site).cv).toBe(RESUME_SIGN);
      expect(zoneSigns(site).blog).toBe(BLOG_SIGNS[site]);
      expect(zoneSigns(site)).toBe(zoneSigns(site)); // one record per site: the signBox/signPolygons memos stay warm
    }
    expect(ALL).toHaveLength(4);
    expect(SIGN_ORDER).toEqual(["portfolio", "cv", "blog"]);
    expect([...SIGN_ORDER].sort()).toEqual([...ZONE_IDS].sort());
  });
});

describe("signPolygons (#393)", () => {
  it("signPolygons: one flat polygon per tessellated backing face plus one quad per glyph box", () => {
    for (const [, s] of ALL) {
      const polys = signPolygons(s), faces = s.backing.flatMap(tessellate).length;
      expect(polys.length).toBe(faces + s.glyphs.length);
      for (const p of polys) {
        expect(p.length % 2).toBe(0);
        expect(p.length).toBeGreaterThanOrEqual(6);
      }
      for (const p of polys.slice(faces)) expect(p.length).toBe(8);
      expect(signPolygons(s)).toBe(polys);
    }
  });

  it("the projected center of every glyph lies in the sign's polygons", () => {
    for (const [id, s] of ALL) {
      for (const g of s.glyphs) {
        const pts = g.quads.flat().map(project);
        const c = { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length };
        expect(inSign(s, c.x, c.y), `${id} ${g.char}`).toBe(true);
      }
    }
  });

  // on the row of the word's vertical center, 3 units past the extremes of every polygon point
  it("a point 3 u beyond either end of the panel is outside the sign", () => {
    for (const [id, s] of ALL) {
      const b = boundsOf(signPolygons(s)), w = signBox(s), y = (w.minY + w.maxY) / 2;
      expect(inSign(s, b.minX - 3, y), `${id} left`).toBe(false);
      expect(inSign(s, b.maxX + 3, y), `${id} right`).toBe(false);
    }
  });

  // a View is a uniform scale plus an offset, so disjoint at scale 1 means disjoint at every camera
  it("the signs' polygons are disjoint, both Writing sites included", () => {
    const boxes = ALL.map(([, s]) => boundsOf(signPolygons(s)));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!, b = boxes[j]!;
        const meet = a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
        expect(meet, `${ALL[i]![0]} × ${ALL[j]![0]}`).toBe(false);
      }
    }
  });
});

describe("signBox (#393)", () => {
  it("signBox is the screen box of the projected glyph quads", () => {
    for (const [, s] of ALL) {
      const pts = s.glyphs.flatMap((g) => g.quads.flat()).map(project);
      expect(signBox(s)).toEqual({
        minX: Math.min(...pts.map((p) => p.x)), minY: Math.min(...pts.map((p) => p.y)),
        maxX: Math.max(...pts.map((p) => p.x)), maxY: Math.max(...pts.map((p) => p.y)),
      });
    }
    // measured: the words at the laptop cover, in host px; RESUME on the hotel facade (#474, 100 x 20 host px; TINKER unchanged)
    const v = coverView(1366, 657);
    const r = (b: ScreenBox): number[] => [b.minX, b.maxX, b.minY, b.maxY].map(Math.round);
    expect(r(toHost(signBox(RESUME_SIGN), v))).toEqual([308, 408, 237, 257]);
    expect(r(toHost(signBox(TINKER_SIGN), v))).toEqual([600, 688, 70, 86]);
  });
});

describe("the hotel's RESUME sign as the zone link (#474)", () => {
  it("zoneAtScreen on the center of each glyph of the hotel sign returns cv", () => {
    for (const v of [ID, coverView(1366, 657), coverView(1600, 900)]) {
      for (const g of RESUME_SIGN.glyphs) {
        const pts = g.quads.flat().map(project), cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
        expect(zoneAtScreen(v, cx * v.scale + v.x, cy * v.scale + v.y, "wide"), `${g.char} at scale ${v.scale}`).toBe("cv");
      }
    }
  });

  it("the zone link hitbox follows SIGN_SITE", () => {
    const b = signBox(RESUME_SIGN), p = project(SIGN_SITE);
    expect(p.x).toBeGreaterThanOrEqual(b.minX); expect(p.x).toBeLessThanOrEqual(b.maxX);
    expect(p.y).toBeGreaterThanOrEqual(b.minY); expect(p.y).toBeLessThanOrEqual(b.maxY);
    expect(zoneAtScreen(ID, p.x, p.y - 1, "wide")).toBe("cv");
  });
});

describe("zoneAtScreen (#393)", () => {
  it("zoneAtScreen on the center of each word returns its zone", () => {
    for (const v of [ID, coverView(1366, 657)]) {
      for (const [id, s, site] of ALL) {
        const b = toHost(signBox(s), v);
        expect(zoneAtScreen(v, (b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, site), `${site} ${id} at scale ${v.scale}`).toBe(id);
      }
    }
  });

  // A10: since #427 every sign stands over its own zone's geography (0 of ~22 000 probes lie over another), so precedence over the geography
  // is checked with a mocked geography in signs-precedence.test.ts; here every point of every sign must answer its own zone
  it("every point of every sign answers its zone", () => {
    for (const [id, s, site] of ALL) {
      const b = boundsOf(signPolygons(s));
      for (let x = b.minX; x <= b.maxX; x += 0.5) for (let y = b.minY; y <= b.maxY; y += 0.5) {
        if (!inSign(s, x, y)) continue;
        expect(zoneAtScreen(ID, x, y, site), `${site} ${id} ${x},${y}`).toBe(id);
      }
    }
  });

  // a 20 px grid of the laptop host, without the points over a sign
  it.each(SITES)("zoneAtScreen away from the signs equals worldZoneAt(pointerToWorld(…)), %s site", (site) => {
    const v = coverView(1366, 657), signs = Object.values(zoneSigns(site));
    let checked = 0;
    for (let px = 0; px <= 1366; px += 20) {
      for (let py = 0; py <= 657; py += 20) {
        const sx = (px - v.x) / v.scale, sy = (py - v.y) / v.scale;
        if (signs.some((s) => inSign(s, sx, sy))) continue;
        const g = pointerToWorld(v, px, py);
        expect(zoneAtScreen(v, px, py, site), `${px},${py}`).toBe(worldZoneAt(g.x, g.y));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(2000);
  });
});

describe("labelLayout (#393)", () => {
  const PAD = { hw: 50, hh: 20 };

  it("labelLayout at coverView(1366, 657) puts the three on their sign, Writing at the wide site", () => {
    const v = coverView(1366, 657);
    for (const [id, s] of Object.entries(zoneSigns("wide"))) {
      const b = signBox(s), l = labelLayout(b, v, { w: 1366, h: 657 }, PAD);
      expect(l.mode, id).toBe("sign");
      if (l.mode !== "sign") continue;
      expect(l.x).toBeCloseTo(b.minX * v.scale + v.x, 6);
      expect(l.y).toBeCloseTo(b.minY * v.scale + v.y, 6);
      expect(l.w).toBeCloseTo((b.maxX - b.minX) * v.scale, 6);
      expect(l.h).toBeCloseTo((b.maxY - b.minY) * v.scale, 6);
    }
  });

  // with the focus at 0.39 and the host rule (#428) the phone shows Writing at the tall site, on its sign; since #474 RESUME stands on the hotel
  // facade, 48 % of it inside the phone (D10 of #471): its label goes to the host edge
  it("labelLayout at coverView(390, 750) puts portfolio and blog on their sign and cv on the edge, Writing at writingSite(390, 750)", () => {
    const v = coverView(390, 750), host = { w: 390, h: 750 };
    expect(writingSite(390, 750)).toBe("tall");
    const want: Record<string, string> = { portfolio: "sign", cv: "edge", blog: "sign" };
    for (const [id, s] of Object.entries(zoneSigns(writingSite(390, 750)))) expect(labelLayout(signBox(s), v, host, PAD).mode, id).toBe(want[id]);
  });

  it("labelLayout at coverView(820, 1180) puts the three on their sign", () => {
    const v = coverView(820, 1180), host = { w: 820, h: 1180 };
    for (const [id, s] of Object.entries(zoneSigns(writingSite(820, 1180)))) expect(labelLayout(signBox(s), v, host, PAD).mode, id).toBe("sign");
  });

  // exactly half inside on both axes still counts as on the sign
  it("labelLayout keeps the sign when exactly half of the box is inside", () => {
    const l = labelLayout({ minX: 90, minY: -10, maxX: 110, maxY: 10 }, ID, { w: 100, h: 100 }, PAD);
    expect(l).toEqual({ mode: "sign", x: 90, y: -10, w: 20, h: 20 });
    expect(labelLayout({ minX: 91, minY: 0, maxX: 111, maxY: 10 }, ID, { w: 100, h: 100 }, PAD).mode).toBe("edge");
  });

  // a host smaller than the label clamps to the low end, as placeLabels did
  it("labelLayout clamps the edge label to lo when the host is smaller than the label", () => {
    const l = labelLayout({ minX: 500, minY: 500, maxX: 600, maxY: 520 }, ID, { w: 40, h: 40 }, { hw: 50, hh: 30 });
    expect(l).toEqual({ mode: "edge", x: 50, y: 30 });
  });
});

describe("signs.ts stays pure (#393)", () => {
  // pixi-free.test.ts does not cover src/world (stage.ts is Pixi), so this module guards itself
  it("signs.ts imports neither pixi.js nor the DOM", () => {
    const src = readFileSync(fileURLToPath(new URL("./signs.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/["']pixi\.js["']/);
    expect(src).not.toMatch(/\b(document|window|HTMLElement)\b/);
  });
});
