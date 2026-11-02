import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const readme = readFileSync(`${ROOT}README.md`, "utf8");
const blogLab = readFileSync(`${ROOT}src/lab/blog.ts`, "utf8");

describe("fleet documentation (#65, #83)", () => {
  it("README describes the river mouth, the two lanes and the exit toward the lower-left (#87)", () => {
    expect(readme).toMatch(/river mouth/);
    expect(readme).toMatch(/two lanes/);
    expect(readme).toMatch(/lower-left/);
  });
  it("README lists the ships reference document among the specs", () => {
    expect(readme).toContain("2026-10-16-barcos-referencia.md");
  });
  it("neither README nor the Blog lab describe the old routes", () => {
    for (const txt of [readme, blogLab]) expect(txt).not.toMatch(/born in the bay|around the point|anchorage|BERTH/);
  });
  it("README names the Tigre river bus and the split wreck", () => {
    expect(readme).toMatch(/Tigre\s+river\s+bus/);
    expect(readme).toMatch(/wreck[^.]*split in two/);
  });
  it("the Blog lab comment describes the river mouth and the lanes", () => {
    expect(blogLab).toMatch(/river mouth/);
    expect(blogLab).toMatch(/lower-left/);
  });
});

describe("storybook documentation (#97)", () => {
  // its own paragraph, so the keys are not inherited from the world.html sentence (which already names `6` and ?bloom=)
  const story = readme.split(/\n\s*\n/).find((p) => p.includes("/lab/storybook.html")) ?? "";
  it("README describes /lab/storybook.html and the hash in its own paragraph", () => {
    expect(story).toMatch(/hash/);
    expect(story).not.toContain("/lab/world.html");
  });
  it("README names the storybook keys and parameters", () => {
    for (const k of ["←", "→", "`j`", "`k`", "`g`", "`h`", "`a`", "`6`", "?bloom=", "?speed="]) expect(story).toContain(k);
  });
  it("README lists the storybook spec among the lab specs", () => {
    const lab = readme.split(/\n\s*\n/).find((p) => p.includes("/lab/world.html")) ?? "";
    expect(lab).toContain("2026-10-17-storybook-estructuras-design.md");
  });
});

