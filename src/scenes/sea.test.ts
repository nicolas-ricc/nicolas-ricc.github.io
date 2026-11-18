import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { spotOf } from "../iso/spot-fixtures";
import type { Accent } from "../iso/accent";
import { buildRenderList } from "../iso/render-list";
import { bounds, isFlat, type Solid } from "../iso/solids";
import { HEADLAND_SHIFT, ZONE_SPLIT_X, abyssX, inHeadland, worldZoneAt } from "../map/geo";
import { allIsoColors, type Material } from "../map/palette-iso";
import { createRng } from "../map/seed";
import { BUOYS, CAP_R, COAST, COAST_Z, GALLERY_DECK_R, GALLERY_LIGHT_Z, GALLERY_POSTS, GALLERY_R, KEEPER, LANTERN_R, LANTERN_Z, LIGHTHOUSE, POST_H, POST_W, WRECK, WRECK_BUOY, sea, type SeaScene } from "./sea";
import { seaPlatformAt, type WritingSite } from "./sign-platform";
import { world } from "./world";
import { headlandZ, terrainAt } from "./terrain";

const scene = (): SeaScene => sea(createRng(7));
/** What `seaPlatformAt` builds on its own at `site`. */
const platform = (site: WritingSite) => { const out: Solid[] = [], accents: Accent[] = []; seaPlatformAt(out, accents, site); return { out, accents }; };
const SEA_MATS: readonly Material[] = ["rock", "whitewash", "rust", "steel", "glass", "hull", "deck", "foam", "leaf", "leafDark"]; // #427: the Writing platform (boxGrey hut, officeDark panel) left sea() for platformAnimator
const water = new Set(["water", "sea", "shore", "abyss", "reef"]);
type Cyl = Extract<Solid, { kind: "cylinder" }>;
type Prism = Extract<Solid, { kind: "prism" }>;
type Cone = Extract<Solid, { kind: "cone" }>;
type Poly = Extract<Solid, { kind: "poly" }>;

