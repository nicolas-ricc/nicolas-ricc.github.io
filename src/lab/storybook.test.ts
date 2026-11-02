import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// storybook.ts arranca la app al importarse: se lee el fuente, como en lab-excluded.test.ts
const src = readFileSync(new URL("./storybook.ts", import.meta.url), "utf8");

describe("ciclo de vida de los stages del storybook (#102)", () => {
  it("recicla cada stage con stage.destroy(), nunca destruyendo el contenedor a mano", () => {
    expect(src).not.toMatch(/container\.destroy\(/);
    expect(src).toContain("stage?.destroy()");
  });
});

describe("elementos de la página (#187)", () => {
  it("no los lee con getElementById: los resuelve mountStorybook", () => {
    expect(src).not.toContain("getElementById(");
    expect(src).toContain("mountStorybook(document,");
  });
});

describe("logs del storybook (#132)", () => {
  it("la tecla 6 no usa el prefijo bloom: del veredicto medido", () => {
    const infos = src.match(/console\.\w+\(\s*([`"'])[\s\S]*?\1/g) ?? [];
    expect(infos.length).toBeGreaterThan(0);
    expect(infos.filter((l) => l.includes("bloom:"))).toEqual([]);
    expect(src).toMatch(/stage\.setBloom\(nextBloomMode\(stage\.bloom\)\);\s*if \(log\) console\.info\(`\[storybook\] bloom a mano: \$\{stage\.bloom\}`\);/);
  });
  it("la ayuda de teclas sigue describiendo la tecla 6", () => {
    expect(src).toMatch(/6 rota el bloom/);
    expect(readFileSync(new URL("../../lab/storybook.html", import.meta.url), "utf8")).toMatch(/aria-label="[^"]*Tecla 6 rota el bloom: off, on, fallback\.[^"]*"/);
  });
  it("worst y since se acumulan solo con log, como en src/main.ts", () => {
    expect(src).toMatch(/bloom\?\.tick\(dt\);\s*if \(log\) \{\s*worst = Math\.max\(worst, dt\);\s*since \+= ticker\.deltaMS;\s*if \(since > 5000\) \{.*worst = 0; since = 0; \}\s*\}/);
  });
});

describe("readout rows (#185)", () => {
  it("shows the ground in its own Suelo row, right after Sólidos", () => {
    expect(src).toMatch(/\["Sólidos", String\(r\.solids\)\],\s*\["Suelo", String\(r\.ground\)\],/);
  });
});
