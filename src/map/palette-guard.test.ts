import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = new URL("../", import.meta.url).pathname; // src/

/** palette-iso.ts define los colores; palette-base.ts guarda el atlas previo al oscurecimiento; seed.ts usa 0x6d2b79f5, la constante de mulberry32. */
const EXEMPT = new Set(["map/palette-iso.ts", "map/palette-base.ts", "map/seed.ts"]);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) sourceFiles(full, out);
    else if (e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

describe("guard de paleta", () => {
  const files = sourceFiles(SRC).filter((f) => !EXEMPT.has(relative(SRC, f)));

  it("encuentra los fuentes de src/", () => {
    expect(files.length).toBeGreaterThan(5);
    expect(files.map((f) => relative(SRC, f))).toContain("main.ts");
  });

  for (const file of files) {
    it(`${relative(SRC, file)} no tiene colores hardcodeados`, () => {
      const hits = readFileSync(file, "utf8").match(/0x[0-9a-fA-F]{6}/g) ?? [];
      expect(hits).toEqual([]);
    });
  }
});
