import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const claude = readFileSync(`${ROOT}CLAUDE.md`, "utf8");
const factory = readdirSync(`${ROOT}.factory`, { withFileTypes: true })
  .filter((d) => d.isFile())
  .map((d) => [d.name, readFileSync(`${ROOT}.factory/${d.name}`, "utf8")] as const);
const METHOD = "docs/superpowers/specs/2026-10-17-barcos-inventario.md";
const MAP_BASE = /\/map\/|:5173\/map\b/;

describe("agent notes: base and lab URL (#99)", () => {
  it("neither CLAUDE.md nor .factory/ mention /map/", () => {
    for (const [f, txt] of [["CLAUDE.md", claude], ...factory]) expect(txt, f).not.toMatch(MAP_BASE);
  });
  it("CLAUDE.md gives the real base and opens the lab at /lab/world.html", () => {
    expect(claude).toMatch(/vite\.config\.ts/);
    expect(claude).toContain("/lab/<page>.html");
    expect(claude).toMatch(/open http:\/\/localhost:5173\/lab\/world\.html/);
  });
  it("the dev_server comment in config.toml points to the root and to /lab/", () => {
    const toml = factory.find(([f]) => f === "config.toml")?.[1] ?? "";
    expect(toml).toContain("http://localhost:5173/lab/<page>.html");
  });
});

describe("agent notes: headless warning (#99)", () => {
  it("CLAUDE.md warns about fps, deltaMS and the throughput of ?speed=", () => {
    expect(claude).toMatch(/~?2 fps/);
    expect(claude).toMatch(/deltaMS/);
    expect(claude).toMatch(/100 ms/);
    expect(claude).toMatch(/0.2·N/);
  });
  it("CLAUDE.md links the time-lapse method and the section exists", () => {
    expect(claude).toContain(`(${METHOD}#método-del-time-lapse)`);
    expect(existsSync(`${ROOT}${METHOD}`)).toBe(true);
    expect(readFileSync(`${ROOT}${METHOD}`, "utf8")).toMatch(/^## Método del time-lapse$/m);
  });
});
