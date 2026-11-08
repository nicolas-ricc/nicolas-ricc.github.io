import { describe, expect, it } from "vitest";
import { bounds, type Solid, type Tri } from "../iso/solids";
import { WORLD } from "../map/geo";
import { createRng } from "../map/seed";
import { city } from "./city";
import { DARSENA, PROMENADE } from "./city-grid";
import { shipyard } from "./shipyard";
import { QUAY_CRANES, YARD, quayCranes } from "./shipyard-east";
import { buildTerrain } from "./terrain";
import { isWaterAt, terrainAt } from "./terrain-classify";

/**
 * Island coasts between the river/estuary and the sea (#237, spec
 * `2026-10-27-isla-costas-design.md` §6 and §8). The mask is the 6 u grid
 * anchored at (WORLD.x0, WORLD.y0); `isWaterAt` dispatches content and bleed.
 */
const C = 6;
const X0 = 234, X1 = 420, Y0 = -48, Y1 = 420;
const NX = (X1 - X0) / C, NY = (Y1 - Y0) / C;
const center = (i: number, j: number): [number, number] => [X0 + i * C + C / 2, Y0 + j * C + C / 2];
const isLand = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < NX && j < NY && !isWaterAt(...center(i, j));

/** Connected component (4-neighbors) of land that contains the cell at (320, 80): the island. */
function island(): Set<string> {
  const out = new Set<string>();
  const stack: [number, number][] = [[Math.floor((320 - X0) / C), Math.floor((80 - Y0) / C)]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    const k = `${i},${j}`;
    if (out.has(k) || !isLand(i, j)) continue;
    out.add(k);
    stack.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]);
  }
  return out;
}

const tris = (s: Solid): Tri[] => (s.kind === "ground" ? s.tris : []);

