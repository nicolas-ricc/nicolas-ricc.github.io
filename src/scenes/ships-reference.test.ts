import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACCENT_COLORS, ISO_TONES } from "../map/palette-iso";

/**
 * Guard for the ship reference document (#59): fixed structure per
 * style, five photo angles, dimensions inside the lanes' box
 * and pieces with kit solids and existing materials/accents. The spec itself stays in Spanish,
 * so the patterns that match its text (headings, labels, log lines) stay in Spanish too.
 */
const DOC = new URL("../../docs/superpowers/specs/2026-10-16-barcos-referencia.md", import.meta.url);
const read = (): string => readFileSync(DOC, "utf8");
const ANGLES = ["perfil", "proa", "popa", "tres cuartos", "cenital"];
const SOLIDS = ["hull", "box", "cyl", "prism", "cone"], LIGHTS = ["dot", "poly"];
const BOX: Record<"cargo" | "tug" | "barge" | "ferry", string> = { cargo: "60 × 10 u", tug: "19 × 7 u", barge: "40 × 8 u + empujador 20 × 7 u", ferry: "15 × 4 u" };

function section(md: string, head: RegExp): string {
  const m = md.match(head);
  if (!m || m.index === undefined) return "";
  const rest = md.slice(m.index + m[0].length);
  const end = rest.search(/^## /m);
  return end < 0 ? rest : rest.slice(0, end);
}
const sub = (sec: string, title: string): string => section(sec.replace(/^### /gm, "## "), new RegExp(`^## ${title}\\s*$`, "m"));

describe("ships-reference: frame", () => {
  it("exists, with no embedded images, with scale, kit, decisions and the three styles", () => {
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
  describe(`ships-reference: ${kind}`, () => {
    const get = (): string => section(existsSync(DOC) ? read() : "", new RegExp(`^## \`${kind}\` — .*$`, "m"));

    it("data: shipyard/class, length, beam, height above the water", () => {
      const sec = get();
      for (const label of ["Astillero/clase", "Eslora", "Manga", "Altura sobre el agua"]) expect(sec).toMatch(new RegExp(`\\*\\*${label}:\\*\\*\\s*\\S`));
    });

    it("photos: ≥ 5 rows with an angle from the closed list, all five angles, ≥ 5 distinct URLs, non-empty description", () => {
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

    it("silhouette traits: ≥ 6 bullets", () => {
      expect(sub(get(), "Rasgos de silueta").split("\n").filter((l) => /^- \S/.test(l)).length).toBeGreaterThanOrEqual(6);
    });

    it("map box and maximum height within the lanes' limits", () => {
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

    it("pieces: kit solids with palette materials (≤ 40), lights with accents (≤ 8, including the three navigation lights)", () => {
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

describe("ships-reference: closing and measurement (#65)", () => {
  const close = (): string => section(read(), /^## Cierre y medición\s*$/m);
  it("exists with the two measured pages and the raw lab lines", () => {
    const sec = close();
    expect(sec).not.toBe("");
    for (const page of ["/lab/blog.html", "/lab/world.html"]) expect(sec).toContain(page);
    const code = [...sec.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1]).join("\n");
    expect(code.match(/\[lab\] primer dibujo: [\d.]+ ms/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(code.match(/\[lab\] peor redibujo en 5 s: [\d.]+ ms/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(code.match(/\[lab\] bloom: promedio [\d.]+ ms/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
  it("worst redraw ≤ 15 ms, or SHIP_STEP_MS applied, or isolated spike decided by majority", () => {
    const sec = close();
    const worst = [...sec.matchAll(/peor redibujo en 5 s: ([\d.]+) ms/g)].map((m) => Number(m[1]));
    const over = worst.filter((w) => w > 15).length;
    // sustained excess (half or more of the readings): SHIP_STEP_MS; isolated spikes: decision by written majority
    if (over * 2 >= worst.length) expect(sec).toMatch(/SHIP_STEP_MS = 66/);
    else if (over > 0) expect(sec).toMatch(/mayoría/);
  });
  it("has a subsection of deviations from the #57 plan", () => {
    const sec = close();
    const at = sec.search(/^### Desvíos/m);
    expect(at).toBeGreaterThanOrEqual(0);
    const deviations = sec.slice(at);
    for (const child of ["#60", "#61", "#62", "#63"]) expect(deviations).toMatch(new RegExp(`^- \\*\\*.*${child}`, "m"));
  });
  it("the departure port bullet points to the #87 lanes without erasing the #83 record (#156)", () => {
    const sec = close();
    const from = sec.search(/^### Desvíos/m);
    expect(from).toBeGreaterThanOrEqual(0);
    const deviations = sec.slice(from);
    const item = deviations.split("\n").find((l) => l.startsWith("- **Puerto de salida")) ?? "";
    for (const old of ["(232, 50)", "(362, −16)", "y −50..−70"]) expect(item).toContain(old);
    const at = item.indexOf("*Desvío posterior (#87):");
    expect(at).toBeGreaterThan(item.indexOf("(232, 50)"));
    const note = item.slice(at);
    for (const s of ["`LANE_OUT`", "`LANE_BACK`", "sin fondeadero"]) expect(note).toContain(s);
    const link = note.match(/\]\(2026-10-17-barcos-inventario\.md#([^)]+)\)/);
    expect(link?.[1]).toBe("inventario-después");
    const inv = new URL("2026-10-17-barcos-inventario.md", DOC);
    expect(existsSync(inv)).toBe(true);
    expect(readFileSync(inv, "utf8")).toMatch(/^### Inventario después\s*$/m);
  });
  it("the sea-anim API bullet warns that the anchored ship no longer exists since #87 (#156)", () => {
    const sec = close();
    const item = sec.slice(sec.search(/^### Desvíos/m)).split("\n").find((l) => l.startsWith("- **API de `sea-anim.ts`")) ?? "";
    expect(item).toContain("Un barco fondeado no lleva estela");
    expect(item.indexOf("*Desde #87 no hay fondeadero ni barcos fondeados")).toBeGreaterThan(item.indexOf("Un barco fondeado"));
  });
  it("checklist captures: before/after per ship, lighthouse and cover with outbound and return", () => {
    const dir = new URL("../../docs/superpowers/specs/assets/57-barcos/", import.meta.url);
    for (const f of ["cargo-antes", "cargo-despues", "tug-antes", "tug-despues", "barge-antes", "barge-despues", "faro-antes", "faro-despues", "cover-ida-vuelta"])
      expect(existsSync(new URL(`${f}.png`, dir))).toBe(true);
  });
});
