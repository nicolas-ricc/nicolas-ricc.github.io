import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const read = (rel: string): string => (existsSync(`${ROOT}${rel}`) ? readFileSync(`${ROOT}${rel}`, "utf8") : "");

describe("domain glossary (#194, #196)", () => {
  const glossary = read("CONTEXT.md");
  it("CONTEXT.md exists at the repo root", () => {
    expect(existsSync(`${ROOT}CONTEXT.md`)).toBe(true);
  });
  for (const term of ["Veil", "Zone", "Accent", "Animator", "Deck piece", "Side piece", "Hull rule", "Frame", "Lanes", "Exhibit"]) {
    it(`defines ${term}`, () => {
      expect(glossary).toMatch(new RegExp(`^### ${term}\\b`, "m"));
    });
  }
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
});
