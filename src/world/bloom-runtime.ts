import type { SystemRunner } from "pixi.js";
import { BLOOM_BUDGET_MS, createBloomBudget, formatBloomVerdict } from "./bloom";
import type { BloomMode, Stage } from "./stage";

/** El llamador pasa en cada frame el tiempo de CPU de `stage.tick`, que ya mide para su log. */
export interface BloomProbe { tick(ms: number): void }

interface BloomApp { renderer: { runners: { prerender: SystemRunner; postrender: SystemRunner } } }

/**
 * Activa el bloom y mide 60 frames: tick (lo pasa el llamador) + render (`postrender − prerender`).
 * Si el promedio supera el presupuesto pasa a `fallback`. Con `force` aplica ese modo y no mide.
 */
export function attachBloom(opts: { app: BloomApp; stage: Pick<Stage, "bloom" | "setBloom">; log: boolean; prefix: string; force?: BloomMode | null }): BloomProbe {
  const { app, stage, log, prefix, force } = opts;
  if (force) {
    stage.setBloom(force);
    if (log) console.info(`[${prefix}] bloom forzado por URL: ${force}`);
    return { tick() {} };
  }
  stage.setBloom("on");
  const budget = createBloomBudget();
  const { prerender, postrender } = app.renderer.runners;
  let t0 = 0, pendingTick = 0;
  const pre = { prerender() { t0 = performance.now(); } };
  const post = {
    postrender() {
      const v = budget.sample({ tickMs: pendingTick, renderMs: performance.now() - t0 });
      pendingTick = 0;
      if (!v) return;
      prerender.remove(pre);
      postrender.remove(post);
      // la tecla 6 del lab pudo cambiar el modo durante la medición: no se pisa
      if (stage.bloom === "on") stage.setBloom(v.mode);
      if (log) console.info(`[${prefix}] bloom: ${formatBloomVerdict(v, BLOOM_BUDGET_MS)}`);
    },
  };
  prerender.add(pre);
  postrender.add(post);
  return { tick(ms) { pendingTick = ms; } };
}
