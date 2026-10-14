import { afterEach, describe, expect, it, vi } from "vitest";
import { BLOOM_BUDGET_MS, BLOOM_SAMPLE_FRAMES, createBloomBudget, formatBloomVerdict, scheduleIdle, type BloomVerdict } from "./bloom";

const feed = (b: ReturnType<typeof createBloomBudget>, n: number, tickMs: number, renderMs: number) => {
  let v: BloomVerdict | null = null;
  for (let i = 0; i < n; i++) v = b.sample({ tickMs, renderMs });
  return v;
};

describe("createBloomBudget", () => {
  it("presupuesto 15 ms en 60 frames por defecto", () => {
    expect(BLOOM_BUDGET_MS).toBe(15);
    expect(BLOOM_SAMPLE_FRAMES).toBe(60);
  });
  it("devuelve null las primeras 59 muestras y el veredicto en la 60", () => {
    const b = createBloomBudget();
    expect(feed(b, 59, 1, 1)).toBeNull();
    expect(b.sample({ tickMs: 1, renderMs: 1 })).not.toBeNull();
  });
  it("promedia tick, render y su suma", () => {
    const b = createBloomBudget({ frames: 4 });
    b.sample({ tickMs: 1, renderMs: 4 });
    b.sample({ tickMs: 3, renderMs: 6 });
    b.sample({ tickMs: 2, renderMs: 8 });
    expect(b.sample({ tickMs: 2, renderMs: 2 })).toEqual({ frames: 4, avgMs: 7, avgTickMs: 2, avgRenderMs: 5, mode: "on" });
  });
  it("> presupuesto → fallback; = presupuesto → on", () => {
    expect(feed(createBloomBudget(), 60, 5, 10.01)!.mode).toBe("fallback");
    expect(feed(createBloomBudget(), 60, 5, 10)!.mode).toBe("on");
    expect(feed(createBloomBudget({ frames: 2, budgetMs: 4 }), 2, 2, 2.5)!.mode).toBe("fallback");
  });
  it("una sola decisión: después del veredicto devuelve null", () => {
    const b = createBloomBudget({ frames: 2 });
    expect(feed(b, 2, 1, 1)).not.toBeNull();
    expect(feed(b, 5, 1, 1)).toBeNull();
  });
});

describe("formatBloomVerdict", () => {
  it("activo y fallback, un decimal", () => {
    expect(formatBloomVerdict({ frames: 60, avgMs: 12.34, avgTickMs: 4.12, avgRenderMs: 8.22, mode: "on" }, 15))
      .toBe("promedio 12.3 ms en 60 frames (tick 4.1 + render 8.2), presupuesto 15 ms → activo");
    expect(formatBloomVerdict({ frames: 60, avgMs: 31, avgTickMs: 6, avgRenderMs: 25, mode: "fallback" }, 15))
      .toBe("promedio 31.0 ms en 60 frames (tick 6.0 + render 25.0), presupuesto 15 ms → fallback");
  });
});

describe("scheduleIdle", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  it("usa requestIdleCallback con timeout 1000 si existe", () => {
    const ric = vi.fn();
    vi.stubGlobal("requestIdleCallback", ric);
    const fn = () => {};
    scheduleIdle(fn);
    expect(ric).toHaveBeenCalledWith(fn, { timeout: 1000 });
  });
  it("si no, setTimeout 0: no corre en el acto", () => {
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.useFakeTimers();
    const fn = vi.fn();
    scheduleIdle(fn);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(fn).toHaveBeenCalledOnce();
  });
});
