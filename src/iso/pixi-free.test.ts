import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../../", import.meta.url).pathname;
const DIRS = ["src/iso", "src/scenes"];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) sourceFiles(full, out);
    else if (e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

describe("guard de motor sin Pixi", () => {
  const files = DIRS.flatMap((d) => sourceFiles(`${ROOT}${d}`));

  it("encuentra los fuentes de src/iso y src/scenes", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    // src/iso y src/scenes son el motor puro: no deben depender del runtime de render (Pixi).
    it(`${relative(ROOT, file)} no importa Pixi`, () => {
      expect(readFileSync(file, "utf8")).not.toMatch(/from "pixi\.js"/);
    });
  }
});

/** Prueban Pixi mismo (árbol de `buildStage`, semántica de `SystemRunner`): quedan con el real (#166). */
const PIXI_TESTS = new Set(["src/world/stage.test.ts", "src/world/bloom-runtime.test.ts"]);

function testFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) testFiles(full, out);
    else if (e.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

describe("tests sin Pixi (#103)", () => {
  const files = testFiles(`${ROOT}src`).filter((f) => !PIXI_TESTS.has(relative(ROOT, f)));

  it("encuentra los tests de src", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("las excepciones siguen existiendo", () => {
    for (const f of PIXI_TESTS) expect(existsSync(`${ROOT}${f}`), f).toBe(true);
  });

  for (const file of files) {
    it(`${relative(ROOT, file)} usa dobles en vez de Pixi`, () => {
      expect(readFileSync(file, "utf8")).not.toMatch(/["']pixi\.js["']/);
    });
  }
});
