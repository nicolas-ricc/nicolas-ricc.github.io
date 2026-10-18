import { describe, expect, it } from "vitest";
import { v3 } from "../iso/geometry";
import { bounds } from "../iso/solids";
import { prism } from "../scenes/city-pieces";
import { emptyPiece, fitToCap, shiftTone } from "./piece";
import type { Lot } from "./types";

const LOT: Lot = { x: 0, y: 0, w: 10, d: 10, z: 2, open: ["s"], maxH: 10 };

describe("fitToCap", () => {
  it("una pieza que entra en el tope sale igual", () => {
    const p = emptyPiece();
    p.solids.push(prism(0, 0, 2, 4, 4, 8, "stone"));
    expect(fitToCap(p, LOT)).toEqual(p);
  });

  it("una pieza más alta que el tope se achata en z relativa a lot.z: sólidos, acentos, paredes y landmarkTop", () => {
    const p = emptyPiece();
    p.solids.push(prism(0, 0, 2, 4, 4, 20, "stone"), { kind: "dome", at: v3(2, 2, 22), r: 2, h: 0, mat: "copper" });
    p.accents.push({ kind: "dot", at: v3(1, 1, 12), r: 0.5, color: "amber" });
    p.walls.push({ pts: [v3(4, 0, 2), v3(4, 4, 2), v3(4, 4, 22), v3(4, 0, 22)], normal: v3(1, 0, 0), floorH: 4, building: 0 });
    p.landmarkTop = v3(2, 2, 22);
    const q = fitToCap(p, LOT);
    expect(Math.max(...q.solids.map((s) => bounds(s).max.z))).toBeCloseTo(12, 9);
    expect(q.solids[0]).toMatchObject({ at: { x: 0, y: 0, z: 2 }, h: 10 });
    expect(q.accents[0]).toMatchObject({ at: { x: 1, y: 1, z: 7 }, r: 0.5 });
    expect(q.walls[0]!.pts.map((p) => p.z)).toEqual([2, 2, 12, 12]);
    expect(q.walls[0]!.floorH).toBeCloseTo(2, 9);
    expect(q.walls[0]!.normal).toEqual(v3(1, 0, 0));
    expect(q.landmarkTop!.z).toBeCloseTo(12, 9);
  });
});

describe("piece", () => {
  it("shiftTone suma y recorta a −2..+2", () => {
    expect(shiftTone(0, 1)).toBe(1);
    expect(shiftTone(2, 1)).toBe(2);
    expect(shiftTone(-2, -1)).toBe(-2);
    expect(shiftTone(1, 2)).toBe(2);
  });
});
