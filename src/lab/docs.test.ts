import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { project } from "../iso/project";
import { COVER_LAPTOP, COVER_PHONE, layoutGaps, SIGN_FONT, signMetrics, staticContrast } from "../kit/legibility";
import { counterClearance, letterGaps, measureText, rhythm } from "../kit/lettering";
import { TOWER } from "../scenes/city-grid";
import { CROWN_SITE } from "../scenes/sign-crown";
import { PLATFORM_DECK, PLATFORM_SITE } from "../scenes/sign-platform";
import { SHIPYARD_HALLS, TINKER_SITE } from "../scenes/sign-tinker";
import { EXHIBITS } from "./exhibits";

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
    for (const k of ["←", "→", "`j`", "`k`", "`g`", "`h`", "`a`", "`6`", "`c`", "?bloom=", "?speed="]) expect(story).toContain(k);
  });
  it("README says the frame takes the projected bounds and the layout is responsive (#400)", () => {
    expect(story).toContain("projected bounds");
    expect(story).toContain("responsive");
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

describe("seam at 90 documentation (#56)", () => {
  const paragraphs = readme.split(/\n\s*\n/);
  // whitespace collapsed: the paragraph is wrapped at ~80 columns
  const world = (paragraphs.find((p) => p.includes("`factory.ts`")) ?? "").replace(/\s+/g, " ");
  const lab = paragraphs.find((p) => p.includes("/lab/world.html")) ?? "";
  const story = paragraphs.find((p) => p.includes("/lab/storybook.html")) ?? "";
  const glossary = readFileSync(`${ROOT}CONTEXT.md`, "utf8");
  const SPEC = "2026-10-15-costura-90-portfolio-denso-galpones-feria-design.md";
  const ASSETS = `${ROOT}docs/superpowers/specs/assets/2026-10-15-costura-90/`;
  const seamSpec = readFileSync(`${ROOT}docs/superpowers/specs/${SPEC}`, "utf8");
  const at = seamSpec.search(/^## 12\. Desvíos$/m);
  const deviations = at < 0 ? "" : seamSpec.slice(at);
  const NEW_IDS = ["dique-flotante", "patio-contenedores", "grua-muelle", "galpones", "playa-carga", "mercado-pescado", "tren-fantasma", "casa-espejos", "tobogan", "tronco-acuatico"];
  const BEFORE = ["portfolio-antes", "resume-antes", "mundo-antes", "cover-antes"];
  const AFTER = ["portfolio-despues", "resume-despues", "mundo-despues", "cover-despues"];
  it("README lists the seam spec among the lab specs", () => {
    expect(lab).toContain(SPEC);
  });
  it("the world paragraph names the seam at y 90, the station land, the rail lands and the dock", () => {
    expect(world).toMatch(/y 90/);
    expect(world).toMatch(/station land/);
    expect(world).toMatch(/rail lands/);
    expect(world).toMatch(/dock inlet/);
    expect(world).toMatch(/floating dock/);
    expect(world).toMatch(/ghost train/);
  });
  it("the storybook paragraph names the new exhibits, and each one exists", () => {
    const ids = new Set(EXHIBITS.map((e) => e.id));
    for (const id of NEW_IDS) {
      expect(story, id).toContain(`#${id}`);
      expect(ids.has(id), id).toBe(true);
    }
  });
  it("CONTEXT.md defines the rail lands and anchors the zone entry on STATION_LAND", () => {
    expect(glossary).toMatch(/^### Rail lands$/m);
    const rail = glossary.slice(glossary.search(/^### Rail lands$/m)).split(/\n(?=### )/)[0];
    expect(rail).toContain("src/city/rail-lands.ts");
    expect(rail).toContain("src/scenes/station.ts");
    const zone = glossary.slice(glossary.search(/^### Zone$/m)).split(/\n(?=### )/)[0];
    expect(zone).toMatch(/^Code: .*`src\/map\/geo\.ts` \([^)]*`STATION_LAND`/m);
  });
  it("the seam spec says implemented", () => {
    const status = seamSpec.split("\n").find((l) => l.startsWith("**Estado:**")) ?? "";
    expect(status).toMatch(/implementad/);
    expect(status).toContain("#328");
  });
  it("§9 is ticked off and the budget table carries the measured column", () => {
    const i = seamSpec.search(/^## 9\. /m), j = seamSpec.search(/^## 10\. /m);
    expect(i).toBeGreaterThan(0);
    const tests = seamSpec.slice(i, j);
    expect(tests).not.toMatch(/- \[ \]/);
    expect(tests).toMatch(/- \[x\]/);
    expect(tests).toMatch(/\| Medido \|$/m);
  });
  it("the spec closes with deviations per child, measurement, scene counts and captures", () => {
    expect(at).toBeGreaterThan(seamSpec.search(/^## 11\. /m));
    for (const h of [/^### 12\.0 /m, /^### 12\.1 /m, /^### 12\.2 /m, /^### 12\.3 /m]) expect(deviations).toMatch(h);
    for (const n of [319, 320, 321, 322, 323, 324, 325, 326, 327]) expect(deviations, `#${n}`).toContain(`#${n}`);
    for (const n of ["423", "778", "1 121", "278", "503", "1 489", "41 507"]) expect(deviations).toContain(n);
    for (const name of [...BEFORE, ...AFTER]) expect(deviations).toContain(`assets/2026-10-15-costura-90/${name}.png`);
  });
  it("the after captures are 1600×900 PNGs at 2x", () => {
    for (const name of AFTER) {
      const png = readFileSync(`${ASSETS}${name}.png`);
      expect(png.subarray(1, 4).toString()).toBe("PNG");
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([3200, 1800]);
    }
  });
});

describe("zone signs closing documentation (#364)", () => {
  const SPECS = `${ROOT}docs/superpowers/specs/`;
  const spec = readFileSync(`${SPECS}2026-11-11-carteles-de-zona-assets-design.md`, "utf8");
  const REFS = `${SPECS}assets/carteles-refs/`;
  const index = existsSync(`${REFS}CREDITS.md`) ? readFileSync(`${REFS}CREDITS.md`, "utf8") : "";
  const paragraphs = readme.split(/\n\s*\n/);
  const lab = paragraphs.find((p) => p.includes("/lab/world.html")) ?? "";
  const at = spec.search(/^## 8\. Desvíos y medición$/m);
  const dev = at < 0 ? "" : spec.slice(at);
  const IDS = ["cartel-helipuerto", "cartel-helipuerto-b", "grafiti", "plataforma"];
  const SUFFIXES = ["real-bloom", "real-nobloom", "117-bloom", "117-nobloom", "083"];

  it("the sign spec says implemented, pending integration", () => {
    const status = spec.split("\n").find((l) => l.startsWith("**Estado:**")) ?? "";
    expect(status).toBe("**Estado:** implementado (storybook; integración pendiente, §7)");
  });
  it("§6 is ticked off", () => {
    const criteria = spec.slice(spec.search(/^## 6\. /m), spec.search(/^## 7\. /m));
    expect(criteria).not.toMatch(/- \[ \]/);
    expect(criteria.match(/- \[x\]/g)?.length ?? 0).toBe(8);
  });
  it("§8 carries the three legibility tables with the measured values", () => {
    expect(at).toBeGreaterThan(spec.search(/^## 7\. /m));
    expect(dev).toMatch(/^### 8\.1 /m);
    for (const n of ["**3.490**", "**4.08 px** ✗", "**10.0035 px** ✓", "**10.003 px** ✓", "**10.00 px** ✓", "8.55", "30.54", "37.86", "15.879"]) expect(dev, n).toContain(n);
    for (const re of [/^\| \*\*A\*\* \(pista\) \|/m, /^\| \*\*B\*\* \(tubo\) \|/m, /^\| Portfolio \|/m, /^\| Blog \|/m]) expect(dev).toMatch(re);
  });
  it("§8 lists the story deviations and each child's", () => {
    for (const s of ["(−1.4, −1.4, 0)", "fillText", "\"≈ 6.8 u\"", "CREDITS.md", "1366×768"]) expect(dev, s).toContain(s);
    expect(dev).toMatch(/1\.27\s+\(1\.272\)/);
    for (const n of [360, 361, 362, 363, 367, 368, 369, 370]) expect(dev, `#${n}`).toContain(`#${n}`);
  });
  it("§8 names the twenty captures and the stale placeholders", () => {
    for (const id of IDS) for (const s of SUFFIXES) expect(dev).toContain(`assets/352-carteles/${id}-${s}.png`);
    expect(dev).toContain("real-base");
  });
  it("the credits index links each folder's CREDITS.md with its photo count", () => {
    for (const dir of ["helipuerto", "plataforma"]) {
      const n = readdirSync(`${REFS}${dir}`).filter((f) => f.endsWith(".jpg")).length;
      const line = index.split("\n").find((l) => l.includes(`](${dir}/CREDITS.md)`)) ?? "";
      expect(line, dir).toContain(`${n} fotos`);
      expect(line, dir).toMatch(/CC BY-SA/);
    }
  });
  it("the twenty sign captures are 3200×1800 PNGs", () => {
    for (const id of IDS) for (const s of SUFFIXES) {
      const png = readFileSync(`${SPECS}assets/352-carteles/${id}-${s}.png`);
      expect(png.subarray(1, 4).toString()).toBe("PNG");
      expect([png.readUInt32BE(16), png.readUInt32BE(20)], `${id}-${s}`).toEqual([3200, 1800]);
    }
  });
  it("README lists the sign spec among the lab specs", () => {
    expect(lab).toContain("2026-11-11-carteles-de-zona-assets-design.md");
  });
});

describe("zone signs redesign documentation (#374)", () => {
  const SPECS = `${ROOT}docs/superpowers/specs/`;
  const read = (rel: string) => (existsSync(`${SPECS}${rel}`) ? readFileSync(`${SPECS}${rel}`, "utf8") : "");
  const size = (rel: string) => {
    const b = readFileSync(`${SPECS}${rel}`);
    expect(b.subarray(1, 4).toString(), rel).toBe("PNG");
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  };
  const CONTEXTS = ["cartel-torre-escena", "cartel-taller-escena", "plataforma-escena"];
  const SCALES = [["117", COVER_LAPTOP], ["083", COVER_PHONE]] as const;
  const DELETED = ["cartel-helipuerto", "grafiti"];
  const WORDS = { RESUME: "cartel-torre-escena", PORTFOLIO: "cartel-taller-escena", Writing: "plataforma-escena" } as const;
  const f = (n: number) => n.toFixed(2);
  const report = read("assets/carteles-legibilidad/REPORT.md");
  const spec = read("2026-11-15-carteles-de-zona-rediseno-design.md");
  const between = (txt: string, from: RegExp, to?: RegExp) => {
    const i = txt.search(from);
    if (i < 0) return "";
    const rest = txt.slice(i), j = to ? rest.search(to) : -1;
    return j < 0 ? rest : rest.slice(0, j);
  };
  const dev = between(spec, /^## 8\. Desvíos y medición$/m);
  const measures = between(dev, /^### 8\.1 /m, /^### 8\.2 /m), sizes = between(dev, /^### 8\.3 /m, /^### 8\.4 /m);
  /** The single line of `txt` that starts with `prefix` ("" when none or several). */
  const row = (txt: string, prefix: string) => { const ls = txt.split("\n").filter((l) => l.startsWith(prefix)); return ls.length === 1 ? ls[0]! : ""; };
  const context = (id: string) => { const e = EXHIBITS.find((x) => x.id === id); if (e?.kind !== "context") throw new Error(id); return e; };
  /** Screen width of a set of world points: the x extent of their projection. */
  const xExtent = (pts: { x: number; y: number; z: number }[]) => { const xs = pts.map((p) => project(p).x); return Math.max(...xs) - Math.min(...xs); };
  const rect = (x0: number, y0: number, x1: number, y1: number) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ x: x!, y: y!, z: 0 }));
  const HOSTS = {
    RESUME: rect(TOWER.x, TOWER.y, TOWER.x + TOWER.w, TOWER.y + TOWER.d),
    PORTFOLIO: rect(SHIPYARD_HALLS[1]!.x0, SHIPYARD_HALLS[1]!.y0, SHIPYARD_HALLS[1]!.x1, SHIPYARD_HALLS[1]!.y1),
    Writing: PLATFORM_DECK.map((q) => ({ x: q.x, y: q.y, z: 0 })),
  };

  it("REPORT.md exists, has every context at both scales and no failure mark", () => {
    expect(report).not.toBe("");
    // the header cell is `✓/✗`: the verdict is the last cell of each metric row
    expect(report).not.toMatch(/\| ✗ \|$/m);
    expect(report.match(/^\| (contraste|halo|OCR) \|.*\| ✓ \|$/gm)?.length ?? 0).toBe(18);
    for (const id of CONTEXTS) for (const s of ["1.17", "0.83"]) expect(report).toMatch(new RegExp(`^## ${id} a ${s.replace(".", "\\.")}$`, "m"));
    expect(report).toContain("Sin violaciones.");
  });
  it("the six level-3 crops are PNGs and the six scene captures are 3200×1800", () => {
    for (const id of CONTEXTS) for (const [s] of SCALES) {
      size(`assets/carteles-legibilidad/${id}-${s}.png`);
      expect(size(`assets/374-carteles/${id}-${s}.png`), `${id}-${s}`).toEqual([3200, 1800]);
    }
  });
  it("the redesign spec says implemented, pending integration, and §6 is ticked off", () => {
    expect(spec.split("\n").find((l) => l.startsWith("**Estado:**"))).toBe("**Estado:** implementado (storybook; integración pendiente, §7)");
    const criteria = between(spec, /^## 6\. /m, /^## 7\. /m);
    expect(criteria).not.toMatch(/- \[ \]/);
    expect(criteria.match(/- \[x\]/g)?.length ?? 0).toBe(9);
  });
  it("§5 records the three candidate sites with their values", () => {
    const sites = between(spec, /^## 5\. /m, /^## 6\. /m);
    // built from the constants, with the spec's U+2212 minus, so a moved site fails here
    const at = (v: { x: number; y: number; z: number }, z = true) => `(${[v.x, v.y, ...(z ? [v.z] : [])].join(", ").replace(/-/g, "−")})`;
    for (const s of ["CROWN_SITE", at(CROWN_SITE), "TINKER_SITE", at(TINKER_SITE), "PLATFORM_SITE", at(PLATFORM_SITE, false)]) expect(sites, s).toContain(s);
  });
  it("§8 exists after §7 with its four parts and names the report, the font, the contexts and the sites", () => {
    expect(spec.search(/^## 8\. Desvíos y medición$/m)).toBeGreaterThan(spec.search(/^## 7\. /m));
    for (const h of [/^### 8\.1 /m, /^### 8\.2 /m, /^### 8\.3 /m, /^### 8\.4 /m]) expect(dev).toMatch(h);
    for (const s of ["REPORT.md", "SIGN_FONT", ...CONTEXTS, "CROWN_SITE", "TINKER_SITE", "PLATFORM_SITE"]) expect(dev, s).toContain(s);
  });
  it("§8.1 carries the level-2 measures of each context and scale, as the oracle computes them", () => {
    for (const id of CONTEXTS) for (const [tag, s] of SCALES) {
      const line = row(measures, `| \`${id}\` | ${s} |`), m = signMetrics(context(id).sign, s);
      expect(line, `${id} ${tag}`).not.toBe("");
      for (const v of [m.xHeightPx, m.strokePx, m.airPx, staticContrast(context(id).sign)]) expect(line, `${id} ${tag} ${f(v)}`).toContain(f(v));
    }
  });
  it("§8.1 carries the level-3 measures of REPORT.md in the same rows", () => {
    for (const id of CONTEXTS) for (const s of ["1.17", "0.83"]) {
      const sec = between(report, new RegExp(`^## ${id} a ${s.replace(".", "\\.")}$`, "m")).split(/\n(?=## )/)[0]!;
      const cell = (name: string) => row(sec, `| ${name} |`).split("|")[2]?.trim() ?? "";
      const line = row(measures, `| \`${id}\` | ${s} |`);
      for (const v of [cell("contraste"), cell("halo"), cell("OCR")]) {
        expect(v, `${id} ${s}`).not.toBe("");
        expect(line, `${id} ${s} ${v}`).toContain(v);
      }
    }
  });
  it("§8.1 carries the font measures of the three words at SIGN_FONT", () => {
    const { size: sz, width: w } = SIGN_FONT;
    for (const [word, id] of Object.entries(WORDS)) {
      const sign = context(id).sign, line = row(measures, `| ${word} |`);
      expect(line, word).not.toBe("");
      // a marquee word (RESUME, Neon Light) is measured on its own layouts, with its face as w
      const vals = sign.stroke !== undefined
        ? (() => {
          const fw = sign.stroke!, gaps = layoutGaps(sign.glyphs.map((g) => g.layout)), counter = Math.min(...sign.glyphs.flatMap((g) => g.layout.counters.map((c) => 2 * c.r)));
          return [Math.min(...gaps) / fw, Math.max(...gaps) / fw, Math.max(...gaps) / Math.min(...gaps), counter / fw];
        })()
        : (() => {
          const gaps = letterGaps(word, sz, w), counter = Math.min(...counterClearance(word, sz, w).map((c) => c.clearance));
          return [Math.min(...gaps) / w, Math.max(...gaps) / w, rhythm(word, sz, w), counter / w];
        })();
      for (const v of vals) expect(line, `${word} ${f(v)}`).toContain(f(v));
    }
  });
  it("§8.3 compares each word with its host on screen at 1.17", () => {
    for (const [word, id] of Object.entries(WORDS)) {
      const line = row(sizes, `| ${word} |`), quads = context(id).sign.glyphs.flatMap((g) => g.quads.flat());
      expect(line, word).not.toBe("");
      const sign = context(id).sign, box = sign.glyphs.map((g) => g.layout.box);
      const width = sign.stroke !== undefined ? box.at(-1)!.x1 - box[0]!.x0 : measureText(word, SIGN_FONT.size).width;
      const vals = [width, xExtent(quads) * COVER_LAPTOP, xExtent(HOSTS[word as keyof typeof HOSTS]) * COVER_LAPTOP];
      for (const v of vals) expect(line, `${word} ${f(v)}`).toContain(f(v));
    }
  });
  it("§8.4 lists the scene captures and the level-3 crops", () => {
    const caps = between(dev, /^### 8\.4 /m);
    for (const id of CONTEXTS) for (const [s] of SCALES) {
      expect(caps).toContain(`assets/374-carteles/${id}-${s}.png`);
      expect(caps).toContain(`carteles-legibilidad/${id}-${s}.png`);
    }
  });
  it("the first-pass spec opens §3.1, §3.2 and §3.3 with a deviation note", () => {
    const old = read("2026-11-11-carteles-de-zona-assets-design.md");
    const note = (h: RegExp) => (between(old, h).split(/\n\s*\n/)[1] ?? "").replace(/\s+/g, " ");
    const notes = { "3\\.1": "cartel-torre", "3\\.2": "cartel-taller", "3\\.3": "respaldo" };
    for (const [n, word] of Object.entries(notes)) {
      const text = note(new RegExp(`^### ${n} `, "m"));
      expect(text.startsWith("*Desvío (2026-11-15):"), n).toBe(true);
      expect(text, n).toContain("2026-11-15-carteles-de-zona-rediseno-design.md");
      expect(text, n).toContain(word);
    }
  });
  it("the storybook index names the new piece and scene exhibits, not the deleted ones", () => {
    const story = read("2026-10-17-storybook-estructuras-design.md");
    const cell = (start: string) => (story.split("\n").find((l) => l.startsWith(start)) ?? "").split("|").at(-2) ?? "";
    const rows = { "| Portfolio: astillero |": "cartel-taller", "| Resume: ciudad |": "cartel-torre", "| Blog: mar |": "plataforma" };
    for (const [start, id] of Object.entries(rows)) {
      expect(cell(start), start).toContain(`\`${id}\``);
      expect(cell(start), start).toContain(`\`${id}-escena\``);
    }
    expect(cell("| Portfolio: astillero |")).not.toMatch(/grafit/);
    expect(cell("| Resume: ciudad |")).not.toMatch(/helipuerto/);
  });
  it("README's storybook paragraph names the three sign pairs and npm run legibility, not the deleted exhibits", () => {
    const paragraphs = readme.split(/\n\s*\n/);
    const story = (paragraphs.find((p) => p.includes("/lab/storybook.html")) ?? "").replace(/\s+/g, " ");
    const ids = new Set(EXHIBITS.map((e) => e.id));
    for (const id of ["cartel-torre", "cartel-taller", "plataforma"].flatMap((i) => [i, `${i}-escena`])) {
      expect(story, id).toContain(`\`#${id}\``);
      expect(ids.has(id), id).toBe(true);
    }
    for (const s of ["in its scene", "candidate site", "npm run legibility", "contrast", "halo", "OCR", "does not run in CI", "`c`"]) expect(story, s).toContain(s);
    for (const id of DELETED) expect(story, id).not.toContain(id);
  });
  it("README's lab paragraph lists the redesign spec and names the legibility guardrails next to the lettering", () => {
    const lab = readme.split(/\n\s*\n/).find((p) => p.includes("/lab/world.html")) ?? "";
    for (const s of ["2026-11-15-carteles-de-zona-rediseno-design.md", "src/kit/lettering.ts", "src/kit/legibility.ts"]) expect(lab, s).toContain(s);
  });
  it("the credits index lists helipuerto, corona, taller and plataforma with their photo counts", () => {
    const index = read("assets/carteles-refs/CREDITS.md");
    for (const dir of ["helipuerto", "corona", "taller", "plataforma"]) {
      const n = readdirSync(`${SPECS}assets/carteles-refs/${dir}`).filter((x) => x.endsWith(".jpg")).length;
      const line = index.split("\n").find((l) => l.includes(`](${dir}/CREDITS.md)`)) ?? "";
      expect(line, dir).toContain(`${n} fotos`);
      expect(line, dir).toMatch(/CC BY-SA/);
    }
    expect(index).not.toContain("grafiti/");
  });
});

describe("wreck vertical line diagnosis (#404)", () => {
  const spec = readFileSync(`${ROOT}docs/superpowers/specs/2026-11-16-storybook-luces-y-encuadre-design.md`, "utf8");
  const diagnosis = spec.split(/^## /m).find((s) => s.startsWith("§5 — diagn\u00f3stico")) ?? "";
  it("the storybook lights spec has a §5 diagnosis section that names the sweep and its result", () => {
    expect(diagnosis).not.toBe("");
    expect(diagnosis).toContain("npm run wreck-sweep");
    expect(diagnosis).toMatch(/off-sky px/);
    expect(diagnosis).toContain("origin/main");
  });
  it("README lists npm run wreck-sweep among the scripts", () => {
    const scripts = readme.split(/\n\s*\n/).find((p) => p.includes("`npm test`")) ?? "";
    expect(scripts).toContain("npm run wreck-sweep");
  });
});

describe("storybook lights closing (#405)", () => {
  const SPECS = `${ROOT}docs/superpowers/specs/`;
  const ASSETS = `${SPECS}assets/2026-11-16-storybook-luces/`;
  const spec = readFileSync(`${SPECS}2026-11-16-storybook-luces-y-encuadre-design.md`, "utf8");
  const IDS = ["playa-camiones", "gradas", "estacion", "patio-contenedores", "grua-muelle", "cartel-taller-escena", "silos", "playa-contenedores", "autitos-chocadores", "faro", "pecio"];
  const NN = IDS.map((_, k) => String(k + 1).padStart(2, "0"));
  const VIEWPORTS = { phone: [412, 915], desktop: [1600, 900] } as const;
  /** Width and height from a PNG's IHDR chunk, or null when the file is missing or not a PNG. */
  const pngSize = (path: string): [number, number] | null => {
    if (!existsSync(path)) return null;
    const b = readFileSync(path);
    return b.toString("latin1", 1, 4) === "PNG" ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null;
  };
  const h2 = (txt: string, heading: RegExp): string => {
    const at = txt.search(heading);
    return at < 0 ? "" : txt.slice(at).split(/\n(?=## )/)[0]!;
  };
  const TABLE = /^## Capturas antes y después$/m;
  const DEVIATIONS = /^## Desvíos$/m;

  it("the 11 capture ids are storybook exhibits", () => {
    const ids = new Set(EXHIBITS.map((e) => e.id));
    for (const id of IDS) expect(ids.has(id), id).toBe(true);
  });
  it("the 22 final captures exist as PNGs of the viewport size", () => {
    for (const [name, size] of Object.entries(VIEWPORTS)) {
      for (const n of NN) expect(pngSize(`${ASSETS}after/${name}-${n}.png`), `${name}-${n}`).toEqual([...size]);
    }
  });
  it("the intermediate framing captures folder is gone and nothing references it", () => {
    const needle = "after-" + "encuadre";
    expect(existsSync(`${ASSETS}${needle}`)).toBe(false);
    const walk = (dir: string): string[] => readdirSync(`${ROOT}${dir}`, { withFileTypes: true }).flatMap((d) => {
      const rel = `${dir}/${d.name}`;
      return d.isDirectory() ? walk(rel) : [rel];
    });
    const files = ["README.md", "CONTEXT.md", "vite.config.ts",
      ...walk("docs/superpowers/specs").filter((f) => f.endsWith(".md")),
      ...["src", "lab", "scripts"].flatMap(walk).filter((f) => /\.(ts|html|css|json|md)$/.test(f))];
    for (const f of files) expect(readFileSync(`${ROOT}${f}`, "utf8").includes(needle), f).toBe(false);
  });
  it("the spec says implemented on its second line", () => {
    expect(spec.split("\n")[1]).toBe("**Estado:** implementado (#395)");
  });
  it("the spec carries a before/after table with the three captures per exhibit", () => {
    const table = h2(spec, TABLE);
    expect(table).not.toBe("");
    for (const n of NN) {
      const row = table.split("\n").filter((l) => l.includes(`after/phone-${n}.png`));
      expect(row.length, n).toBe(1);
      expect(row[0], n).toContain(`assets/2026-11-16-storybook-luces/${n}.jpg`);
      expect(row[0], n).toContain(`assets/2026-11-16-storybook-luces/after/desktop-${n}.png`);
      expect(existsSync(`${ASSETS}${n}.jpg`), `${n}.jpg`).toBe(true);
    }
    for (const [name, size] of Object.entries(VIEWPORTS)) {
      expect(table).toContain(`assets/2026-11-16-storybook-luces/after/faro-norte-${name}.png`);
      expect(pngSize(`${ASSETS}after/faro-norte-${name}.png`), name).toEqual([...size]);
    }
  });
  it("the spec lists its deviations", () => {
    const dev = h2(spec, DEVIATIONS);
    expect(dev).not.toBe("");
    for (const s of ["poly", "light: true", "boyas", "24/48/72", "40/68/124", "(32, −180)", "(−150, −50)", "(−180, 10)", "terreno", "sombras", "`h`"]) expect(dev, s).toContain(s);
  });
  it("README's storybook paragraph names __lab.tick, shadows, halos and animation", () => {
    const story = (readme.split(/\n\s*\n/).find((p) => p.includes("/lab/storybook.html")) ?? "").replace(/\s+/g, " ");
    for (const s of ["`__lab.tick`", "shadows", "halos", "animation"]) expect(story, s).toContain(s);
  });
  it("README's world section describes the STS boom and no sparks", () => {
    const world = h2(readme, /^## Isometric world$/m);
    expect(world).toMatch(/STS/);
    expect(world).toMatch(/boom/);
    expect(readme).not.toMatch(/spark|welding/i);
  });
  it("README lists the lights spec among the lab specs", () => {
    const lab = readme.split(/\n\s*\n/).find((p) => p.includes("/lab/world.html")) ?? "";
    expect(lab).toContain("2026-11-16-storybook-luces-y-encuadre-design.md");
  });
  it("the 2026-10-17 storybook spec notes the deviation after its framing paragraph", () => {
    const old = readFileSync(`${SPECS}2026-10-17-storybook-estructuras-design.md`, "utf8");
    const paras = old.split(/\n\s*\n/);
    const at = paras.findIndex((p) => p.startsWith("**Encuadre.**"));
    expect(at).toBeGreaterThanOrEqual(0);
    const note = (paras[at + 1] ?? "").replace(/\s+/g, " ");
    expect(note.startsWith("*Desvío (2026-11-17")).toBe(true);
    expect(note).toContain("2026-11-16-storybook-luces-y-encuadre-design.md");
    expect(old.split("\n").find((l) => l.startsWith("**Estado:**"))).toMatch(/implementad/);
  });
});
