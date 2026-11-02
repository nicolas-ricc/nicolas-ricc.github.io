import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

describe("lab outside production", () => {
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
  it("vite.config does not add the lab to the build", () => {
    const cfg = readFileSync(`${ROOT}vite.config.ts`, "utf8");
    expect(cfg).not.toMatch(/rollupOptions|input\s*:/);
  });
  it("prerender does not copy it", () => {
    // \blab\b so it does not match "slab" or "label".
    expect(readFileSync(`${ROOT}scripts/prerender.ts`, "utf8")).not.toMatch(/\blab\b/);
  });
});