describe("island coast", () => {
  it("no straight stretch of the island coast exceeds 30 u (except seawall and lighthouse point)", () => {
    const isl = island();
    expect(isl.size).toBeGreaterThan(500);
    const inI = (i: number, j: number) => isl.has(`${i},${j}`);
    // the lighthouse point (headland and its reef) is left alone: its edges break the run
    const exemptCell = (i: number, j: number) => { const [x, y] = center(i, j); const t = terrainAt(x, y); return t === "headland" || t === "reef"; };
    const runs: string[] = [];
    // vertical edges at x = X0 + i·C, between cells i−1 and i
    for (let i = 0; i <= NX; i++) {
      let start = 0, side = 0;
      for (let j = 0; j <= NY; j++) {
        const a = inI(i - 1, j), b = inI(i, j), x = X0 + i * C, y = Y0 + j * C;
        const promenade = x === 342 && y >= 156 && y < 330;
        let s = j < NY && a !== b ? (a ? 1 : 2) : 0;
        if (s && (promenade || exemptCell(a ? i - 1 : i, j))) s = 0;
        if (s !== side) { if (side && (j - start) * C > 30) runs.push(`x=${x} y ${Y0 + start * C}..${y}`); start = j; side = s; }
      }
    }
    // horizontal edges at y = Y0 + j·C, between cells j−1 and j
    for (let j = 0; j <= NY; j++) {
      let start = 0, side = 0;
      for (let i = 0; i <= NX; i++) {
        const a = inI(i, j - 1), b = inI(i, j);
        let s = i < NX && a !== b ? (a ? 1 : 2) : 0;
        if (s && exemptCell(i, a ? j - 1 : j)) s = 0;
        if (s !== side) { if (side && (i - start) * C > 30) runs.push(`y=${Y0 + j * C} x ${X0 + start * C}..${X0 + i * C}`); start = i; side = s; }
      }
    }
    expect(runs).toEqual([]);
  });

  it("no solid on the island is within 3 u of the water (except the breakwater)", () => {
    const M = 3;
    const nearWater = (s: Solid): boolean => {
      const b = bounds(s);
      const cx0 = Math.floor((b.min.x - M - WORLD.x0) / C), cx1 = Math.floor((b.max.x + M - WORLD.x0) / C);
      const cy0 = Math.floor((b.min.y - M - WORLD.y0) / C), cy1 = Math.floor((b.max.y + M - WORLD.y0) / C);
      for (let j = cy0; j <= cy1; j++) for (let i = cx0; i <= cx1; i++) if (isWaterAt(WORLD.x0 + i * C + C / 2, WORLD.y0 + j * C + C / 2)) return true;
      return false;
    };
    const sy = shipyard(createRng(7));
    const cs = city(createRng(7), createRng(8), createRng(9));
    const onIsland = (s: Solid) => bounds(s).max.x >= 276;
    const breakwater = (s: Solid) => s.kind === "cone" && s.mat === "rock"; // the `rock` cones: the shipyard's breakwater (shipyard.ts) and the inlet's riprap (city/harbor.ts)
    // #323: the quay cranes, their rails and the container yard stand on the cove quay on purpose (the issue fixes them at y ≥ 30, by the cove water);
    // they are checked apart, below: each footprint centre on land
    const cranes: Solid[] = []; quayCranes(cranes, []);
    const craneJson = new Set(cranes.map((s) => JSON.stringify(s)));
    const inYard = (s: Solid) => { const b = bounds(s); return b.min.x >= YARD.x0 && b.max.x <= YARD.x1 && b.min.y >= YARD.y0 && b.max.y <= 84; }; // the gatehouse reaches y 84
    const onQuay = (s: Solid) => craneJson.has(JSON.stringify(s)) || inYard(s);
    const quay = [...sy.solids, ...sy.ground].filter(onQuay);
    expect(quay.length).toBeGreaterThan(QUAY_CRANES.length * 10);
    // #326: the dock inlet (DARSENA) is built on purpose at its edge (walls, bollards, boats, nets, crates, crane, lamps, the plinth of the block
    // facing it, the market and its awning): every non-cone city solid whose plan box cuts DARSENA grown by 4 is exempt; the rest stays checked
    const atInlet = (s: Solid) => {
      const b = bounds(s), g = 4;
      return s.kind !== "cone" && b.max.x > DARSENA.x0 - g && b.min.x < DARSENA.x1 + g && b.max.y > DARSENA.y0 - g && b.min.y < DARSENA.y1 + g;
    };
    const candidates = [
      ...[...sy.solids, ...sy.ground].filter((s) => onIsland(s) && !breakwater(s) && !onQuay(s)),
      // of the city, only what lies north of the promenade (y < 158): to the south the estuary bank only gains land
      // (islandWestX ≤ estuaryEast, geo.test.ts) and seawall, bridge and collapse are in the water on purpose
      ...cs.solids.filter((s) => onIsland(s) && bounds(s).max.y < PROMENADE.y0 && !atInlet(s) && !breakwater(s)),
    ];
    // #319 removed the shipyard's southern island content (the scrap, the southern jungle clusters) and the city seam belt;
    // the remaining shipyard island solids (sheds, silo, east jungle) keep the check from being vacuous.
    expect(candidates.length).toBeGreaterThan(4);
    const wet = candidates.filter(nearWater).map((s) => { const b = bounds(s); return `${s.kind}/${s.mat} ${b.min.x.toFixed(1)},${b.min.y.toFixed(1)}..${b.max.x.toFixed(1)},${b.max.y.toFixed(1)}`; });
    expect(wet).toEqual([]);
    for (const s of quay) { const b = bounds(s); expect(terrainAt((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2), `${s.kind}/${s.mat}`).not.toBe("water"); }
  });

  it("the coast is pure: two seeds give the same island", () => {
    const key = (m: ReturnType<typeof buildTerrain>) => new Set(m.water.flatMap(tris).map((t) => t.pts.map((p) => `${p.x},${p.y}`).join("|")));
    const a = key(buildTerrain(createRng(1))), b = key(buildTerrain(createRng(2)));
    expect(a.size).toBeGreaterThan(1000);
    expect([...a].filter((k) => !b.has(k))).toEqual([]);
    expect(a.size).toBe(b.size);
  });

  it("the south point is drawn in 6 u cells: no 18 u squares in land or foam", () => {
    const m = buildTerrain(createRng(7));
    const side = (t: Tri) => Math.max(...t.pts.map((p) => p.x)) - Math.min(...t.pts.map((p) => p.x));
    const inTip = (t: Tri) => t.pts.every((p) => p.x >= 282 && p.x <= 362 && p.y >= 336 && p.y <= 398);
    const land = m.bleed.flatMap(tris).filter(inTip);
    expect(land.length).toBeGreaterThan(50);
    expect(land.filter((t) => side(t) === 18)).toEqual([]);
    expect(tris(m.foam).filter(inTip).filter((t) => side(t) === 18)).toEqual([]);
  });

  it("the terrain grows no more than 3 % in polygons (22102 triangles on main, foam included)", () => {
    const m = buildTerrain(createRng(7));
    const n = [...m.ground, ...m.bleed, ...m.water, m.foam].reduce((acc, s) => acc + tris(s).length, 0);
    expect(n).toBeLessThanOrEqual(Math.floor(22102 * 1.03));
  });
});
