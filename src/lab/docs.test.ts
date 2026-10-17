import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../../", import.meta.url).pathname;
const readme = readFileSync(`${ROOT}README.md`, "utf8");
const blogLab = readFileSync(`${ROOT}src/lab/blog.ts`, "utf8");

describe("documentación de la flota (#65, #83)", () => {
  it("README describe la bocana, los dos carriles y la salida por abajo-izquierda (#87)", () => {
    expect(readme).toMatch(/bocana/);
    expect(readme).toMatch(/dos carriles/);
    expect(readme).toMatch(/abajo-izquierda/);
  });
  it("README lista el documento de referencia de barcos entre las specs", () => {
    expect(readme).toContain("2026-10-16-barcos-referencia.md");
  });
  it("ni README ni el lab de Blog describen los recorridos viejos", () => {
    for (const txt of [readme, blogLab]) expect(txt).not.toMatch(/nacen en la bahía|rodean la punta|fondeadero|BERTH/);
  });
  it("README nombra la lancha colectiva y el pecio partido", () => {
    expect(readme).toMatch(/lancha\s+colectiva/);
    expect(readme).toMatch(/pecio/);
  });
  it("el comentario del lab de Blog describe la bocana y los carriles", () => {
    expect(blogLab).toMatch(/bocana/);
    expect(blogLab).toMatch(/abajo-izquierda/);
  });
});
