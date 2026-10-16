import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../../", import.meta.url).pathname;
const readme = (): string => readFileSync(`${ROOT}README.md`, "utf8");
const blogLab = (): string => readFileSync(`${ROOT}src/lab/blog.ts`, "utf8");

describe("documentación de la flota (#65)", () => {
  it("README describe el fondeadero de la bocana, los dos carriles y la salida por abajo-izquierda", () => {
    const md = readme();
    expect(md).toMatch(/fondeadero de la bocana/);
    expect(md).toMatch(/dos carriles/);
    expect(md).toMatch(/abajo-izquierda/);
  });
  it("README lista el documento de referencia de barcos entre las specs", () => {
    expect(readme()).toContain("2026-10-16-barcos-referencia.md");
  });
  it("ni README ni el lab de Blog describen el recorrido viejo", () => {
    for (const txt of [readme(), blogLab()]) expect(txt).not.toMatch(/nacen en la bahía|rodean la punta/);
  });
  it("el comentario del lab de Blog describe fondeadero y carriles", () => {
    expect(blogLab()).toMatch(/fondeadero/);
    expect(blogLab()).toMatch(/abajo-izquierda/);
  });
});
