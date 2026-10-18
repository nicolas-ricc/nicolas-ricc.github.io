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

describe("documentación del storybook (#97)", () => {
  // párrafo propio, para que las teclas no se hereden de la frase de world.html (que ya nombra `6` y ?bloom=)
  const story = readme.split(/\n\s*\n/).find((p) => p.includes("/lab/storybook.html")) ?? "";
  it("README describe /lab/storybook.html y el hash en un párrafo propio", () => {
    expect(story).toMatch(/hash/);
    expect(story).not.toContain("/lab/world.html");
  });
  it("README nombra las teclas y los parámetros del storybook", () => {
    for (const k of ["←", "→", "`j`", "`k`", "`g`", "`h`", "`a`", "`6`", "?bloom=", "?speed="]) expect(story).toContain(k);
  });
  it("README lista la spec del storybook entre las specs del laboratorio", () => {
    const lab = readme.split(/\n\s*\n/).find((p) => p.includes("/lab/world.html")) ?? "";
    expect(lab).toContain("2026-10-17-storybook-estructuras-design.md");
  });
});

describe("estado de la spec del storybook (#97)", () => {
  const spec = readFileSync(`${ROOT}docs/superpowers/specs/2026-10-17-storybook-estructuras-design.md`, "utf8");
  it("la spec dice implementado y no sin implementar", () => {
    const estado = spec.split("\n").find((l) => l.startsWith("**Estado:**")) ?? "";
    expect(estado).toMatch(/implementad/);
    expect(estado).not.toMatch(/sin implementar/);
  });
  it("la spec anota sus desvíos", () => {
    expect(spec).toMatch(/^## 10\. Desvíos$/m);
  });
});

describe("specs viejas de los barcos (#69)", () => {
  // `ROUTE` con comilla delante, para no contar `FERRY_ROUTE`
  const OLD = /`ROUTE`|1\.2 \/ 2 \/ 0\.8/;
  const NOTE = "*Desvío: reemplazado por los carriles semirrectos de #87 (`LANE_OUT` / `LANE_BACK`) y la velocidad única `LANE_SPEED = 1.2` de #63, con fases 0, 1/3 y 2/3; ver `2026-10-16-barcos-referencia.md` y `2026-10-17-barcos-inventario.md`. Lo que sigue queda como registro.*";
  const specs = { "2026-09-14-mundo-isometrico-design.md": 1, "2026-09-14-mundo-2-fabrica-distrito-blog-design.md": 3 };
  for (const [name, count] of Object.entries(specs)) {
    const spec = readFileSync(`${ROOT}docs/superpowers/specs/${name}`, "utf8");
    // la nota se corta en varias líneas como el resto de la spec: se compara con los espacios colapsados
    const items = spec.split(/\n(?=- |\s*\n)/).map((item) => item.replace(/\s+/g, " ")).filter((item) => OLD.test(item));
    it(`${name}: cada viñeta con ROUTE o las velocidades por barco lleva la nota de desvío antes de la mención`, () => {
      expect(items).toHaveLength(count);
      for (const item of items) {
        expect(item).toContain(NOTE);
        expect(item.indexOf(NOTE)).toBeLessThan(item.search(OLD));
      }
    });
  }
});
