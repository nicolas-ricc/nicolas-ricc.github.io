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
/** The ids of the storybook exhibits (the URL hash), as whole tokens; `tren.lights` is the id of the train animator's light layer. */
const EXHIBIT_IDS = /(?<=["'`#])(planta|tanque-agua|chimeneas|subestacion|playa-camiones|playa-vias|excavadora|gradas|darsena|grua-portico|calle-faroles|naves|punta-norte|estacion|paso-a-nivel|dique-flotante|patio-contenedores|grua-muelle|grua-torre|farol|tren(\.lights)?|central-termica|tanques|silos|alta-tension|playa-contenedores|noria|montana-rusa|torre-caida|carrusel|arcade|autitos-chocadores|muelle|tren-fantasma|casa-espejos|tobogan|tronco-acuatico|plaza|hotel|puente|malecon|manzana-derrumbada|manzana-distrito|manzana-casco|manzana-transicion|obra|punta-sur|galpones|playa-carga|mercado-pescado|campus|selva|cartel-helipuerto(-b)?|grafiti|plataforma(-escena(-angosta)?)?|cartel-torre(-escena)?|cartel-taller(-escena)?|mastil|arena|auditorio|torres|monoblock|casas|escuela|club|plaza-barrio|costanera|barrio|faro|casa-farero|boyas|pecio|viga|carguero|remolcador|convoy|lancha)(?=["'`.\]),\s:])/g;
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
  "src/content/render.test.ts": [/\btitulo: "Rawls & <puente>"/g, CONTENT_KEYS, /Quién soy &(amp;)? qué hago/g, /Sin (<url>|&lt;url&gt;)/g, /¿Lenguaje &(amp;)? (<|&lt;)mundo(>|&gt;)\?/g],
  "src/content/validate.test.ts": [CONTENT_KEYS],
  "src/content/blog-feed.test.ts": [CONTENT_KEYS, /(title|description|titulo|descripcion): ('[^']*'|"[^"]*")/g,
    // the RSS fixture stands in for a Spanish blog post
    /Rawls como puente/g, /¿Puede un (&amp;quot;|")velo(&amp;quot;|")/g, /dar cuenta del mundo\?/g],
  "src/style.css": [/\.(externo|proyectos|articulos)\b/g],
  // #438: the shell test pins the map host's Spanish aria-label, shown to the visitor
  "src/site-shell.test.ts": [/Mapa: arrastrá o usá las flechas para recorrerlo/g],
  // exhibit ids are the storybook URL hash, cited by the old specs (decision 2b)
  "src/lab/exhibits.ts": [/\bid: "[a-z0-9-]+"/g],
  // the test names the exhibits by their (Spanish) ids and reads the animator layer `tren.lights`; only the ids of the catalog are stripped, as whole tokens
  "src/lab/exhibits.test.ts": [EXHIBIT_IDS],
  // #403: the 0-dot gate lists the exhibits by id
  "src/lab/no-dots.test.ts": [EXHIBIT_IDS],
  // `faro` is an exhibit id (decision 2b); the test names it in its title
  "src/lab/frame.test.ts": [EXHIBIT_IDS, /real world: faro covers/g],
  // `sin` is the trig function in two geometry comments (it is also the Spanish word for "without")
  "src/iso/solids.ts": [/\bsin(?= φ|\(π\))/g],
  // `"se"` is the southeast corner id of the chamfer recipe (it collides with the Spanish word "se"); the guard sees string text without its quotes
  // (only a line whose string text is nothing but corner ids is stripped, so a Spanish "se" in a comment is still caught)
  "src/kit/forms/composite.ts": [/^\s*(?:(?:nw|ne|se|sw|n|s|e|w)\s+)*se(?:\s+(?:nw|ne|se|sw|n|s|e|w))*\s*$/g],
  // the test name says "SE without open" (the corner id)
  "src/kit/forms/porteno.ts": [/^\s*(?:(?:nw|ne|se|sw|n|s|e|w)\s+)*se(?:\s+(?:nw|ne|se|sw|n|s|e|w))*\s*$/g],
  "src/kit/forms/porteno.test.ts": [/^\s*(?:(?:nw|ne|se|sw|n|s|e|w)\s+)*se(?:\s+(?:nw|ne|se|sw|n|s|e|w))*\s*$/g],
  "src/kit/forms/composite.test.ts": [/\bSE without open/g, /^\s*(?:(?:nw|ne|se|sw|n|s|e|w)\s+)*se(?:\s+(?:nw|ne|se|sw|n|s|e|w))*\s*$/g],
  // proper nouns of the real places the neighborhood pieces model (decision 2c)
  "src/scenes/neighborhood-houses.ts": [/Ciudad Jardín/g],
  "src/scenes/neighborhood-houses.test.ts": [/Ciudad Jardín/g],
  "src/scenes/neighborhood-monoblock.ts": [/Simón Bolívar/g],
  "src/scenes/neighborhood-monoblock.test.ts": [/Simón Bolívar/g],
  // #472: the axis names and barrio ids are the place names of the layout (spec 2026-11-22), data like the exhibit ids
  "src/scenes/city-plan.ts": [/Avenida (?:de la Plaza|de las Vías|del Sur|del Barrio)/g, /\bcostanera\b/gi, /\b[Bb]arrios?(?:At)?\b/g, /\bresidencial\b/g],
  "src/scenes/city-plan.test.ts": [/Avenida (?:de la Plaza|de las Vías|del Sur|del Barrio)/g, /\bcostanera\b/gi, /\b[Bb]arrios?(?:At)?\b/g, /\bresidencial\b/g],
  // #493: proper nouns of the layout (avenues, Bulevar Central, Costanera) and the barrio ids
  "src/scenes/layout-493.test.ts": [/Avenida del (?:Sur|Barrio)/g, /Bulevar Central/g, /\bcostanera\b/gi, /Costanera/g, /\b[Bb]arrios?(?:At)?\b/g, /\bbulevar\b/g, /\bresidencial\b/g, /clásico/g],
  "src/city/streets.test.ts": [/Avenida de las Vías/g, /\bcostanera\b/gi, /\bCOSTANERA_LAMP_Y\b/g], // axis name of the plan (#472), as city-plan.test.ts; axis kind and lamp stations of the costanera (#473)
  "src/city/streets.ts": [/\bcostanera\b/gi, /\bCOSTANERA_LAMP_Y\b/g], // axis kind of the plan (#472); the lamp stations of its row (#473)
  "src/city/crossings.ts": [/\bcostanera\b/g], // axis kind of the plan (#473)
  "src/city/crossings.test.ts": [/\bcostanera\b/g, /\bbarrio\b/g], // axis ids of the plan (#473)
  "src/city/axis-furniture.test.ts": [/\bcostanera\b/gi, /\bCOSTANERA_LAMP_Y\b/g, /Avenida de la Plaza/g], // axis kind and name of the plan (#473)
  "src/scenes/city-streets.test.ts": [/\bcostanera\b/g], // axis kind of the plan (#473)
  "src/city/axis-streets.ts": [/\bcostanera\b/gi], // axis kind of city-plan is layout data
  // #478: the south neighborhood zones by the barrio ids and paints the axes of the plan
  "src/scenes/tech-south.test.ts": [/Avenida del (?:Sur|Barrio)/g, /\bcostanera\b/gi, /\b[Bb]arrios?\b/g, /\bresidencial\b/g, /\bbajo\b/g, /\bbulevar\b/g, /\bescuela\b/g, /\bauditorio\b/g, /\bcasas\b/g],
  "src/scenes/tech-zoning.ts": [/\bbajo\b/g, /\bresidencial\b/g, /\b[Bb]arrios?\b/g], // barrio ids of city-plan are layout data
  "src/scenes/tech-zoning.test.ts": [/\bbajo\b/g, /\bresidencial\b/g, /\b[Bb]arrios?\b/g],
  "src/city/axis-streets.test.ts": [/Avenida del (?:Sur|Barrio)/g, /\bcostanera\b/gi, /\bbarrio\b/g],
  "src/city/zoning.ts": [/\b[Bb]arrios?\b/g, /\bresidencial\b/g, /\bBARRIO_STEP\b/g, /\bCityBarrio\b/g], // Barrio ids of city-plan are layout data (#477: `residencial` too)
  "src/scenes/city.test.ts": [/const MAIN = \[(?:"[0-9a-f]{8}",? ?)+\]/g], // fingerprints of the pinned plinth pieces (a hash may spell a stem)
  "src/city/lights.ts": [/\b[Bb]arrios?\b/g, /\bANIMABLE_BARRIOS\b/g], // barrio ids of city-plan are layout data (#480)
  "src/city/lights.test.ts": [/\b[Bb]arrios?\b/g, /\bANIMABLE_BARRIOS\b/g],
  "src/scenes/city-anim.test.ts": [/\b[Bb]arrios?\b/g, /\bANIMABLE_BARRIOS\b/g], // barrio ids of city-plan are layout data (#480)
  "src/docs-glossary.test.ts": [/\b[Bb]arrios?\b/g, /Resume: ciudad/g, /\bbarrioAt\b/g], // barrio ids and the Resume: ciudad row of the storybook index (#477); the barrioAt identifier (#480)
  "src/kit/kit.test.ts": [/\b[Bb]arrios?\b/g], // barrio ids of the plan (#477)
  "src/city/zoning.test.ts": [/\b[Bb]arrios?\b/g, /\bresidencial\b/g, /\bcostanera\b/g, /\bBARRIO_STEP\b/g, /\bCityBarrio\b/g],
  // proper noun: the Fábrica de Luz is the real power station the boiler hall models (decision 2c)
  "src/scenes/boiler-house.ts": [/Fábrica de Luz/g],
  "src/scenes/factory.ts": [/Fábrica de Luz/g],
  // proper noun: the real substation the model is based on (decision 2c)
  "src/scenes/substation.ts": [/Pont-l'Abbé/g],
  // the animator layer id is built from the exhibit id `tren` (decision 2b) and exhibits.test.ts reads it
  "src/scenes/rail-animator.ts": [/\btren\.lights\b/g],
  // `SE` is the southeast quadrant id of the plaza test (it collides with the Spanish word "se")
  "src/scenes/neighborhood-plaza.test.ts": [/\bSE\b/g],
  // proper noun: the Paraná delta, where the Tigre launch runs (decision 2c)
  "src/scenes/ships.ts": [/Paraná/g],
  // heading of the old terrain spec, which stays in Spanish
  "src/scenes/terrain.ts": [/Desvíos de la implementación/g],
  // the old ships reference spec stays in Spanish (decision 3): the patterns that match its headings, labels and
  // text, the Spanish photo angles and its asset file names are literals of that spec
  "src/scenes/ships-reference.test.ts": [
    /Astillero\/clase|Eslora|Manga|Altura sobre el agua|Rasgos de silueta|Piezas sugeridas|por importancia|Altura máx/g,
    /Ángulo|Cierre y medición|mayoría|Desvíos|Puerto de salida|Desvío posterior|sin fondeadero/g,
    /inventario-después|Inventario después|API de|Desde #87 no hay fondeadero ni barcos fondeados|Un barco fondeado/g,
    /\b(cargo|tug|barge|faro)-(antes|despues)\b|cover-ida-vuelta/g,
  ],
  // proper nouns: the Fábrica de Luz is the real power station the factory models (decision 2c)
  "README.md": [/Fábrica de Luz/g],
  // the anchor of a link into an old Spanish spec, whose heading stays in Spanish (decision 3)
  "CLAUDE.md": [/#método-del-time-lapse/g],
  // the docs test pins prose of the Spanish specs in `docs/superpowers/specs/` (the old ones stay untouched, decision 3; the sign spec is
  // closed by #364): each entry is a literal of one of those specs (status line, headings, deviation notes, table rows, log text, exhibit names) or an exhibit id
  "src/lab/docs.test.ts": [
    // the centro costero closing (#480): its status line, §12 heading and the name of its spec and asset folder
    /centro[- ]costero|implementado \(#471; rama feature\/471-resume-centro-costero\)/g,
    /casas con techo de teja|plaza de barrio|barrio costero|estación|paso a nivel|peor redibujo( en 5 s)?/g,
    EXHIBIT_IDS,
    // the zone signs closing (#364): its status line and an exhibit name of the storybook table
    /integración pendiente|plataforma con cartel/g,
    // the zone signs redesign closing (#380): the level-2 line of the generated legibility report
    /Sin violaciones\./g,
    /\*\*Estado:\*\*|implementad|sin implementar|pendiente|listo para agente/g,
    /Desvíos( y medición)?|Reglas de modelado|## 2\. Decisiones|\| Tema \| Decisión \|/g,
    /\*Desvío[^"*]*\*?/g,
    // the history note of the 2026-11-17 spec (#427), quoted whole
    /\*\*Superada en parte:\*\* #423[^"]*/g,
    // the #423 closing (#429): the after-captures folder and a phrase its README must carry
    /423-composicion-responsive\/despues\/|despues\/ is|sin recargar/g,
    /\| (Resume: tecnológico|Portfolio: astillero|Resume: ciudad|Blog: mar) \|/g,
    // old asset names of those specs: `<view>-antes`, `<view>-despues`, and their folders
    /[\w-]*-(antes|despues)\b|assets\/[\w.-]*(fabrica|barrio|estacion|costura)[\w.-]*\//g,
    // the old spec mundo-3
    /\bmundo-3\b/g,
    // the storybook lights closing (#405): its asset folder, the beam-north captures and the before/after table heading
    /2026-11-16-storybook-luces\/|faro-norte|Capturas antes y después/g,
    // the zone signs integration closing (#394): status line, framing row label and frame table rows of its spec
    /integración al sitio|teléfono|veredicto del bloom|bloom, promedio|polígonos estáticos|acentos estáticos del mundo/g,
    // the plank raft closing (#457): the pending note it drops, the 2026-11-18 §8.3 phrase, and the glossary's Spanish name of Decal
    /#457 las regenera|balsa de tablones|\(Calcomanía\.\)/g,
    // the hotel sign closing (#475): the crown's sha256 digests (any 64-hex literal of this file), its §8.3 line, the storybook cell phrases and the #474 note it closes
    /\b[0-9a-f]{64}\b|Desde #471 el cartel es el del hotel|el cartel de Resume en la fachada del hotel|recorte del mundo|hasta #475/g,
  ],
  "src/scenes/world-baseline.test.ts": [/"?[a-z-]+"?: "[0-9a-f]{8}\/[0-9a-f]{8}"/g],
};

/** Tokens that collide with WORDS but are not prose: `Math.sin`, file paths. */
const NOT_PROSE = [/\bMath\.\w+/g, /[\w./-]*\.(md|png|ts|html|json|pdf|css)\b/g, /\bdocs\/[\w./-]*/g];

/** A `/` after one of these (or at the start) opens a regex literal, not a division. */
const BEFORE_REGEX = new Set(["", "(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";"]);

/** Comment, string and regex-literal text of a TS/CSS source, line by line (code replaced by spaces). */
function proseOf(src: string, css: boolean): string[] {
  let out = "", mode: "code" | "line" | "block" | "str" | "regex" = "code", quote = "", prev = "", inClass = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!, n = src[i + 1];
    if (c === "\n") { out += "\n"; if (mode === "line") mode = "code"; continue; }
    if (mode === "code") {
      if (!css && c === "/" && n === "/") { mode = "line"; out += "  "; i++; continue; }
      if (c === "/" && n === "*") { mode = "block"; out += "  "; i++; continue; }
      if (!css && (c === '"' || c === "'" || c === "`")) { mode = "str"; quote = c; out += " "; prev = c; continue; }
      if (!css && c === "/" && BEFORE_REGEX.has(prev)) { mode = "regex"; inClass = false; out += " "; continue; }
      if (!/\s/.test(c)) prev = c;
      out += " ";
    } else if (mode === "regex") {
      if (c === "\\") { out += "  "; i++; continue; }
      if (c === "[") inClass = true; else if (c === "]") inClass = false;
      else if (c === "/" && !inClass) { mode = "code"; prev = ")"; out += " "; continue; }
      out += c;
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
    expect(offenses("x.test.ts", "expect(readme).toMatch(/dos carriles por la costa/);")).toHaveLength(1);
    expect(offenses("x.ts", "const half = w / 2 / scale; const re = /[/]two lanes/;")).toEqual([]);
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
