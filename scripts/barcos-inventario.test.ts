import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Inventario "antes" de los barcos (#86): el documento y sus capturas.
const SPECS = new URL("../docs/superpowers/specs/", import.meta.url);
const DOC = new URL("2026-10-17-barcos-inventario.md", SPECS);
const ASSETS = new URL("assets/85-barcos/", SPECS);
const SNAPSHOTS = ["antes-cover", "antes-darsena", "antes-pecio", "antes-lancha", "antes-feria-botes"];

/** Ancho y alto de un PNG, leídos de la cabecera IHDR; `null` si no es un PNG. */
function pngSize(file: URL): { w: number; h: number } | null {
  const buf = readFileSync(file);
  if (buf.length < 24 || buf.toString("latin1", 1, 4) !== "PNG" || buf.toString("latin1", 12, 16) !== "IHDR") return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const doc = (): string => readFileSync(DOC, "utf8");

describe("capturas antes de los barcos (#86)", () => {
  it.each(SNAPSHOTS)("capturas: %s.png existe y es un PNG a 2x", (name) => {
    const file = new URL(`${name}.png`, ASSETS);
    expect(existsSync(file)).toBe(true);
    expect(pngSize(file)?.w).toBeGreaterThanOrEqual(3200);
  });

  it("time-lapse: antes-recorrido.png tiene el tamaño del cover", () => {
    const tl = new URL("antes-recorrido.png", ASSETS), cover = new URL("antes-cover.png", ASSETS);
    expect(existsSync(tl)).toBe(true);
    const size = pngSize(tl);
    expect(size?.w).toBeGreaterThanOrEqual(3200);
    expect(size).toEqual(pngSize(cover));
  });
});

describe("documento del inventario de barcos (#86)", () => {
  it("documento: existe con el frontmatter de las specs", () => {
    expect(existsSync(DOC)).toBe(true);
    for (const key of ["Fecha", "Estado", "Issues", "Alcance"]) expect(doc()).toMatch(new RegExp(`^\\*\\*${key}:\\*\\*`, "m"));
  });

  it("documento: la tabla tiene una fila por cada conjunto del issue", () => {
    const rows = doc().split("\n").filter((l) => l.startsWith("|"));
    const sets = [/`cargo`.*`tug`.*`barge`/, /`ferry`/, /pecio partido/i, /boyas de canal/i, /casco en construcci[oó]n/i, /grada 2/i, /dique seco/i, /botes .*feria/i];
    for (const set of sets) expect(rows.some((r) => set.test(r)), String(set)).toBe(true);
  });

  it("documento: anota los totals de rendering.capture() en al menos dos instantes", () => {
    const lines = doc().split("\n");
    const header = lines.findIndex((l) => l.startsWith("|") && /sprites/.test(l) && /graphics/.test(l));
    expect(header).toBeGreaterThanOrEqual(0);
    const end = lines.findIndex((l, i) => i > header && !l.startsWith("|"));
    const counts = lines.slice(header + 2, end < 0 ? undefined : end).filter((r) => /\d/.test(r));
    expect(counts.length).toBeGreaterThanOrEqual(2);
  });

  it("documento: cada captura citada existe y están todas las antes-*", () => {
    const cited = [...doc().matchAll(/assets\/85-barcos\/([\w-]+\.png)/g)].map((m) => m[1]!);
    for (const name of cited) expect(existsSync(new URL(name, ASSETS)), name).toBe(true);
    for (const name of [...SNAPSHOTS, "antes-recorrido"]) expect(cited).toContain(`${name}.png`);
  });

  it("documento: describe el método del time-lapse y deja pendiente la sección Después", () => {
    expect(doc()).toMatch(/^## M[eé]todo del time-lapse/m);
    expect(doc()).toMatch(/^## Antes/m);
    // #88 completa la sección Después y reemplaza esta aserción.
    expect(doc()).toMatch(/^## Despu[eé]s\s+pendiente: lo completa el hijo de verificación de #85/m);
  });
});
