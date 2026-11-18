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
/** Each backticked `src/` or `scripts/` path of the entry's `Code:` line, with the backticked identifiers in the parenthesis right after it. */
function codeRefs(sec: string): { file: string; idents: string[] }[] {
  const line = sec.split("\n").find((l) => l.startsWith("Code:")) ?? "";
  return [...line.matchAll(/`((?:src|scripts)\/[^`]+)`(?:\s*\(([^)]*)\))?/g)].map((m) => ({
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
    expect(codeRefs("Code: `scripts/a.ts` (`X`).")).toEqual([{ file: "scripts/a.ts", idents: ["X"] }]);
  });
});

const SIGN_TERMS = ["Sign", "Lettering", "Legibility"];

describe("sign vocabulary (#360)", () => {
  const glossary = read("CONTEXT.md");
  for (const term of SIGN_TERMS) {
    it(`defines ${term}, and every Code: file exists and names identifiers it holds`, () => {
      expect(glossary).toMatch(new RegExp(`^### ${escape(term)}$`, "m"));
      const refs = codeRefs(section(glossary, term));
      expect(refs.length).toBeGreaterThan(0);
      for (const { file, idents } of refs) {
        expect(existsSync(`${ROOT}${file}`), file).toBe(true);
        const text = read(file);
        for (const id of idents) expect(hasIdent(text, id), `${id} in ${file}`).toBe(true);
      }
    });
  }
  it("Lettering names the lettering API and Sign the exhibits", () => {
    const lettering = section(glossary, "Lettering"), sign = section(glossary, "Sign");
    for (const id of ["TextPlane", "diagonalWall", "roofDiagonal", "facade", "strokeText", "fillText", "measureText", "GLYPHS"]) expect(lettering).toContain(id);
    for (const id of ["gap 2", "KERN", "layoutText", "letterGaps", "rhythm", "counterClearance", "probe"]) expect(lettering, id).toContain(id);
    for (const id of ["cartel-torre", "cartel-torre-escena", "cartel-taller", "cartel-taller-escena", "plataforma", "plataforma-escena", "src/scenes/sign-", "src/scenes/sign-crown.ts", "towerCrown", "RESUME_SIGN", "CROWN_SITE"]) expect(sign).toContain(id);
    for (const id of ["TINKER_SITE", "PLATFORM_SITE", "src/lab/signs.test.ts", "npm run legibility"]) expect(sign, id).toContain(id);
    expect(sign).not.toContain("cartel-helipuerto");
    expect(sign).not.toContain("grafiti");
  });
  it("Legibility names the three levels, the oracle API and the level-3 script", () => {
    const legibility = section(glossary, "Legibility");
    for (const s of ["level 1", "level 2", "level 3", "SIGN_FONT", "checkFont", "SignSpec", "checkSign", "SIGN_RULES", "npm run legibility"]) expect(legibility, s).toContain(s);
    const files = codeRefs(legibility).map((r) => r.file);
    for (const f of ["src/kit/legibility.ts", "scripts/legibility.ts"]) expect(files, f).toContain(f);
  });
  it("the kit's README paragraph names src/kit/lettering.ts", () => {
    expect(read("README.md")).toContain("src/kit/lettering.ts");
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

describe("storybook vocabulary (#405)", () => {
  const glossary = read("CONTEXT.md");
  const refsHold = (term: string): void => {
    for (const { file, idents } of codeRefs(section(glossary, term))) {
      expect(existsSync(`${ROOT}${file}`), file).toBe(true);
      const text = read(file);
      for (const id of idents) expect(hasIdent(text, id), `${id} in ${file}`).toBe(true);
    }
  };
  it("Accent names spot() and its Code: line points at it", () => {
    const accent = section(glossary, "Accent");
    expect(accent).toContain("spot()");
    expect(codeRefs(accent)).toContainEqual(expect.objectContaining({ file: "src/iso/accent.ts", idents: expect.arrayContaining(["spot"]) }));
    refsHold("Accent");
  });
  it("Exhibit names contentFrame and the clip of the regions, and its Code: line points at src/lab/frame.ts", () => {
    const exhibit = section(glossary, "Exhibit");
    expect(exhibit).toContain("contentFrame");
    expect(exhibit).toContain("clip");
    expect(codeRefs(exhibit)).toContainEqual({ file: "src/lab/frame.ts", idents: ["contentFrame"] });
    refsHold("Exhibit");
  });
  it("Frame names contentFrame", () => {
    expect(section(glossary, "Frame")).toContain("contentFrame");
    refsHold("Frame");
  });
});

describe("signs as the navigation (#394)", () => {
  const glossary = read("CONTEXT.md");
  const dir = `${ROOT}docs/adr/`;
  const adr = read("docs/adr/0003-signs-are-the-navigation.md");
  it("docs/adr/0003-signs-are-the-navigation.md has Status, Context, Decision and Consequences, in order", () => {
    expect(existsSync(`${dir}0003-signs-are-the-navigation.md`)).toBe(true);
    const at = ["Status", "Context", "Decision", "Consequences"].map((h) => adr.search(new RegExp(`^## ${h}$`, "m")));
    for (const i of at) expect(i).toBeGreaterThanOrEqual(0);
    for (let k = 1; k < at.length; k++) expect(at[k]!).toBeGreaterThan(at[k - 1]!);
  });
  it("the ADR names the hit test, the labels and the camera, and every src/ path it cites exists", () => {
    for (const s of ["zoneAtScreen", "worldZoneAt", "src/world/signs.ts", "labelLayout", "coverView", "edge", "phone"]) expect(adr, s).toContain(s);
    const paths = [...adr.matchAll(/`(src\/[^`\s]+\.ts)`/g)].map((m) => m[1]!);
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) expect(existsSync(`${ROOT}${p}`), p).toBe(true);
  });
  it("Sign tells where each scene builds its sign and how the site navigates by them", () => {
    const sign = section(glossary, "Sign");
    for (const s of ["assembleWorld", "tinkerAnimator", "src/world/signs.ts", "SIGNS", "zoneAtScreen", "labelLayout"]) expect(sign, s).toContain(s);
    expect(sign).not.toContain("None is in the world yet");
    expect(codeRefs(sign).find((r) => r.file === "src/world/signs.ts")?.idents).toEqual(expect.arrayContaining(["SIGNS", "zoneAtScreen", "labelLayout"]));
  });
  it("Zone and Landmark follow the moved headland (#426): Blog, no longer capping the shipyard, lighthouse at (410, 290)", () => {
    const zone = section(glossary, "Zone");
    expect(zone).toContain("Blog for the headland");
    expect(zone).not.toContain("caps the shipyard");
    expect(codeRefs(zone).find((r) => r.file === "src/map/geo.ts")?.idents).toEqual(expect.arrayContaining(["HEADLAND", "HEADLAND_SHIFT"]));
    expect(section(glossary, "Landmark")).toContain("(410, 290)");
  });
  it("Zone says the site's hit test tries the signs first", () => {
    const zone = section(glossary, "Zone");
    expect(zone).toContain("zoneAtScreen");
    expect(codeRefs(zone).find((r) => r.file === "src/world/signs.ts")?.idents).toContain("zoneAtScreen");
  });
  it("Exhibit says a context carries the sign the lab audits, cropped from the world", () => {
    const exhibit = section(glossary, "Exhibit");
    for (const s of ["`sign`", "cropScene", "contextScene", "contextAnimators"]) expect(exhibit, s).toContain(s);
  });
  for (const term of ["Zone", "Exhibit"]) {
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
});
