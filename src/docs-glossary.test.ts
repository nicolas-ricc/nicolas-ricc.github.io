import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const read = (rel: string): string => (existsSync(`${ROOT}${rel}`) ? readFileSync(`${ROOT}${rel}`, "utf8") : "");

const KIT_TERMS = ["Lot", "Piece", "Recipe", "Landmark recipe", "Style", "Wall", "Window", "Slot"];
const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The entry `### <title>` (exact heading line) up to the next `### ` heading or the end of the file. */
function section(text: string, title: string): string {
  const m = new RegExp(`^### ${escape(title)}$`, "m").exec(text);
  if (!m) return "";
  const rest = text.slice(m.index + m[0].length);
  const next = rest.search(/^### /m);
  return next < 0 ? rest : rest.slice(0, next);
}
/** Each backticked `src/` path of the entry's `Code:` line, with the backticked identifiers in the parenthesis right after it. */
function codeRefs(sec: string): { file: string; idents: string[] }[] {
  const line = sec.split("\n").find((l) => l.startsWith("Code:")) ?? "";
  return [...line.matchAll(/`(src\/[^`]+)`(?:\s*\(([^)]*)\))?/g)].map((m) => ({
    file: m[1]!,
    idents: [...(m[2] ?? "").matchAll(/`([^`]+)`/g)].map((i) => i[1]!),
  }));
}
/** Every dot-separated segment of `ident` occurs in `text` as a whole word. */
const hasIdent = (text: string, ident: string): boolean => ident.split(".").every((seg) => new RegExp(`\\b${escape(seg)}\\b`).test(text));

describe("domain glossary (#194, #196, #126)", () => {
  const glossary = read("CONTEXT.md");
  it("CONTEXT.md exists at the repo root", () => {
    expect(existsSync(`${ROOT}CONTEXT.md`)).toBe(true);
  });
  for (const term of ["Veil", "Zone", "Accent", "Animator", "Deck piece", "Side piece", "Hull rule", "Frame", "Lanes", "Exhibit", "Plinth", ...KIT_TERMS]) {
    it(`defines ${term}`, () => {
      expect(glossary).toMatch(new RegExp(`^### ${escape(term)}\\b`, "m"));
    });
  }
});

describe("kit vocabulary (#126)", () => {
  const glossary = read("CONTEXT.md");
  it("appends the kit entries after Plinth, in order", () => {
    const at = ["Plinth", ...KIT_TERMS].map((t) => glossary.search(new RegExp(`^### ${escape(t)}$`, "m")));
    for (const i of at) expect(i).toBeGreaterThanOrEqual(0);
    for (let k = 1; k < at.length; k++) expect(at[k]!).toBeGreaterThan(at[k - 1]!);
  });
  it("disambiguates the zone landmark from the landmark recipe", () => {
    const recipe = section(glossary, "Landmark recipe"), zone = section(glossary, "Landmark");
    for (const s of ["LANDMARK_MAX_H", "fitToCap", "landmarkTop", "Landmark of a zone"]) expect(recipe).toContain(s);
    expect(zone).toContain("Landmark recipe");
    expect(zone).toContain("LANDMARKS");
    expect(zone).not.toContain("LANDMARK_MAX_H");
  });
  for (const term of KIT_TERMS) {
    it(`${term}: every Code: file exists and names identifiers it holds`, () => {
      const refs = codeRefs(section(glossary, term));
      expect(refs.length).toBeGreaterThan(0);
      for (const { file, idents } of refs) {
        expect(existsSync(`${ROOT}${file}`), file).toBe(true);
        const text = read(file);
        for (const id of idents) expect(hasIdent(text, id), `${id} in ${file}`).toBe(true);
      }
    });
  }
  it("hasIdent matches whole words only", () => {
    expect(hasIdent("const KIT_LOT = 1", "Lot")).toBe(false);
    expect(hasIdent("interface Lot {", "Lot")).toBe(true);
    expect(hasIdent("interface RecipeDef { landmark?: boolean }", "RecipeDef.landmark")).toBe(true);
  });
  it("codeRefs reads files and their parenthesised identifiers", () => {
    expect(codeRefs("x\nCode: `src/a.ts` (`A`, `B.c`), `src/b.ts`.\n")).toEqual([
      { file: "src/a.ts", idents: ["A", "B.c"] },
      { file: "src/b.ts", idents: [] },
    ]);
  });
});

describe("veil ADR (#194, #26)", () => {
  const dir = `${ROOT}docs/adr/`;
  const name = existsSync(dir) ? readdirSync(dir).find((f) => /^0001-.*\.md$/.test(f)) : undefined;
  const adr = name ? read(`docs/adr/${name}`) : "";
  it("docs/adr/0001-*.md exists", () => {
    expect(name).toBeDefined();
  });
  it("points at the code that applies the rule", () => {
    expect(adr).toContain("src/world/veil.ts");
    expect(adr).toContain("accentsByZone");
  });
  it("states the position rule and the ship exception", () => {
    expect(adr).toMatch(/zone (where|in which) (it|the light) stands/i);
    expect(adr).toMatch(/static or animated/i);
    expect(adr).toMatch(/ship/i);
  });
});

describe("README points at the glossary and the ADRs (#194)", () => {
  const readme = read("README.md");
  it("links CONTEXT.md and docs/adr/", () => {
    expect(readme).toContain("CONTEXT.md");
    expect(readme).toContain("docs/adr/");
  });
  it("names the kit vocabulary next to CONTEXT.md", () => {
    const line = readme.split("\n").find((l) => l.includes("is defined in `CONTEXT.md`")) ?? "";
    for (const t of ["lot", "piece", "recipe", "style", "wall", "window", "slot", "plinth"]) expect(line).toMatch(new RegExp(`\\b${t}\\b`));
  });
});
