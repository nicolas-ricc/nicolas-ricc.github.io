import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { project } from "../iso/project";
import { COVER_LAPTOP, COVER_PHONE, GROUND_ASPECT, layoutGaps, SIGN_FONT, SIGN_RULES, signMetrics, staticContrast } from "../kit/legibility";
import { counterClearance, letterGaps, measureText, rhythm } from "../kit/lettering";
import { TOWER } from "../scenes/city-grid";
import { CROWN_SITE } from "../scenes/sign-crown";
import { BLOG_SIGNS, CYCLE_POSES, PITCH, PLATFORM_DECK, PLATFORM_SITES, poseAt, ROLL, signAt, WRITING_CAP } from "../scenes/sign-platform";
import { RAFT } from "../scenes/raft";
import { ISO_TONES } from "../map/palette-iso";
import { CHAINSAW_BAR } from "../kit/marquee";
import { writingSite } from "../world/signs";
import { LANE_BACK, LANE_OUT } from "../scenes/sea-anim";
import { HEADLAND_SHIFT } from "../map/geo";
import { buildRenderList } from "../iso/render-list";
import { assembleWorld } from "../world/assemble";
import { COVER_FOCUS_U } from "../world/view";
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
  const WORDS = { RESUME: "cartel-torre-escena", PORTFOLIO: "cartel-taller-escena", WRITING: "plataforma-escena" } as const;
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
    WRITING: PLATFORM_DECK.map((q) => ({ x: q.x, y: q.y, z: 0 })),
  };

  it("REPORT.md exists, has every context at both scales and no failure mark", () => {
    expect(report).not.toBe("");
    // 3 metrics × 2 scales × 4 contexts (plataforma-escena-angosta joined in #429); since #445 no row is excused
    expect(report.match(/^\| (contraste|halo|OCR) \|.*\| ✓ \|$/gm)?.length ?? 0).toBe(24);
    // the only ✗ left is the `✓/✗` header cell of each table
    for (const l of report.split("\n").filter((x) => x.includes("✗"))) expect(l).toMatch(/\| ✓\/✗ \|$/);
    for (const id of [...CONTEXTS, "plataforma-escena-angosta"]) for (const s of ["1.17", "0.83"]) expect(report).toMatch(new RegExp(`^## ${id} a ${s.replace(".", "\\.")}$`, "m"));
    expect(report).toContain("Sin violaciones.");
  });
  it("the six level-3 crops are PNGs and the six scene captures are 3200×1800", () => {
    for (const id of CONTEXTS) for (const [s] of SCALES) {
      size(`assets/carteles-legibilidad/${id}-${s}.png`);
      expect(size(`assets/374-carteles/${id}-${s}.png`), `${id}-${s}`).toEqual([3200, 1800]);
    }
  });
  it("the redesign spec says implemented in the storybook and on the site, and §6 is ticked off", () => {
    expect(spec.split("\n").find((l) => l.startsWith("**Estado:**"))).toBe("**Estado:** implementado (storybook e integración al sitio: #389, spec 2026-11-17)");
    const criteria = between(spec, /^## 6\. /m, /^## 7\. /m);
    expect(criteria).not.toMatch(/- \[ \]/);
    expect(criteria.match(/- \[x\]/g)?.length ?? 0).toBe(9);
  });
  it("§5 records the three candidate sites with their values", () => {
    const sites = between(spec, /^## 5\. /m, /^## 6\. /m);
    // built from the constants, with the spec's U+2212 minus, so a moved site fails here; the platform's is a literal since #427
    // (it left PLATFORM_SITE for two sites, PLATFORM_SITES, and this spec records the site of its time)
    const at = (v: { x: number; y: number; z: number }) => `(${[v.x, v.y, v.z].join(", ").replace(/-/g, "−")})`;
    for (const s of ["CROWN_SITE", at(CROWN_SITE), "TINKER_SITE", at(TINKER_SITE), "PLATFORM_SITE", "(392, 178)"]) expect(sites, s).toContain(s);
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
  // since #429 the current level-3 measures live in the 2026-11-18 spec §8; the 2026-11-15 §8.1 keeps those of 2026-11-17
  it("the 2026-11-18 spec §8 carries the level-3 measures of REPORT.md for the four contexts", () => {
    const next = readFileSync(`${SPECS}2026-11-18-composicion-responsive-design.md`, "utf8");
    const table = between(next, /^## 8\. Desvíos y medición$/m);
    for (const id of [...CONTEXTS, "plataforma-escena-angosta"]) for (const s of ["1.17", "0.83"]) {
      const sec = between(report, new RegExp(`^## ${id} a ${s.replace(".", "\\.")}$`, "m")).split(/\n(?=## )/)[0]!;
      const cell = (name: string) => row(sec, `| ${name} |`).split("|")[2]?.trim() ?? "";
      const line = row(table, `| \`${id}\` | ${s} |`);
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
    for (const s of ["in its scene", "crop of the real world", "npm run legibility", "contrast", "halo", "OCR", "does not run in CI", "`c`"]) expect(story, s).toContain(s);
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

describe("zone signs integration (#394)", () => {
  const SPECS = `${ROOT}docs/superpowers/specs/`;
  const NAME = "2026-11-17-carteles-de-zona-integracion-design.md";
  const read = (rel: string) => (existsSync(`${SPECS}${rel}`) ? readFileSync(`${SPECS}${rel}`, "utf8") : "");
  const spec = read(NAME);
  const between = (txt: string, from: RegExp, to?: RegExp) => {
    const i = txt.search(from);
    if (i < 0) return "";
    const rest = txt.slice(i), j = to ? rest.search(to) : -1;
    return j < 0 ? rest : rest.slice(0, j);
  };
  const part = (n: number) => between(spec, new RegExp(`^## ${n}\\. `, "m"), new RegExp(`^## ${n + 1}\\. `, "m"));
  /** The single line of `txt` that starts with `prefix` ("" when none or several). */
  const row = (txt: string, prefix: string) => { const ls = txt.split("\n").filter((l) => l.startsWith(prefix)); return ls.length === 1 ? ls[0]! : ""; };
  /** Cells of a table row, trimmed, without the outer pipes. */
  const cells = (line: string) => line.split("|").slice(1, -1).map((c) => c.trim());
  /** Value as the specs write it: comma-separated, U+2212 for the minus. */
  const at = (v: { x: number; y: number; z: number }, z = true) => `(${[v.x, v.y, ...(z ? [v.z] : [])].join(", ").replace(/-/g, "−")})`;
  const CAPTURES = ["plataforma-sitio.png", "corona-sitio.png", "tinker-sitio.png", "sitio-laptop.png", "sitio-laptop-resume.png", "sitio-foco.png", "sitio-telefono.png"];

  it("the integration spec exists, dated 2026-11-17 and implemented, with §1 to §7 in order", () => {
    expect(spec).not.toBe("");
    expect(spec).toMatch(/^\*\*Fecha:\*\* 2026-11-17$/m);
    expect(spec).toMatch(/^\*\*Estado:\*\* implementado$/m);
    const lines = spec.split("\n"), estado = lines.indexOf("**Estado:** implementado");
    expect(lines[estado + 1]).toBe("**Superada en parte:** #423 (spec 2026-11-18) muda la plataforma de Writing a dos sitios y cambia `COVER_FOCUS_U`; las tablas de §3, §4 y §5 describen el estado en #394.");
    const heads = [1, 2, 3, 4, 5, 6, 7].map((n) => spec.search(new RegExp(`^## ${n}\\. `, "m")));
    for (const h of heads) expect(h).toBeGreaterThanOrEqual(0);
    for (let k = 1; k < heads.length; k++) expect(heads[k]!).toBeGreaterThan(heads[k - 1]!);
  });
  it("§3 carries the final site of each sign, as the constants say", () => {
    const sites = part(3);
    // the platform's row is a literal since #427: the spec is history, and the platform now has two sites (PLATFORM_SITES)
    const rows = { CROWN_SITE: at(CROWN_SITE), TINKER_SITE: at(TINKER_SITE), PLATFORM_SITE: "(392, 178)" };
    for (const [name, value] of Object.entries(rows)) expect(row(sites, `| \`${name}\` |`), name).toContain(value);
  });
  // literals since #428: COVER_FOCUS_U moved to 0.39 and Writing has two sites, so the live boxes no longer match; the spec is history
  it("§4 carries each sign's screen box and label mode on the laptop and the phone, as #394 measured them", () => {
    const framing = part(4);
    const ROWS = [
      ["laptop 1366×657", "portfolio", "600.1..688.3 × 69.6..86.1", "sign"],
      ["laptop 1366×657", "cv", "393.7..466.7 × 236.7..251.0", "sign"],
      ["laptop 1366×657", "blog", "747.5..846.5 × 397.2..425.2", "sign"],
      ["teléfono 390×750", "portfolio", "307.4..400.6 × 101.5..118.9", "sign"],
      ["teléfono 390×750", "cv", "89.4..166.5 × 278.0..293.1", "sign"],
      ["teléfono 390×750", "blog", "463.2..567.8 × 447.6..477.1", "edge"],
    ] as const;
    for (const [screen, id, box, mode] of ROWS) {
      const line = row(framing, `| ${screen} | \`${id}\` |`);
      expect(line, `${screen} ${id}`).not.toBe("");
      expect(line, `${screen} ${id} ${box}`).toContain(box);
      expect(line, `${screen} ${id} ${mode}`).toContain(`\`${mode}\``);
    }
  });
  it("§5 carries the frame table before and after, the static polygons and the world accents", () => {
    const budget = part(5);
    const num = (c: string) => Number(c.replace(/\s/g, "").replace(",", "."));
    for (const name of ["first draw (ms)", "bloom, promedio (ms)", "peor redibujo en 5 s (ms)"]) {
      const c = cells(row(budget, `| ${name} |`));
      expect(c.length, name).toBe(3);
      for (const v of c.slice(1)) expect(Number.isFinite(num(v)) && num(v) > 0, `${name} ${v}`).toBe(true);
    }
    const verdict = cells(row(budget, "| veredicto del bloom |"));
    expect(verdict.length).toBe(3);
    for (const v of verdict.slice(1)) expect(v).toMatch(/^`(on|fallback)`$/);
    // literals since #427: the spec is history, and the Writing platform left the static world (platformAnimator), so the live counts dropped
    expect(num(cells(row(budget, "| polígonos estáticos |")).at(-1) ?? "")).toBe(46518);
    expect(num(cells(row(budget, "| acentos estáticos del mundo |")).at(-1) ?? "")).toBe(2409);
  });
  it("§7 lists the seven site captures, and they exist", () => {
    const caps = part(7);
    for (const f of CAPTURES) {
      expect(caps, f).toContain(`assets/389-carteles-sitio/${f}`);
      expect(existsSync(`${SPECS}assets/389-carteles-sitio/${f}`), f).toBe(true);
    }
  });
  it("§7 of both previous sign specs opens with the integration note", () => {
    const NOTE = "*Desvío (2026-11-17): integrado en #389; ver 2026-11-17-carteles-de-zona-integracion-design.md.*";
    for (const old of ["2026-11-15-carteles-de-zona-rediseno-design.md", "2026-11-11-carteles-de-zona-assets-design.md"]) {
      const first = (between(read(old), /^## 7\. /m).split(/\n\s*\n/)[1] ?? "").replace(/\s+/g, " ").trim();
      expect(first, old).toBe(NOTE);
    }
  });
  it("README lists the integration spec among the lab specs and tells the sign navigation in the runtime paragraph", () => {
    const paragraphs = readme.split(/\n\s*\n/);
    const lab = paragraphs.find((p) => p.includes("/lab/world.html")) ?? "";
    expect(lab).toContain(NAME);
    const runtime = (paragraphs.find((p) => p.includes("coverView(host)")) ?? "").replace(/\s+/g, " ");
    for (const s of ["src/world/signs.ts", "zoneAtScreen", "labelLayout", "edge", "no external font"]) expect(runtime, s).toContain(s);
  });
});

describe("Writing with two sites (#427)", () => {
  const ASSETS = `${ROOT}docs/superpowers/specs/assets/423-composicion-responsive/`;
  it("README's storybook paragraph lists the three Writing exhibits", () => {
    const p = readme.split(/\n\s*\n/).find((x) => x.includes("zone signs of #374")) ?? "";
    for (const id of ["`#plataforma`", "`#plataforma-escena`", "`#plataforma-escena-angosta`"]) expect(p, id).toContain(id);
  });
  it.each(["plataforma-escena-angosta-117.png", "sitio-1600x900-ancho.png"])("capture %s exists, 1600×900 @2", (f) => {
    expect(existsSync(`${ASSETS}${f}`), f).toBe(true);
    const b = readFileSync(`${ASSETS}${f}`);
    expect(b.subarray(1, 4).toString(), f).toBe("PNG");
    expect([b.readUInt32BE(16), b.readUInt32BE(20)]).toEqual([3200, 1800]);
  });
});

describe("#app decides Writing's site (#428)", () => {
  const glossary = readFileSync(`${ROOT}CONTEXT.md`, "utf8");
  /** The CONTEXT.md entry `### <title>` up to the next `### `. */
  const entry = (title: string) => { const at = glossary.indexOf(`### ${title}\n`); const rest = glossary.slice(at + title.length + 5); const next = rest.search(/^### /m); return at < 0 ? "" : next < 0 ? rest : rest.slice(0, next); };
  it("CONTEXT.md Cover frame names COVER_FOCUS_U at 0.39", () => {
    const e = entry("Cover frame");
    expect(e).toContain("`COVER_FOCUS_U`");
    expect(e).toContain("0.39");
  });
  it("CONTEXT.md Sign tells writingSite, WRITING_SITE_MARGIN and #app, and the site is no longer pinned", () => {
    const e = entry("Sign");
    for (const s of ["`writingSite`", "`WRITING_SITE_MARGIN`", "`#app`"]) expect(e, s).toContain(s);
    expect(e).not.toContain("pinned to `wide`");
  });
  it("README's runtime paragraph tells writingSite and #app", () => {
    const runtime = (readme.split(/\n\s*\n/).find((p) => p.includes("coverView(host)")) ?? "").replace(/\s+/g, " ");
    for (const s of ["writingSite", "#app"]) expect(runtime, s).toContain(s);
    expect(runtime).not.toContain("(Writing, on a phone)");
  });
});

describe("#423 closing (#429)", () => {
  const SPECS = `${ROOT}docs/superpowers/specs/`;
  const AFTER = `${SPECS}assets/423-composicion-responsive/despues/`;
  const read = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : "");
  const png = (path: string) => {
    expect(existsSync(path), path).toBe(true);
    const b = readFileSync(path);
    expect(b.subarray(1, 4).toString(), path).toBe("PNG");
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  };
  /** `WxH` of a capture name such as `mapa-390x750.png`. */
  const viewport = (name: string) => name.match(/(\d+)x(\d+)/)!.slice(1).map(Number);
  const CAPTURES = [
    ...["390x750", "430x932", "820x1180", "1024x768", "1366x1024", "1600x900", "1920x955"].map((s) => `mapa-${s}.png`),
    "blog-1920x955.png", "blog-390x750.png", "boca-lab-1600x900.png", "rotacion-900x1440.png", "rotacion-1440x900.png",
  ];
  const glossary = read(`${ROOT}CONTEXT.md`);
  const adr4 = read(`${ROOT}docs/adr/0004-writing-site-follows-the-host.md`);
  const adr3 = read(`${ROOT}docs/adr/0003-signs-are-the-navigation.md`);
  const spec = read(`${SPECS}2026-11-18-composicion-responsive-design.md`);
  const at8 = spec.search(/^## 8\. Desvíos y medición$/m);
  const dev = (at8 < 0 ? "" : spec.slice(at8)).replace(/\s+/g, " ");
  // a literal since #437: WRITING in LostWages moved the threshold; this spec records #429's, the 2026-11-15 spec §8.2 the new one
  const threshold = () => "1,54";
  /** A count as the spec writes it: thousands separated by a space. */
  const count = (n: number) => n.toLocaleString("en").replace(/,/g, " ");

  it.each(CAPTURES)("capture %s exists at 2W×2H", (name) => {
    const [w, h] = viewport(name);
    expect(png(`${AFTER}${name}`)).toEqual([2 * w!, 2 * h!]);
  });
  it("every PNG of despues/ is 2W×2H of the viewport in its name", () => {
    for (const name of readdirSync(AFTER).filter((f) => f.endsWith(".png") && /\d+x\d+/.test(f))) {
      const [w, h] = viewport(name);
      expect(png(`${AFTER}${name}`), name).toEqual([2 * w!, 2 * h!]);
    }
  });
  it("despues/README.md judges every capture on a line of its own and records the rotation", () => {
    const lines = read(`${AFTER}README.md`).split("\n");
    for (const name of CAPTURES) expect(lines.filter((l) => l.startsWith(`- \`${name}\``)), name).toHaveLength(1);
    const text = lines.join("\n");
    for (const s of ["transform", "900×1440", "1440×900", "sin recargar"]) expect(text, s).toContain(s);
  });
  it("REPORT.md has plataforma-escena-angosta at both scales, every row ok, and its four crops", () => {
    const report = read(`${SPECS}assets/carteles-legibilidad/REPORT.md`);
    for (const sc of ["1.17", "0.83"]) {
      const sec = report.slice(report.indexOf(`## plataforma-escena-angosta a ${sc}\n`)).split(/\n(?=## )/)[0]!;
      expect(report, sc).toContain(`## plataforma-escena-angosta a ${sc}\n`);
      expect(sec.match(/^\| (contraste|halo|OCR) \|.*\| ✓ \|$/gm)?.length ?? 0, sc).toBe(3);
    }
    for (const s of ["117", "083", "117-ocr", "083-ocr"]) png(`${SPECS}assets/carteles-legibilidad/plataforma-escena-angosta-${s}.png`);
  });
  it("ADR 0004 exists with its title, the five parts in order and the story in its status", () => {
    expect(adr4.split("\n")[0]).toBe("# 0004. The Writing site depends on the host");
    const heads = ["## Status", "## Context", "## Decision", "## Consequences"].map((h) => adr4.search(new RegExp(`^${h}$`, "m")));
    for (const i of heads) expect(i).toBeGreaterThan(0);
    expect([...heads].sort((a, b) => a - b)).toEqual(heads);
    expect(adr4.search(/^Sources: /m)).toBeGreaterThan(heads[3]!);
    const status = adr4.slice(heads[0]!, heads[1]!);
    for (const s of ["Accepted", "2026-11-18", "#423"]) expect(status, s).toContain(s);
    for (const s of ["writingSite", "platformAnimator", "#app", "ResizeObserver", "seaPlatformAt", "ADR 0002", "zoneFrame"]) expect(adr4, s).toContain(s);
  });
  it("ADR 0003 says under Consequences that 0004 revises it", () => {
    const cons = adr3.slice(adr3.search(/^## Consequences$/m));
    expect(cons).toMatch(/^- Revised by 0004: /m);
  });
  it("the spec says implemented and §8 carries the final values, the threshold, the rotation and the counts", () => {
    expect(spec.split("\n").find((l) => l.startsWith("**Estado:**"))).toContain("implementado (#423)");
    expect(at8).toBeGreaterThan(spec.search(/^## 7\. /m));
    const v = (p: { x: number; y: number }) => `(${p.x}, ${p.y})`;
    const needles = [
      "HEADLAND_SHIFT", `(+${HEADLAND_SHIFT.x}, +${HEADLAND_SHIFT.y})`,
      "PLATFORM_SITES", v(PLATFORM_SITES.wide), v(PLATFORM_SITES.tall),
      "COVER_FOCUS_U", String(COVER_FOCUS_U).replace(".", ","),
      "LANE_OUT", "LANE_BACK", ...LANE_OUT.map(v), ...LANE_BACK.map(v),
      threshold(), "900×1440", "1440×900", "46 481", "2 409",
    ];
    for (const s of needles) expect(dev, s).toContain(s);
  });
  it("§8 carries the static polygons and accents of the world after the story, as the budget tests count them", () => {
    const w = assembleWorld(undefined, { reducedMotion: true }).scene;
    const polys = buildRenderList([...w.terrain.ground, ...w.ground, ...w.solids]).length;
    for (const n of [polys, w.accents.length]) expect(dev, String(n)).toContain(count(n));
  });
  it("README and CONTEXT.md name no old identifier, no 0.35 focus and no headland capping the shipyard", () => {
    for (const [name, txt] of [["README.md", readme], ["CONTEXT.md", glossary]] as const) {
      for (const re of [/\bPLATFORM_SITE\b/, /\bBLOG_SIGN\b/, /(?<![A-Za-z_])SIGNS\b/, /caps the shipyard/]) expect(txt, `${name} ${re}`).not.toMatch(re);
      // the veil's ACCENT_DIM is 0.35 too: it is the only 0.35 allowed
      expect(txt.replace("`ACCENT_DIM` (0.35)", ""), name).not.toMatch(/0[.,]35/);
    }
  });
  it("README's runtime paragraph gives the focus, 0.39", () => {
    const runtime = (readme.split(/\n\s*\n/).find((p) => p.includes("coverView(host)")) ?? "").replace(/\s+/g, " ");
    expect(runtime).toContain("`COVER_FOCUS_U` (0.39");
  });
  it("README describes the headland on the island's east coast as Blog, and the lanes between the two Writing sites", () => {
    const world = (readme.split(/\n\s*\n/).find((p) => p.includes("`LANE_OUT`")) ?? "").replace(/\s+/g, " ");
    for (const s of ["east coast", "Blog", "tall site", "wide site"]) expect(world, s).toContain(s);
  });
});

describe("WRITING in LostWages (#437)", () => {
  // history since #441: the LostWages entry stays in §8.2, the floating board's entry follows it
  const spec = existsSync(`${ROOT}docs/superpowers/specs/2026-11-15-carteles-de-zona-rediseno-design.md`) ? readFileSync(`${ROOT}docs/superpowers/specs/2026-11-15-carteles-de-zona-rediseno-design.md`, "utf8") : "";
  const dev = spec.slice(Math.max(0, spec.search(/^### 8\.2 /m)), Math.max(0, spec.search(/^### 8\.3 /m)));

  it("§8.2 has a WRITING en LostWages entry after the Black Chancery one", () => {
    expect(dev.indexOf("- **WRITING en LostWages")).toBeGreaterThan(0);
    expect(dev.indexOf("- **WRITING en LostWages")).toBeGreaterThan(dev.indexOf("- **Writing en Black Chancery"));
  });
});

describe("WRITING in Chainsaw Carnage (#442)", () => {
  it("CONTEXT.md names WRITING in Chainsaw Carnage and its word file, neither LostWages nor Black Chancery", () => {
    const glossary = existsSync(`${ROOT}CONTEXT.md`) ? readFileSync(`${ROOT}CONTEXT.md`, "utf8") : "";
    for (const s of ["`WRITING`", "Chainsaw Carnage", "`src/kit/chainsaw-writing.ts`"]) expect(glossary, s).toContain(s);
    expect(glossary).not.toMatch(/LostWages/);
    expect(glossary).not.toMatch(/Chancery/);
  });
});

describe("WRITING on a floating board (#441)", () => {
  // history since #451: the entry, its heave captures in §8.4 and their folder; the live values are pinned by the #451 block
  const SPECS = `${ROOT}docs/superpowers/specs/`;
  const spec = existsSync(`${SPECS}2026-11-15-carteles-de-zona-rediseno-design.md`) ? readFileSync(`${SPECS}2026-11-15-carteles-de-zona-rediseno-design.md`, "utf8") : "";
  const OLD_LAPSE = `${SPECS}assets/441-tabla-flotante/`, OLD_POSES = [1, 2, 3, 4].map((n) => `balanceo-${n}.png`);
  const dev = spec.slice(Math.max(0, spec.search(/^### 8\.2 /m)), Math.max(0, spec.search(/^### 8\.3 /m)));
  const TITLE = "- **WRITING en Chainsaw Carnage, tabla flotante (#441).**";
  const entry = (dev.split(/\n(?=- \*\*)/).find((b) => b.startsWith(TITLE)) ?? "").replace(/\s+/g, " ");

  it("§8.2 has the floating board entry after the LostWages one", () => {
    expect(entry).not.toBe("");
    expect(dev.indexOf(TITLE)).toBeGreaterThan(dev.indexOf("- **WRITING en LostWages"));
  });
  it("the #441 entry keeps the font, its license and source and the files (history: it carries no live value)", () => {
    for (const s of [
      "Chainsaw Carnage", "GGBotNet", "SIL Open Font License", "https://www.1001fonts.com/chainsaw-carnage-font.html", "https://www.1001fonts.com/download/chainsaw-carnage.zip",
      "`src/kit/chainsaw-writing.ts`", "`scripts/marquee-word.py`", "`HEAVE`", "#437",
    ]) expect(entry, s).toContain(s);
  });
  it("§8.4 lists the four heave captures and their folder stays", () => {
    const caps = spec.slice(Math.max(0, spec.search(/^### 8\.4 /m)));
    for (const f of OLD_POSES) {
      expect(caps, f).toContain(`assets/441-tabla-flotante/${f}`);
      expect(existsSync(`${OLD_LAPSE}${f}`), f).toBe(true);
    }
  });
});

describe("WRITING on a plank raft (#451)", () => {
  const SPECS = `${ROOT}docs/superpowers/specs/`;
  const read = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : "");
  const png = (path: string) => {
    expect(existsSync(path), path).toBe(true);
    const b = readFileSync(path);
    expect(b.subarray(1, 4).toString(), path).toBe("PNG");
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  };
  const LEVEL3 = `${SPECS}assets/carteles-legibilidad/`;
  // the three level-3 runs (#457): at rest, and at two instants of the pitch-and-roll cycle
  const REPORTS = [{ file: "REPORT.md", tick: null }, { file: "REPORT-t7919.md", tick: 7919 }, { file: "REPORT-t15838.md", tick: 15838 }] as const;
  const reports = Object.fromEntries(REPORTS.map((r) => [r.file, read(`${LEVEL3}${r.file}`)]));
  const spec = read(`${SPECS}2026-11-15-carteles-de-zona-rediseno-design.md`);
  const next = read(`${SPECS}2026-11-18-composicion-responsive-design.md`);
  const story = read(`${SPECS}2026-11-20-writing-balsa-tablones-design.md`);
  const ADR5 = "0005-ground-signs-have-their-own-floors.md";
  const adr5 = read(`${ROOT}docs/adr/${ADR5}`);
  const glossary = read(`${ROOT}CONTEXT.md`);
  const LAPSE = `${SPECS}assets/451-balsa-tablones/balanceo/`;
  const TIMES = [0, 1675, 3350, 5025, 7919, 15838];
  const POSES = TIMES.map((_, k) => `balanceo-${k + 1}.png`);
  const dev = spec.slice(Math.max(0, spec.search(/^### 8\.2 /m)), Math.max(0, spec.search(/^### 8\.3 /m)));
  const TITLE = "- **WRITING en Chainsaw Carnage, tabla flotante (#441).**";
  // the title of the #451 entry, matched by its story number (the English guard reads this file)
  const TITLE_451 = /^- \*\*WRITING [^*]*\(#451\)\.\*\*/m;
  const entry451 = (dev.split(/\n(?=- \*\*)/).find((b) => TITLE_451.test(b)) ?? "").replace(/\s+/g, " ");
  const WRITING_CONTEXTS = ["plataforma-escena", "plataforma-escena-angosta"];
  const SCALES = ["1.17", "0.83"];
  /** The value cell of `metric` in the section of `id` at `scale` of the report `md` ("" when missing). */
  const cell = (md: string, id: string, scale: string, metric: string) => {
    const at = md.indexOf(`## ${id} a ${scale}\n`);
    if (at < 0) return "";
    const sec = md.slice(at).split(/\n(?=## )/)[0]!;
    return sec.split("\n").find((l) => l.startsWith(`| ${metric} |`))?.split("|")[2]?.trim() ?? "";
  };
  /** The aspect threshold of the Writing site at 900 px high, comma decimal. */
  const threshold = () => { let w = 900; while (writingSite(w, 900) !== "wide") w++; return (w / 900).toFixed(2).replace(".", ","); };
  /** A value as the time-lapse README writes it: `d` decimals, sign (U+2212 minus), no sign when it rounds to zero. */
  const signed = (v: number, d: number) => { const s = Math.abs(v).toFixed(d), z = Number(s) === 0; return `${z ? "" : v > 0 ? "+" : "\u2212"}${s}`; };
  const deg = (r: number) => (r * 180) / Math.PI;
  /** Every file under `dir`, relative to it. */
  const walk = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(`${dir}${d.name}/`).map((f) => `${d.name}/${f}`) : [d.name])) : []);
  const RAFT_PNGS = walk(`${SPECS}assets/451-balsa-tablones/`).filter((f) => f.endsWith(".png"));

  it("the three reports: the four Writing rows at ≥ 7:1, halo ✓ and OCR WRITING; every row ✓", () => {
    for (const { file, tick } of REPORTS) {
      const md = reports[file]!;
      expect(md, file).not.toBe("");
      if (tick === null) expect(md, file).not.toMatch(/^Tick:/m);
      else expect(md, file).toMatch(new RegExp(`^Viewport: .*\\n\\nTick: ${tick} ms$`, "m"));
      expect(md.match(/^\| (contraste|halo|OCR) \|.*\| ✓ \|$/gm)?.length ?? 0, file).toBe(24);
      for (const id of WRITING_CONTEXTS) for (const sc of SCALES) {
        expect(parseFloat(cell(md, id, sc, "contraste")), `${file} ${id} ${sc}`).toBeGreaterThanOrEqual(7);
        const sec = md.slice(md.indexOf(`## ${id} a ${sc}\n`)).split(/\n(?=## )/)[0]!;
        expect(sec, `${file} ${id} ${sc}`).toMatch(/^\| halo \|.*\| ✓ \|$/m);
        expect(sc === "1.17" ? ["`WRITING`"] : ["`WRITING`", "`writing`"], `${file} ${id} ${sc}`).toContain(cell(md, id, sc, "OCR"));
      }
      expect(md, file).toContain("Sin violaciones.");
    }
  });
  it("the tick runs version their crops with the -t suffix", () => {
    for (const t of [7919, 15838]) for (const id of WRITING_CONTEXTS) for (const sc of ["117", "083"]) for (const k of ["", "-ocr"]) png(`${LEVEL3}${id}-${sc}-t${t}${k}.png`);
  });
  it("the #451 entry follows the #441 one and carries the live values of the raft", () => {
    expect(entry451).not.toBe("");
    expect(dev.search(TITLE_451)).toBeGreaterThan(dev.indexOf(TITLE));
    const hex = (n: number) => `0x${n.toString(16).padStart(6, "0")}`;
    const contrast = staticContrast(BLOG_SIGNS.wide).toFixed(2);
    expect(staticContrast(BLOG_SIGNS.tall).toFixed(2)).toBe(contrast);
    for (const s of [
      `\`WRITING_CAP\` ${WRITING_CAP}`, `\`CHAINSAW_BAR\` ${CHAINSAW_BAR}`, "`timber`", "`navy`", hex(ISO_TONES.timber.top), hex(ISO_TONES.navy.top), "`staticContrast`", contrast,
      `\`GROUND_ASPECT\` ${GROUND_ASPECT}`, threshold(), "`LANE_OUT`", ...LANE_OUT.slice(-3).map((p) => `(${p.x}, ${p.y})`), `\`zoneFrame\``, "450", "`platform.lights`", "caja alta 17.25",
      "`PITCH`", `${PITCH.periodMs} ms`, "`ROLL`", `${ROLL.periodMs} ms`, `\`plankW\` ${RAFT.plankW}`,
    ]) expect(entry451, s).toContain(s);
    // the entry says the layer is gone, it does not list it as live
    expect(entry451).toMatch(/`platform\.lights`.{0,8}no existe/);
  });
  it("the #451 entry records the owner's size decision, the ground floors and the values at cap 17.25 (#460)", () => {
    for (const s of ["2026-11-20", "`SIGN_RULES.ground`", "#460"]) expect(entry451, s).toContain(s);
    const keys = ["xHeightPx", "strokePx", "airPx"] as const;
    const posed = { wide: CYCLE_POSES.map((p) => signAt("wide", p)), tall: CYCLE_POSES.map((p) => signAt("tall", p)) };
    for (const sc of [COVER_LAPTOP, COVER_PHONE]) {
      const f = SIGN_RULES.ground[sc];
      for (const v of [f.xHeightPx, f.strokePx, f.airPx]) expect(entry451, `${sc} floor ${v}`).toContain(`${v}`);
      expect(entry451).toContain(`${f.contrast}:1`);
      const at = (site: "wide" | "tall") => {
        const rest = signMetrics(BLOG_SIGNS[site], sc), all = posed[site].map((s) => signMetrics(s, sc));
        return keys.flatMap((k) => [rest[k].toFixed(2), Math.min(...all.map((m) => m[k])).toFixed(2)]);
      };
      const wide = at("wide");
      expect(at("tall"), `${sc}: one figure covers both sites`).toEqual(wide);
      for (const v of wide) expect(entry451, `${sc} ${v}`).toContain(v);
    }
  }, 30_000);
  it("the #451 entry carries the level-3 readings of the three runs (#457)", () => {
    for (const s of ["#457", "t 7919", "t 15838", "`--tick`"]) expect(entry451, s).toContain(s);
    for (const { file } of REPORTS) for (const id of WRITING_CONTEXTS) for (const sc of SCALES) for (const m of ["contraste", "halo", "OCR"]) {
      const v = cell(reports[file]!, id, sc, m);
      expect(v, `${file} ${id} ${sc} ${m}`).not.toBe("");
      expect(entry451, `${file} ${id} ${sc} ${m} ${v}`).toContain(v);
    }
  });
  it("§8.4 lists the regenerated captures, the -t crops and the 451-balsa-tablones folder, with no pending note", () => {
    const caps = spec.slice(Math.max(0, spec.search(/^### 8\.4 /m)));
    for (const s of ["assets/carteles-legibilidad/plataforma-escena-117-t7919.png", "assets/carteles-legibilidad/plataforma-escena-angosta-083-t15838.png", "assets/451-balsa-tablones/", "REPORT-t7919.md", "REPORT-t15838.md"]) expect(caps, s).toContain(s);
    expect(caps).not.toMatch(/#457 las regenera/);
  });
  it("the new spec exists and names the ground class, the materials, the motion, the lane, ADR 0005, every capture of 451-balsa-tablones and the children's plans", () => {
    expect(story).not.toBe("");
    for (const s of ["`groundDiagonal`", "`GROUND_ASPECT`", "`CHAINSAW_BAR`", "`timber`", "`navy`", "`PITCH`", "`ROLL`", "`LANE_OUT`", "`SIGN_RULES.ground`", "`--tick`", ADR5]) expect(story, s).toContain(s);
    expect(RAFT_PNGS.length).toBeGreaterThanOrEqual(10);
    for (const f of RAFT_PNGS) expect(story, f).toContain(`assets/451-balsa-tablones/${f}`);
    for (const plan of ["452-cartel-de-suelo", "453-mesh-rigid", "454-balsa-tablones", "455-balsa-contacto-agua", "456-cabeceo-rolido", "460-cap-17-pisos-suelo", "457-nivel3-suelo-cierre"]) {
      const path = `docs/plans/2026-11-20-${plan}.md`;
      expect(existsSync(`${ROOT}${path}`), path).toBe(true);
      expect(story, path).toContain(`2026-11-20-${plan}.md`);
    }
    for (const { file } of REPORTS) for (const id of WRITING_CONTEXTS) for (const sc of SCALES) expect(story, `${file} ${id} ${sc}`).toContain(cell(reports[file]!, id, sc, "contraste"));
  });
  it("ADR 0005 is Accepted and names SIGN_RULES and GROUND_ASPECT", () => {
    expect(adr5.split("\n")[0]).toMatch(/^# 0005\. /);
    const heads = ["## Status", "## Context", "## Decision", "## Consequences"].map((h) => adr5.search(new RegExp(`^${h}$`, "m")));
    for (const i of heads) expect(i).toBeGreaterThan(0);
    expect([...heads].sort((a, b) => a - b)).toEqual(heads);
    expect(adr5.search(/^Sources: /m)).toBeGreaterThan(heads[3]!);
    expect(adr5.slice(heads[0]!, heads[1]!)).toContain("Accepted");
    for (const s of ["`SIGN_RULES`", "`SIGN_RULES.ground`", "`GROUND_ASPECT`", "#451", "#460"]) expect(adr5, s).toContain(s);
  });
  it("the five regenerated captures, the close captures and the six of the time-lapse are 3200×1800", () => {
    for (const f of ["374-carteles/plataforma-escena-117.png", "374-carteles/plataforma-escena-083.png", "374-carteles/plataforma-real.png",
      "423-composicion-responsive/plataforma-escena-angosta-117.png", "423-composicion-responsive/sitio-1600x900-ancho.png"]) expect(png(`${SPECS}assets/${f}`), f).toEqual([3200, 1800]);
    for (const f of RAFT_PNGS) expect(png(`${SPECS}assets/451-balsa-tablones/${f}`), f).toEqual([3200, 1800]);
    for (const f of POSES) expect(RAFT_PNGS, f).toContain(`balanceo/${f}`);
  });
  it("the pitch and roll README names each capture with t and poseAt's dz, pitch and roll (#456)", () => {
    const lines = read(`${LAPSE}README.md`).split("\n");
    POSES.forEach((f, k) => {
      const line = lines.filter((l) => l.startsWith(`- \`${f}\``)), t = TIMES[k]!, p = poseAt(t);
      expect(line, f).toHaveLength(1);
      for (const s of [`t = ${t} ms`, `dz ${signed(p.dz, 2)}`, `pitch ${signed(deg(p.pitch), 1)}°`, `roll ${signed(deg(p.roll), 1)}°`]) expect(line[0], `${f} ${s}`).toContain(s);
    });
    expect(lines.join("\n")).toContain("poseAt");
  });
  it("the 2026-11-18 spec §8.3 says the sign is the plank raft and the OCR reads WRITING", () => {
    const at = next.search(/^### 8\.3 /m), rest = at < 0 ? "" : next.slice(at), end = rest.search(/\n#/);
    const sec = (end < 0 ? rest : rest.slice(0, end)).replace(/\s+/g, " ");
    for (const s of ["#451", "balsa de tablones", "`WRITING`"]) expect(sec, s).toContain(s);
    expect(sec).not.toMatch(/excepci|WRELENG|WREFHNG/);
  });
  it("CONTEXT.md Sign tells the raft, its motion, the paint and level 3 with --tick, and no LostWages", () => {
    const entryOf = (name: string) => { const at = glossary.indexOf(`### ${name}\n`), rest = glossary.slice(at + name.length + 5); return at < 0 ? "" : rest.slice(0, Math.max(0, rest.search(/^### /m)) || rest.length); };
    const sign = entryOf("Sign");
    for (const s of ["`platformAnimator`", "`HEAVE`", "`reducedMotion`", "no row", "`timber`", "`navy`", "decal", "`groundDiagonal`", "`platform.solid`", "`WRITING_CAP` (17.25)",
      "`PITCH`", "`ROLL`", "`ANGLE_STEP`", "`poseAt`", "`CYCLE_POSES`", "one pose", "`raftAt`", "`--tick`", "`?tick=`"]) expect(sign, s).toContain(s);
    for (const re of [/PAINT_LIFT/, /officeDark/, /roofDiagonal/, /platform\.lights/]) expect(sign, String(re)).not.toMatch(re);
    expect(glossary).toContain("Chainsaw Carnage");
    expect(glossary).not.toMatch(/LostWages/);
  });
  it("CONTEXT.md has ### Raft and ### Decal; Lettering and Legibility tell the ground plane, the symmetric halo and --tick", () => {
    const entryOf = (name: string) => { const at = glossary.indexOf(`### ${name}\n`), rest = glossary.slice(at + name.length + 5); return at < 0 ? "" : rest.slice(0, Math.max(0, rest.search(/^### /m)) || rest.length); };
    const raft = entryOf("Raft"), decal = entryOf("Decal"), lettering = entryOf("Lettering"), legibility = entryOf("Legibility");
    for (const s of ["(Balsa.)", "`raftAt`", "`RAFT`", "`PLATFORM_DECK`", "`buildRaft`", "`raftEnvelope`", "Code:"]) expect(raft, s).toContain(s);
    for (const s of ["(Calcomanía.)", "bloom", "`staticContrast`", "Code:"]) expect(decal, s).toContain(s);
    expect(lettering).toContain("`groundDiagonal`");
    for (const s of ["`SIGN_RULES.ground`", "halo", "symmetric", "`--tick`", "backed"]) expect(legibility, s).toContain(s);
  });
  it("README lists the new spec, --tick, its reports and the storybook's ?tick=", () => {
    for (const s of ["2026-11-20-writing-balsa-tablones-design.md", "`--tick", "REPORT-t", "`?tick=`"]) expect(readme, s).toContain(s);
    const p = (readme.split(/\n\s*\n/).find((x) => x.includes("zone signs of #374")) ?? "").replace(/\s+/g, " ");
    for (const s of ["no exceptions", "`--tick`"]) expect(p, s).toContain(s);
  });
});
