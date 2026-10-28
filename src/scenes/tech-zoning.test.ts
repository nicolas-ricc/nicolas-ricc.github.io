import { describe, expect, it } from "vitest";
import { inCoverQuad } from "../map/geo";
import { createRng, SEED, type Rng } from "../map/seed";
import { suburbBlocks, type SprawlBlock } from "./sprawl-grid";
import { TELECOM as TELECOM_TECH } from "./tech";
import { ARENA, AUDITORIUM, CLUB, PLAZAS, SCHOOL, TELECOM, blockParity, inBarrio, zoneKinds, type Kind } from "./tech-zoning";
import { zoneRng } from "./world";

const KINDS: readonly Kind[] = ["tower", "campus", "monoblock", "casas", "park", "plaza", "escuela", "club", "telecom", "arena", "auditorium"];
const blocks = suburbBlocks();
const world = () => zoneKinds(zoneRng(SEED, "cv", 2), blocks);
const at = (p: { x: number; y: number }) => blocks.findIndex((b) => b.x === p.x && b.y === p.y);
const neighbours = (a: SprawlBlock, b: SprawlBlock) => (a.y === b.y && Math.abs(a.x - b.x) === 30) || (a.x === b.x && Math.abs(a.y - b.y) > 0 && Math.abs(a.y - b.y) <= 30);
const FIXED = [TELECOM, ARENA, AUDITORIUM, SCHOOL, CLUB, ...PLAZAS];
const count = (kinds: Kind[], k: Kind, only?: (b: SprawlBlock) => boolean) => kinds.filter((x, i) => x === k && (!only || only(blocks[i]!))).length;
const visible = (b: SprawlBlock) => inCoverQuad(b.x + 12, b.y + 9, 16 / 9, 0);

describe("zoneKinds", () => {
  it("un tipo por manzana, ninguno de laboratorio ni atrio", () => {
    const kinds = world();
    expect(kinds).toHaveLength(blocks.length);
    for (const k of kinds as string[]) { expect(k).not.toBe("lab"); expect(k).not.toBe("atrium"); expect(KINDS).toContain(k); }
  });

  it("los fijos existen y caen en su tipo con cualquier semilla", () => {
    for (const p of FIXED) expect(at(p), JSON.stringify(p)).toBeGreaterThanOrEqual(0);
    for (const rng of [createRng(1), createRng(7), zoneRng(SEED, "cv", 2)]) {
      const kinds = zoneKinds(rng, blocks);
      expect(kinds[at(SCHOOL)]).toBe("escuela");
      expect(kinds[at(CLUB)]).toBe("club");
      for (const p of PLAZAS) expect(kinds[at(p)]).toBe("plaza");
      expect(kinds[at(TELECOM)]).toBe("telecom");
      expect(kinds[at(ARENA)]).toBe("arena");
      expect(kinds[at(AUDITORIUM)]).toBe("auditorium");
    }
  });

  it("tabla del mundo y mínimos visibles en el cover", () => {
    const kinds = world();
    expect(Object.fromEntries(KINDS.map((k) => [k, count(kinds, k)]))).toEqual({ tower: 34, campus: 15, monoblock: 18, casas: 17, park: 10, plaza: 7, escuela: 1, club: 1, telecom: 1, arena: 1, auditorium: 1 });
    expect(count(kinds, "monoblock", visible)).toBeGreaterThanOrEqual(2);
    expect(count(kinds, "casas", visible)).toBeGreaterThanOrEqual(4);
    expect(count(kinds, "escuela", visible)).toBe(1);
    expect(count(kinds, "club", visible)).toBe(1);
    expect(count(kinds, "plaza", visible)).toBeGreaterThanOrEqual(2);
    expect(kinds[at({ x: 132, y: 448 })]).toBe("monoblock");
    expect(kinds[at({ x: 132, y: 520 })]).toBe("casas");
  });

  it("ningún monoblock tiene un vecino monoblock; vecinas del barrio con paridad distinta", () => {
    const kinds = world();
    blocks.forEach((a, i) => blocks.forEach((b, j) => {
      if (!neighbours(a, b)) return;
      if (kinds[i] === "monoblock") expect(kinds[j], `${a.x},${a.y} → ${b.x},${b.y}`).not.toBe("monoblock");
      if (inBarrio(a) && inBarrio(b)) expect(blockParity(a)).not.toBe(blockParity(b));
    }));
  });

  it("dentro del barrio no hay parques: el sorteo de parque da plaza", () => {
    const kinds = world();
    blocks.forEach((b, i) => { if (inBarrio(b)) expect(kinds[i]).not.toBe("park"); });
  });

  it("consume exactamente un chance(0.12) por manzana no fija", () => {
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

  it("tech.ts reexporta los hitos de tech-zoning", () => {
    expect(TELECOM_TECH).toBe(TELECOM);
  });
});
