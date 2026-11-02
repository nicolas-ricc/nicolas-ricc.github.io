import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assembleWorld } from "../world/assemble";
import { EXHIBITS } from "./exhibits";
import { bloomFromSearch, MAX_SPEED, nextBloomMode, speedFromSearch } from "./page";

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
    const logs = pageSrc.match(/console\.\w+\(\s*([`"'])[\s\S]*?\1/g) ?? [];
    expect(logs.filter((l) => l.includes("bloom:"))).toEqual([]);
    expect(pageSrc).toMatch(/stage\.setBloom\(nextBloomMode\(stage\.bloom\)\);\s*if \(log\) console\.info\(`\[lab\] bloom a mano: \$\{stage\.bloom\}`\)/);
  });
  it("la ayuda de teclas sigue describiendo la tecla 6", () => {
    expect(pageSrc).toMatch(/6 rota el bloom entre off, on y fallback/);
    expect(readFileSync(`${ROOT}lab/world.html`, "utf8")).toMatch(/aria-label="[^"]*Tecla 6 rota el bloom: off, on, fallback\.[^"]*"/);
  });
  it("worst y since se acumulan solo con log, como en src/main.ts", () => {
    expect(pageSrc).toMatch(/bloom\?\.tick\(dt\);\s*if \(log\) \{\s*worst = Math\.max\(worst, dt\);\s*since \+= ticker\.deltaMS;\s*if \(since > 5000\) \{.*worst = 0; since = 0; \}\s*\}/);
  });
});

describe("?speed= en el lab (#114)", () => {
  it("ausente, vacío o no numérico vale 1", () => {
    expect(speedFromSearch("")).toBe(1);
    expect(speedFromSearch("?bloom=on")).toBe(1);
    expect(speedFromSearch("?speed=")).toBe(1);
    expect(speedFromSearch("?speed")).toBe(1);
    expect(speedFromSearch("?speed=%20")).toBe(1);
    expect(speedFromSearch("?speed=abc")).toBe(1);
  });
  it("0 congela el reloj", () => {
    expect(speedFromSearch("?speed=0")).toBe(0);
    expect(speedFromSearch("?speed=-0")).toBe(0);
    expect(speedFromSearch("?bloom=off&speed=0")).toBe(0);
  });
  it("un positivo finito pasa tal cual", () => {
    expect(speedFromSearch("?speed=2.5")).toBe(2.5);
    expect(speedFromSearch("?speed=1e-3")).toBe(0.001);
    expect(speedFromSearch("?speed=%202%20")).toBe(2);
  });
  it("negativo o infinito vale 1", () => {
    expect(speedFromSearch("?speed=-1")).toBe(1);
    expect(speedFromSearch("?speed=Infinity")).toBe(1);
  });
});

describe("?speed=0 en las páginas (#114)", () => {
  const storySrc = readFileSync(`${ROOT}src/lab/storybook.ts`, "utf8");
  it("page.ts y storybook.ts leen la velocidad con speedFromSearch", () => {
    for (const src of [pageSrc, storySrc]) {
      expect(src).toMatch(/const speed = speedFromSearch\(location\.search\);/);
      expect(src).not.toMatch(/get\("speed"\)\)\s*\|\|\s*1/);
    }
  });
  it("la ayuda documenta ?speed=0", () => {
    expect(pageSrc).toMatch(/\?speed=0 congela/);
    expect(storySrc).toMatch(/\?speed=0 lo congela/);
  });
  it.each([false, true])("con el reloj congelado nada se redibuja tras el primer frame (reducedMotion %s)", (reducedMotion) => {
    const { animators } = assembleWorld(undefined, { reducedMotion });
    const dt = 33 * speedFromSearch("?speed=0");
    for (const a of animators) a.tick(dt);
    const ids = animators.flatMap((a) => Array.from({ length: 100 }, () => [...a.tick(dt)]).flat());
    expect(ids).toEqual([]);
  });
});

describe("?speed= con tope (#128)", () => {
  it("el tope es 100 y está incluido", () => {
    expect(MAX_SPEED).toBe(100);
    expect(speedFromSearch("?speed=100")).toBe(100);
    expect(speedFromSearch("?speed=99.5")).toBe(99.5);
  });
  it("por encima del tope vale 1", () => {
    expect(speedFromSearch("?speed=100.0001")).toBe(1);
    expect(speedFromSearch("?speed=1e3")).toBe(1);
    expect(speedFromSearch("?speed=1e12")).toBe(1);
    expect(speedFromSearch("?speed=1.7976931348623157e308")).toBe(1);
    expect(speedFromSearch("?speed=1e12&speed=5")).toBe(1); // URLSearchParams.get toma el primero
  });
  it("el tope se compara después de parsear con Number()", () => {
    expect(speedFromSearch("?speed=1e2")).toBe(100);
    expect(speedFromSearch("?speed=%201e2%20")).toBe(100);
    expect(speedFromSearch("?speed=100abc")).toBe(1);
  });
  it("la ayuda documenta el tope", () => {
    expect(pageSrc).toMatch(/\?speed=.*100/);
    expect(readFileSync(`${ROOT}src/lab/storybook.ts`, "utf8")).toMatch(/\?speed=[\s\S]{0,80}100/);
    expect(readFileSync(`${ROOT}README.md`, "utf8")).toMatch(/`\?speed=`[^\n]*\n?[^\n]*100/);
  });
  it.each([false, true])("a velocidad máxima un tick largo de los animadores termina pronto (reducedMotion %s)", (reducedMotion) => {
    const { animators } = assembleWorld(undefined, { reducedMotion });
    const pieces = EXHIBITS.flatMap((e) => (e.kind === "piece" && e.animate ? [e.animate({ reducedMotion })] : []));
    const dt = 100 * MAX_SPEED; // deltaMS acotado por Pixi (_maxElapsedMS) × tope
    const t0 = performance.now();
    for (let i = 0; i < 10; i++) for (const a of [...animators, ...pieces]) a.tick(dt);
    expect(performance.now() - t0).toBeLessThan(2000);
  });
});
