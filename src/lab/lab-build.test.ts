import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

describe("lab in the build", () => {
  it("the dev entries exist", () => {
    for (const page of ["portfolio", "resume", "blog", "world", "kit", "storybook"]) expect(existsSync(`${ROOT}lab/${page}.html`)).toBe(true);
  });
  it("every lab page has its entry and noindex", () => {
    for (const f of readdirSync(`${ROOT}lab`).filter((n) => n.endsWith(".html"))) {
      const html = readFileSync(`${ROOT}lab/${f}`, "utf8");
      expect(html).toMatch(/name="robots" content="noindex"/);
      expect(html).toMatch(new RegExp(`src="/src/lab/${f.replace(".html", "")}\\.ts"`));
    }
  });
  it("vite.config adds every lab page to the build, next to index.html", () => {
    // The lab is deployed at /lab/<page>.html so the storybook can be seen
    // without the dev server; the noindex above keeps it out of search.
    const cfg = readFileSync(`${ROOT}vite.config.ts`, "utf8");
    expect(cfg).toMatch(/input:\s*\{\s*main:.*index\.html.*\.\.\.lab/);
    expect(cfg).toMatch(/readdirSync\(.*"lab"\)/);
  });
  it("prerender does not copy it", () => {
    // \blab\b so it does not match "slab" or "label".
    expect(readFileSync(`${ROOT}scripts/prerender.ts`, "utf8")).not.toMatch(/\blab\b/);
  });
});
