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

/** The markup from the opening tag that starts with `open` to its closing `</tag>`. */
function element(html: string, open: string, tag: string): string {
  const at = html.indexOf(open);
  expect(at, `missing element ${open}`).toBeGreaterThanOrEqual(0);
  return html.slice(at, html.indexOf(`</${tag}>`, at) + tag.length + 3);
}

/** An icon control: an aria-hidden, unfocusable svg drawn in currentColor, and no visible text. */
function expectIconOnly(el: string): void {
  expect(el).toMatch(/<svg [^>]*aria-hidden="true"[^>]*focusable="false"/);
  expect(el.replace(/<svg[\s\S]*<\/svg>/, "").replace(/<[^>]+>/g, "").trim()).toBe("");
  for (const m of el.matchAll(/(?:fill|stroke)="([^"]+)"/g)) expect(["currentColor", "none"]).toContain(m[1]);
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
    for (const d of ["color: transparent", "background: none", "padding: 0", "box-sizing: border-box", "overflow: hidden"]) expect(b).toContain(d);
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
    for (const d of ["width: auto !important", "height: auto !important", "position: static"]) expect(b).toContain(d);
  });

  // with a zone open, the edge label of another zone hides (it floated as loose HTML text), except under keyboard focus
  it("style.css hides the edge label of a zone that is not the active one", () => {
    expect(block(CSS, 'body.zone #zonas a.on-edge:not([aria-current="page"]):not(:focus-visible)')).toContain("opacity: 0;");
  });

  // the opacity transition served .dim only
  it("#zonas a has no opacity transition", () => {
    expect(block(CSS, "#zonas a")).not.toContain("transition");
  });

  it("main.ts has no LABEL_AT and no dim class", () => {
    expect(MAIN).not.toMatch(/LABEL_AT/);
    expect(MAIN).not.toMatch(/["']dim["']/);
  });
});

describe("site shell: navigable map (#438)", () => {
  it("the map host is a focusable region that names its controls", () => {
    expect(HTML).toContain(`<div id="canvas-host" role="region" tabindex="0" aria-label="Mapa: arrastrá o usá las flechas para recorrerlo">`);
  });

  // #499: the controls are icons, named by aria-label and title
  it("the recenter button starts hidden inside the host and is an icon named by its aria-label", () => {
    const open = `<button id="recentrar" type="button" aria-label="Centrar vista" title="Centrar vista" hidden>`;
    const btn = HTML.indexOf(open);
    expect(btn).toBeGreaterThan(HTML.indexOf(`id="canvas-host"`));
    expect(btn).toBeLessThan(HTML.indexOf(`<main id="content"`));
    expectIconOnly(element(HTML, open, "button"));
  });

  it("the back link is an icon named by its aria-label inside the hidden hud", () => {
    const open = `<a id="back" href="/" aria-label="Volver al mapa" title="Volver al mapa">`;
    expect(HTML.indexOf(open)).toBeGreaterThan(HTML.indexOf(`<div id="hud" hidden>`));
    expectIconOnly(element(HTML, open, "a"));
  });

  it("style.css puts the button in the top-right corner with a focus ring", () => {
    const b = block(CSS, "#recentrar");
    for (const d of ["position: absolute", "inset: 1rem 1rem auto auto", "z-index: 2"]) expect(b).toContain(d);
    for (const d of ["color: var(--fg)", "filter: drop-shadow(0 1px 2px #000)", "min-width: 2rem", "min-height: 2rem"]) expect(b).toContain(d);
    expect(block(CSS, "#recentrar:focus-visible")).toContain("outline: 2px solid var(--fg)");
    // an author display beats the UA [hidden] rule: the button must still start hidden
    expect(block(CSS, "#recentrar[hidden]")).toContain("display: none");
  });

  it("style.css gives the back link the same icon box as the button", () => {
    const b = block(CSS, "#hud a");
    for (const d of ["color: var(--fg)", "filter: drop-shadow(0 1px 2px #000)", "min-width: 2rem", "min-height: 2rem", "display: inline-flex"]) expect(b).toContain(d);
    for (const d of ["position: absolute", "inset: 1rem auto auto 1rem", "z-index: 2"]) expect(block(CSS, "#hud")).toContain(d);
    expect(block(CSS, ".no-canvas #canvas-host canvas, .no-canvas #hud, .no-canvas #titulo")).toContain("display: none");
  });

  it("style.css gives the focused host an inset ring", () => {
    const b = block(CSS, "#canvas-host:focus-visible");
    expect(b).toContain("outline: 2px solid var(--fg)");
    expect(b).toContain("outline-offset: -2px");
  });

  it("style.css hides the button without a canvas", () => {
    expect(block(CSS, ".no-canvas #recentrar")).toContain("display: none");
  });
});
