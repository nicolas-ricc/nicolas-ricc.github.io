import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Guard for #194: the code, its comments and its messages are in English. Visitor-facing text
// (content/, the strings the site shows) and data that only looks like a name (content JSON keys,
// storybook exhibit ids, which are the URL hash) stay as they are; see ALLOW.
const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** Spanish-only letters and marks. */
const ACCENTS = /[áéíóúñÁÉÍÓÚÑ¿¡]/;
/** Whole words that are Spanish and almost never English (`y`, `a`, `o`, `e`, `lo`, `en`, `no`, `un` are left out on purpose). */
const WORDS = new Set(("el los las del de la que por para con una sin como cada sobre entre hasta desde donde cuando pero esta " +
  "hay se al su sus es son queda va mas tambien solo este estos estas ese esa porque aunque mientras luego antes despues ya muy cual").split(" "));
/** Spanish identifier parts (camelCase / snake_case / kebab-case pieces). */
const STEMS = new Set(("barrio barrios costanera escuela casa casas fila filas ancho largo techo ventana ventanas nombre mundo parrafos " +
  "torres articulo articulos proyecto proyectos centro bares residencial civico ribera distrito fabrica ciudad astillero desvios malecon " +
  "feria mar tecnologico nave selva faro estacion tren pecio carguero remolcador lancha farol viga tanque grua calle puente isla punta " +
  "velo zona acento luz luces despues integracion antes").split(" "));

/** Content JSON keys (decision 2a): the TS fields that mirror `content/*.json`. */
const CONTENT_KEYS = /\b(titulo|subtitulo|descripcion|nombre|proyectos|articulos|secciones)\b/g;
/** Strings shown to the visitor or kept as data. */
const ALLOW: Record<string, RegExp[]> = {
  "*": [/Nicolás Riccomini/g, /\[mapa\]/g],
  "src/views.ts": [],
  "src/content/types.ts": [CONTENT_KEYS],
  "src/content/render.ts": [CONTENT_KEYS, /class="(externo|proyectos|articulos)"/g,
    // the PDF fallback sentence is shown to the visitor
    /<p>Este navegador.*<\/p>/g],
  "src/content/validate.ts": [CONTENT_KEYS],
  "src/content/blog-feed.ts": [CONTENT_KEYS],
  // Spanish fixtures stand in for visitor content
  "src/content/render.test.ts": [CONTENT_KEYS, /: "[^"]*"/g, /Quién soy &(amp;)? qué hago/g, /Sin (<url>|&lt;url&gt;)/g, /¿Lenguaje &(amp;)? (<|&lt;)mundo(>|&gt;)\?/g],
  "src/content/validate.test.ts": [CONTENT_KEYS],
  "src/content/blog-feed.test.ts": [CONTENT_KEYS, /(title|description|titulo|descripcion): ('[^']*'|"[^"]*")/g,
    // the RSS fixture stands in for a Spanish blog post
    /Rawls como puente/g, /¿Puede un (&amp;quot;|")velo(&amp;quot;|")/g, /dar cuenta del mundo\?/g],
  "src/style.css": [/\.(externo|proyectos|articulos)\b/g],
  // exhibit ids are the storybook URL hash, cited by the old specs (decision 2b)
  "src/lab/exhibits.ts": [/\bid: "[a-z0-9-]+"/g],
  // `sin` is the trig function in two geometry comments (it is also the Spanish word for "without")
  "src/iso/solids.ts": [/\bsin(?= φ|\(π\))/g],
  // `"se"` is the southeast corner id of the chamfer recipe (it collides with the Spanish word "se"); the guard sees string text without its quotes
  "src/kit/forms/composite.ts": [/\bse\b/gi],
  "src/kit/forms/composite.test.ts": [/\bse\b/gi],
  // `MALECON` is imported under an English alias; its definition in src/scenes/city-grid.ts is renamed by the scenes task
  "src/city/fixed.ts": [/\bMALECON as /g],
  "src/city/fixed.test.ts": [/\bMALECON as /g],
  "src/city/streets.ts": [/\bMALECON as /g],
  "src/scenes/world-baseline.test.ts": [/"?[a-z-]+"?: "[0-9a-f]{8}\/[0-9a-f]{8}"/g],
};

