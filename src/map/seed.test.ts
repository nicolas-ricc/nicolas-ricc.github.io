import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createRng, SEED } from "./seed";

describe("createRng", () => {
  it("es determinístico para la misma seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("cambia con la seed", () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it("next está en [0, 1)", () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int es inclusivo en ambos extremos", () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(rng.int(0, 2));
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });

  it("pick devuelve un elemento del array", () => {
    const rng = createRng(9);
    expect(["a", "b", "c"]).toContain(rng.pick(["a", "b", "c"]));
  });
});

const ROOT = new URL("../../", import.meta.url).pathname;
const source = (path: string): string => readFileSync(`${ROOT}${path}`, "utf8");

describe("SEED (#105)", () => {
  it("es 7", () => {
    expect(SEED).toBe(7);
  });
  it.each(["src/lab/exhibits.ts", "src/scenes/city.test.ts", "src/scenes/fair.test.ts"])("%s la importa de map/seed y no del ensamblador", (path) => {
    const src = source(path);
    expect(src).toMatch(/import \{[^}]*\bSEED\b[^}]*\} from "\.\.\/map\/seed";/);
    expect(src).not.toContain("world/assemble");
  });
  it("el ensamblador la importa de map/seed y no la declara", () => {
    const src = source("src/world/assemble.ts");
    expect(src).toMatch(/import \{[^}]*\bSEED\b[^}]*\} from "\.\.\/map\/seed";/);
    expect(src).not.toMatch(/const SEED\b/);
  });
});
