import { afterEach, describe, expect, it, vi } from "vitest";
import { afterFirstRender, BLOOM_BUDGET_MS, BLOOM_SAMPLE_FRAMES, createBloomBudget, formatBloomVerdict, type BloomVerdict } from "./bloom";

const feed = (b: ReturnType<typeof createBloomBudget>, n: number, tickMs: number, renderMs: number) => {
  let v: BloomVerdict | null = null;
  for (let i = 0; i < n; i++) v = b.sample({ tickMs, renderMs });
  return v;
};

describe("createBloomBudget", () => {
  it("budget 15 ms over 60 frames by default", () => {
    expect(BLOOM_BUDGET_MS).toBe(15);
    expect(BLOOM_SAMPLE_FRAMES).toBe(60);
  });
  it("returns null for the first 59 samples and the verdict on the 60th", () => {
    const b = createBloomBudget();
    expect(feed(b, 59, 1, 1)).toBeNull();
    expect(b.sample({ tickMs: 1, renderMs: 1 })).not.toBeNull();
  });
  it("averages tick, render and their sum", () => {
    const b = createBloomBudget({ frames: 4 });
    b.sample({ tickMs: 1, renderMs: 4 });
    b.sample({ tickMs: 3, renderMs: 6 });
    b.sample({ tickMs: 2, renderMs: 8 });
    expect(b.sample({ tickMs: 2, renderMs: 2 })).toEqual({ frames: 4, avgMs: 7, avgTickMs: 2, avgRenderMs: 5, mode: "on" });
  });
  it("> budget → fallback; = budget → on", () => {
    expect(feed(createBloomBudget(), 60, 5, 10.01)!.mode).toBe("fallback");
    expect(feed(createBloomBudget(), 60, 5, 10)!.mode).toBe("on");
    expect(feed(createBloomBudget({ frames: 2, budgetMs: 4 }), 2, 2, 2.5)!.mode).toBe("fallback");
  });
  it("a single decision: after the verdict it returns null", () => {
    const b = createBloomBudget({ frames: 2 });
    expect(feed(b, 2, 1, 1)).not.toBeNull();
    expect(feed(b, 5, 1, 1)).toBeNull();
  });
});

describe("formatBloomVerdict", () => {
  it("on and fallback, one decimal", () => {
    expect(formatBloomVerdict({ frames: 60, avgMs: 12.34, avgTickMs: 4.12, avgRenderMs: 8.22, mode: "on" }, 15))
      .toBe("average 12.3 ms over 60 frames (tick 4.1 + render 8.2), budget 15 ms → on");
    expect(formatBloomVerdict({ frames: 60, avgMs: 31, avgTickMs: 6, avgRenderMs: 25, mode: "fallback" }, 15))
      .toBe("average 31.0 ms over 60 frames (tick 6.0 + render 25.0), budget 15 ms → fallback");
  });
});

type PostrenderListener = { postrender(): void };
const fakeRunner = () => {
  const items: PostrenderListener[] = [];
  return {
    items,
    add(l: PostrenderListener) { items.push(l); },
    remove(l: PostrenderListener) { const i = items.indexOf(l); if (i >= 0) items.splice(i, 1); },
    // same loop as Pixi's SystemRunner.emit: length captured up front
    emit() { for (let i = 0, len = items.length; i < len; i++) items[i]!.postrender(); },
  };
};

describe("afterFirstRender", () => {
  afterEach(() => { vi.useRealTimers(); });
  it("does not run fn before any postrender, nor synchronously inside the first one", () => {
    vi.useFakeTimers();
    const runner = fakeRunner(), fn = vi.fn();
    afterFirstRender(runner, fn);
    vi.advanceTimersByTime(0);
    expect(fn).not.toHaveBeenCalled();
    runner.emit();
    expect(fn).not.toHaveBeenCalled();
  });
  it("runs fn once in the task after the first postrender", async () => {
    vi.useFakeTimers();
    const runner = fakeRunner(), fn = vi.fn();
    afterFirstRender(runner, fn);
    runner.emit();
    await Promise.resolve();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(fn).toHaveBeenCalledOnce();
  });
  it("a second postrender before the task does not schedule fn twice", () => {
    vi.useFakeTimers();
    const runner = fakeRunner(), fn = vi.fn();
    afterFirstRender(runner, fn);
    runner.emit();
    runner.emit();
    vi.advanceTimersByTime(0);
    expect(fn).toHaveBeenCalledOnce();
  });
  it("detaches itself after the first postrender", async () => {
    vi.useFakeTimers();
    const runner = fakeRunner(), fn = vi.fn();
    afterFirstRender(runner, fn);
    runner.emit();
    await Promise.resolve();
    expect(runner.items).toHaveLength(0);
    runner.emit();
    vi.advanceTimersByTime(0);
    expect(fn).toHaveBeenCalledOnce();
  });
  it("detaching does not skip a listener added after it", async () => {
    vi.useFakeTimers();
    const runner = fakeRunner(), other = { postrender: vi.fn() };
    afterFirstRender(runner, () => {});
    runner.add(other);
    runner.emit();
    await Promise.resolve();
    runner.emit();
    expect(other.postrender).toHaveBeenCalledTimes(2);
  });
});
