import { readFileSync, readdirSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { allIsoColors } from "./palette-iso";

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

const LAB = new URL("../../lab/", import.meta.url).pathname;
const PALETTE = allIsoColors();

/** Literales hex que no son colores de la paleta. Uno de 3, 4 u 8 dígitos nunca lo es: no se puede abreviar para saltar el guard. */
function offPalette(text: string): string[] {
  return (text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).filter((h) => h.length !== 7 || !PALETTE.has(parseInt(h.slice(1), 16)));
}

describe("guard de paleta en lab/*.html", () => {
  const pages = readdirSync(LAB).filter((f) => f.endsWith(".html")).map((f) => join(LAB, f));

  it("encuentra las páginas del lab", () => {
    expect(pages.length).toBeGreaterThanOrEqual(5);
    expect(pages.map((f) => basename(f))).toContain("world.html");
  });

  it("reporta lo que no es paleta y deja pasar lo que sí", () => {
    expect(offPalette("background: #100e19; color: #d8d4e8;")).toEqual([]);
    expect(offPalette("background: #100E19;")).toEqual([]);
    expect(offPalette("background: #100e1a;")).toEqual(["#100e1a"]);
    expect(offPalette("color: #fff; border: #100e19ff;")).toEqual(["#fff", "#100e19ff"]);
    expect(offPalette("#exhibits a { color: inherit; } #readout dl {}")).toEqual([]);
  });

  for (const page of pages) {
    it(`lab/${basename(page)} solo usa colores de la paleta`, () => {
      expect(offPalette(readFileSync(page, "utf8"))).toEqual([]);
    });
  }
});
