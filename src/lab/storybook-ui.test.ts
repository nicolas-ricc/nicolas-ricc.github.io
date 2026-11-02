// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Readout } from "./crop";
import { EXHIBITS, GROUPS } from "./exhibits";
import { buildIndex, markCurrent, mountStorybook, renderReadout, STORYBOOK_IDS, storybookElements } from "./storybook-ui";

// under happy-dom import.meta.url is a /@fs/ URL, not a path
const ROOT = `${resolve(import.meta.dirname, "../..")}/`;

/** Builds the body with the requested ids, in the order of lab/storybook.html. */
function page(ids: readonly string[] = STORYBOOK_IDS): void {
  document.body.replaceChildren(...["exhibits", "lab-host", "readout"].filter((id) => ids.includes(id)).map((id) => {
    const el = document.createElement(id === "exhibits" ? "nav" : id === "readout" ? "aside" : "div");
    el.id = id;
    return el;
  }));
}

let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => { error = vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

describe("guarded storybook elements (#187)", () => {
  it("with all three present it returns host, nav and panel", () => {
    page();
    const els = storybookElements(document);
    expect(els.host).toBe(document.getElementById("lab-host"));
    expect(els.nav).toBe(document.getElementById("exhibits"));
    expect(els.panel).toBe(document.getElementById("readout"));
  });
  it("without #readout it throws naming it", () => {
    page(["lab-host", "exhibits"]);
    expect(() => storybookElements(document)).toThrow("#readout is missing from the page");
  });
  it("without two it names both", () => {
    page(["lab-host"]);
    expect(() => storybookElements(document)).toThrow("#exhibits, #readout are missing from the page");
  });
  it("lab/storybook.html has an element for each id of STORYBOOK_IDS", () => {
    const html = new DOMParser().parseFromString(readFileSync(`${ROOT}lab/storybook.html`, "utf8"), "text/html");
    for (const id of STORYBOOK_IDS) expect(html.getElementById(id), id).not.toBeNull();
  });
});

describe("mountStorybook reports on the page (#187)", () => {
  it("with the full page it calls run once and logs no error", () => {
    page();
    const run = vi.fn();
    mountStorybook(document, run);
    expect(run).toHaveBeenCalledTimes(1);
    const [els] = run.mock.calls[0]!;
    expect(els.host).toBe(document.getElementById("lab-host"));
    expect(els.nav).toBe(document.getElementById("exhibits"));
    expect(els.panel).toBe(document.getElementById("readout"));
    expect(error).not.toHaveBeenCalled();
  });
  it("without #exhibits it writes the reason to the host, logs and does not throw", () => {
    page(["lab-host", "readout"]);
    const run = vi.fn();
    expect(() => mountStorybook(document, run)).not.toThrow();
    expect(document.getElementById("lab-host")!.textContent).toBe("Could not start the storybook: #exhibits is missing from the page");
    expect(run).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith("[storybook] could not start", expect.any(Error));
  });
  it("without #lab-host it writes the reason to body", () => {
    page(["exhibits", "readout"]);
    mountStorybook(document, vi.fn());
    expect(document.body.textContent).toBe("Could not start the storybook: #lab-host is missing from the page");
  });
  it("with none it names all three in STORYBOOK_IDS order", () => {
    page([]);
    mountStorybook(document, vi.fn());
    expect(document.body.textContent).toBe("Could not start the storybook: #lab-host, #exhibits, #readout are missing from the page");
  });
  it("a synchronous error from run shows in the host", () => {
    page();
    const err = new Error("no world");
    mountStorybook(document, () => { throw err; });
    expect(document.getElementById("lab-host")!.textContent).toBe("Could not start the storybook: no world");
    expect(error).toHaveBeenCalledWith("[storybook] could not start", err);
  });
  it("a throw that is not an Error is shown as is", () => {
    page();
    mountStorybook(document, () => { throw "no context"; });
    expect(document.getElementById("lab-host")!.textContent).toBe("Could not start the storybook: no context");
  });
});

describe("storybook index (#187)", () => {
  const groups = [{ id: "factory", title: "Factory" }, { id: "sea", title: "Sea" }] as const;
  const exhibits = [
    { id: "a", title: "Alpha", group: "factory" },
    { id: "b", title: "Beta", group: "sea" },
    { id: "c", title: "Gamma", group: "sea" },
  ] as const;
  const nav = (): HTMLElement => { const n = document.createElement("nav"); buildIndex(n, groups, exhibits); return n; };

  it("one h2 and one ul per group, with the links in order", () => {
    const n = nav();
    expect([...n.children].map((c) => c.tagName)).toEqual(["H2", "UL", "H2", "UL"]);
    expect([...n.querySelectorAll("h2")].map((h) => h.textContent)).toEqual(["Factory", "Sea"]);
    const links = [...n.querySelectorAll("ul")].map((ul) => [...ul.querySelectorAll<HTMLElement>("li > a")].map((a) => [a.getAttribute("href"), a.dataset.id, a.textContent]));
    expect(links).toEqual([[["#a", "a", "Alpha"]], [["#b", "b", "Beta"], ["#c", "c", "Gamma"]]]);
  });
  it("with the real catalog it creates one link per exhibit", () => {
    const n = document.createElement("nav");
    buildIndex(n, GROUPS, EXHIBITS);
    expect(n.querySelectorAll("a")).toHaveLength(EXHIBITS.length);
  });
  it("only the current entry carries aria-current", () => {
    const n = nav();
    markCurrent(n, "b");
    markCurrent(n, "c");
    expect([...n.querySelectorAll<HTMLElement>("a[aria-current]")].map((a) => [a.dataset.id, a.getAttribute("aria-current")])).toEqual([["c", "page"]]);
  });

  const rect = (top: number, bottom: number): DOMRect => ({ top, bottom }) as DOMRect;
  function spied(entry: DOMRect): { n: HTMLElement; scroll: ReturnType<typeof vi.fn> } {
    const n = nav();
    const a = n.querySelector<HTMLElement>('a[data-id="c"]')!;
    vi.spyOn(n, "getBoundingClientRect").mockReturnValue(rect(0, 900));
    vi.spyOn(a, "getBoundingClientRect").mockReturnValue(entry);
    const scroll = vi.fn();
    a.scrollIntoView = scroll;
    return { n, scroll };
  }
  it("out of view it is centered (#117)", () => {
    const { n, scroll } = spied(rect(1200, 1222));
    markCurrent(n, "c");
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll).toHaveBeenCalledWith({ block: "center" });
  });
  it("if it is already fully visible, the index does not move (#117)", () => {
    const { n, scroll } = spied(rect(100, 122));
    markCurrent(n, "c");
    expect(scroll).not.toHaveBeenCalled();
  });
});

