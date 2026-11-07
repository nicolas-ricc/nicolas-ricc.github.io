import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createRng, SEED } from "./seed";

describe("createRng", () => {
  it("is deterministic for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("changes with the seed", () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it("next is in [0, 1)", () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int is inclusive at both ends", () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(rng.int(0, 2));
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });

  it("pick returns an element of the array", () => {
    const rng = createRng(9);
    expect(["a", "b", "c"]).toContain(rng.pick(["a", "b", "c"]));
  });
});

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const source = (path: string): string => readFileSync(`${ROOT}${path}`, "utf8");

describe("SEED (#105)", () => {
  it("is 7", () => {
    expect(SEED).toBe(7);
  });
  // these three only used the assembler for the seed: they do not even name it
  it.each(["src/lab/exhibits.ts", "src/scenes/city.test.ts", "src/scenes/fair.test.ts"])("%s imports it from map/seed and not from the assembler", (path) => {
    const src = source(path);
    expect(src).toMatch(/import \{[^}]*\bSEED\b[^}]*\} from "\.\.\/map\/seed";/);
    expect(src).not.toContain("world/assemble");
  });
  it("the assembler imports it from map/seed and does not declare it", () => {
    const src = source("src/world/assemble.ts");
    expect(src).toMatch(/import \{[^}]*\bSEED\b[^}]*\} from "\.\.\/map\/seed";/);
    expect(src).not.toMatch(/const SEED\b/);
  });
});
