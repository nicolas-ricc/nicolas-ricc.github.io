import { SystemRunner } from "pixi.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { attachBloom } from "./bloom-runtime";
import type { BloomMode } from "./stage";

const fakeApp = () => ({ renderer: { runners: { prerender: new SystemRunner("prerender"), postrender: new SystemRunner("postrender") } } });
const fakeStage = () => {
  const s = { bloom: "off" as BloomMode, setBloom: vi.fn((m: BloomMode) => { s.bloom = m; }) };
  return s;
};
let now = 0;
/** Un frame: tick (si se pasa) y luego render de `renderMs`. */
const frame = (app: ReturnType<typeof fakeApp>, probe: { tick(ms: number): void }, tickMs: number | null, renderMs: number) => {
  if (tickMs !== null) probe.tick(tickMs);
  app.renderer.runners.prerender.emit();
  now += renderMs;
  app.renderer.runners.postrender.emit();
};

describe("attachBloom", () => {
  afterEach(() => { vi.restoreAllMocks(); });
  const setup = () => {
    now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    return { app: fakeApp(), stage: fakeStage(), info };
  };

  it("activa on al adjuntar y queda on si el promedio entra en el presupuesto", () => {
    const { app, stage, info } = setup();
    const probe = attachBloom({ app, stage, log: true, prefix: "mapa" });
    expect(stage.bloom).toBe("on");
    for (let i = 0; i < 59; i++) frame(app, probe, 4, 8);
    expect(info).not.toHaveBeenCalled();
    frame(app, probe, 4, 8);
    expect(stage.bloom).toBe("on");
    expect(info).toHaveBeenCalledWith("[mapa] bloom: promedio 12.0 ms en 60 frames (tick 4.0 + render 8.0), presupuesto 15 ms → activo");
  });

  it("pasa a fallback si el promedio supera 15 ms", () => {
    const { app, stage, info } = setup();
    const probe = attachBloom({ app, stage, log: true, prefix: "lab" });
    for (let i = 0; i < 60; i++) frame(app, probe, 6, 10);
    expect(stage.setBloom).toHaveBeenLastCalledWith("fallback");
    expect(stage.bloom).toBe("fallback");
    expect(info).toHaveBeenCalledWith("[lab] bloom: promedio 16.0 ms en 60 frames (tick 6.0 + render 10.0), presupuesto 15 ms → fallback");
  });

  it("se descuelga de los runners tras el veredicto: una sola decisión", () => {
    const { app, stage } = setup();
    const probe = attachBloom({ app, stage, log: false, prefix: "mapa" });
    for (let i = 0; i < 60; i++) frame(app, probe, 6, 10);
    expect(app.renderer.runners.prerender.items).toHaveLength(0);
    expect(app.renderer.runners.postrender.items).toHaveLength(0);
    stage.setBloom.mockClear();
    for (let i = 0; i < 120; i++) frame(app, probe, 1, 1);
    expect(stage.setBloom).not.toHaveBeenCalled();
  });

  it("un render sin tick previo cuenta tick 0, no el del frame anterior", () => {
    const { app, stage, info } = setup();
    const probe = attachBloom({ app, stage, log: true, prefix: "mapa" });
    for (let i = 0; i < 30; i++) { frame(app, probe, 10, 2); frame(app, probe, null, 2); }
    expect(info).toHaveBeenCalledWith("[mapa] bloom: promedio 7.0 ms en 60 frames (tick 5.0 + render 2.0), presupuesto 15 ms → activo");
  });

  it("si el modo cambió a mano durante la medición, el veredicto no lo pisa", () => {
    const { app, stage } = setup();
    const probe = attachBloom({ app, stage, log: false, prefix: "lab" });
    stage.setBloom("off");
    for (let i = 0; i < 60; i++) frame(app, probe, 20, 20);
    expect(stage.bloom).toBe("off");
  });

  it("sin log no escribe en consola", () => {
    const { app, stage, info } = setup();
    const probe = attachBloom({ app, stage, log: false, prefix: "mapa" });
    for (let i = 0; i < 60; i++) frame(app, probe, 1, 1);
    expect(info).not.toHaveBeenCalled();
  });

  it("forzado: aplica el modo, loguea el forzado y no mide", () => {
    const { app, stage, info } = setup();
    const probe = attachBloom({ app, stage, log: true, prefix: "lab", force: "fallback" });
    expect(stage.setBloom).toHaveBeenCalledExactlyOnceWith("fallback");
    expect(info).toHaveBeenCalledExactlyOnceWith("[lab] bloom forzado por URL: fallback");
    expect(app.renderer.runners.prerender.items).toHaveLength(0);
    for (let i = 0; i < 60; i++) frame(app, probe, 20, 20);
    expect(stage.setBloom).toHaveBeenCalledOnce();
  });
});
