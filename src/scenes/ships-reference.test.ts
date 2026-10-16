import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACCENT_COLORS, ISO_TONES } from "../map/palette-iso";

/**
 * Guard del documento de referencia de barcos (#59): estructura fija por
 * estilo, cinco ángulos de foto, dimensiones dentro de la caja de las rutas
 * y piezas con sólidos del kit y materiales/acentos existentes.
 */
const DOC = new URL("../../docs/superpowers/specs/2026-10-16-barcos-referencia.md", import.meta.url);
const read = (): string => readFileSync(DOC, "utf8");
const ANGLES = ["perfil", "proa", "popa", "tres cuartos", "cenital"];
const SOLIDS = ["hull", "box", "cyl", "prism", "cone"], LIGHTS = ["dot", "poly"];
const BOX: Record<"cargo" | "tug" | "barge", string> = { cargo: "60 × 10 u", tug: "19 × 7 u", barge: "40 × 8 u + empujador 20 × 7 u" };

function section(md: string, head: RegExp): string {
  const m = md.match(head);
  if (!m || m.index === undefined) return "";
  const rest = md.slice(m.index + m[0].length);
  const end = rest.search(/^## /m);
  return end < 0 ? rest : rest.slice(0, end);
}
const sub = (sec: string, title: string): string => section(sec.replace(/^### /gm, "## "), new RegExp(`^## ${title}\\s*$`, "m"));

describe("barcos-referencia: marco", () => {
  it("existe, sin imágenes embebidas, con escala, kit, decisiones y los tres estilos", () => {
    expect(existsSync(DOC)).toBe(true);
    const md = read();
    expect(md).not.toMatch(/!\[/);
    for (const h of ["Escala y caja", "Kit y materiales", "Decisiones"]) expect(md).toMatch(new RegExp(`^## ${h}\\s*$`, "m"));
    const decisions = section(md, /^## Decisiones\s*$/m);
    for (const kind of Object.keys(BOX)) {
      expect(decisions).toContain(`\`${kind}\``);
      expect(md).toMatch(new RegExp(`^## \`${kind}\` — \\S`, "m"));
    }
  });
});

for (const kind of Object.keys(BOX) as (keyof typeof BOX)[]) {
  describe(`barcos-referencia: ${kind}`, () => {
    const get = (): string => section(existsSync(DOC) ? read() : "", new RegExp(`^## \`${kind}\` — .*$`, "m"));

    it("datos: astillero/clase, eslora, manga, altura sobre el agua", () => {
      const sec = get();
      for (const label of ["Astillero/clase", "Eslora", "Manga", "Altura sobre el agua"]) expect(sec).toMatch(new RegExp(`\\*\\*${label}:\\*\\*\\s*\\S`));
    });

    it("fotos: ≥ 5 filas con ángulo de la lista cerrada, los cinco ángulos, ≥ 5 URLs distintas, descripción no vacía", () => {
      const rows = sub(get(), "Fotos").split("\n").filter((l) => /^\|/.test(l) && !/^\|\s*(Ángulo|-)/.test(l));
      const cells = rows.map((r) => r.split("|").slice(1, -1).map((c) => c.trim()));
      expect(cells.length).toBeGreaterThanOrEqual(5);
      for (const c of cells) {
        expect(c).toHaveLength(4);
        expect(ANGLES).toContain(c[0]);
        expect(c[1]).not.toBe("");
        expect(c[2]).toMatch(/^https:\/\/\S+$/);
        expect(c[3]!.length).toBeGreaterThan(10);
      }
      for (const a of ANGLES) expect(cells.map((c) => c[0])).toContain(a);
      expect(new Set(cells.map((c) => c[2])).size).toBeGreaterThanOrEqual(5);
    });

    it("rasgos de silueta: ≥ 6 viñetas", () => {
      expect(sub(get(), "Rasgos de silueta").split("\n").filter((l) => /^- \S/.test(l)).length).toBeGreaterThanOrEqual(6);
    });

    it("caja en mapa y altura máxima dentro de los límites de las rutas", () => {
      const sec = get();
      const box = sec.match(/\*\*Caja en mapa:\*\*\s*([^·\n]+?)\s*(·|$)/m);
      const boxText = box?.[1] ?? "";
      expect(boxText).toBe(BOX[kind]);
      const dims = [...boxText.matchAll(/(\d+(?:\.\d+)?) × (\d+(?:\.\d+)?)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);
      expect(dims.reduce((s, [l]) => s + l, 0)).toBeLessThanOrEqual(60);
      for (const [, b] of dims) expect(b).toBeLessThanOrEqual(10);
      const z = sec.match(/\*\*Altura máx\.:\*\*\s*z = (-?\d+(?:\.\d+)?)/);
      expect(z).not.toBeNull();
      expect(Number(z?.[1])).toBeLessThanOrEqual(13);
    });

    it("piezas: sólidos del kit con materiales de la paleta (≤ 40), luces con acentos (≤ 8, con las tres de navegación)", () => {
      const items = [...sub(get(), "Piezas sugeridas \\(por importancia\\)").matchAll(/^\d+\. `(\w+)` · `(\w+)` — \S/gm)].map((m) => ({ solid: m[1]!, name: m[2]! }));
      const solids = items.filter((i) => SOLIDS.includes(i.solid)), lights = items.filter((i) => LIGHTS.includes(i.solid));
      expect(solids.length + lights.length).toBe(items.length);
      expect(items[0]?.solid).toBe("hull");
      expect(solids.length).toBeGreaterThanOrEqual(8);
      expect(solids.length).toBeLessThanOrEqual(40);
      expect(lights.length).toBeLessThanOrEqual(8);
      for (const s of solids) expect(Object.keys(ISO_TONES)).toContain(s.name);
      for (const l of lights) expect(ACCENT_COLORS).toContain(l.name);
      for (const nav of ["magentaMid", "magenta", "cyanMid"]) expect(lights.map((l) => l.name)).toContain(nav);
    });
  });
}

describe("barcos-referencia: cierre y medición (#65)", () => {
  const close = (): string => section(read(), /^## Cierre y medición\s*$/m);
  it("existe con las dos páginas medidas y las líneas crudas del lab", () => {
    const sec = close();
    expect(sec).not.toBe("");
    for (const page of ["/lab/blog.html", "/lab/world.html"]) expect(sec).toContain(page);
    const code = [...sec.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1]).join("\n");
    expect(code.match(/\[lab\] primer dibujo: [\d.]+ ms/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(code.match(/\[lab\] peor redibujo en 5 s: [\d.]+ ms/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(code.match(/\[lab\] bloom: promedio [\d.]+ ms/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
  it("peor redibujo ≤ 15 ms, o SHIP_STEP_MS aplicado, o pico aislado decidido por mayoría", () => {
    const sec = close();
    const worst = [...sec.matchAll(/peor redibujo en 5 s: ([\d.]+) ms/g)].map((m) => Number(m[1]));
    const over = worst.filter((w) => w > 15).length;
    // exceso sostenido (la mitad o más de las lecturas): SHIP_STEP_MS; picos aislados: decisión por mayoría escrita
    if (over * 2 >= worst.length) expect(sec).toMatch(/SHIP_STEP_MS = 66/);
    else if (over > 0) expect(sec).toMatch(/mayoría/);
  });
  it("tiene una subsección de desvíos respecto del plan de #57", () => {
    const desvios = close().slice(close().search(/^### Desvíos/m));
    expect(desvios).toMatch(/^### Desvíos/m);
    for (const child of ["#60", "#61", "#62", "#63"]) expect(desvios).toMatch(new RegExp(`^- \\*\\*.*${child}`, "m"));
  });
  it("capturas del checklist: antes/después por barco, faro y cover con ida y vuelta", () => {
    const dir = new URL("../../docs/superpowers/specs/assets/57-barcos/", import.meta.url);
    for (const f of ["cargo-antes", "cargo-despues", "tug-antes", "tug-despues", "barge-antes", "barge-despues", "faro-antes", "faro-despues", "cover-ida-vuelta"])
      expect(existsSync(new URL(`${f}.png`, dir))).toBe(true);
  });
});
