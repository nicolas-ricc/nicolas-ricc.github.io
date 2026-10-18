import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../../", import.meta.url).pathname;
const PAGES = ["world", "blog", "resume", "portfolio", "storybook"];

describe("host del lab (#103)", () => {
  for (const p of PAGES) {
    it(`lab/${p}.html anuncia la ayuda: role="application" y aria-label en #lab-host`, () => {
      const html = readFileSync(`${ROOT}lab/${p}.html`, "utf8");
      const host = html.match(/<div id="lab-host"[^>]*>/)?.[0] ?? "";
      expect(host).toMatch(/\brole="application"/);
      expect(host).toMatch(/\baria-label="[^"]+"/);
    });
  }
});
