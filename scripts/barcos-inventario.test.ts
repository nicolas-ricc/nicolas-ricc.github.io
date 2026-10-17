import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CYCLE_MS, SHIPS, alphaAt, shipStateAt } from "../src/scenes/sea-anim";

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

  it("documento: describe el método del time-lapse y la sección Antes", () => {
    expect(doc()).toMatch(/^## M[eé]todo del time-lapse/m);
    expect(doc()).toMatch(/^## Antes/m);
  });
});

// Verificación "después" de los carriles nuevos (#88): capturas, y lo anotado en el documento contra shipStateAt.
const AFTER = ["despues-recorrido", ...[1, 2, 3, 4, 5, 6].map((n) => `despues-cover-${n}`), "despues-pecio", "despues-boyas", "despues-lancha", "despues-gradas", "despues-feria-botes", "despues-feria-botes-ancho"];
const after = (): string => doc().slice(doc().search(/^## Despu[eé]s/m));
const LANE_WORD = { out: "ida", back: "vuelta", offscreen: "fuera" } as const;

/** El texto de una subsección `### …` de "Después", hasta la siguiente subsección. */
function subsection(title: RegExp): string {
  const start = after().search(title);
  if (start < 0) return "";
  const sub = after().slice(start), next = sub.indexOf("\n### ", 4);
  return sub.slice(0, next < 0 ? undefined : next);
}

const cells = (row: string): string[] => row.split("|").slice(1, -1).map((c) => c.trim());

/** Las filas de la tabla de `### Capturas instantáneas`, como celdas. */
function snapshotRows(): string[][] {
  return subsection(/^### Capturas instant[aá]neas/m).split("\n").filter((l) => /^\|.*despues-cover-\d\.png/.test(l)).map(cells);
}

describe("capturas después de los barcos (#88)", () => {
  it.each(AFTER)("capturas: %s.png existe y es un PNG a 2x", (name) => {
    const file = new URL(`${name}.png`, ASSETS);
    expect(existsSync(file)).toBe(true);
    expect(pngSize(file)?.w).toBeGreaterThanOrEqual(3200);
  });

  it("time-lapse: despues-recorrido.png tiene el tamaño del cover", () => {
    expect(pngSize(new URL("despues-recorrido.png", ASSETS))).toEqual(pngSize(new URL("antes-cover.png", ASSETS)));
  });
});

describe("documento del inventario, después (#88)", () => {
  it("documento: la sección Después está completa y el estado ya no dice pendiente", () => {
    expect(doc()).toMatch(/^## Despu[eé]s/m);
    expect(doc()).not.toMatch(/pendiente: lo completa el hijo/);
    expect(doc()).toMatch(/^\*\*Estado:\*\*(?!.*pendiente)/m);
  });

  it("documento: cita todas las capturas después y cada una existe", () => {
    const cited = [...after().matchAll(/assets\/85-barcos\/([\w-]+\.png)/g)].map((m) => m[1]!);
    for (const name of cited) expect(existsSync(new URL(name, ASSETS)), name).toBe(true);
    for (const name of AFTER) expect(cited).toContain(`${name}.png`);
  });

  it("capturas instantáneas: seis, separadas ≥ T/6, con lo anotado igual a shipStateAt y ≥ 1 a pleno en cada carril", () => {
    const header = subsection(/^### Capturas instant[aá]neas/m).split("\n").find((l) => l.startsWith("| Captura"));
    expect(cells(header ?? "").slice(2, 5)).toEqual(SHIPS.map((s) => s.kind));
    const rows = snapshotRows();
    expect(rows).toHaveLength(6);
    const times = rows.map((r) => Number(r[1]) * 1000);
    for (const t of times) expect(Number.isFinite(t)).toBe(true);
    for (let i = 1; i < times.length; i++) expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(CYCLE_MS / 6);
    rows.forEach((r, i) => {
      const full: Record<"out" | "back", string[]> = { out: [], back: [] };
      SHIPS.forEach((s, k) => {
        const st = shipStateAt((s.phase * CYCLE_MS + times[i]!) % CYCLE_MS);
        expect(r[2 + k], `${r[0]} ${s.kind}`).toMatch(new RegExp(`^${LANE_WORD[st.lane]}\\b`));
        if (st.lane !== "offscreen" && alphaAt(st.lane, st.dist) === 1) full[st.lane].push(s.kind);
      });
      const listed = (cell: string): string[] => [...cell.matchAll(/`(\w+)`/g)].map((m) => m[1]!).sort();
      expect(full.out.length, `${r[0]} yendo`).toBeGreaterThanOrEqual(1);
      expect(full.back.length, `${r[0]} volviendo`).toBeGreaterThanOrEqual(1);
      expect(listed(r[5]!), `${r[0]} yendo`).toEqual(full.out.sort());
      expect(listed(r[6]!), `${r[0]} volviendo`).toEqual(full.back.sort());
    });
  });

  it("documento: conteos de DevTools después en al menos dos instantes", () => {
    const lines = after().split("\n");
    const header = lines.findIndex((l) => l.startsWith("|") && /sprites/.test(l) && /graphics/.test(l));
    expect(header).toBeGreaterThanOrEqual(0);
    const end = lines.findIndex((l, i) => i > header && !l.startsWith("|"));
    expect(lines.slice(header + 2, end < 0 ? undefined : end).filter((r) => /\d/.test(r)).length).toBeGreaterThanOrEqual(2);
  });

  it("documento: lista las desviaciones respecto de #85", () => {
    const deviations = subsection(/^### Desviaciones/m);
    for (const re of [/fondeadero/, /42 u/, /boyas/, /pecio/, /fosa/]) expect(deviations).toMatch(re);
  });
});