describe("storybook readout panel (#187)", () => {
  const rows = (panel: HTMLElement): [string | null, string | null][] =>
    [...panel.querySelectorAll("dt")].map((dt) => [dt.textContent, dt.nextElementSibling?.textContent ?? null]);

  it("one row per datum, the ground right after the solids (#185) and the box to one decimal", () => {
    const panel = document.createElement("aside");
    const r: Readout = {
      solids: 5, ground: 2, faces: 12, accents: 1,
      box: { min: { x: 0, y: 0, z: 0 }, max: { x: 2, y: 3, z: 4 }, w: 2, d: 3, h: 4 },
      materials: ["slab", "concrete"], accentColors: ["amber"],
    };
    renderReadout(panel, r);
    expect(panel.querySelectorAll("dl")).toHaveLength(1);
    expect(rows(panel)).toEqual([
      ["Solids", "5"], ["Ground", "2"], ["Faces", "12"], ["Accents", "1"],
      ["Box x", "0.0 … 2.0"], ["Box y", "0.0 … 3.0"], ["Box z", "0.0 … 4.0"],
      ["Width × depth × height", "2.0 × 3.0 × 4.0 u"],
      ["Materials", "slab, concrete"], ["Accent colors", "amber"],
    ]);
  });
  it("without a box or materials it shows — and a second call replaces the dl", () => {
    const panel = document.createElement("aside");
    const empty: Readout = { solids: 0, ground: 0, faces: 0, accents: 0, box: null, materials: [], accentColors: [] };
    renderReadout(panel, empty);
    renderReadout(panel, empty);
    expect(panel.querySelectorAll("dl")).toHaveLength(1);
    expect(rows(panel).slice(4).map(([, v]) => v)).toEqual(["—", "—", "—", "—", "—", "—"]);
  });
});