describe("sea", () => {
  it("is deterministic, has ≥ 80 raised solids and uses only Blog or shared materials", () => {
    expect(JSON.stringify(sea(createRng(7)))).toBe(JSON.stringify(sea(createRng(7))));
    const s = scene();
    expect(s.solids.filter((x) => !isFlat(x)).length).toBeGreaterThanOrEqual(80);
    for (const x of [...s.ground, ...s.solids]) { expect(SEA_MATS).toContain(x.mat); expect(bounds(x).min.x).toBeGreaterThanOrEqual(330); }
  });

  it("lighthouse: six alternating drums, gallery with eight posts, glass lantern and cone; ≈ 29.6 above the rock", () => {
    const s = scene();
    const drums = s.solids.filter((x) => x.kind === "cylinder" && x.h === 4 && Math.abs(x.at.x - LIGHTHOUSE.x) < 0.01);
    expect(drums).toHaveLength(6);
    expect(drums.map((d) => d.mat)).toEqual(["whitewash", "rust", "whitewash", "rust", "whitewash", "rust"]);
    expect(s.solids.filter((x) => x.kind === "prism" && x.h === 1.2 && x.w === 0.3)).toHaveLength(8);
    expect(s.solids.some((x) => x.kind === "cylinder" && x.mat === "glass" && x.h === 3)).toBe(true);
    const top = Math.max(...s.solids.filter((x) => Math.abs(bounds(x).min.x - (LIGHTHOUSE.x - 3.2)) < 4 && Math.abs(bounds(x).min.y - (LIGHTHOUSE.y - 3.2)) < 4).map((x) => bounds(x).max.z));
    expect(top - LIGHTHOUSE.z).toBeCloseTo(29.6, 1);
    expect(s.lantern.z).toBeCloseTo(LIGHTHOUSE.z + 24 + 0.6 + 1.5, 6); // deliberate drift pin (#133): six drums of 4 + gallery 0.6 + half a lantern, in literals so changing a constant breaks here
    expect(s.lantern.z).toBe(LANTERN_Z);
    expect(worldZoneAt(LIGHTHOUSE.x, LIGHTHOUSE.y)).toBe("blog"); // #426: the moved headland is Blog
    expect(worldZoneAt(KEEPER.x, KEEPER.y)).toBe("blog");
  });

  it("lighthouse gallery: disc and posts with named measurements, not moving a bit (#27)", () => {
    const s = scene();
    expect([GALLERY_R, GALLERY_DECK_R, POST_W, POST_H]).toEqual([2.7, 3, 0.3, 1.2]);
    const deck = s.solids.filter((x): x is Cyl => x.kind === "cylinder" && x.mat === "steel" && x.at.x === LIGHTHOUSE.x && x.at.y === LIGHTHOUSE.y);
    expect(deck.map((d) => d.r)).toEqual([GALLERY_DECK_R]);
    const posts = s.solids.filter((x): x is Prism => x.kind === "prism" && x.mat === "steel" && x.w === POST_W && x.d === POST_W && x.h === POST_H && Math.hypot(x.at.x - LIGHTHOUSE.x, x.at.y - LIGHTHOUSE.y) < GALLERY_DECK_R);
    expect(posts).toHaveLength(8);
    for (const p of posts) expect(Math.hypot(p.at.x + POST_W / 2 - LIGHTHOUSE.x, p.at.y + POST_W / 2 - LIGHTHOUSE.y)).toBeCloseTo(GALLERY_R, 9);
  });

  it("lighthouse lantern and cap with named radii, set back from the last drum (#27)", () => {
    const s = scene();
    expect([LANTERN_R, CAP_R]).toEqual([1.6, 1.8]);
    const glass = s.solids.filter((x): x is Cyl => x.kind === "cylinder" && x.mat === "glass" && x.at.x === LIGHTHOUSE.x && x.at.y === LIGHTHOUSE.y);
    expect(glass.map((g) => g.r)).toEqual([LANTERN_R]);
    const cap = s.solids.filter((x): x is Cone => x.kind === "cone" && x.mat === "steel" && x.at.x === LIGHTHOUSE.x && x.at.y === LIGHTHOUSE.y);
    expect(cap.map((c) => c.r)).toEqual([CAP_R]);
  });

  it("gallery lights: one per post, 0.5 below the disc floor, not moving a bit (#130)", () => {
    const s = scene();
    expect(GALLERY_POSTS).toBe(8); // drift pin, like the #27 measurements
    expect(GALLERY_LIGHT_Z).toBe(LANTERN_Z - 2);
    const deck = s.solids.find((x): x is Cyl => x.kind === "cylinder" && x.mat === "steel" && x.at.x === LIGHTHOUSE.x && x.at.y === LIGHTHOUSE.y)!;
    expect(GALLERY_LIGHT_Z + 0.5).toBe(deck.at.z + deck.h);
    const posts = s.solids.filter((x): x is Prism => x.kind === "prism" && x.mat === "steel" && x.w === POST_W && x.d === POST_W && x.h === POST_H && Math.hypot(x.at.x - LIGHTHOUSE.x, x.at.y - LIGHTHOUSE.y) < GALLERY_DECK_R);
    expect(posts).toHaveLength(GALLERY_POSTS);
    expect(s.neon.gallery).toHaveLength(GALLERY_POSTS);
    s.neon.gallery.forEach((p, k) => {
      expect(p.z).toBe(GALLERY_LIGHT_Z);
      expect(p.x).toBeCloseTo(posts[k]!.at.x + POST_W / 2, 9);
      expect(p.y).toBeCloseTo(posts[k]!.at.y + POST_W / 2, 9);
    });
  });

  it("#426: the lighthouse, the keeper's house and the coast beacons moved with the headland, as one block", () => {
    expect(LIGHTHOUSE).toEqual({ x: 410, y: 290, z: 7 });
    expect(KEEPER).toEqual({ x: 386, y: 280 });
    expect([LIGHTHOUSE.x - HEADLAND_SHIFT.x, LIGHTHOUSE.y - HEADLAND_SHIFT.y]).toEqual([396, 118]);
    expect([KEEPER.x - HEADLAND_SHIFT.x, KEEPER.y - HEADLAND_SHIFT.y]).toEqual([372, 108]);
    const OLD_COAST = [[397.5, 99.5], [403, 101.5], [408, 104], [411.5, 108.5], [413, 114.5], [413, 120.5], [412, 126.5], [408.5, 131.5]];
    expect(COAST.map((p) => [p.x - HEADLAND_SHIFT.x, p.y - HEADLAND_SHIFT.y])).toEqual(OLD_COAST);
  });

  it("keeper's house, stepped rock path over the point, outcrops, boulders and reef", () => {
    const s = scene();
    const house = s.solids.find((x) => x.kind === "prism" && x.mat === "whitewash" && x.roof === "gable") as Extract<Solid, { kind: "prism" }>;
    expect(house.at).toMatchObject({ x: KEEPER.x, y: KEEPER.y });
    expect(house.at.z).toBeCloseTo(headlandZ(KEEPER.x + 4), 6);
    const path = s.ground.filter((x) => x.kind === "strip" && x.mat === "rock");
    expect(path).toHaveLength(10);
    for (const p of path) if (p.kind === "strip") for (const q of p.path) expect(inHeadland(q.x, q.y)).toBe(true);
    expect(path.map((p) => p.kind === "strip" && p.z)).toEqual([...path].map((p) => p.kind === "strip" && p.z).sort((a, b) => Number(a) - Number(b))); // rises toward the lighthouse
    expect(s.solids.filter((x) => x.kind === "poly" && x.mat === "rock")).toHaveLength(6);
    const reef = s.solids.filter((x) => x.kind === "cone" && x.mat === "rock" && x.h === 1) as Extract<Solid, { kind: "cone" }>[];
    expect(reef.length).toBeGreaterThanOrEqual(30); expect(reef.length).toBeLessThanOrEqual(40);
    for (const c of reef) expect(terrainAt(c.at.x, c.at.y)).toBe("reef");
    expect(s.solids.filter((x) => x.kind === "cone" && x.mat === "rock" && x.h === 1.5)).toHaveLength(20); // boulders on the point
  });

  it("sea() no longer builds the Writing platform (#427): it lives in platformAnimator", () => {
    const s = scene(), w = world(7);
    for (const site of ["wide", "tall"] as const) {
      const { out, accents } = platform(site);
      for (const x of out) { expect(s.solids, site).not.toContainEqual(x); expect(w.solids, site).not.toContainEqual(x); }
      for (const a of accents) { expect(s.accents, site).not.toContainEqual(a); expect(w.accents, site).not.toContainEqual(a); }
    }
    expect(s.solids.some((x) => x.mat === "boxGrey" || x.mat === "officeDark")).toBe(false);
  });

  it("buoys and wreck on the water; the wreck's buoy has a fixed light and a foam ring", () => {
    const s = scene();
    for (const b of BUOYS) expect(s.solids.some((x) => x.kind === "cylinder" && x.mat === "rust" && x.at.x === b.x && x.at.y === b.y && x.at.z === -1)).toBe(true);
    expect(s.buoys).toHaveLength(2);
    expect(s.solids.some((x) => x.kind === "cylinder" && x.mat === "steel" && x.at.x === WRECK_BUOY.x)).toBe(true);
    // #403: the wreck buoy's light is a haloless spot of r 1, not a dot
    expect(s.accents[0]).toEqual({ kind: "poly", pts: expect.any(Array), color: "magentaBleed", alpha: expect.any(Number) });
    const buoy = spotOf(s.accents[1]!)!;
    expect(buoy).toMatchObject({ color: "magentaMid", alpha: 1 });
    expect(buoy.r).toBeCloseTo(1, 9);
    expect([buoy.at.x, buoy.at.y, buoy.at.z].map((c) => Math.round(c * 1e6) / 1e6)).toEqual([WRECK_BUOY.x, WRECK_BUOY.y, 1]);
    expect(s.ground.some((g) => g.kind === "ground" && g.mat === "foam" && g.tris.length === 8)).toBe(true);
    // wreck (#83): no whole hull afloat; the bow sticks out (rust wedge with deck) and the stern house (deckhouse with windows, funnel, mast), all above the water
    expect(s.solids.some((x) => x.kind === "hull")).toBe(false);
    const near = (x: Solid) => { const b = bounds(x); return Math.hypot((b.min.x + b.max.x) / 2 - WRECK.x, (b.min.y + b.max.y) / 2 - WRECK.y) < 45; };
    const parts = s.solids.filter(near);
    expect(parts.filter((x) => x.kind === "poly" && x.mat === "hull" && x.footprint.length === 5)).toHaveLength(1); // bow wedge, underwater hull
    expect(parts.filter((x) => x.kind === "poly" && x.mat === "rust" && x.footprint.length === 5)).toHaveLength(1); // and its rusty topsides stripe
    expect(s.ground.filter((g) => g.kind === "ground" && g.mat === "foam" && g.tris.length === 8).length).toBeGreaterThanOrEqual(3); // foam: buoy, bow and stern of the wreck
    expect(parts.filter((x) => x.kind === "poly" && x.mat === "whitewash" && x.facade)).toHaveLength(2); // stern deckhouse
    expect(parts.some((x) => x.kind === "cylinder" && x.mat === "rust" && x.h > 2)).toBe(true); // funnel
    expect(parts.some((x) => x.kind === "poly" && x.mat === "steel" && x.h >= 4)).toBe(true); // mast
    for (const x of parts) expect(bounds(x).min.z).toBeGreaterThanOrEqual(-1); // nothing under the water
    const bow = parts.find((x) => x.kind === "poly" && x.mat === "hull" && x.footprint.length === 5)!, house = parts.find((x) => x.kind === "poly" && x.mat === "whitewash" && x.facade)!;
    const bb = bounds(bow), hb = bounds(house);
    expect(Math.hypot((bb.min.x + bb.max.x) / 2 - (hb.min.x + hb.max.x) / 2, (bb.min.y + bb.max.y) / 2 - (hb.min.y + hb.max.y) / 2)).toBeGreaterThan(20); // split in two: the center is sunk
    for (const x of s.solids) if (x.kind === "cylinder" || x.kind === "hull") if (bounds(x).min.x > ZONE_SPLIT_X + 60 && !inHeadland(x.at.x, x.at.y)) expect(water.has(terrainAt(x.at.x, x.at.y))).toBe(true);
  });

  it("neons: gallery of eight lights around the shaft, coast beacons in Blog and the keeper's cyan sign", () => {
    const s = scene();
    const { gallery, coast, keeperSign } = s.neon;
    expect(gallery).toHaveLength(8);
    for (const p of gallery) {
      expect(p.z).toBeCloseTo(s.lantern.z - 2, 6);
      expect(Math.abs(Math.hypot(p.x - LIGHTHOUSE.x, p.y - LIGHTHOUSE.y) - GALLERY_R)).toBeLessThan(1e-6);
    }
    expect(GALLERY_R).toBeCloseTo(2.2 + 0.5, 6); // deliberate drift pin (#133): last drum (2.2) + 0.5, in literals and not with the constants
    expect(coast.length).toBeGreaterThanOrEqual(6); expect(coast.length).toBeLessThanOrEqual(10);
    expect(coast).toEqual(COAST.map((p) => ({ x: p.x, y: p.y, z: COAST_Z })));
    expect(COAST_Z).toBe(1.2);
    coast.forEach((p, k) => {
      expect(worldZoneAt(p.x, p.y)).toBe("blog");
      expect(p.x).toBeGreaterThan(LIGHTHOUSE.x);
      if (k > 0) { const d = Math.hypot(p.x - coast[k - 1]!.x, p.y - coast[k - 1]!.y); expect(d).toBeGreaterThan(5); expect(d).toBeLessThan(7); }
    });
    const z = headlandZ(KEEPER.x + 4);
    expect(keeperSign.kind).toBe("poly");
    if (keeperSign.kind !== "poly") return;
    expect(keeperSign.color).toBe("cyan");
    const xs = keeperSign.pts.map((p) => p.x), ys = keeperSign.pts.map((p) => p.y), zs = keeperSign.pts.map((p) => p.z);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(2, 6);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(1, 6);
    expect(Math.min(...zs)).toBeCloseTo(z + 4, 6); // resting on the eave
    for (const y of ys) expect(y).toBeCloseTo(KEEPER.y + 6.42, 6); // front of the box, on the south face
    expect(s.solids.some((x) => x.kind === "prism" && x.mat === "steel" && x.at.y === KEEPER.y + 6 && x.at.z <= z + 4 && x.at.z + x.h >= z + 5 && x.at.x <= Math.min(...xs) && x.at.x + x.w >= Math.max(...xs))).toBe(true); // dark box behind
    // the static accents: keeper's window (poly) and wreck buoy (spot, a poly since #403); the Writing platform's lights are in platformAnimator (#427)
    expect(s.accents).toHaveLength(2);
    expect(s.accents.every((a) => a.kind === "poly")).toBe(true);
  });

  it("the whole render uses atlas colors", () => {
    const s = scene();
    const colors = allIsoColors();
    for (const i of buildRenderList([...s.ground, ...s.solids])) expect(colors.has(i.color)).toBe(true);
  });
});

