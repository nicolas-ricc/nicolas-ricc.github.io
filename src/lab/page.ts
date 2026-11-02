import { Application } from "pixi.js";
import type { WorldZone } from "../map/geo";
import { ISO_COLORS } from "../map/palette-iso";
import { assembleWorld } from "../world/assemble";
import { afterFirstRender } from "../world/bloom";
import { attachBloom, type BloomProbe } from "../world/bloom-runtime";
import { coverFrame, fitTransform, type Frame, zoneFrame } from "../world/frame";
import { type BloomMode, buildStage } from "../world/stage";
import { WORLD_ZONES } from "../world/veil";
import { runBoot } from "./boot";

const KEY_ZONE: Record<string, Frame> = { "0": "all", "1": "portfolio", "2": "cv", "3": "blog", "4": "cover" };

const BLOOM_CYCLE: readonly BloomMode[] = ["off", "on", "fallback"];

/** `?bloom=on|off|fallback` forces the bloom mode; any other value forces nothing. */
export function bloomFromSearch(search: string): BloomMode | null {
  const v = new URLSearchParams(search).get("bloom");
  return BLOOM_CYCLE.find((m) => m === v) ?? null;
}

/** Cap of `?speed=`: a huge value would freeze the tab (the animators iterate in proportion to `dt`). */
export const MAX_SPEED = 100;

/** `?speed=` scales the animators' clock, from 0 (freezes it) to `MAX_SPEED`. Absent, empty, non-numeric, negative, infinite or above the cap: 1. */
export function speedFromSearch(search: string): number {
  const v = new URLSearchParams(search).get("speed")?.trim();
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= MAX_SPEED ? n + 0 : 1; // + 0 turns -0 into 0
}

export function nextBloomMode(mode: BloomMode): BloomMode {
  return BLOOM_CYCLE[(BLOOM_CYCLE.indexOf(mode) + 1) % BLOOM_CYCLE.length]!;
}

/**
 * A lab page: the world (or some zones), its animators and the initial
 * framing. Keys 0..3 frame world, Portfolio, Resume and Blog; 4 the 16:9
 * cover; 5 rotates the focus (veil) among none, Portfolio, Resume and Blog;
 * 6 rotates the bloom among off, on and fallback (`?bloom=on|off|fallback` forces it on load; with no parameter it measures and decides by itself).
 * `?speed=` scales the animators' clock (up to 100) and `?speed=0` freezes it.
 */
export function bootWorldPage(zones: readonly WorldZone[] | undefined, frame: Frame): void {
  const host = document.getElementById("lab-host") as HTMLDivElement;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const log = import.meta.env.DEV;
  const { scene, animators } = assembleWorld(zones, { reducedMotion });
  void runBoot(host, "lab", boot);

  async function boot(): Promise<void> {
    const app = new Application();
    await app.init({ resizeTo: host, background: ISO_COLORS.sky, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true });
    host.appendChild(app.canvas);
    app.ticker.maxFPS = 30;

    const t0 = performance.now();
    const stage = buildStage(scene, animators);
    app.stage.addChild(stage.container);
    if (log) console.info(`[lab] first draw: ${(performance.now() - t0).toFixed(1)} ms, ${stage.staticCount} static polygons`);

    let current = frame;
    const fit = (): void => {
      // cover touches the bleed edge at its four corners: with a margin the sky peeks through right there.
      const items = current === "cover" ? coverFrame(16 / 9) : zoneFrame(current);
      const f = fitTransform(items, host.clientWidth, host.clientHeight, current === "cover" ? 0 : undefined);
      stage.container.position.set(f.x, f.y);
      stage.container.scale.set(f.scale);
    };
    fit();
    // deferred like the site; ?bloom= forces the mode and skips measuring
    let bloom: BloomProbe | null = null;
    afterFirstRender(app.renderer.runners.postrender, () => { bloom = attachBloom({ app, stage, log, prefix: "lab", force: bloomFromSearch(location.search) }); });
    app.renderer.on("resize", fit);
    const focusCycle: (WorldZone | null)[] = [null, ...WORLD_ZONES];
    let focusIdx = 0;
    window.addEventListener("keydown", (e) => {
      const z = KEY_ZONE[e.key];
      if (z) { current = z; fit(); }
      if (e.key === "5") { focusIdx = (focusIdx + 1) % focusCycle.length; stage.setFocus(focusCycle[focusIdx]!); }
      if (e.key === "6") { stage.setBloom(nextBloomMode(stage.bloom)); if (log) console.info(`[lab] bloom by hand: ${stage.bloom}`); }
    });

    // ?speed=0.1 slows the animators' clock (material review in slow motion) and ?speed=0 freezes the frame; lab only.
    const speed = speedFromSearch(location.search);
    let worst = 0, since = 0;
    app.ticker.add((ticker) => {
      const t = performance.now();
      stage.tick(ticker.deltaMS * speed);
      const dt = performance.now() - t;
      bloom?.tick(dt);
      if (log) {
        worst = Math.max(worst, dt);
        since += ticker.deltaMS;
        if (since > 5000) { console.info(`[lab] worst redraw in 5 s: ${worst.toFixed(2)} ms`); worst = 0; since = 0; }
      }
    });
  }
}
