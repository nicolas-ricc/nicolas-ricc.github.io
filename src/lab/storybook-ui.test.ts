// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Readout } from "./crop";
import { EXHIBITS, GROUPS } from "./exhibits";
import { buildIndex, markCurrent, mountStorybook, renderReadout, STORYBOOK_IDS, storybookElements } from "./storybook-ui";

// bajo happy-dom import.meta.url es una URL /@fs/, no una ruta
const ROOT = `${resolve(import.meta.dirname, "../..")}/`;

/** Arma el body con los ids pedidos, en el orden de lab/storybook.html. */
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

describe("elementos del storybook con guarda (#187)", () => {
  it("con los tres presentes devuelve host, nav y panel", () => {
    page();
    const els = storybookElements(document);
    expect(els.host).toBe(document.getElementById("lab-host"));
    expect(els.nav).toBe(document.getElementById("exhibits"));
    expect(els.panel).toBe(document.getElementById("readout"));
  });
  it("sin #readout lanza nombrándolo", () => {
    page(["lab-host", "exhibits"]);
    expect(() => storybookElements(document)).toThrow("falta #readout en la página");
  });
  it("sin dos los nombra a los dos", () => {
    page(["lab-host"]);
    expect(() => storybookElements(document)).toThrow("faltan #exhibits, #readout en la página");
  });
  it("lab/storybook.html tiene un elemento por cada id de STORYBOOK_IDS", () => {
    const html = new DOMParser().parseFromString(readFileSync(`${ROOT}lab/storybook.html`, "utf8"), "text/html");
    for (const id of STORYBOOK_IDS) expect(html.getElementById(id), id).not.toBeNull();
  });
});

describe("mountStorybook avisa en la página (#187)", () => {
  it("con la página completa llama a run una vez y no registra error", () => {
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
  it("sin #exhibits escribe el motivo en el host, registra y no lanza", () => {
    page(["lab-host", "readout"]);
    const run = vi.fn();
    expect(() => mountStorybook(document, run)).not.toThrow();
    expect(document.getElementById("lab-host")!.textContent).toBe("No se pudo iniciar el storybook: falta #exhibits en la página");
    expect(run).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith("[storybook] no se pudo iniciar", expect.any(Error));
  });
  it("sin #lab-host escribe el motivo en body", () => {
    page(["exhibits", "readout"]);
    mountStorybook(document, vi.fn());
    expect(document.body.textContent).toBe("No se pudo iniciar el storybook: falta #lab-host en la página");
  });
  it("sin ninguno nombra los tres en el orden de STORYBOOK_IDS", () => {
    page([]);
    mountStorybook(document, vi.fn());
    expect(document.body.textContent).toBe("No se pudo iniciar el storybook: faltan #lab-host, #exhibits, #readout en la página");
  });
  it("un error síncrono de run se muestra en el host", () => {
    page();
    const err = new Error("sin mundo");
    mountStorybook(document, () => { throw err; });
    expect(document.getElementById("lab-host")!.textContent).toBe("No se pudo iniciar el storybook: sin mundo");
    expect(error).toHaveBeenCalledWith("[storybook] no se pudo iniciar", err);
  });
  it("un throw que no es Error se muestra tal cual", () => {
    page();
    mountStorybook(document, () => { throw "sin contexto"; });
    expect(document.getElementById("lab-host")!.textContent).toBe("No se pudo iniciar el storybook: sin contexto");
  });
});

describe("índice del storybook (#187)", () => {
  const groups = [{ id: "fabrica", title: "Fábrica" }, { id: "mar", title: "Mar" }] as const;
  const exhibits = [
    { id: "a", title: "Alfa", group: "fabrica" },
    { id: "b", title: "Beta", group: "mar" },
    { id: "c", title: "Gama", group: "mar" },
  ] as const;
  const nav = (): HTMLElement => { const n = document.createElement("nav"); buildIndex(n, groups, exhibits); return n; };

  it("un h2 y un ul por grupo, con los enlaces en orden", () => {
    const n = nav();
    expect([...n.children].map((c) => c.tagName)).toEqual(["H2", "UL", "H2", "UL"]);
    expect([...n.querySelectorAll("h2")].map((h) => h.textContent)).toEqual(["Fábrica", "Mar"]);
    const links = [...n.querySelectorAll("ul")].map((ul) => [...ul.querySelectorAll("li > a")].map((a) => [a.getAttribute("href"), (a as HTMLElement).dataset.id, a.textContent]));
    expect(links).toEqual([[["#a", "a", "Alfa"]], [["#b", "b", "Beta"], ["#c", "c", "Gama"]]]);
  });
  it("con el catálogo real crea un enlace por exhibit", () => {
    const n = document.createElement("nav");
    buildIndex(n, GROUPS, EXHIBITS);
    expect(n.querySelectorAll("a")).toHaveLength(EXHIBITS.length);
  });
  it("solo la entrada actual lleva aria-current", () => {
    const n = nav();
    markCurrent(n, "b");
    markCurrent(n, "c");
    expect([...n.querySelectorAll("a[aria-current]")].map((a) => [(a as HTMLElement).dataset.id, a.getAttribute("aria-current")])).toEqual([["c", "page"]]);
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
  it("fuera de la vista se centra (#117)", () => {
    const { n, scroll } = spied(rect(1200, 1222));
    markCurrent(n, "c");
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll).toHaveBeenCalledWith({ block: "center" });
  });
  it("si ya se ve entera, el índice no se mueve (#117)", () => {
    const { n, scroll } = spied(rect(100, 122));
    markCurrent(n, "c");
    expect(scroll).not.toHaveBeenCalled();
  });
});

describe("panel de lectura del storybook (#187)", () => {
  const rows = (panel: HTMLElement): [string | null, string | null][] =>
    [...panel.querySelectorAll("dt")].map((dt) => [dt.textContent, dt.nextElementSibling?.textContent ?? null]);

  it("una fila por dato, el suelo justo después de los sólidos (#185) y la caja a un decimal", () => {
    const panel = document.createElement("aside");
    const r: Readout = {
      solids: 5, ground: 2, faces: 12, accents: 1,
      box: { min: { x: 0, y: 0, z: 0 }, max: { x: 2, y: 3, z: 4 }, w: 2, d: 3, h: 4 },
      materials: ["slab", "concrete"], accentColors: ["amber"],
    };
    renderReadout(panel, r);
    expect(panel.querySelectorAll("dl")).toHaveLength(1);
    expect(rows(panel)).toEqual([
      ["Sólidos", "5"], ["Suelo", "2"], ["Caras", "12"], ["Acentos", "1"],
      ["Caja x", "0.0 … 2.0"], ["Caja y", "0.0 … 3.0"], ["Caja z", "0.0 … 4.0"],
      ["Ancho × fondo × alto", "2.0 × 3.0 × 4.0 u"],
      ["Materiales", "slab, concrete"], ["Colores de acento", "amber"],
    ]);
  });
  it("sin caja ni materiales muestra — y una segunda llamada reemplaza el dl", () => {
    const panel = document.createElement("aside");
    const empty: Readout = { solids: 0, ground: 0, faces: 0, accents: 0, box: null, materials: [], accentColors: [] };
    renderReadout(panel, empty);
    renderReadout(panel, empty);
    expect(panel.querySelectorAll("dl")).toHaveLength(1);
    expect(rows(panel).slice(4).map(([, v]) => v)).toEqual(["—", "—", "—", "—", "—", "—"]);
  });
});
