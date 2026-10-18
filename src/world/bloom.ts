/** Presupuesto del bloom: promedio de tick + render por frame, medido con el bloom activo (#18). */
export const BLOOM_BUDGET_MS = 15, BLOOM_SAMPLE_FRAMES = 60;

export interface BloomSample { tickMs: number; renderMs: number }
export interface BloomVerdict { frames: number; avgMs: number; avgTickMs: number; avgRenderMs: number; mode: "on" | "fallback" }

/** Acumula muestras; devuelve el veredicto al completar `frames`, antes `null`. Después, siempre `null`: una decisión por carga. */
export function createBloomBudget(opts: { frames?: number; budgetMs?: number } = {}): { sample(s: BloomSample): BloomVerdict | null } {
  const frames = opts.frames ?? BLOOM_SAMPLE_FRAMES, budgetMs = opts.budgetMs ?? BLOOM_BUDGET_MS;
  let n = 0, tick = 0, render = 0;
  return {
    sample(s) {
      if (n >= frames) return null;
      n++; tick += s.tickMs; render += s.renderMs;
      if (n < frames) return null;
      const avgTickMs = tick / n, avgRenderMs = render / n, avgMs = avgTickMs + avgRenderMs;
      return { frames: n, avgMs, avgTickMs, avgRenderMs, mode: avgMs > budgetMs ? "fallback" : "on" };
    },
  };
}

/** El texto del log después de "bloom: ". */
export function formatBloomVerdict(v: BloomVerdict, budgetMs: number): string {
  return `promedio ${v.avgMs.toFixed(1)} ms en ${v.frames} frames (tick ${v.avgTickMs.toFixed(1)} + render ${v.avgRenderMs.toFixed(1)}), presupuesto ${budgetMs} ms → ${v.mode === "on" ? "activo" : "fallback"}`;
}

/**
 * Corre `fn` cuando el navegador esté ocioso (a más tardar en 1 s). Sin `requestIdleCallback`, en la tarea
 * siguiente al próximo frame: el `setTimeout` deja que ese frame se pinte sin el bloom. Sin rAF, en la próxima tarea.
 */
export function scheduleIdle(fn: () => void): void {
  if (typeof requestIdleCallback === "function") requestIdleCallback(fn, { timeout: 1000 });
  else if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => setTimeout(fn, 0));
  else setTimeout(fn, 0);
}
