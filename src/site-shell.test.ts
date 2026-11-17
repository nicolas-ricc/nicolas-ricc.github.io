import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string): string => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const HTML = read("../index.html");
const CSS = read("./style.css");
const MAIN = read("./main.ts");

/** The declarations of the first rule, at the start of a line, whose selector list is exactly `selector`. */
function block(css: string, selector: string): string {
  const at = css.indexOf(`\n${selector} {`);
  expect(at, `missing rule ${selector}`).toBeGreaterThanOrEqual(0);
  return css.slice(at + selector.length + 3, css.indexOf("}", at));
}

describe("site shell: the zone links over the signs (#393)", () => {
  it("index.html loads no external font", () => {
    expect(HTML).not.toMatch(/Rubik|fonts\.googleapis|fonts\.gstatic|preconnect/);
    const links = [
      `<a href="/area/portfolio/" data-zone="portfolio">Portfolio</a>`,
      `<a href="/area/resume/" data-zone="cv">Resume</a>`,
      `<a href="/area/blog/" data-zone="blog">Writing</a>`,
    ].map((l) => HTML.indexOf(l));
    expect(links.every((i) => i >= 0)).toBe(true);
    expect([...links].sort((a, b) => a - b)).toEqual(links);
  });

  it("style.css has no Rubik and no .dim", () => {
    expect(CSS).not.toMatch(/Rubik/);
    expect(CSS).not.toMatch(/\.dim\b/);
  });

  it("style.css hides the text on the sign but keeps it in the tree", () => {
    const b = block(CSS, "#zonas a.on-sign");
    for (const d of ["color: transparent", "background: none", "padding: 0", "box-sizing: border-box"]) expect(b).toContain(d);
    for (const d of ["display: none", "visibility: hidden", "font-size: 0"]) expect(b).not.toContain(d);
  });

  it("style.css gives the edge label the plate and the system font", () => {
    const b = block(CSS, "#zonas a.on-edge");
    for (const d of ["font: 600 0.9rem/1 system-ui, sans-serif", "letter-spacing: 0.08em", "text-transform: uppercase", "background:"]) expect(b).toContain(d);
  });

  it("style.css focus ring for both modes and brightness on the edge only", () => {
    const f = block(CSS, "#zonas a:focus-visible");
    expect(f).toContain("outline: 2px solid var(--fg)");
    expect(f).toContain("outline-offset: 4px");
    expect(block(CSS, "#zonas a.on-edge:hover, #zonas a.on-edge:focus-visible")).toContain("filter: brightness(1.25)");
    expect(CSS).not.toMatch(/#zonas a:hover/);
  });

  it("style.css resets the sign size without a canvas", () => {
    const b = block(CSS, ".no-canvas #zonas a");
    for (const d of ["width: auto", "height: auto", "position: static"]) expect(b).toContain(d);
  });

  // A8: the opacity transition served .dim only
  it("#zonas a has no opacity transition", () => {
    expect(block(CSS, "#zonas a")).not.toContain("transition");
  });

  it("main.ts has no LABEL_AT and no dim class", () => {
    expect(MAIN).not.toMatch(/LABEL_AT/);
    expect(MAIN).not.toMatch(/["']dim["']/);
  });
});
