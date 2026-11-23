import { describe, expect, it } from "vitest";
import { createRng, SEED, type Rng } from "../map/seed";
import { techBlocks, type SprawlBlock } from "./sprawl-grid";
import { ARENA, AUDITORIUM, CLUB, PLAZAS, SCHOOL, blockParity, inNeighborhood, isCell, zoneKinds, type Kind } from "./tech-zoning";
import { zoneRng } from "./world";

const KINDS: readonly Kind[] = ["monoblock", "houses", "plaza", "school", "club", "arena", "auditorium", "low"];
const blocks = techBlocks();
const world = () => zoneKinds(zoneRng(SEED, "cv", 2), blocks);
const CELLS = [SCHOOL, CLUB, ARENA, AUDITORIUM, ...PLAZAS];
const cellIndex = (c: { col: number; row: number }) => blocks.findIndex((b) => isCell(b, c));
const neighbors = (a: SprawlBlock, b: SprawlBlock) => {
  if (a.parcel && b.parcel) { const p = a.parcel.cell, q = b.parcel.cell; return (p.row === q.row && Math.abs(p.col - q.col) === 30) || (p.col === q.col && Math.abs(p.row - q.row) === 30); }
  if (a.parcel || b.parcel) return false;
  return (a.y === b.y && Math.abs(a.x - b.x) === 30) || (a.x === b.x && Math.abs(a.y - b.y) > 0 && Math.abs(a.y - b.y) <= 30);
};
const count = (kinds: Kind[], k: Kind, only: (b: SprawlBlock) => boolean = () => true) => kinds.filter((x, i) => x === k && only(blocks[i]!)).length;

describe("zoneKinds", () => {
  it("one kind per block, none of laboratory or atrium", () => {
    const kinds = world();
    expect(kinds).toHaveLength(blocks.length);
    for (const k of kinds as string[]) { expect(k).not.toBe("lab"); expect(k).not.toBe("atrium"); expect(KINDS).toContain(k); }
  });

  it("the fixed ones fall on their cell with any seed", () => {
    for (const c of CELLS) expect(blocks.filter((b) => isCell(b, c)), JSON.stringify(c)).toHaveLength(1);
    for (const rng of [createRng(1), createRng(7), zoneRng(SEED, "cv", 2)]) {
      const kinds = zoneKinds(rng, blocks);
      expect(kinds[cellIndex(SCHOOL)]).toBe("school");
      expect(kinds[cellIndex(CLUB)]).toBe("club");
      for (const p of PLAZAS) expect(kinds[cellIndex(p)]).toBe("plaza");
      expect(kinds[cellIndex(ARENA)]).toBe("arena");
      expect(kinds[cellIndex(AUDITORIUM)]).toBe("auditorium");
    }
  });

  it("world table", () => {
    const kinds = world();
    // measured with zoneRng(SEED, "cv", 2) on techBlocks() on agent/479 without the west (#479): 68 south parcels, no west blocks
    // (#478 had measured tower 10, campus 6, monoblock 12, houses 23, park 6, plaza 5, school 1, club 1, telecom 1, arena 1, auditorium 1, low 30 with 29 west blocks first)
    expect(Object.fromEntries(KINDS.map((k) => [k, count(kinds, k)]))).toEqual({ monoblock: 5, houses: 21, plaza: 8, school: 1, club: 1, arena: 1, auditorium: 1, low: 30 });
  });

  it("blockParity alternates between neighboring parcels, by cell", () => {
    for (const b of blocks) if (b.parcel) expect(blockParity(b)).toBe((((b.parcel.cell.col - 13) / 30 + (b.parcel.cell.row - 21) / 30) & 1));
    blocks.forEach((a) => blocks.forEach((b) => { if (neighbors(a, b)) expect(blockParity(a), `${a.x},${a.y} → ${b.x},${b.y}`).not.toBe(blockParity(b)); }));
  });

  it("bajo parcels are low; residencial ones are houses, monoblock, plaza or low", () => {
    const kinds = world();
    blocks.forEach((b, i) => {
      const p = b.parcel;
      if (!p || CELLS.some((c) => isCell(b, c))) return;
      if (p.barrio === "bajo") expect(kinds[i], `${p.cell.col},${p.cell.row}`).toBe("low");
      else expect(["houses", "monoblock", "plaza", "low"]).toContain(kinds[i]);
      if (kinds[i] === "monoblock") expect(p.area).toBeGreaterThanOrEqual(450);
    });
  });

  it("no monoblock has a monoblock neighbor", () => {
    const kinds = world();
    blocks.forEach((a, i) => blocks.forEach((b, j) => {
      if (neighbors(a, b) && kinds[i] === "monoblock") expect(kinds[j], `${a.x},${a.y} → ${b.x},${b.y}`).not.toBe("monoblock");
    }));
  });

  it("every tech block is a south parcel of the neighborhood", () => {
    blocks.forEach((b) => expect(inNeighborhood(b)).toBe(true));
  });

  it("consumes exactly one chance(0.12) per non-fixed block", () => {
    const real = zoneRng(SEED, "cv", 2), calls: string[] = [];
    const spy: Rng = {
      next: () => { calls.push("next"); return real.next(); },
      int: (a, b) => { calls.push("int"); return real.int(a, b); },
      chance: (p) => { calls.push(`chance:${p}`); return real.chance(p); },
      pick: (arr) => { calls.push("pick"); return real.pick(arr); },
    };
    zoneKinds(spy, blocks);
    expect(calls).toEqual(Array(blocks.length - 6).fill("chance:0.12")); // 6 fixed cells
  });
});
