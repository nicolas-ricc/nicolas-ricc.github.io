import { describe, expect, it } from "vitest";
import { bounds, type Solid, type Tri } from "../iso/solids";
import { WORLD } from "../map/geo";
import { createRng } from "../map/seed";
import { city } from "./city";
import { MALECON } from "./city-grid";
import { shipyard } from "./shipyard";
import { buildTerrain } from "./terrain";
import { isWaterAt, terrainAt } from "./terrain-classify";

/**
 * Costas de la isla entre el río/estuario y el mar (#237, spec
 * `2026-10-27-isla-costas-design.md` §6 y §8). La máscara es la grilla de 6 u
 * anclada en (WORLD.x0, WORLD.y0); `isWaterAt` despacha contenido y sangrado.
 */
const C = 6;
const X0 = 234, X1 = 420, Y0 = -48, Y1 = 420;
const NX = (X1 - X0) / C, NY = (Y1 - Y0) / C;
const center = (i: number, j: number): [number, number] => [X0 + i * C + C / 2, Y0 + j * C + C / 2];
const isLand = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < NX && j < NY && !isWaterAt(...center(i, j));

/** Componente conexa (4-vecinos) de tierra que contiene la celda de (320, 80): la isla. */
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

describe("costa de la isla", () => {
  it("ningún tramo recto de la costa de la isla supera 30 u (salvo malecón y punta del faro)", () => {
    const isl = island();
    expect(isl.size).toBeGreaterThan(500);
    const inI = (i: number, j: number) => isl.has(`${i},${j}`);
    // la punta del faro (headland y su arrecife) no se toca: sus bordes cortan la racha
    const exemptCell = (i: number, j: number) => { const [x, y] = center(i, j); const t = terrainAt(x, y); return t === "headland" || t === "reef"; };
    const runs: string[] = [];
    // bordes verticales en x = X0 + i·C, entre las celdas i−1 e i
    for (let i = 0; i <= NX; i++) {
      let start = 0, side = 0;
      for (let j = 0; j <= NY; j++) {
        const a = inI(i - 1, j), b = inI(i, j), x = X0 + i * C, y = Y0 + j * C;
        const malecon = x === 342 && y >= 156 && y < 330;
        let s = j < NY && a !== b ? (a ? 1 : 2) : 0;
        if (s && (malecon || exemptCell(a ? i - 1 : i, j))) s = 0;
        if (s !== side) { if (side && (j - start) * C > 30) runs.push(`x=${x} y ${Y0 + start * C}..${y}`); start = j; side = s; }
      }
    }
    // bordes horizontales en y = Y0 + j·C, entre las celdas j−1 y j
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

  it("ningún sólido de la isla queda a menos de 3 u del agua (salvo la escollera)", () => {
    const M = 3;
    const nearWater = (s: Solid): boolean => {
      const b = bounds(s);
      const cx0 = Math.floor((b.min.x - M - WORLD.x0) / C), cx1 = Math.floor((b.max.x + M - WORLD.x0) / C);
      const cy0 = Math.floor((b.min.y - M - WORLD.y0) / C), cy1 = Math.floor((b.max.y + M - WORLD.y0) / C);
      for (let j = cy0; j <= cy1; j++) for (let i = cx0; i <= cx1; i++) if (isWaterAt(WORLD.x0 + i * C + C / 2, WORLD.y0 + j * C + C / 2)) return true;
      return false;
    };
    const sy = shipyard(createRng(7));
    const cs = city(createRng(7), createRng(8));
    const onIsland = (s: Solid) => bounds(s).max.x >= 276;
    const escollera = (s: Solid) => s.kind === "cone" && s.mat === "rock"; // shipyard.ts: el único `rock` del astillero
    const candidates = [
      ...[...sy.solids, ...sy.ground].filter((s) => onIsland(s) && !escollera(s)),
      // de la ciudad, solo la franja de costura (y < 158): al sur la ribera del estuario solo gana tierra
      // (islandWestX ≤ estuaryEast, geo.test.ts) y malecón, puente y derrumbe están en el agua a propósito
      ...cs.solids.filter((s) => onIsland(s) && bounds(s).max.y < MALECON.y0),
    ];
    expect(candidates.length).toBeGreaterThan(10);
    const wet = candidates.filter(nearWater).map((s) => { const b = bounds(s); return `${s.kind}/${s.mat} ${b.min.x.toFixed(1)},${b.min.y.toFixed(1)}..${b.max.x.toFixed(1)},${b.max.y.toFixed(1)}`; });
    expect(wet).toEqual([]);
  });

  it("la costa es pura: dos semillas dan la misma isla", () => {
    const key = (m: ReturnType<typeof buildTerrain>) => new Set(m.water.flatMap(tris).map((t) => t.pts.map((p) => `${p.x},${p.y}`).join("|")));
    const a = key(buildTerrain(createRng(1))), b = key(buildTerrain(createRng(2)));
    expect(a.size).toBeGreaterThan(1000);
    expect([...a].filter((k) => !b.has(k))).toEqual([]);
    expect(a.size).toBe(b.size);
  });

  it("la punta sur se dibuja en celdas de 6 u: sin cuadrados de 18 u en tierra ni espuma", () => {
    const m = buildTerrain(createRng(7));
    const side = (t: Tri) => Math.max(...t.pts.map((p) => p.x)) - Math.min(...t.pts.map((p) => p.x));
    const inTip = (t: Tri) => t.pts.every((p) => p.x >= 282 && p.x <= 362 && p.y >= 336 && p.y <= 398);
    const land = m.bleed.flatMap(tris).filter(inTip);
    expect(land.length).toBeGreaterThan(50);
    expect(land.filter((t) => side(t) === 18)).toEqual([]);
    expect(tris(m.foam).filter(inTip).filter((t) => side(t) === 18)).toEqual([]);
  });

  it("el terreno no crece más de 3 % en polígonos (22102 triángulos en main, espuma incluida)", () => {
    const m = buildTerrain(createRng(7));
    const n = [...m.ground, ...m.bleed, ...m.water, m.foam].reduce((acc, s) => acc + tris(s).length, 0);
    expect(n).toBeLessThanOrEqual(Math.floor(22102 * 1.03));
  });
});
