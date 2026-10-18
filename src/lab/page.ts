import { Application } from "pixi.js";
import type { WorldZone } from "../map/geo";
import { ISO_COLORS } from "../map/palette-iso";
import { assembleWorld } from "../world/assemble";
import { scheduleIdle } from "../world/bloom";
import { attachBloom, type BloomProbe } from "../world/bloom-runtime";
import { coverFrame, fitTransform, type Frame, zoneFrame } from "../world/frame";
import { type BloomMode, buildStage } from "../world/stage";
import { WORLD_ZONES } from "../world/veil";
import { runBoot } from "./boot";

const KEY_ZONE: Record<string, Frame> = { "0": "all", "1": "portfolio", "2": "cv", "3": "blog", "4": "cover" };

const BLOOM_CYCLE: readonly BloomMode[] = ["off", "on", "fallback"];

/** `?bloom=on|off|fallback` fuerza el modo de bloom; cualquier otro valor no fuerza nada. */
export function bloomFromSearch(search: string): BloomMode | null {
  const v = new URLSearchParams(search).get("bloom");
  return BLOOM_CYCLE.find((m) => m === v) ?? null;
}

export function nextBloomMode(mode: BloomMode): BloomMode {
  return BLOOM_CYCLE[(BLOOM_CYCLE.indexOf(mode) + 1) % BLOOM_CYCLE.length]!;
}

/**
 * Una página del laboratorio: el mundo (o algunas zonas), sus animadores y el
 * encuadre inicial. Teclas 0..3 encuadran mundo, Portfolio, Resume y Blog; 4
 * el cover 16:9; 5 rota el foco (velo) entre ninguno, Portfolio, Resume y Blog;
 * 6 rota el bloom entre off, on y fallback (`?bloom=on|off|fallback` lo fuerza al cargar; sin parámetro se mide y decide solo).
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
    if (log) console.info(`[lab] primer dibujo: ${(performance.now() - t0).toFixed(1)} ms, ${stage.staticCount} polígonos estáticos`);

    let current = frame;
    const fit = (): void => {
      // cover toca el borde del sangrado en sus cuatro esquinas: con margen se asoma el cielo justo ahí.
      const items = current === "cover" ? coverFrame(16 / 9) : zoneFrame(current);
      const f = fitTransform(items, host.clientWidth, host.clientHeight, current === "cover" ? 0 : undefined);
      stage.container.position.set(f.x, f.y);
      stage.container.scale.set(f.scale);
    };
    fit();
    // diferido igual que el sitio; ?bloom= fuerza el modo y no mide
    let bloom: BloomProbe | null = null;
    scheduleIdle(() => { bloom = attachBloom({ app, stage, log, prefix: "lab", force: bloomFromSearch(location.search) }); });
    app.renderer.on("resize", fit);
    const focusCycle: (WorldZone | null)[] = [null, ...WORLD_ZONES];
    let focusIdx = 0;
    window.addEventListener("keydown", (e) => {
      const z = KEY_ZONE[e.key];
      if (z) { current = z; fit(); }
      if (e.key === "5") { focusIdx = (focusIdx + 1) % focusCycle.length; stage.setFocus(focusCycle[focusIdx]!); }
      if (e.key === "6") { stage.setBloom(nextBloomMode(stage.bloom)); if (log) console.info(`[lab] bloom a mano: ${stage.bloom}`); }
    });

    // ?speed=0.1 ralentiza el reloj de los animadores (revisión de materiales en cámara lenta); solo el laboratorio.
    const speed = Number(new URLSearchParams(location.search).get("speed")) || 1;
    let worst = 0, since = 0;
    app.ticker.add((ticker) => {
      const t = performance.now();
      stage.tick(ticker.deltaMS * speed);
      const dt = performance.now() - t;
      bloom?.tick(dt);
      if (log) {
        worst = Math.max(worst, dt);
        since += ticker.deltaMS;
        if (since > 5000) { console.info(`[lab] peor redibujo en 5 s: ${worst.toFixed(2)} ms`); worst = 0; since = 0; }
      }
    });
  }
}
