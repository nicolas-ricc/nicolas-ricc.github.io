import { describe, expect, it } from "vitest";
import { BLEED, MOUTH_Y, SHORE_W, distToHeadland, inHeadland, STATION_LAND, inStationLand, TIP_BOX, QUAY_X, RIVER_HALF, WORLD, ZONE_SPLIT_X, ZONE_SPLIT_Y, riverCenter, worldZoneAt } from "../map/geo";
import { createRng } from "../map/seed";
import type { Solid, Tri } from "../iso/solids";
import { BLEED_WATER, clearOfWater } from "./terrain-classify";
import { CELL, baseToneAt, bleedTerrainAt, bleedZ, buildTerrain, seaTerrainAt, shipyardTerrainAt, terrainAt, waterBand } from "./terrain";

const tris = (s: Solid): Tri[] => (s.kind === "ground" ? s.tris : []);
// The row of vertices at ZONE_SPLIT_Y = 90 is shared by the last row of shipyard cells (center 87) and the first of the city (center 93).
const SEAM_Y = Math.floor(ZONE_SPLIT_Y / CELL) * CELL;
const allTris = (m: ReturnType<typeof buildTerrain>): Tri[] => [...m.ground, ...m.water].flatMap(tris);

describe("classification", () => {
  it("the seam is aligned to the 6 u and 18 u grids", () => {
    expect(ZONE_SPLIT_Y % 6).toBe(0);
    expect(ZONE_SPLIT_Y % 18).toBe(0);
  });
  it("shipyard: slab west of the quay, river, river mouth and jungle at the edges", () => {
    expect(shipyardTerrainAt(50, 50)).toBe("slab");
    expect(shipyardTerrainAt(QUAY_X + 20, 60)).toBe("water");
    expect(shipyardTerrainAt(300, 10)).toBe("water");     // bay
    expect(shipyardTerrainAt(300, MOUTH_Y + 2)).toBe("east");
    expect(shipyardTerrainAt(10, 144)).toBe("jungle");   // below the seam (unreached by terrainAt, kept for the jungle rule)
    expect(shipyardTerrainAt(98, 120)).toBe("asphalt");  // station land, west strip
    expect(shipyardTerrainAt(150, 100)).toBe("slab");    // station land, slab
    expect(shipyardTerrainAt(150, 20)).toBe("dock");
    expect(shipyardTerrainAt(-30, 50)).toBe("slab");     // track yard
    expect(shipyardTerrainAt(-30, 130)).toBe("jungle");
    expect(shipyardTerrainAt(50, -30)).toBe("slab");     // factory band
    expect(shipyardTerrainAt(300, -30)).toBe("water");   // the bay continues to the north
  });
  it("shipyard: the new north coast, with land in front of the sheds, cove and NE point", () => {
    expect(terrainAt(300, 18)).toBe("east");   // new land in front of the sheds (formerly water: coast at y 21)
    expect(terrainAt(286, 27)).toBe("water");  // cove to the NW
    expect(terrainAt(339, 9)).not.toBe("water"); // NE point
  });
  it("sea: point, reef, shore and open sea", () => {
    expect(terrainAt(380, 118)).toBe("headland");
    expect(terrainAt(336, 115)).toBe("headland");          // the base of the point wins in the shipyard zone
    expect(seaTerrainAt(404, 118)).toBe("reef");
    expect(seaTerrainAt(350, 60)).toBe("shore");           // next to the shipyard coast
    expect(seaTerrainAt(400, 200)).toBe("sea");
    expect(seaTerrainAt(350, 10)).toBe("shore");           // in front of the bay there is a shoal
    expect(seaTerrainAt(370, 10)).toBe("sea");
    expect(seaTerrainAt(500, 200)).toBe("abyss");
    expect(seaTerrainAt(410, 60)).toBe("sea");
    expect(terrainAt(ZONE_SPLIT_X + 2, 200)).toBe("shore"); // clicks through to Resume but is shore
  });
  it("city: jungle belt, estuary, jungle east bank, craters and asphalt", () => {
    expect(terrainAt(50, ZONE_SPLIT_Y + 4)).toBe("asphalt");  // city from the seam
    expect(terrainAt(50, 94)).toBe("asphalt");
    expect(terrainAt(-30, 100)).toBe("asphalt");
    expect(terrainAt(50, 140)).toBe("asphalt");
    expect(terrainAt(98, 100)).toBe("asphalt");                // station land, strip west of the track
    expect(terrainAt(150, 100)).toBe("slab");                  // station land
    expect(terrainAt(220, 100)).toBe("water");                 // channel
    expect(terrainAt(260, 100)).toBe("water");
    expect(terrainAt(290, 100)).toBe("asphalt");               // east bank, between the ring and x 306
    expect(terrainAt(320, 100)).toBe("jungle");
    expect(terrainAt(-56, 200)).toBe("asphalt");               // west edge: the tech district continues straight from the city
    expect(terrainAt(100, 330)).toBe("asphalt");               // south edge, likewise
    expect(terrainAt(255, 200)).toBe("water");                 // estuary
    expect(terrainAt(268, 200)).toBe("jungle");                // east bank, before the ring
    expect(terrainAt(290, 200)).toBe("asphalt");               // city to the east
    expect(terrainAt(60, 185)).toBe("jungle");                 // crater
    expect(terrainAt(50, 200)).toBe("asphalt");
    expect(terrainAt(340, 200)).toBe("asphalt");               // under the seawall
    expect(terrainAt(ZONE_SPLIT_X, 200)).toBe("shore");        // the east seam is still sea
    expect(terrainAt(-30, 290)).toBe("asphalt");
    expect(terrainAt(300, 300)).toBe("jungle");
    expect(terrainAt(338, 300)).toBe("asphalt");
    expect(terrainAt(300, 267)).toBe("jungle");
    expect(terrainAt(335, 300)).toBe("jungle");
  });
  it("in the cv zone there is only asphalt, jungle and water", () => {
    const seen = new Set<string>();
    for (let y = ZONE_SPLIT_Y + 3; y < WORLD.y1; y += CELL) for (let x = WORLD.x0 + 3; x < ZONE_SPLIT_X; x += CELL) if (!inStationLand(x, y) && !inHeadland(x, y) && distToHeadland(x, y) >= SHORE_W) seen.add(terrainAt(x, y));
    expect([...seen].sort()).toEqual(["asphalt", "jungle", "water"]);
  });
  it("the water is continuous at the seam and the estuary does not reach the border with Blog", () => {
    // the last row of shipyard cells (center 141) and the first of the city (center 147) wet the same columns
    const waterX = (y: number) => { const xs: number[] = []; for (let x = 3; x < ZONE_SPLIT_X; x += CELL) if (terrainAt(x, y) === "water") xs.push(x); return xs; };
    const north = waterX(141), south = waterX(147);
    expect(north.length).toBeGreaterThan(3);
    expect(south[0]).toBe(north[0]);
    expect(Math.abs(south[south.length - 1]! - north[north.length - 1]!)).toBeLessThanOrEqual(CELL);
    // the new seam (y 90): the channel is the shipyard's on both sides
    const n90 = waterX(87), s90 = waterX(93);
    expect(n90.length).toBeGreaterThan(3);
    expect(s90[0]).toBe(n90[0]);
    expect(Math.abs(s90[s90.length - 1]! - n90[n90.length - 1]!)).toBeLessThanOrEqual(CELL);
    // at the far south the estuary still leaves land before x = 344
    expect(terrainAt(ZONE_SPLIT_X - 3, WORLD.y1 - 3)).not.toBe("water");
  });
  it("no land point clicks through to Blog and the whole trench clicks through to Blog", () => {
    const land = new Set(["slab", "east", "jungle", "dock", "asphalt", "headland", "reef"]);
    for (let y = WORLD.y0 + 3; y < WORLD.y1; y += CELL) for (let x = WORLD.x0 + 3; x < WORLD.x1; x += CELL) {
      const t = terrainAt(x, y), z = worldZoneAt(x, y);
      if (z === "blog") expect(land.has(t)).toBe(false);
      if (t === "abyss") expect(z).toBe("blog");
    }
  });
  it("bleed: built land near the content, jungle and hills beyond; the estuary and the sea continue to the south, the bay to the north", () => {
    expect(bleedTerrainAt(-100, 100)).toBe("urban");        // west of Resume, from the seam
    expect(bleedTerrainAt(-100, 80)).toBe("industrial");    // west of Portfolio
    expect(bleedTerrainAt(-100, 200)).toBe("urban");        // west of Resume
    expect(bleedTerrainAt(100, 400)).toBe("urban");         // south of Resume
    expect(bleedTerrainAt(100, -100)).toBe("industrial");   // north of the factory
    expect(bleedTerrainAt(-100, -100)).toBe("industrial");  // NW corner
    expect(bleedTerrainAt(-100, 400)).toBe("urban");        // SW corner
    expect(bleedTerrainAt(-300, 100)).toBe("jungle");       // beyond the west reach
    expect(bleedTerrainAt(100, -400)).toBe("jungle");       // beyond the north reach (now up to y −348 plus the reach, with the fair in between)
    expect(bleedTerrainAt(100, 700)).toBe("jungle");        // beyond the south reach
    expect(bleedTerrainAt(250, 400)).toBe("river");         // the estuary continues
    expect(bleedTerrainAt(330, 340)).toBe("jungle");        // the base of the south point, between the estuary and the sea
    expect(bleedTerrainAt(325, 370)).toBe("jungle");        // near the end of the south point (at y 370 the land runs from x 317 to 338; it ends at y 380)
    expect(bleedTerrainAt(330, 385)).toBe("river");         // south of the end of the point: all water
    expect(bleedTerrainAt(338, 400)).toBe("river");         // further south the point no longer exists; the estuary is all water up to the sea
    expect(bleedTerrainAt(346, 400)).toBe("shore");         // shore in front of the Resume coast
    expect(bleedTerrainAt(400, 400)).toBe("sea");
    expect(bleedTerrainAt(560, 500)).toBe("abyss");
    expect(bleedTerrainAt(250, 460)).toBe("river");         // at y 460 the estuary has already reached 344: continuous water up to the sea
    expect(bleedTerrainAt(343, 460)).toBe("river");
    expect(bleedTerrainAt(360, -100)).toBe("sea");         // bay to the north, west of the trench
    expect(bleedTerrainAt(440, -100)).toBe("abyss");       // the trench continues north of the content (abyssX(−100) ≈ 382)
    expect(bleedTerrainAt(600, 100)).toBe("abyss");
    expect(bleedZ(-380, 100)).toBeGreaterThan(9);   // hill to the west, beyond the built land
    expect(bleedZ(-380, -430)).toBeGreaterThan(9);  // hill to the north, inside the bleed grid
    expect(bleedZ(-100, 100)).toBe(0.6);            // over the built land it does not rise
    expect(bleedZ(100, 500)).toBe(0.6);             // flat to the south
    expect(bleedZ(-60, 100)).toBe(0.6);             // at the seam it does not rise
    expect(bleedZ(riverCenter(-300) - RIVER_HALF - 10, -300)).toBeLessThan(3); // the hill drops before the cut with the bay: no cliff
  });
});