describe("status of the storybook spec (#97)", () => {
  const spec = readFileSync(`${ROOT}docs/superpowers/specs/2026-10-17-storybook-estructuras-design.md`, "utf8");
  it("the spec says implemented and not unimplemented", () => {
    const status = spec.split("\n").find((l) => l.startsWith("**Estado:**")) ?? "";
    expect(status).toMatch(/implementad/);
    expect(status).not.toMatch(/sin implementar/);
  });
  it("the spec notes its deviations", () => {
    expect(spec).toMatch(/^## 10\. Desvíos$/m);
  });
});

describe("old ship specs (#69)", () => {
  // `ROUTE` with a backtick in front, so as not to count `FERRY_ROUTE`
  const OLD = /`ROUTE`|1\.2 \/ 2 \/ 0\.8/;
  const NOTE = "*Desvío: reemplazado por los carriles semirrectos de #87 (`LANE_OUT` / `LANE_BACK`) y la velocidad única `LANE_SPEED = 1.2` de #63, con fases 0, 1/3 y 2/3; ver `2026-10-16-barcos-referencia.md` y `2026-10-17-barcos-inventario.md`. Lo que sigue queda como registro.*";
  const specs = { "2026-09-14-mundo-isometrico-design.md": 1, "2026-09-14-mundo-2-fabrica-distrito-blog-design.md": 3 };
  for (const [name, count] of Object.entries(specs)) {
    const spec = readFileSync(`${ROOT}docs/superpowers/specs/${name}`, "utf8");
    // the note is wrapped over several lines like the rest of the spec: it is compared with the whitespace collapsed
    const items = spec.split(/\n(?=- |\s*\n)/).map((item) => item.replace(/\s+/g, " ")).filter((item) => OLD.test(item));
    it(`${name}: every bullet with ROUTE or the per-ship speeds carries the deviation note before the mention`, () => {
      expect(items).toHaveLength(count);
      for (const item of items) {
        expect(item).toContain(NOTE);
        expect(item.indexOf(NOTE)).toBeLessThan(item.search(OLD));
      }
    });
  }
});

describe("detailed factory documentation (#217)", () => {
  const factorySrc = readFileSync(`${ROOT}src/scenes/factory.ts`, "utf8");
  const paragraphs = readme.split(/\n\s*\n/);
  // whitespace collapsed: the paragraph is wrapped at ~80 columns
  const world = (paragraphs.find((p) => p.includes("`factory.ts`")) ?? "").replace(/\s+/g, " ");
  const lab = paragraphs.find((p) => p.includes("/lab/world.html")) ?? "";
  const factorySpec = readFileSync(`${ROOT}docs/superpowers/specs/2026-10-24-fabrica-detalle-design.md`, "utf8");
  const at = factorySpec.search(/^## 14\. Desvíos y medición$/m);
  const deviations = at < 0 ? "" : factorySpec.slice(at);
  it("the isometric world paragraph describes the new factory", () => {
    for (const re of [/boiler house/, /maltings/, /water tank/, /chimneys[^.]*bands/, /outdoor substation/, /bucket-wheel excavator/]) expect(world).toMatch(re);
  });
  it("README lists the detailed factory spec among the specs", () => {
    expect(lab).toContain("2026-10-24-fabrica-detalle-design.md");
  });
  it("the docstring of factory.ts points to the new spec", () => {
    const end = factorySrc.indexOf("export interface FactoryScene");
    expect(end).toBeGreaterThan(0);
    expect(factorySrc.slice(0, end)).toContain("docs/superpowers/specs/2026-10-24-fabrica-detalle-design.md");
  });
  it("the factory spec says implemented", () => {
    const status = factorySpec.split("\n").find((l) => l.startsWith("**Estado:**")) ?? "";
    expect(status).toMatch(/implementad/);
    expect(status).not.toMatch(/pendiente/);
  });
  it("the spec closes with deviations, face table and measurement", () => {
    expect(at).toBeGreaterThan(0);
    for (const id of ["planta", "chimeneas", "subestacion", "playa-vias", "cinta", "excavadora"]) expect(deviations).toMatch(new RegExp(`^\\| \`${id}\` \\|`, "m"));
    expect(deviations).toContain("assets/207-fabrica/mundo-antes.png");
    expect(deviations).toContain("assets/207-fabrica/mundo-despues.png");
    expect(deviations).toMatch(/\[lab\] bloom/);
    expect(deviations).toMatch(/peor redibujo/);
  });
  it("the before and after world views are 1600×900 PNGs at 2x", () => {
    for (const name of ["mundo-antes", "mundo-despues"]) {
      const png = readFileSync(`${ROOT}docs/superpowers/specs/assets/207-fabrica/${name}.png`);
      expect(png.subarray(1, 4).toString()).toBe("PNG");
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([3200, 1800]);
    }
  });
});

describe("coastal neighborhood documentation (#256)", () => {
  const techSrc = readFileSync(`${ROOT}src/scenes/tech.ts`, "utf8");
  const world3 = readFileSync(`${ROOT}docs/superpowers/specs/2026-09-15-mundo-3-tecnologico-feria-agua-barcos-design.md`, "utf8");
  const story = readFileSync(`${ROOT}docs/superpowers/specs/2026-10-17-storybook-estructuras-design.md`, "utf8");
  const neighborhoodSpec = readFileSync(`${ROOT}docs/superpowers/specs/2026-10-27-barrio-costero-design.md`, "utf8");
  const paragraphs = readme.split(/\n\s*\n/);
  // whitespace collapsed: the paragraph is wrapped at ~80 columns
  const world = (paragraphs.find((p) => p.includes("`tech.ts`")) ?? "").replace(/\s+/g, " ");
  const lab = paragraphs.find((p) => p.includes("/lab/world.html")) ?? "";
  const at = neighborhoodSpec.search(/^## 11\. Desvíos$/m);
  const deviations = at < 0 ? "" : neighborhoodSpec.slice(at);
  const png = (n: string) => readFileSync(`${ROOT}docs/superpowers/specs/assets/2026-10-27-barrio/${n}.png`);
  const size = (b: Buffer) => [b.readUInt32BE(16), b.readUInt32BE(20)];

  it("the world paragraph tells of the coastal neighborhood and leaves the tech district to the west", () => {
    for (const re of [/coastal residential neighborhood/, /monoblocks/, /houses with tile roofs/, /school/, /club/, /plazas/, /illuminated waterfront on the pier/]) expect(world).toMatch(re);
    expect(world).toMatch(/tech district west of the city/);
    expect(world).not.toMatch(/west and south of the city/);
  });
  it("README lists the neighborhood spec among the specs", () => {
    expect(lab).toContain("2026-10-27-barrio-costero-design.md");
  });
  it("the docstring of tech.ts describes the neighborhood and points to its spec", () => {
    const end = techSrc.indexOf("export interface Tower");
    expect(end).toBeGreaterThan(0);
    const doc = techSrc.slice(0, end);
    expect(doc).toMatch(/coastal residential neighborhood/);
    expect(doc).toContain("docs/superpowers/specs/2026-10-27-barrio-costero-design.md");
    expect(doc).not.toMatch(/laborator|atri(um|a)/);
  });
  it("mundo-3 refers to the neighborhood spec above the type table", () => {
    const from = world3.indexOf("## 2. Decisiones"), to = world3.indexOf("| Tema | Decisión |");
    expect(from).toBeGreaterThan(0);
    expect(world3.slice(from, to)).toContain("2026-10-27-barrio-costero-design.md");
  });
  it("the storybook index lists the seven neighborhood exhibits", () => {
    const row = story.split("\n").find((l) => l.startsWith("| Resume: tecnológico |")) ?? "";
    for (const t of ["monoblock", "casas con techo de teja", "escuela", "club", "plaza de barrio", "costanera", "barrio costero"]) expect(row).toContain(t);
  });
  it("closing captures: whole views at 1600×900 ×2 and equal corner crops", () => {
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
  it("the neighborhood spec says implemented", () => {
    const status = neighborhoodSpec.split("\n").find((l) => l.startsWith("**Estado:**")) ?? "";
    expect(status).toMatch(/implementad/);
  });
  it("the neighborhood spec closes with deviations, faces, accents, totals and bloom", () => {
    expect(at).toBeGreaterThan(0);
    for (const id of ["monoblock", "casas", "escuela", "club", "plaza-barrio", "costanera", "barrio"]) expect(deviations).toMatch(new RegExp(`^\\| \`${id}\` \\|`, "m"));
    for (const s of ["TECH_FACES_BEFORE", "REGION_FACES_BEFORE", "totals", "mediana", "roofMat", "plaza-barrio", "ACCESSES"]) expect(deviations).toContain(s);
    expect(deviations.match(/\[lab\] bloom: /g)?.length ?? 0).toBeGreaterThanOrEqual(6);
    expect(deviations.match(/\[lab\] peor redibujo en 5 s: /g)?.length ?? 0).toBeGreaterThanOrEqual(6);
    for (const n of ["cover-antes", "cover-despues", "barrio-4-antes", "barrio-4-despues", "barrio-despues", "mundo-antes", "mundo-despues"]) expect(deviations).toContain(`assets/2026-10-27-barrio/${n}.png`);
  });
});

describe("factory move documentation (#238)", () => {
  const factorySrc = readFileSync(`${ROOT}src/scenes/factory.ts`, "utf8");
  const shipyardSrc = readFileSync(`${ROOT}src/scenes/shipyard.ts`, "utf8");
  const paragraphs = readme.split(/\n\s*\n/);
  // whitespace collapsed: the paragraph is wrapped at ~80 columns
  const world = (paragraphs.find((p) => p.includes("`factory.ts`")) ?? "").replace(/\s+/g, " ");
  const lab = paragraphs.find((p) => p.includes("/lab/world.html")) ?? "";
  const SPEC = "2026-10-27-fabrica-mudanza-design.md";
  const ASSETS = `${ROOT}docs/superpowers/specs/assets/2026-10-27-fabrica-mudanza/`;
  const moveSpec = readFileSync(`${ROOT}docs/superpowers/specs/${SPEC}`, "utf8");
  const at = moveSpec.search(/^## 9\. Desvíos$/m);
  const deviations = at < 0 ? "" : moveSpec.slice(at);
  it("the world paragraph puts the sheds to the north, behind the factory", () => {
    expect(world).toMatch(/(sheds|assembly halls)[^.]*(to the north|behind)[^.]*factory/);
  });
  it("README lists the move spec among the lab specs", () => {
    expect(lab).toContain(SPEC);
  });
  it("the docstring of factory.ts points to the move spec and does not describe the old place", () => {
    const end = factorySrc.indexOf("export interface FactoryScene");
    expect(end).toBeGreaterThan(0);
    const doc = factorySrc.slice(0, end);
    expect(doc).toContain(`docs/superpowers/specs/${SPEC}`);
    expect(doc).not.toContain("behind (north) and west of the shipyard");
  });
  it("shipyard.ts does not describe the old production line", () => {
    expect(shipyardSrc.replace(/\s*\*\s*/g, " ")).not.toContain("material yard → assembly hall → slipway");
  });
  it("the detailed factory spec opens §2 with the deviation note", () => {
    const factorySpec = readFileSync(`${ROOT}docs/superpowers/specs/2026-10-24-fabrica-detalle-design.md`, "utf8");
    const i = factorySpec.search(/^## 2\. Reglas de modelado$/m);
    expect(i).toBeGreaterThan(0);
    const note = factorySpec.slice(i).split(/\n\s*\n/)[1] ?? "";
    expect(note.startsWith("*Desvío (2026-10-27):")).toBe(true);
    expect(note.replace(/\s+/g, " ")).toContain(SPEC);
  });
  it("the move spec says implemented", () => {
    const status = moveSpec.split("\n").find((l) => l.startsWith("**Estado:**")) ?? "";
    expect(status).toMatch(/implementad/);
    expect(status).not.toMatch(/listo para agente/);
  });
  it("the move spec closes with deviations, face table and captures", () => {
    expect(at).toBeGreaterThan(0);
    for (const id of ["planta", "chimeneas", "subestacion", "playa-camiones", "naves", "cinta"]) expect(deviations).toMatch(new RegExp(`^\\| \`${id}\` \\|`, "m"));
    for (const name of ["cover-antes", "cover-despues"]) expect(deviations).toContain(`assets/2026-10-27-fabrica-mudanza/${name}.png`);
  });
  it("the before and after covers are 1600×900 PNGs at 2x", () => {
    for (const name of ["cover-antes", "cover-despues"]) {
      const png = readFileSync(`${ASSETS}${name}.png`);
      expect(png.subarray(1, 4).toString()).toBe("PNG");
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([3200, 1800]);
    }
  });
  it("the before and after captures of the exhibits exist", () => {
    const names = ["planta", "chimeneas", "subestacion", "naves"].flatMap((id) => [`${id}-antes`, `${id}-despues`]).concat("cinta-antes");
    for (const name of names) expect(existsSync(`${ASSETS}${name}.png`), name).toBe(true);
  });
});

describe("terminal station documentation (#239)", () => {
  const src = (name: string) => readFileSync(`${ROOT}src/scenes/${name}`, "utf8");
  // the docstring of a module: from the first `/**` to its close
  const docstring = (txt: string) => { const i = txt.indexOf("/**"); return i < 0 ? "" : txt.slice(i, txt.indexOf("*/", i)); };
  const paragraphs = readme.split(/\n\s*\n/);
  // whitespace collapsed: the paragraph is wrapped at ~80 columns
  const world = (paragraphs.find((p) => p.includes("`factory.ts`")) ?? "").replace(/\s+/g, " ");
  const lab = paragraphs.find((p) => p.includes("/lab/world.html")) ?? "";
  const story = paragraphs.find((p) => p.includes("/lab/storybook.html")) ?? "";
  const SPEC = "2026-10-27-estacion-terminal-design.md";
  const ASSETS = `${ROOT}docs/superpowers/specs/assets/2026-10-27-estacion/`;
  const stationSpec = readFileSync(`${ROOT}docs/superpowers/specs/${SPEC}`, "utf8");
  const at = stationSpec.search(/^## 12\. Desvíos$/m);
  const deviations = at < 0 ? "" : stationSpec.slice(at);
  it("the world paragraph names the station and the train", () => {
    expect(world).toMatch(/terminal station/);
    expect(world).toMatch(/EMU|train/);
  });
  it("README lists the station spec among the lab specs", () => {
    expect(lab).toContain(SPEC);
  });
  it("the storybook paragraph names the station exhibits", () => {
    for (const id of ["estacion", "paso-a-nivel", "tren"]) expect(story).toContain(id);
  });
  it("the docstring of shipyard.ts does not name the boiler shop", () => {
    const doc = docstring(src("shipyard.ts"));
    expect(doc).toContain("station.ts");
    expect(doc).not.toMatch(/boiler ?shop/i);
  });
  it("the docstrings of station.ts, train.ts and rail-anim.ts point to the spec", () => {
    for (const name of ["station.ts", "train.ts", "rail-anim.ts"]) expect(docstring(src(name)).replace(/\s*\*\s*/g, " "), name).toContain(`docs/superpowers/specs/${SPEC}`);
    expect(docstring(src("station.ts"))).toMatch(/Tigre/);
  });
  it("the station spec says implemented", () => {
    const status = stationSpec.split("\n").find((l) => l.startsWith("**Estado:**")) ?? "";
    expect(status).toMatch(/implementad/);
    expect(status).not.toMatch(/listo para agente/);
  });
  it("the §5 inventory is ticked off", () => {
    const i = stationSpec.search(/^## 5\. /m), j = stationSpec.search(/^## 6\. /m);
    expect(i).toBeGreaterThan(0);
    expect(stationSpec.slice(i, j)).not.toMatch(/- \[ \]/);
  });
  it("the spec closes with deviations, face table, cycle and captures", () => {
    expect(at).toBeGreaterThan(0);
    for (const h of [/^### 12\.1 /m, /^### 12\.2 /m, /^### 12\.3 /m]) expect(deviations).toMatch(h);
    for (const id of ["estacion", "paso-a-nivel", "tren"]) expect(deviations).toMatch(new RegExp(`^\\| \`${id}\` \\|`, "m"));
    for (const name of ["cover-antes", "cover-despues", "time-lapse-ciclo"]) expect(deviations).toContain(`assets/2026-10-27-estacion/${name}.png`);
  });
  it("the before cover, the after cover and the time-lapse are 1600×900 PNGs at 2x", () => {
    for (const name of ["cover-antes", "cover-despues", "time-lapse-ciclo"]) {
      const png = readFileSync(`${ASSETS}${name}.png`);
      expect(png.subarray(1, 4).toString()).toBe("PNG");
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([3200, 1800]);
    }
  });
  it("the after captures of the Portfolio view and the exhibits exist", () => {
    for (const name of ["portfolio-despues", "estacion-despues", "paso-a-nivel-despues", "tren-despues"]) expect(existsSync(`${ASSETS}${name}.png`), name).toBe(true);
  });
  it("the 2026-10-15 spec discards the station at −18, 188 before naming it", () => {
    const NOTE = "*Desvío (2026-10-28): la estación va al final de la vía del oeste del astillero, en el lugar de la calderería; ver `2026-10-27-estacion-terminal-design.md`. Esta pieza queda descartada.*";
    const level2 = readFileSync(`${ROOT}docs/superpowers/specs/2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md`, "utf8").replace(/\s+/g, " ");
    const note = level2.indexOf(NOTE);
    expect(note).toBeGreaterThan(0);
    expect(note).toBeLessThan(level2.indexOf("−18, 188"));
  });
  it("the storybook index adds the station, the level crossing and the train to the shipyard", () => {
    const story17 = readFileSync(`${ROOT}docs/superpowers/specs/2026-10-17-storybook-estructuras-design.md`, "utf8");
    const row = story17.split("\n").find((l) => l.startsWith("| Portfolio: astillero |")) ?? "";
    for (const name of ["estación", "paso a nivel", "tren"]) expect(row).toContain(name);
  });
});

describe("Pixi-free test convention (#103, #168)", () => {
  const at = readme.search(/^## Tests$/m);
  // up to the next `## `, so a later section does not count
  const sec = at < 0 ? "" : readme.slice(at).split(/\n(?=## )/)[0];
  const guard = readFileSync(`${ROOT}src/iso/pixi-free.test.ts`, "utf8");
  it("README has a tests section with the convention", () => {
    expect(readme).toMatch(/^## Tests$/m);
    expect(sec).toContain("the engine tests do not use Pixi");
    expect(sec).toContain("src/iso/pixi-free.test.ts");
    for (const d of ["src/iso/", "src/scenes/"]) expect(sec).toContain(d);
  });
  it("README names each PIXI_TESTS exception", () => {
    const set = /PIXI_TESTS = new Set\(\[([^\]]*)\]\)/.exec(guard)?.[1] ?? "";
    const paths = [...set.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) expect(sec).toContain(p);
  });
});

describe("README names both plan folders (#204)", () => {
  const plansPara = readme.split(/\n\s*\n/).find((p) => p.includes("docs/superpowers/specs/") && p.includes("plans/")) ?? "";
  it("names docs/plans/ as the agent runs' folder and docs/superpowers/plans/", () => {
    expect(plansPara, "README paragraph naming the plan folders").not.toBe("");
    expect(plansPara).toContain("`docs/plans/` (agent runs)");
    expect(plansPara).toContain("`docs/superpowers/plans/`");
  });
  it("drops the old single-folder sentence", () => {
    expect(readme).not.toContain("plan en `docs/superpowers/plans/`");
  });
  it("every plan folder it names exists and holds plans", () => {
    const dirs = [...plansPara.matchAll(/`(docs\/[\w/]*plans\/)`/g)].map((m) => m[1]);
    expect(dirs).toEqual(["docs/plans/", "docs/superpowers/plans/"]);
    for (const d of dirs) {
      expect(existsSync(`${ROOT}${d}`), d).toBe(true);
      expect(readdirSync(`${ROOT}${d}`).some((f) => f.endsWith(".md")), d).toBe(true);
    }
  });
});