/** Tokens that collide with WORDS but are not prose: `Math.sin`, file paths. */
const NOT_PROSE = [/\bMath\.\w+/g, /[\w./-]*\.(md|png|ts|html|json|pdf|css)\b/g, /\bdocs\/[\w./-]*/g, /lang="es"/g];

/** Comment and string text of a TS/CSS source, line by line (code replaced by spaces). */
function proseOf(src: string, css: boolean): string[] {
  let out = "", mode: "code" | "line" | "block" | "str" = "code", quote = "";
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!, n = src[i + 1];
    if (c === "\n") { out += "\n"; if (mode === "line") mode = "code"; continue; }
    if (mode === "code") {
      if (!css && c === "/" && n === "/") { mode = "line"; out += "  "; i++; continue; }
      if (c === "/" && n === "*") { mode = "block"; out += "  "; i++; continue; }
      if (!css && (c === '"' || c === "'" || c === "`")) { mode = "str"; quote = c; out += " "; continue; }
      out += " ";
    } else if (mode === "block") {
      if (c === "*" && n === "/") { mode = "code"; out += "  "; i++; continue; }
      out += c;
    } else if (mode === "str") {
      if (c === "\\") { out += "  "; i++; continue; }
      if (c === quote) { mode = "code"; out += " "; continue; }
      out += c;
    } else out += c;
  }
  return out.split("\n");
}

const identParts = (line: string): string[] =>
  (line.match(/[A-Za-z_$][\w$]*/g) ?? []).flatMap((id) => id.split(/_|(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/)).map((p) => p.toLowerCase());
const fold = (w: string): string => w.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const words = (text: string): string[] => text.split(/[^\p{L}\-_./]+/u).filter((w) => w && !/[-_./]/.test(w)).map(fold);

function strip(line: string, file: string): string {
  for (const re of [...ALLOW["*"]!, ...(ALLOW[file] ?? []), ...NOT_PROSE]) line = line.replace(re, " ");
  return line;
}

function offenses(file: string, src: string): string[] {
  const ts = file.endsWith(".ts"), css = file.endsWith(".css");
  const lines = src.split("\n");
  const prose = ts || css ? proseOf(src, css) : lines;
  const out: string[] = [];
  lines.forEach((raw, i) => {
    const line = strip(raw, file);
    const text = strip(prose[i] ?? "", file);
    const hit = ACCENTS.test(line) ? "accent"
      : words(text).find((w) => WORDS.has(w))
      ?? (ts ? identParts(line.replace(/\/\/.*$/, "")).find((p) => STEMS.has(p)) : undefined);
    if (hit) out.push(`${file}:${i + 1} [${hit}] ${raw.trim().slice(0, 120)}`);
  });
  return out;
}

function walk(dir: string): string[] {
  return readdirSync(`${ROOT}${dir}`).flatMap((name) => {
    const rel = `${dir}/${name}`;
    if (name === "__snapshots__") return [];
    return statSync(`${ROOT}${rel}`).isDirectory() ? walk(rel) : [rel];
  });
}

const FILES = [
  ...walk("src").filter((f) => /\.(ts|css)$/.test(f) && f !== "src/english.test.ts"),
  ...walk("lab").filter((f) => f.endsWith(".html")),
  "README.md",
  "CLAUDE.md",
].sort();

describe("the guard itself", () => {
  it("flags Spanish prose, accents and Spanish identifiers, and lets English, Math.sin and spec paths through", () => {
    expect(offenses("x.ts", "// la luz del faro")).toHaveLength(1);
    expect(offenses("x.ts", "const s = \"cámara\";")).toHaveLength(1);
    expect(offenses("x.ts", "const barrioOf = 1;")).toHaveLength(1);
    expect(offenses("x.ts", "const y = Math.sin(a) + Math.cos(b); // centroid of the anchor")).toEqual([]);
    expect(offenses("x.md", "See `docs/plans/2026-10-19-26-velo-luces-por-posicion.md`.")).toEqual([]);
  });
});

describe("English codebase (#194)", () => {
  for (const file of FILES) {
    it(file, () => {
      expect(offenses(file, readFileSync(`${ROOT}${file}`, "utf8"))).toEqual([]);
    });
  }
  it("visitor text stays as it is: the page title still names Nicolás Riccomini", () => {
    expect(readFileSync(`${ROOT}src/views.ts`, "utf8")).toContain('document.title = "Nicolás Riccomini";');
  });
});
