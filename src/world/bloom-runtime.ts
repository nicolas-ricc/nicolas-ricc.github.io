import type { SystemRunner } from "pixi.js";
import { BLOOM_BUDGET_MS, createBloomBudget, formatBloomVerdict } from "./bloom";
import type { BloomMode, Stage } from "./stage";

/** The caller passes in every frame the CPU time of `stage.tick`, which it already measures for its log. */
export interface BloomProbe { tick(ms: number): void }

interface BloomApp { renderer: { runners: { prerender: SystemRunner; postrender: SystemRunner } } }

/**
 * Turns the bloom on and measures 60 frames: tick (passed by the caller) + render (`postrender − prerender`).
 * If the average exceeds the budget it switches to `fallback`. With `force` it applies that mode and does not measure;
 * if the `Stage` is no longer `off` (changed by hand), it respects that and does not measure either.
 */
export function attachBloom(opts: { app: BloomApp; stage: Pick<Stage, "bloom" | "setBloom">; log: boolean; prefix: string; force?: BloomMode | null }): BloomProbe {
  const { app, stage, log, prefix, force } = opts;
  if (force) {
    stage.setBloom(force);
    if (log) console.info(`[${prefix}] bloom forced by URL: ${force}`);
    return { tick() {} };
  }
  if (stage.bloom !== "off") return { tick() {} };
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
      // removing inside `emit` skips the next listener and breaks the runner's loop: defer it
      queueMicrotask(() => { prerender.remove(pre); postrender.remove(post); });
      // if the mode was changed by hand during the measurement, it is not overwritten
      if (stage.bloom === "on") stage.setBloom(v.mode);
      if (log) console.info(`[${prefix}] bloom: ${formatBloomVerdict(v, BLOOM_BUDGET_MS)}`);
    },
  };
  prerender.add(pre);
  postrender.add(post);
  return { tick(ms) { pendingTick = ms; } };
}
