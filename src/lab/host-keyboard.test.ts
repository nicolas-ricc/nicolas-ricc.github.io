// @vitest-environment happy-dom
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// under happy-dom import.meta.url is a /@fs/ URL, not a file path
const ROOT = `${resolve(import.meta.dirname, "../..")}/`;

/** `KeyboardEvent.key` values each page's `window` keydown listener handles (`src/lab/page.ts`, `src/lab/storybook.ts`). */
const WORLD_KEYS = "0 1 2 3 4 5 6";
const SHORTCUTS: Record<string, string> = {
  world: WORLD_KEYS, blog: WORLD_KEYS, resume: WORLD_KEYS, portfolio: WORLD_KEYS,
  storybook: "ArrowRight ArrowDown ArrowLeft ArrowUp j k g h a 6",
  kit: "s 1 2 3 4",
};

function parsePage(page: string): Document {
  return new DOMParser().parseFromString(readFileSync(`${ROOT}lab/${page}.html`, "utf8"), "text/html");
}

/** Mounts only the page's host into the document, so its module script never runs. */
function mountHost(page: string): HTMLElement {
  const host = parsePage(page).getElementById("lab-host");
  if (!host) throw new Error(`lab/${page}.html has no #lab-host`);
  const mounted = document.importNode(host, true);
  document.body.replaceChildren(mounted);
  return mounted;
}

/** The text of every `<style>` block of the page. */
function pageStyle(page: string): string {
  return [...parsePage(page).querySelectorAll("style")].map((s) => s.textContent ?? "").join("\n");
}

describe("lab host keyboard access (#167)", () => {
  for (const [page, keys] of Object.entries(SHORTCUTS)) {
    it(`lab/${page}.html: #lab-host is in the tab order and takes focus`, () => {
      const host = mountHost(page);
      expect(host.getAttribute("tabindex")).toBe("0");
      expect(host.tabIndex).toBe(0);
      // happy-dom focuses any element, tabindex or not: this only proves the mounted host is live
      host.focus();
      expect(document.activeElement).toBe(host);
    });
    it(`lab/${page}.html: aria-keyshortcuts lists the keys its listener handles`, () => {
      expect(mountHost(page).getAttribute("aria-keyshortcuts")).toBe(keys);
    });
    it(`lab/${page}.html: keyboard focus ring is drawn inside #lab-host (#303)`, () => {
      const css = pageStyle(page);
      expect(css).toContain("#lab-host {");
      const offset = css.match(/#lab-host:focus-visible\s*\{[^}]*\boutline-offset:\s*(-?[\d.]+)px/)?.[1];
      expect(offset, "outline-offset of #lab-host:focus-visible").toBeDefined();
      expect(Number.parseFloat(offset!)).toBeLessThan(0);
      // mouse focus (:focus without -visible) keeps the browser default
      expect(css).not.toMatch(/#lab-host:focus(?!-visible)/);
    });
  }
  it("covers every page in lab/", () => {
    const pages = readdirSync(`${ROOT}lab`).filter((f) => f.endsWith(".html")).map((f) => f.slice(0, -5));
    expect(pages.sort()).toEqual(Object.keys(SHORTCUTS).sort());
  });
  it("keydown listeners stay on window", () => {
    for (const f of ["src/lab/page.ts", "src/lab/storybook.ts", "src/lab/kit.ts"]) {
      const targets = [...readFileSync(`${ROOT}${f}`, "utf8").matchAll(/(\w+)\.addEventListener\(\s*["']key\w+["']/g)].map((m) => m[1]);
      expect(targets.length, f).toBeGreaterThan(0);
      expect(new Set(targets), f).toEqual(new Set(["window"]));
    }
  });
});
