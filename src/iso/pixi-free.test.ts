import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const DIRS = ["src/iso", "src/scenes"];
// Pixi import with any quote style; also catches import() and import type.
const PIXI_IMPORT = /["']pixi\.js["']/;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) sourceFiles(full, out);
    else if (e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

describe("PIXI_IMPORT (#168)", () => {
  // assembled, so this file does not trip its own test guard
  const MOD = ["pixi", "js"].join(".");
  it("detects single and double quotes, import() and import type", () => {
    for (const src of [
      `import { Graphics } from "${MOD}";`,
      `import { Graphics } from '${MOD}';`,
      `import type { Container } from '${MOD}';`,
      `const pixi = await import("${MOD}");`,
      `export { Ticker } from '${MOD}';`,
    ])
      expect(src).toMatch(PIXI_IMPORT);
  });
  it("does not flag an unquoted mention", () => {
    expect(`// without ${MOD} here`).not.toMatch(PIXI_IMPORT);
  });
});

describe("Pixi-free engine guard", () => {
  const files = DIRS.flatMap((d) => sourceFiles(`${ROOT}${d}`));

  it("finds the sources of src/iso and src/scenes", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    // src/iso and src/scenes are the pure engine: they must not depend on the render runtime (Pixi).
    it(`${relative(ROOT, file)} does not import Pixi`, () => {
      expect(readFileSync(file, "utf8")).not.toMatch(PIXI_IMPORT);
    });
  }
});

/** They test Pixi itself (`buildStage` tree, `SystemRunner` semantics): they keep the real one (#166). */
const PIXI_TESTS = new Set(["src/world/stage.test.ts", "src/world/bloom-runtime.test.ts"]);

function testFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) testFiles(full, out);
    else if (e.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

describe("Pixi-free tests (#103)", () => {
  const files = testFiles(`${ROOT}src`).filter((f) => !PIXI_TESTS.has(relative(ROOT, f)));

  it("finds the tests in src", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("the exceptions still exist", () => {
    for (const f of PIXI_TESTS) expect(existsSync(`${ROOT}${f}`), f).toBe(true);
  });

  for (const file of files) {
    it(`${relative(ROOT, file)} uses doubles instead of Pixi`, () => {
      expect(readFileSync(file, "utf8")).not.toMatch(PIXI_IMPORT);
    });
  }
});
