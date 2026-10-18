import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../", import.meta.url).pathname;
const claude = readFileSync(`${ROOT}CLAUDE.md`, "utf8");
const factory = readdirSync(`${ROOT}.factory`, { withFileTypes: true })
  .filter((d) => d.isFile())
  .map((d) => [d.name, readFileSync(`${ROOT}.factory/${d.name}`, "utf8")] as const);
const METHOD = "docs/superpowers/specs/2026-10-17-barcos-inventario.md";

describe("notas para agentes: base y URL del lab (#99)", () => {
  it("ni CLAUDE.md ni .factory/ mencionan /map/", () => {
    expect(claude).not.toContain("/map/");
    for (const [f, txt] of factory) expect(txt, f).not.toMatch(/\/map(\/|\b)/);
  });
  it("CLAUDE.md da la base real y abre el lab en /lab/world.html", () => {
    expect(claude).toMatch(/vite\.config\.ts/);
    expect(claude).toContain("/lab/<página>.html");
    expect(claude).toMatch(/open http:\/\/localhost:5173\/lab\/world\.html/);
  });
  it("el comentario de dev_server en config.toml apunta a la raíz y a /lab/", () => {
    const toml = factory.find(([f]) => f === "config.toml")?.[1] ?? "";
    expect(toml).toContain("http://localhost:5173/lab/<page>.html");
  });
});

describe("notas para agentes: advertencia de headless (#99)", () => {
  it("CLAUDE.md advierte fps, deltaMS y el rendimiento de ?speed=", () => {
    expect(claude).toMatch(/~?2 fps/);
    expect(claude).toMatch(/deltaMS/);
    expect(claude).toMatch(/100 ms/);
    expect(claude).toMatch(/0,2·N/);
  });
  it("CLAUDE.md enlaza el método del time-lapse y la sección existe", () => {
    expect(claude).toContain(`(${METHOD}#método-del-time-lapse)`);
    expect(existsSync(`${ROOT}${METHOD}`)).toBe(true);
    expect(readFileSync(`${ROOT}${METHOD}`, "utf8")).toMatch(/^## Método del time-lapse$/m);
  });
});