describe("wreck: comment and position (#89)", () => {
  const doc = readFileSync(new URL("./sea.ts", import.meta.url), "utf8").match(/\/\*\*\n \* Wreck \(#83\)[\s\S]*?\*\/\nconst WRECK_LEN/)?.[0] ?? "";
  it("the docstring puts the wreck in the trench, ~16 u from the slope, and not the stern on the slope", () => {
    expect(doc).not.toBe("");
    expect(doc).toMatch(/sunk in the trench/);
    expect(doc).not.toMatch(/(at|on) the slope/);
    expect(doc).toMatch(/16 u east of the slope/);
    expect(doc).toMatch(/#87/);
  });
  it("the stern sits ~16 u east of the slope and the whole hull falls in the trench", () => {
    expect(WRECK.x - abyssX(WRECK.y)).toBeGreaterThan(15);
    expect(WRECK.x - abyssX(WRECK.y)).toBeLessThan(17);
    const near = (x: Solid) => { const b = bounds(x); return Math.hypot((b.min.x + b.max.x) / 2 - WRECK.x, (b.min.y + b.max.y) / 2 - WRECK.y) < 45; };
    const hull = scene().solids.filter((x): x is Poly => x.kind === "poly" && near(x)); // the wreck's plates; the buoy is a cylinder and stays out
    expect(hull.length).toBeGreaterThanOrEqual(6);
    for (const x of hull) for (const p of x.footprint) expect(terrainAt(p.x, p.y)).toBe("abyss");
  });
});
