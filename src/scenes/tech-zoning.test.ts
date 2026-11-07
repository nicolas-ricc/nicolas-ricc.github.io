import { describe, expect, it } from "vitest";
import { inCoverQuad } from "../map/geo";
import { createRng, SEED, type Rng } from "../map/seed";
import { suburbBlocks, type SprawlBlock } from "./sprawl-grid";
import { TELECOM as TELECOM_TECH } from "./tech";
import { ARENA, AUDITORIUM, CLUB, PLAZAS, SCHOOL, TELECOM, blockParity, inNeighborhood, zoneKinds, type Kind } from "./tech-zoning";
import { zoneRng } from "./world";

const KINDS: readonly Kind[] = ["tower", "campus", "monoblock", "houses", "park", "plaza", "school", "club", "telecom", "arena", "auditorium"];
const blocks = suburbBlocks();
const world = () => zoneKinds(zoneRng(SEED, "cv", 2), blocks);
const at = (p: { x: number; y: number }) => blocks.findIndex((b) => b.x === p.x && b.y === p.y);
const neighbors = (a: SprawlBlock, b: SprawlBlock) => (a.y === b.y && Math.abs(a.x - b.x) === 30) || (a.x === b.x && Math.abs(a.y - b.y) > 0 && Math.abs(a.y - b.y) <= 30);
const FIXED = [TELECOM, ARENA, AUDITORIUM, SCHOOL, CLUB, ...PLAZAS];
const count = (kinds: Kind[], k: Kind, only?: (b: SprawlBlock) => boolean) => kinds.filter((x, i) => x === k && (!only || only(blocks[i]!))).length;
const visible = (b: SprawlBlock) => inCoverQuad(b.x + 12, b.y + 9, 16 / 9, 0);

describe("zoneKinds", () => {
  it("one kind per block, none of laboratory or atrium", () => {
    const kinds = world();
    expect(kinds).toHaveLength(blocks.length);
    for (const k of kinds as string[]) { expect(k).not.toBe("lab"); expect(k).not.toBe("atrium"); expect(KINDS).toContain(k); }
  });

  it("the fixed ones exist and fall on their kind with any seed", () => {
    for (const p of FIXED) expect(at(p), JSON.stringify(p)).toBeGreaterThanOrEqual(0);
    for (const rng of [createRng(1), createRng(7), zoneRng(SEED, "cv", 2)]) {
      const kinds = zoneKinds(rng, blocks);
      expect(kinds[at(SCHOOL)]).toBe("school");
      expect(kinds[at(CLUB)]).toBe("club");
      for (const p of PLAZAS) expect(kinds[at(p)]).toBe("plaza");
      expect(kinds[at(TELECOM)]).toBe("telecom");
      expect(kinds[at(ARENA)]).toBe("arena");
      expect(kinds[at(AUDITORIUM)]).toBe("auditorium");
    }
  });

  it("world table and visible minimums in the cover", () => {
    const kinds = world();
    expect(Object.fromEntries(KINDS.map((k) => [k, count(kinds, k)]))).toEqual({ tower: 34, campus: 15, monoblock: 18, houses: 17, park: 10, plaza: 7, school: 1, club: 1, telecom: 1, arena: 1, auditorium: 1 });
    expect(count(kinds, "monoblock", visible)).toBeGreaterThanOrEqual(2);
    expect(count(kinds, "houses", visible)).toBeGreaterThanOrEqual(4);
    expect(count(kinds, "school", visible)).toBe(1);
    expect(count(kinds, "club", visible)).toBe(1);
    expect(count(kinds, "plaza", visible)).toBeGreaterThanOrEqual(2);
    expect(kinds[at({ x: 132, y: 448 })]).toBe("monoblock");
    expect(kinds[at({ x: 132, y: 520 })]).toBe("houses");
  });

  it("blockParity: the formula of the issue to the south (y ≥ 328); every pair of neighbors in the district with different parity", () => {
    for (const b of blocks) if (b.y >= 328) expect(blockParity(b)).toBe((Math.round((b.x + 84) / 30) + Math.round((b.y - 328) / 24)) & 1);
    blocks.forEach((a) => blocks.forEach((b) => { if (neighbors(a, b)) expect(blockParity(a), `${a.x},${a.y} → ${b.x},${b.y}`).not.toBe(blockParity(b)); }));
  });

  it("no monoblock has a monoblock neighbor; neighbors in the neighborhood with different parity", () => {
    const kinds = world();
    blocks.forEach((a, i) => blocks.forEach((b, j) => {
      if (!neighbors(a, b)) return;
      if (kinds[i] === "monoblock") expect(kinds[j], `${a.x},${a.y} → ${b.x},${b.y}`).not.toBe("monoblock");
      if (inNeighborhood(a) && inNeighborhood(b)) expect(blockParity(a)).not.toBe(blockParity(b));
    }));
  });

  it("inside the neighborhood there are no parks: the park draw gives a plaza", () => {
    const kinds = world();
    blocks.forEach((b, i) => { if (inNeighborhood(b)) expect(kinds[i]).not.toBe("park"); });
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
    expect(calls).toEqual(Array(blocks.length - FIXED.length).fill("chance:0.12"));
  });

  it("tech.ts re-exports the landmarks of tech-zoning", () => {
    expect(TELECOM_TECH).toBe(TELECOM);
  });
});
