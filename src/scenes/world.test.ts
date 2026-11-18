import { describe, expect, it } from "vitest";
import { buildRenderList } from "../iso/render-list";
import { bounds, isFlat, type Solid } from "../iso/solids";
import { BLEED, HEADLAND, WORLD, distToHeadland, pointInPolygon, worldZoneAt } from "../map/geo";
import { allIsoColors } from "../map/palette-iso";
import { STAIR_TOWER } from "./boiler-house";
import { city } from "./city";
import { PLANT } from "./factory";
import { LIGHTHOUSE } from "./sea";
import { TINKER_SITE, tinkerSign } from "./sign-tinker";
import { SUBSTATION } from "./substation";
import { LANDMARKS, world, zoneRng } from "./world";

describe("world", () => {
  it("is deterministic and each zone has its own random stream", () => {
    expect(JSON.stringify(world(7))).toBe(JSON.stringify(world(7)));
    expect(zoneRng(7, "portfolio").next()).not.toBe(zoneRng(7, "cv").next());
    expect(zoneRng(7, "portfolio").next()).toBe(zoneRng(7, "portfolio").next());
  });

  it("with all zones it brings the shipyard and the complete terrain", () => {
    const w = world(7);
    expect(w.shipyard).not.toBeNull();
    expect(w.factory).not.toBeNull();
    expect(w.solids.length).toBeGreaterThan(700);
    expect(w.terrain.water.reduce((n, s) => n + (s.kind === "ground" ? s.tris.length : 0), 0) > 300).toBe(true);
    for (const s of [...w.shipyard!.solids, ...w.factory!.solids, ...w.city!.solids, ...w.sea!.solids]) {
      const b = bounds(s);
      expect(b.min.x).toBeGreaterThanOrEqual(WORLD.x0 - 2); expect(b.max.x).toBeLessThanOrEqual(WORLD.x1 + 1); // the district grows up to the west edge of the world
      expect(b.min.y).toBeGreaterThanOrEqual(WORLD.y0 - 1); expect(b.max.y).toBeLessThanOrEqual(WORLD.y1 + 1);
    }
    for (const s of w.solids) { // the built margins live on the bleed
      const b = bounds(s);
      expect(b.min.x).toBeGreaterThanOrEqual(WORLD.x0 - BLEED.x); expect(b.max.x).toBeLessThanOrEqual(WORLD.x1 + BLEED.x);
      expect(b.min.y).toBeGreaterThanOrEqual(WORLD.y0 - BLEED.y); expect(b.max.y).toBeLessThanOrEqual(WORLD.y1 + BLEED.y);
    }
    expect(w.hinterland).not.toBeNull(); expect(w.tech).not.toBeNull(); expect(w.fair).not.toBeNull();
    expect(world(7, { zones: ["portfolio", "cv", "blog"] }).tech).toBeNull(); // with an explicit filter there is no bleed or margins
    expect(world(7, { zones: ["portfolio", "cv", "blog"] }).fair).toBeNull();
  });

  it("filtering by zone leaves everything else out", () => {
    const w = world(7, { zones: ["cv"] });
    expect(w.shipyard).toBeNull();
    expect(w.city).not.toBeNull();
    expect(w.solids.length).toBeGreaterThan(250);
    expect(w.terrain.bleed).toEqual([]);
    const b = world(7, { zones: ["blog"] });
    expect(b.city).toBeNull();
    expect(b.sea).not.toBeNull();
    expect(b.solids.length).toBeGreaterThanOrEqual(80);
  });

  it("the whole world brings shipyard and city, and the Resume landmark falls on the tower", () => {
    const w = world(7);
    expect(w.city).not.toBeNull();
    expect(w.solids.length).toBeGreaterThan(900);
    expect(w.solids.filter((s) => !isFlat(s) && worldZoneAt(bounds(s).min.x, bounds(s).min.y) === "cv").length).toBeGreaterThan(450);
    const tower = w.solids.find((s) => s.kind === "prism" && s.h === 30)!;
    const b = bounds(tower);
    expect(LANDMARKS.cv.x).toBeGreaterThan(b.min.x); expect(LANDMARKS.cv.x).toBeLessThan(b.max.x);
    expect(LANDMARKS.cv.y).toBeGreaterThan(b.min.y); expect(LANDMARKS.cv.y).toBeLessThan(b.max.y);
  });

  it("shipyard + factory, city + district and Blog do not share building materials, except those shared by rule", () => {
    const w = world(7);
    const mats = (solids: Solid[]) => new Set(solids.filter((s) => s.kind !== "cone").map((s) => s.mat));
    const portfolio = mats([...w.shipyard!.solids, ...w.factory!.solids, ...w.factory!.excavator]), // the excavator lives outside factory.solids (#216)
      cv = mats(w.city!.solids), blog = mats(w.sea!.solids);
    // Exact equality (#218): fails if one stops being shared or another appears. office: lilac gray of the excavator (decision of #207);
    // asphalt: heads of the station's traffic lights (#277) and lantern caps (#278); stone: shaft of the clock tower and paving: esplanade slab (#278);
    // deck: level-crossing planks (#277) and terraces of the Resume pier (#190);
    // brick: factory/station walls, the harbor buildings of the Resume (#326) and the reconversion kit of the warehouses strip (#325); sheetTeal: fitting-out sheds of the shipyard (#323) and vaults of the harbor buildings (#326);
    // concrete: walls of the Resume inlet (#326), the freight dock (#325) and the factory/shipyard buildings; hull: fishing boats of the Resume inlet (#326) and the ships of the shipyard;
    // boxBlue/boxGreen/boxRust: containers of the freight lot recipes and of the freight yard (#325; which box colours appear depends on the draw) (stackContainers, shared with the shipyard's container yard); whitewash: reconversion kit (#325), also used by the factory;
    // sheetGreen left the list with the budget cut of #328: the service strip keeps one storeroom, and with seed 7 it is not green.
    // glass: the panel of the Resume crown on the tower (#391); the city's other glass is facade faces, not the mat of a solid.
    // officeDark: panels of the tinker sign on the south hall (#392) and offices of the city.
    const sharedWithCity = ["asphalt", "boxBlue", "boxGreen", "boxRust", "brick", "concrete", "deck", "glass", "hull", "office", "officeDark", "paving", "rust", "sheetTeal", "steel", "stone", "whitewash"];
    expect([...portfolio].filter((m) => cv.has(m)).sort()).toEqual([...sharedWithCity].sort());
    const sharedWithBlog = ["steel", "rust", "hull", "rock", "glass", "whitewash", "deck", "boxGrey", "officeDark"]; // boxGrey, officeDark: hut and sign panel of the Writing platform in the sea (#390); glass: the lighthouse lantern (spec §7); whitewash: porcelain and finials of the factory (#207); deck: level-crossing planks (#277), ship decks and terraces of the Resume pier (#190)
    for (const other of [portfolio, cv]) for (const m of blog) if (other.has(m)) expect(sharedWithBlog).toContain(m);
  });

  it("the landmarks fall in their zone", () => {
    for (const z of ["portfolio", "cv", "blog"] as const) expect(worldZoneAt(LANDMARKS[z].x, LANDMARKS[z].y)).toBe(z);
  });

  it("the whole render uses atlas colors", () => {
    const w = world(7);
    const colors = allIsoColors();
    for (const i of buildRenderList([...w.terrain.ground, ...w.terrain.water, w.terrain.foam, ...w.terrain.bleed, ...w.ground, ...w.solids])) expect(colors.has(i.color)).toBe(true);
  });

  it("no raised solid from another scene enters the substation fence (#244)", () => {
    const w = world(7);
    const mine = new Set(w.factory!.solids);
    const others = w.solids.filter((s) => !isFlat(s) && !mine.has(s));
    expect(w.solids.filter((s) => mine.has(s))).toHaveLength(mine.size); // world() reuses the factory's objects
    for (const s of others) {
      const b = bounds(s);
      expect(b.max.x <= SUBSTATION.x0 || b.min.x >= SUBSTATION.x1 || b.max.y <= SUBSTATION.y0 || b.min.y >= SUBSTATION.y1, JSON.stringify(s).slice(0, 90)).toBe(true);
    }
  });

  it("no raised solid from another scene enters the plant footprint or the truck yard (#246)", () => {
    const w = world(7);
    const mine = new Set(w.factory!.solids);
    const others = w.solids.filter((s) => !isFlat(s) && !mine.has(s));
    const areas = [{ x0: PLANT.x, x1: STAIR_TOWER.x1, y0: PLANT.y - 0.6, y1: PLANT.y + PLANT.d + 1.5 }, { x0: PLANT.x, x1: STAIR_TOWER.x1, y0: PLANT.y + PLANT.d + 1.5, y1: PLANT.y + PLANT.d + 16 }]; // roof from the north eave to the plinth; yard to the south, 
    // the seam fence of #319 (steel wall at y 89.4, posts at y 89.3, lamp poles at y 88.2) runs along the south edge of the yard on purpose
    const isFence = (s: Solid) => s.kind === "prism" && s.mat === "steel" && ((s.at.y === 89.4 && s.w === 156) || (s.at.y === 89.3 && s.w === 0.3) || (s.at.y === 88.2 && s.w === 0.6 && s.h === 5));
    for (const s of others) {
      if (isFence(s)) continue;
      const b = bounds(s);
      for (const a of areas) expect(b.max.x <= a.x0 || b.min.x >= a.x1 || b.max.y <= a.y0 || b.min.y >= a.y1, JSON.stringify(s).slice(0, 90)).toBe(true);
    }
  });

  it("the shipyard in the north band does not touch the siding, the wagons, the locomotive or the tower crane (#247)", () => {
    const w = world(7);
    const siding = w.factory!.ground.filter((s) => s.kind === "strip").map(bounds).filter((b) => b.min.y >= -9.01 && b.max.y <= -6.99); // siding rails
    const pieces = w.factory!.solids.filter((s) => !isFlat(s)).map(bounds).filter((b) => b.min.y >= -13.1 && b.max.y <= -6.7); // wagons, locomotive and tower crane
    expect(siding).toHaveLength(2);
    expect(pieces.length).toBeGreaterThanOrEqual(8);
    // the tinker sign (#392) stands over the siding at z ≥ 16.6 but for one ground post on its north rail: exempt here, follow-up #408
    const sign: Solid[] = [];
    tinkerSign(sign, [], TINKER_SITE);
    const signKeys = new Set(sign.map((s) => JSON.stringify(s)));
    const all = w.shipyard!.solids.filter((s) => s.kind !== "cone" && bounds(s).max.y < 0 && bounds(s).min.x < 198); // without pier or bollards
    expect(all.filter((s) => signKeys.has(JSON.stringify(s)))).toHaveLength(sign.length); // the exemption matches the sign and nothing else
    const band = all.filter((s) => !signKeys.has(JSON.stringify(s)));
    expect(band.length).toBeGreaterThanOrEqual(40);
    for (const s of band) {
      const b = bounds(s), where = JSON.stringify(s).slice(0, 90);
      expect(b.min.y, where).toBeGreaterThanOrEqual(-60);
      for (const o of [...siding, ...pieces]) {
        expect(b.max.x <= o.min.x + 1e-9 || o.max.x <= b.min.x + 1e-9 || b.max.y <= o.min.y + 1e-9 || o.max.y <= b.min.y + 1e-9, where).toBe(true);
      }
    }
  });

  it("the Blog landmark is the lighthouse (#426) and the bleed exists only with the whole world", () => {
    expect(LANDMARKS.blog).toEqual({ x: LIGHTHOUSE.x, y: LIGHTHOUSE.y, z: 0 });
    expect(worldZoneAt(LANDMARKS.blog.x, LANDMARKS.blog.y)).toBe("blog");
    expect(world(7).terrain.bleed.length).toBeGreaterThan(0);
    expect(world(7, { zones: ["portfolio"] }).terrain.bleed).toEqual([]);
  });

  it("#426: only the sea's solids have a box corner inside the moved headland, and nothing else stands within 2 u of it", () => {
    const w = world(7), own = new Set(w.sea!.solids), flat = HEADLAND.flat();
    const inside: string[] = [], close: string[] = [];
    for (const s of w.solids) {
      if (own.has(s)) continue;
      const b = bounds(s), corners = [[b.min.x, b.min.y], [b.max.x, b.min.y], [b.min.x, b.max.y], [b.max.x, b.max.y]] as const;
      const where = `${s.kind} ${b.min.x.toFixed(1)},${b.min.y.toFixed(1)}`;
      if (corners.some(([x, y]) => pointInPolygon(x, y, flat))) inside.push(where);
      else if (Math.min(...corners.map(([x, y]) => distToHeadland(x, y))) < 2) close.push(where);
    }
    expect(inside).toEqual([]);
    expect(close).toEqual([]); // the promenade lamps (x 341..341.6) are the nearest, at 2.4 u
  });

  it("Portfolio with factory exceeds 400 raised solids and the factory stays in the west column, the siding with the crane or the new region (#246)", () => {
    const w = world(7);
    const raised = w.solids.filter((s) => !isFlat(s) && worldZoneAt(bounds(s).min.x, bounds(s).min.y) === "portfolio");
    expect(raised.length).toBeGreaterThan(400);
    const west = (b: ReturnType<typeof bounds>) => b.max.x <= 0; // west column
    const sidingAndCrane = (b: ReturnType<typeof bounds>) => b.min.y >= -13.1 && b.max.y <= -6.7; // siding and tower crane, which stay
    const inNewRegion = (b: ReturnType<typeof bounds>) => b.min.x >= 4 && b.max.x <= 98.7 && b.min.y >= -4 && b.max.y <= 99; // region the shipyard leaves (#238); x ≤ 98.7 for every solid, stricter than the issue (which asks it for anything over 7 tall)
    expect(w.factory!.solids.filter((s) => !west(bounds(s)) && !sidingAndCrane(bounds(s)) && !inNewRegion(bounds(s))).map((s) => JSON.stringify(s).slice(0, 90))).toEqual([]);
  });

  it("Portfolio budget: shipyard ≤ 900 raised solids, shipyard + factory ≤ 1 700 (#324)", () => {
    const w = world(7);
    const sy = w.shipyard!.solids.filter((s) => !isFlat(s)).length, fa = w.factory!.solids.filter((s) => !isFlat(s)).length;
    expect(sy).toBeLessThanOrEqual(900);
    expect(sy + fa).toBeLessThanOrEqual(1700);
  });

  it("the city lights come from zoneRng(seed, \"cv\", 3)", () => {
    const w = world(7, { zones: ["cv"] });
    expect(w.city!.lights.windows.length).toBeGreaterThan(0);
    expect(JSON.stringify(w.city!.lights)).toBe(JSON.stringify(city(zoneRng(7, "cv"), zoneRng(7, "cv", 1), zoneRng(7, "cv", 3)).lights));
  });
});
