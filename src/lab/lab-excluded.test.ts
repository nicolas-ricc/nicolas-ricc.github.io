import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../../", import.meta.url).pathname;

describe("laboratorio fuera de producción", () => {
  it("existen las entradas de dev", () => {
    for (const page of ["portfolio", "resume", "blog", "world", "storybook"]) expect(existsSync(`${ROOT}lab/${page}.html`)).toBe(true);
  });
  it("cada página del lab tiene su entry y noindex", () => {
    for (const f of readdirSync(`${ROOT}lab`).filter((n) => n.endsWith(".html"))) {
      const html = readFileSync(`${ROOT}lab/${f}`, "utf8");
      expect(html).toMatch(/name="robots" content="noindex"/);
      expect(html).toMatch(new RegExp(`src="/src/lab/${f.replace(".html", "")}\\.ts"`));
    }
  });
  it("vite.config no agrega el laboratorio al build", () => {
    const cfg = readFileSync(`${ROOT}vite.config.ts`, "utf8");
    expect(cfg).not.toMatch(/rollupOptions|input\s*:/);
  });
  it("prerender no lo copia", () => {
    // \blab\b para no matchear "slab" ni "label".
    expect(readFileSync(`${ROOT}scripts/prerender.ts`, "utf8")).not.toMatch(/\blab\b/);
  });
});
