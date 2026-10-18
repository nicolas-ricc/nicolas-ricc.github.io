import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bloomFromSearch, nextBloomMode } from "./page";

describe("bloom en el lab", () => {
  it("?bloom= acepta los tres modos", () => {
    expect(bloomFromSearch("?bloom=on")).toBe("on");
    expect(bloomFromSearch("?speed=0.1&bloom=fallback")).toBe("fallback");
    expect(bloomFromSearch("?bloom=off")).toBe("off");
  });
  it("sin parámetro o con un valor desconocido no fuerza nada", () => {
    expect(bloomFromSearch("")).toBeNull();
    expect(bloomFromSearch("?bloom=")).toBeNull();
    expect(bloomFromSearch("?bloom=ON")).toBeNull();
    expect(bloomFromSearch("?bloom=foo")).toBeNull();
  });
  it("la tecla 6 rota off → on → fallback → off", () => {
    expect(nextBloomMode("off")).toBe("on");
    expect(nextBloomMode("on")).toBe("fallback");
    expect(nextBloomMode("fallback")).toBe("off");
  });
});

const ROOT = new URL("../../", import.meta.url).pathname;
const pageSrc = readFileSync(`${ROOT}src/lab/page.ts`, "utf8");

describe("logs del lab (#31)", () => {
  it("la tecla 6 no usa el prefijo bloom: del veredicto medido", () => {
    const infos = pageSrc.match(/console\.info\(`[^`]*`\)/g) ?? [];
    expect(infos.filter((l) => l.includes("bloom:"))).toEqual([]);
    expect(pageSrc).toContain("stage.setBloom(nextBloomMode(stage.bloom)); if (log) console.info(`[lab] bloom a mano: ${stage.bloom}`);");
  });
  it("la ayuda de teclas sigue describiendo la tecla 6", () => {
    expect(pageSrc).toMatch(/6 rota el bloom entre off, on y fallback/);
    expect(readFileSync(`${ROOT}lab/world.html`, "utf8")).toMatch(/aria-label="[^"]*Tecla 6 rota el bloom: off, on, fallback\.[^"]*"/);
  });
  it("worst y since se acumulan solo con log, como en src/main.ts", () => {
    expect(pageSrc).toMatch(/bloom\?\.tick\(dt\);\s*if \(log\) \{\s*worst = Math\.max\(worst, dt\);\s*since \+= ticker\.deltaMS;\s*if \(since > 5000\) \{.*worst = 0; since = 0; \}\s*\}/);
  });
});