describe("buildTerrain", () => {
  it("the south point is drawn in 6 u cells", () => {
    const m = buildTerrain(createRng(7));
    const side = (t: Tri) => Math.max(...t.pts.map((p) => p.x)) - Math.min(...t.pts.map((p) => p.x));
    const inBox = (t: Tri) => t.pts.every((p) => p.x >= TIP_BOX.x0 && p.x <= TIP_BOX.x1 && p.y >= TIP_BOX.y0 && p.y <= TIP_BOX.y1);
    const bleed = m.bleed.flatMap(tris).filter(inBox);
    expect(bleed.length).toBeGreaterThanOrEqual(50);
    for (const t of [...bleed, ...m.water.flatMap(tris).filter(inBox)]) expect(side(t)).toBe(6);
  });
  it("the edge of the south point's box is water, except the seam", () => {
    for (let v = TIP_BOX.x0; v <= TIP_BOX.x1; v += 6) expect(BLEED_WATER.has(bleedTerrainAt(v, TIP_BOX.y1))).toBe(true);
    for (let v = TIP_BOX.y0 + 6; v <= TIP_BOX.y1; v += 6) {
      expect(BLEED_WATER.has(bleedTerrainAt(TIP_BOX.x0, v))).toBe(true);
      expect(BLEED_WATER.has(bleedTerrainAt(TIP_BOX.x1, v))).toBe(true);
    }
  });
  it("the subdivision does not touch the rng", () => {
    const r = createRng(7); let n = 0; const next = r.next; r.next = () => { n++; return next(); };
    buildTerrain(r);
    expect(n).toBe(11912);
  });
  it("a single deterministic mesh covering the world", () => {
    const a = buildTerrain(createRng(7)), b = buildTerrain(createRng(7));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const t = allTris(a);
    expect(t.length).toBeGreaterThan(2 * ((WORLD.x1 - WORLD.x0) / CELL) * ((WORLD.y1 - WORLD.y0) / CELL) * 0.9);
    // the water (m.water) mixes content and bleed: only the ground (m.ground) is bounded to WORLD.
    for (const tri of a.ground.flatMap(tris)) for (const p of tri.pts) {
      expect(p.x).toBeGreaterThanOrEqual(WORLD.x0); expect(p.x).toBeLessThanOrEqual(WORLD.x1);
      expect(p.y).toBeGreaterThanOrEqual(WORLD.y0); expect(p.y).toBeLessThanOrEqual(WORLD.y1);
    }
  });
  it("the water is split by depth into four materials, all at z −1, with baseTone in [−1, 1] and foam next to the coast", () => {
    const m = buildTerrain(createRng(7));
    expect(m.water.map((w) => w.mat)).toEqual(["shallow", "water", "waterDeep", "abyss"]);
    for (const w of m.water) {
      expect(tris(w).length).toBeGreaterThan(100);
      for (const t of tris(w)) { expect(t.pts.every((p) => p.z === -1)).toBe(true); expect(t.toneOffset ?? 0).toBe(0); expect(Math.abs(t.baseTone ?? 0)).toBeLessThanOrEqual(1); }
    }
    expect(m.foam.mat).toBe("foam");
    expect(tris(m.foam).length).toBeGreaterThan(200);
    expect(waterBand(200, 300)).toBe("shallow"); expect(waterBand(240, 300)).toBe("water"); // shore and center of the estuary
    expect(waterBand(560, 60)).toBe("abyss"); expect(waterBand(100, 100)).toBeNull();
    expect(tris(m.water[3]!).length).toBeGreaterThan(400);
    // baseTone has teeth: "shallow" does not stay all at 0 (depthAt quantizes in CELL steps, so the
    // first water cell next to land, d = CELL, is the shallow edge: +1), and "water" crosses through both ends.
    expect(tris(m.water[0]!).some((t) => t.baseTone === 1)).toBe(true);
    expect(tris(m.water[1]!).some((t) => t.baseTone === 1)).toBe(true);
    expect(tris(m.water[1]!).some((t) => t.baseTone === -1)).toBe(true);
    // (200,300) is the estuary shore (waterBand "shallow"), at depthAt = CELL = 6 from land: the
    // first water cell, the shallowest possible edge, so baseToneAt gives exactly +1.
    expect(waterBand(200, 300)).toBe("shallow");
    expect(baseToneAt(200, 300, "shallow")).toBe(1);
  });

  it("the bleed leaves no holes: every 18 cell with water inside the cover produces 2 triangles (not subdivided, measurement-gated)", () => {
    const m = buildTerrain(createRng(7));
    const all = m.water.flatMap(tris);
    // real bleed cell (anchor bx0 = -402, by0 = -438), in the bay to the north, inside the cover.
    const x0 = 282, y0 = -420, x1 = 300, y1 = -402;
    const inCell = all.filter((t) => t.pts.every((p) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1));
    expect(inCell.length).toBe(2);
  });

  it("the shipyard channel and the bay still classify as water (not as a hole) in m.water", () => {
    const m = buildTerrain(createRng(7));
    const all = m.water.flatMap(tris);
    // the bay is river: north of the river mouth, east of the channel, there is still water in m.water.
    expect(all.some((t) => t.pts.every((p) => p.y < MOUTH_Y && p.x > 300))).toBe(true);
    // the shipyard channel never crosses west of the quay: no content water triangle
    // (inside WORLD, y < ZONE_SPLIT_Y) has vertices at x < QUAY_X.
    const inContent = (p: { x: number; y: number }) => p.x >= WORLD.x0 && p.x <= WORLD.x1 && p.y >= WORLD.y0 && p.y <= WORLD.y1;
    expect(all.filter((t) => t.pts.every((p) => inContent(p) && p.y < ZONE_SPLIT_Y))).not.toEqual([]);
    expect(all.filter((t) => t.pts.every((p) => inContent(p) && p.y < ZONE_SPLIT_Y)).every((t) => t.pts.every((p) => p.x >= QUAY_X))).toBe(true);
  });

  it("the bleed water uses 18 cells, inside and outside the cover (measurement-gated: worst redraw)", () => {
    const m = buildTerrain(createRng(7));
    const side = (t: Tri) => Math.max(...t.pts.map((p) => p.x)) - Math.min(...t.pts.map((p) => p.x));
    const at = (x: number, y: number) => m.water.flatMap(tris).filter((t) => t.pts.some((p) => Math.abs(p.x - x) < 1 && Math.abs(p.y - y) < 1));
    // real grid vertices (anchored at bx0=-402, by0=-438): inside the cover, (264,−348), in the
    // bay north of the fair; outside, (858,660), open sea to the southeast. The `every` calls say nothing
    // about an empty set (that was the case of the earlier (597,300), which fell in the center of a cell,
    // not on a vertex): cells must be found there first.
    expect(at(264, -348).length).toBeGreaterThan(0);
    expect(at(858, 660).length).toBeGreaterThan(0);
    expect(at(264, -348).every((t) => side(t) === 18)).toBe(true);
    expect(at(858, 660).every((t) => side(t) === 18)).toBe(true);
  });
  it("the point is high and drops to the sea; the dry dock has no ground (the scene provides it)", () => {
    const m = buildTerrain(createRng(7));
    const rock = m.ground.filter((g) => g.kind === "ground" && g.mat === "rock").flatMap(tris);
    const high = rock.filter((t) => t.pts.every((p) => p.z >= 4));
    expect(high.length).toBeGreaterThan(20);
    // the base of the point (x < 340) is low: nothing tall next to the quay sheds
    const base = rock.filter((t) => t.pts.every((p) => p.x <= 340 && p.y > 96 && p.y < 136));
    expect(base.length).toBeGreaterThan(0);
    expect(base.every((t) => t.pts.every((p) => p.z < 4))).toBe(true);
    const inDock = allTris(m).filter((t) => t.pts.every((p) => p.x > 122 && p.x < 190 && p.y > 8 && p.y < 28));
    expect(inDock).toEqual([]);
  });
  it("filtering by zone preserves the heights at the seam", () => {
    const p = buildTerrain(createRng(7), ["portfolio"]), c = buildTerrain(createRng(7), ["cv"]);
    // ground only: a shore vertex of the east bank also belongs to a water cell (z −1) in one zone and to a land cell in the other
    const onSeam = (m: ReturnType<typeof buildTerrain>) => new Map(m.ground.flatMap(tris).flatMap((t) => t.pts).filter((v) => v.y === SEAM_Y).map((v) => [`${v.x},${v.y}`, v.z]));
    const a = onSeam(p), b = onSeam(c);
    expect(a.size).toBeGreaterThan(10);
    expect([...a.keys()].filter((k) => b.has(k)).length).toBeGreaterThan(10);
    for (const [k, z] of a) if (b.has(k)) expect(b.get(k)).toBe(z);
    const { x0, x1, y1 } = STATION_LAND;
    expect(allTris(p).every((t) => t.pts.every((v) => v.y <= ZONE_SPLIT_Y + CELL || (v.y <= y1 + CELL && v.x >= x0 - CELL && v.x <= x1 + CELL) || distToHeadland(v.x, v.y) < SHORE_W + CELL))).toBe(true); // or the headland and its shore, Portfolio by geography
  });
  it("the asphalt is nearly flat and comes out as its own ground", () => {
    const m = buildTerrain(createRng(7), ["cv"]);
    const asphalt = m.ground.filter((g) => g.kind === "ground" && g.mat === "asphalt").flatMap(tris);
    expect(asphalt.length).toBeGreaterThan(600);
    expect(asphalt.every((t) => t.pts.every((p) => Math.abs(p.z) <= 0.1 || terrainAt(p.x, p.y) !== "asphalt"))).toBe(true);
    expect(m.ground.some((g) => g.kind === "ground" && g.mat === "paving")).toBe(false);
  });
  it("the bleed surrounds the content with 18 cells, no hills to the south or east, and no jitter at the seam", () => {
    const m = buildTerrain(createRng(7));
    expect(m.bleed.length).toBeGreaterThan(0);
    const bt = m.bleed.flatMap(tris);
    expect(bt.length).toBeGreaterThan(3000);
    const mats = new Set(m.bleed.map((s) => s.kind === "ground" && s.mat));
    for (const mt of mats) expect(["leafDark", "rock", "slab", "asphalt", "sand"]).toContain(mt);
    for (const t of bt) for (const p of t.pts) {
      expect(p.x).toBeGreaterThanOrEqual(WORLD.x0 - BLEED.x); expect(p.x).toBeLessThanOrEqual(WORLD.x1 + BLEED.x);
      expect(p.y).toBeGreaterThanOrEqual(WORLD.y0 - BLEED.y); expect(p.y).toBeLessThanOrEqual(WORLD.y1 + BLEED.y);
      if ((p.y > WORLD.y1 && p.x >= WORLD.x0) || p.x > WORLD.x1) expect(p.z).toBeLessThanOrEqual(1.4); // to the south (except the SW corner, which stays behind) and to the east, flat
    }
    expect(bt.some((t) => t.pts.every((p) => p.y < WORLD.y0 - 250 && p.x < 100 && p.z > 6))).toBe(true); // hills to the north, beyond the built land
    expect(m.water.flatMap(tris).some((t) => t.pts.every((p) => p.y > WORLD.y1 && p.x > QUAY_X && p.x < 300 && p.z === -1))).toBe(true); // the estuary continues to the south (now in m.water, not in m.bleed)
    // seam: the bleed vertices on the content's edge have the content's base z, no jitter.
    // Only the stretch of the edge that touches the content: a vertex at x = WORLD.x0 but y = 400 is ordinary bleed jungle.
    const onSeam = (p: { x: number; y: number }) =>
      ((p.x === WORLD.x0 || p.x === WORLD.x1) && p.y >= WORLD.y0 && p.y <= WORLD.y1) ||
      ((p.y === WORLD.y0 || p.y === WORLD.y1) && p.x >= WORLD.x0 && p.x <= WORLD.x1);
    const seamZ = new Set(bt.flatMap((t) => t.pts).filter(onSeam).map((p) => p.z));
    expect(seamZ.size).toBeGreaterThan(0);
    for (const z of seamZ) expect([0, 0.6, -1]).toContain(z);
    const contentSeamZ = new Set(allTris(m).flatMap((t) => t.pts).filter(onSeam).map((p) => p.z));
    for (const z of contentSeamZ) expect([0, 0.6, -1]).toContain(z);
    // with a zone filter there is no bleed
    expect(buildTerrain(createRng(7), ["cv"]).bleed).toEqual([]);
  });

  it("the fair is flat sand in the north bleed", () => {
    expect(bleedTerrainAt(150, -264)).toBe("fair");
    const m = buildTerrain(createRng(7));
    const sand = m.bleed.find((s) => s.kind === "ground" && s.mat === "sand");
    expect(sand && sand.kind === "ground" && sand.tris.length).toBeGreaterThan(50);
    for (const t of tris(sand!)) for (const p of t.pts) expect(Math.abs(p.z)).toBeLessThanOrEqual(0.1);
  });
});

describe("clearOfWater", () => {
  it("true over slab, false over the river", () => {
    expect(clearOfWater(10, 10, 20, 20, 3)).toBe(true);
    expect(clearOfWater(250, 60, 252, 62, 3)).toBe(false);
  });

  it("the margin counts: box on land next to the bank", () => {
    expect(clearOfWater(271, 60, 272, 61, 0)).toBe(true);  // eastBank(60) = 269: the box is on land
    expect(clearOfWater(271, 60, 272, 61, 3)).toBe(false); // but within 3 u there is water
  });
});
