import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// storybook.ts boots the app on import: the source is read, as in lab-excluded.test.ts
const src = readFileSync(new URL("./storybook.ts", import.meta.url), "utf8");

describe("storybook stage lifecycle (#102)", () => {
  it("recycles each stage with stage.destroy(), never destroying the container by hand", () => {
    expect(src).not.toMatch(/container\.destroy\(/);
    expect(src).toContain("stage?.destroy()");
  });
});

describe("page elements (#187)", () => {
  it("does not read them with getElementById: mountStorybook resolves them", () => {
    expect(src).not.toContain("getElementById(");
    expect(src).toMatch(/mountStorybook\(\s*document\s*,/);
  });
});

describe("storybook logs (#132)", () => {
  it("key 6 does not use the bloom: prefix of the measured verdict", () => {
    const infos = src.match(/console\.\w+\(\s*([`"'])[\s\S]*?\1/g) ?? [];
    expect(infos.length).toBeGreaterThan(0);
    expect(infos.filter((l) => l.includes("bloom:"))).toEqual([]);
    expect(src).toMatch(/stage\.setBloom\(nextBloomMode\(stage\.bloom\)\);\s*if \(log\) console\.info\(`\[storybook\] bloom by hand: \$\{stage\.bloom\}`\);/);
  });
  it("the key help still describes key 6", () => {
    expect(src).toMatch(/6 rotates the bloom/);
    expect(readFileSync(new URL("../../lab/storybook.html", import.meta.url), "utf8")).toMatch(/aria-label="[^"]*Key 6 rotates the bloom: off, on, fallback\.[^"]*"/);
  });
  it("worst and since accumulate only with log, as in src/main.ts", () => {
    expect(src).toMatch(/bloom\?\.tick\(dt\);\s*if \(log\) \{\s*worst = Math\.max\(worst, dt\);\s*since \+= ticker\.deltaMS;\s*if \(since > 5000\) \{.*worst = 0; since = 0; \}\s*\}/);
  });
});

describe("cover-scale key c (#360)", () => {
  it("the header comment and the aria-label document the c key", () => {
    expect(src.replace(/\n\s*\*\s*/g, " ")).toContain("c cycles the exhibit scale: real, 1.17 and 0.83, the cover scales of a laptop and a phone");
    expect(readFileSync(new URL("../../lab/storybook.html", import.meta.url), "utf8")).toMatch(/aria-label="[^"]*Key c cycles the exhibit scale: real, 1\.17 \(laptop cover\) and 0\.83 \(phone cover\)\.[^"]*"/);
  });
  it("c ignores held keys and logs the mode", () => {
    expect(src).toMatch(/ev\.key === "c" && !ev\.repeat/);
    expect(src).toContain("[storybook] cover scale: ");
  });
});

describe("lab hook (#377)", () => {
  it("publishes window.__lab only under import.meta.env.DEV", () => {
    expect(src).toMatch(/if \(import\.meta\.env\.DEV\)\s*\{?\s*window\.__lab = /);
  });
  it("declares LabHook on Window in the module", () => {
    expect(src).toMatch(/interface LabHook/);
    expect(src).toMatch(/declare global \{\s*interface Window \{\s*__lab\?: LabHook/);
  });
  it("LabHook has every member the legibility script reads", () => {
    const start = src.indexOf("interface LabHook {");
    const body = src.slice(start, src.indexOf("\n}", start));
    for (const k of ["exhibitId", "coverScale", "setCoverScale", "bloom", "fit", "hostSize", "pixels", "tick"]) expect(body).toMatch(new RegExp(`\\b${k}\\b`));
  });
  it("pixels reads the stage through extract.pixels at resolution 2", () => {
    expect(src).toContain("extract.pixels(");
    expect(src).toContain("resolution: 2");
  });
  it("the header comment documents window.__lab", () => {
    const header = src.slice(src.indexOf("/**"), src.indexOf("*/")).replace(/\n\s*\*\s*/g, " ");
    expect(header).toContain("window.__lab");
  });
});

describe("content framing and tick (#400)", () => {
  const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  it("fits contentFrame, not the box rhombus", () => {
    expect(code).toMatch(/fitTransform\(\s*content\b/);
    expect(code).not.toMatch(/fitTransform\(\s*boxFrame\(/);
  });
  it("contentFrame is computed once per show, before buildStage", () => {
    expect(code.match(/contentFrame\(/g)).toHaveLength(1);
    const show = code.slice(code.indexOf("const show = "), code.indexOf("const fromHash"));
    expect(show.indexOf("contentFrame(")).toBeGreaterThan(-1);
    expect(show.indexOf("contentFrame(")).toBeLessThan(show.indexOf("buildStage("));
  });
  it("tick redraws the stage and renders", () => {
    expect(code).toMatch(/tick\(dtMs\)\s*\{\s*stage\?\.tick\(dtMs\);\s*app\.render\(\);\s*\}/);
  });
  it("the header documents tick and the 8 s clock advance", () => {
    const header = src.slice(src.indexOf("/**"), src.indexOf("*/")).replace(/\n\s*\*\s*/g, " ");
    expect(header).toMatch(/\btick\b/);
    expect(header).toContain("8 s");
  });
});

describe("responsive layout (#400)", () => {
  const html = readFileSync(new URL("../../lab/storybook.html", import.meta.url), "utf8").replace(/\s+/g, " ");
  it("under 60rem the index, the canvas and the readout stack in one column", () => {
    expect(html).toContain("@media (max-width: 60rem) { body { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr) auto; } #exhibits { max-height: 22vh; } #readout { max-height: 22vh; } #lab-host { height: auto; min-height: 0; } }");
  });
  it("keeps the three columns, the hidden overflow and the element order", () => {
    expect(html).toContain("grid-template-columns: 14rem 1fr 16rem");
    expect(html).toMatch(/html, body \{[^}]*overflow: hidden/);
    const order = ["id=\"exhibits\"", "id=\"lab-host\"", "id=\"readout\""].map((k) => html.indexOf(k));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
