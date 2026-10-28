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

describe("documentación de la fábrica en detalle (#217)", () => {
  const factorySrc = readFileSync(`${ROOT}src/scenes/factory.ts`, "utf8");
  const parrafos = readme.split(/\n\s*\n/);
  // espacios colapsados: el párrafo se envuelve a ~80 columnas
  const mundo = (parrafos.find((p) => p.includes("`factory.ts`")) ?? "").replace(/\s+/g, " ");
  const lab = parrafos.find((p) => p.includes("/lab/world.html")) ?? "";
  const fab = readFileSync(`${ROOT}docs/superpowers/specs/2026-10-24-fabrica-detalle-design.md`, "utf8");
  const at = fab.search(/^## 14\. Desvíos y medición$/m);
  const desvios = at < 0 ? "" : fab.slice(at);
  it("el párrafo del mundo isométrico describe la fábrica nueva", () => {
    for (const re of [/nave de calderas/, /maltería/, /tanque de agua/, /chimeneas[^.]*bandas/, /subestación de intemperie/, /excavadora de rueda/]) expect(mundo).toMatch(re);
  });
  it("README lista la spec de la fábrica en detalle entre las specs", () => {
    expect(lab).toContain("2026-10-24-fabrica-detalle-design.md");
  });
  it("el docstring de factory.ts apunta a la spec nueva", () => {
    const end = factorySrc.indexOf("export interface FactoryScene");
    expect(end).toBeGreaterThan(0);
    expect(factorySrc.slice(0, end)).toContain("docs/superpowers/specs/2026-10-24-fabrica-detalle-design.md");
  });
  it("la spec de la fábrica dice implementada", () => {
    const estado = fab.split("\n").find((l) => l.startsWith("**Estado:**")) ?? "";
    expect(estado).toMatch(/implementad/);
    expect(estado).not.toMatch(/pendiente/);
  });
  it("la spec cierra con desvíos, tabla de caras y medición", () => {
    expect(at).toBeGreaterThan(0);
    for (const id of ["planta", "chimeneas", "subestacion", "playa-vias", "cinta", "excavadora"]) expect(desvios).toMatch(new RegExp(`^\\| \`${id}\` \\|`, "m"));
    expect(desvios).toContain("assets/207-fabrica/mundo-antes.png");
    expect(desvios).toContain("assets/207-fabrica/mundo-despues.png");
    expect(desvios).toMatch(/\[lab\] bloom/);
    expect(desvios).toMatch(/peor redibujo/);
  });
  it("las vistas del mundo antes y después son PNG de 1600×900 a 2x", () => {
    for (const name of ["mundo-antes", "mundo-despues"]) {
      const png = readFileSync(`${ROOT}docs/superpowers/specs/assets/207-fabrica/${name}.png`);
      expect(png.subarray(1, 4).toString()).toBe("PNG");
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([3200, 1800]);
    }
  });
});

describe("documentación del barrio costero (#256)", () => {
  const techSrc = readFileSync(`${ROOT}src/scenes/tech.ts`, "utf8");
  const mundo3 = readFileSync(`${ROOT}docs/superpowers/specs/2026-09-15-mundo-3-tecnologico-feria-agua-barcos-design.md`, "utf8");
  const story = readFileSync(`${ROOT}docs/superpowers/specs/2026-10-17-storybook-estructuras-design.md`, "utf8");
  const barrio = readFileSync(`${ROOT}docs/superpowers/specs/2026-10-27-barrio-costero-design.md`, "utf8");
  const parrafos = readme.split(/\n\s*\n/);
  // espacios colapsados: el párrafo se envuelve a ~80 columnas
  const mundo = (parrafos.find((p) => p.includes("`tech.ts`")) ?? "").replace(/\s+/g, " ");
  const lab = parrafos.find((p) => p.includes("/lab/world.html")) ?? "";
  const at = barrio.search(/^## 11\. Desvíos$/m);
  const desvios = at < 0 ? "" : barrio.slice(at);
  const png = (n: string) => readFileSync(`${ROOT}docs/superpowers/specs/assets/2026-10-27-barrio/${n}.png`);
  const size = (b: Buffer) => [b.readUInt32BE(16), b.readUInt32BE(20)];

  it("el párrafo del mundo cuenta el barrio costero y deja el distrito tecnológico al oeste", () => {
    for (const re of [/barrio residencial costero/, /monoblocks/, /casas con techo de teja/, /escuela/, /club/, /plazas/, /costanera iluminada sobre el muelle/]) expect(mundo).toMatch(re);
    expect(mundo).toMatch(/distrito tecnológico de Resume al oeste/);
    expect(mundo).not.toMatch(/al oeste y al sur de la ciudad/);
  });
  it("README lista la spec del barrio entre las specs", () => {
    expect(lab).toContain("2026-10-27-barrio-costero-design.md");
  });
  it("el docstring de tech.ts cuenta el barrio y apunta a su spec", () => {
    const end = techSrc.indexOf("export interface Tower");
    expect(end).toBeGreaterThan(0);
    const doc = techSrc.slice(0, end);
    expect(doc).toMatch(/barrio residencial costero/);
    expect(doc).toContain("docs/superpowers/specs/2026-10-27-barrio-costero-design.md");
    expect(doc).not.toMatch(/laboratori|atrio/);
  });
  it("mundo-3 remite al spec del barrio encima de la tabla de tipos", () => {
    const from = mundo3.indexOf("## 2. Decisiones"), to = mundo3.indexOf("| Tema | Decisión |");
    expect(from).toBeGreaterThan(0);
    expect(mundo3.slice(from, to)).toContain("2026-10-27-barrio-costero-design.md");
  });
  it("el índice del storybook lista los siete exhibits del barrio", () => {
    const row = story.split("\n").find((l) => l.startsWith("| Resume: tecnológico |")) ?? "";
    for (const t of ["monoblock", "casas con techo de teja", "escuela", "club", "plaza de barrio", "costanera", "barrio costero"]) expect(row).toContain(t);
  });
  it("capturas del cierre: vistas enteras a 1600×900 ×2 y recortes de la esquina iguales", () => {
    for (const n of ["cover-despues", "barrio-despues", "mundo-antes", "mundo-despues"]) {
      const b = png(n);
      expect(b.subarray(1, 4).toString()).toBe("PNG");
      expect(size(b)).toEqual([3200, 1800]);
    }
    for (const n of ["barrio-4-antes", "barrio-4-despues"]) {
      const b = png(n);
      expect(b.subarray(1, 4).toString()).toBe("PNG");
      expect(size(b)).toEqual([840, 600]);
    }
  });
  it("la spec del barrio dice implementada", () => {
    const estado = barrio.split("\n").find((l) => l.startsWith("**Estado:**")) ?? "";
    expect(estado).toMatch(/implementad/);
  });
  it("la spec del barrio cierra con desvíos, caras, acentos, totals y bloom", () => {
    expect(at).toBeGreaterThan(0);
    for (const id of ["monoblock", "casas", "escuela", "club", "plaza-barrio", "costanera", "barrio"]) expect(desvios).toMatch(new RegExp(`^\\| \`${id}\` \\|`, "m"));
    for (const s of ["TECH_FACES_BEFORE", "REGION_FACES_BEFORE", "totals", "mediana", "roofMat", "plaza-barrio", "ACCESSES"]) expect(desvios).toContain(s);
    expect(desvios.match(/\[lab\] bloom: /g)?.length ?? 0).toBeGreaterThanOrEqual(6);
    expect(desvios.match(/\[lab\] peor redibujo en 5 s: /g)?.length ?? 0).toBeGreaterThanOrEqual(6);
    for (const n of ["cover-antes", "cover-despues", "barrio-4-antes", "barrio-4-despues", "barrio-despues", "mundo-antes", "mundo-despues"]) expect(desvios).toContain(`assets/2026-10-27-barrio/${n}.png`);
  });
});
