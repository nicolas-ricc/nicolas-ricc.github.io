import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Capturas "antes" de la composición responsive (#424, hijo 0 de #423).
const DIR = new URL("../docs/superpowers/specs/assets/423-composicion-responsive/antes/", import.meta.url);
const README = new URL("README.md", DIR);
const MAP_SIZES = ["390x750", "430x932", "820x1180", "1024x768", "1366x1024", "1600x900", "1920x955"];
const SHOTS = [...MAP_SIZES.map((s) => `mapa-${s}`), "blog-1920x955", "blog-390x750", "boca-lab-1600x900"];
// un cuadro liso o negro comprime a pocos KB; el más chico legítimo (780×1500) pesa mucho más
const MIN_BYTES = 50_000;

/** Ancho y alto de un PNG, leídos de la cabecera IHDR; `null` si no es un PNG. */
function pngSize(file: URL): { w: number; h: number } | null {
  const buf = readFileSync(file);
  if (buf.length < 24 || buf.toString("latin1", 1, 4) !== "PNG" || buf.toString("latin1", 12, 16) !== "IHDR") return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const cssSize = (name: string): { w: number; h: number } => {
  const [w, h] = name.slice(name.lastIndexOf("-") + 1).split("x").map(Number);
  return { w: w!, h: h! };
};

describe("capturas antes de recomponer (#424)", () => {
  it.each(SHOTS)("%s.png existe, mide 2·W × 2·H y no es un cuadro vacío", (name) => {
    const file = new URL(`${name}.png`, DIR);
    expect(existsSync(file)).toBe(true);
    const { w, h } = cssSize(name);
    expect(pngSize(file)).toEqual({ w: 2 * w, h: 2 * h });
    expect(statSync(file).size).toBeGreaterThanOrEqual(MIN_BYTES);
  });

  it("README: fecha, commit y una línea por captura", () => {
    expect(existsSync(README)).toBe(true);
    const doc = readFileSync(README, "utf8");
    expect(doc).toMatch(/^\*\*Fecha:\*\* \d{4}-\d{2}-\d{2}/m);
    expect(doc).toMatch(/^\*\*Commit:\*\*.*6cbbe9e/m);
    for (const name of SHOTS) expect(doc, name).toContain(`${name}.png`);
  });
});
