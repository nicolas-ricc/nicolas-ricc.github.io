import { Application, Rectangle } from "pixi.js";
import type { RenderItem } from "../iso/render-list";
import { ISO_COLORS } from "../map/palette-iso";
import type { WorldScene } from "../scenes/world";
import { assembleWorld, tag, type ZonedAnimator } from "../world/assemble";
import { afterFirstRender } from "../world/bloom";
import { attachBloom, type BloomProbe } from "../world/bloom-runtime";
import { type Box, type Fit, fitTransform } from "../world/frame";
import { type BloomMode, buildStage, type Stage, type StageLayer } from "../world/stage";
import { runBoot } from "./boot";
import { fixedScaleFit, nextCoverScale } from "./cover-scale";
import { contextAnimators, contextScene, cropAnimators, cropScene, pieceScene, readout, solidsBox } from "./crop";
import { EXHIBITS, type Exhibit, GROUPS, pickExhibit, stepExhibit } from "./exhibits";
import { contentFrame } from "./frame";
import { bloomFromSearch, nextBloomMode, speedFromSearch, tickFromSearch } from "./page";
import { buildIndex, markCurrent, mountStorybook, renderReadout } from "./storybook-ui";

/**
 * Structures storybook: one exhibit at a time, cropped from the world by its
 * box or built alone at the origin (pieces); context exhibits are the crop, plus
 * a sign built whole in world coordinates when the world does not already
 * have it. The hash picks the exhibit; arrows and j/k only write the hash.
 * 6 rotates the bloom; ?bloom= forces it and ?speed= scales the clock up to
 * 100 (?speed=0 freezes it), as in page.ts; ?tick=<ms> poses the Writing raft of a context exhibit at that
 * animation time (static, rest when absent; the stage clock cannot pose it). g, h and a
 * hide or show ground, shadows and accents (with the bloom) and are remembered
 * across exhibits. c cycles the exhibit scale: real, 1.17 and 0.83, the cover scales
 * of a laptop and a phone. The frame is the projected bounds of what is drawn (contentFrame),
 * sampling the animation 16 times over 8 s, which moves the shared clock 8 s on each exhibit
 * change (accepted); it is computed once per show; resize, c and the cover scale reuse it.
 * In development the page publishes `window.__lab` (exhibit id, cover scale and its setter,
 * bloom mode, `tickMs`, last fit, host size, `tick(dtMs)` to advance the stage and render, for
 * time-lapse checks in headless, and `pixels`, the stage's RGBA at resolution 2 with
 * filters) for `npm run legibility`.
 */
/** The DEV page hook `npm run legibility` drives: `pixels` takes host CSS px and returns base64 RGBA at resolution 2. */
export interface LabHook {
  readonly exhibitId: string | null; readonly coverScale: number | null; setCoverScale(s: number | null): void;
  readonly tickMs: number; readonly bloom: BloomMode | null; fit(): Fit | null; hostSize(): { w: number; h: number };
  tick(dtMs: number): void;
  pixels(x: number, y: number, w: number, h: number): Promise<string>;
}
declare global {
  interface Window { __lab?: LabHook }
}

mountStorybook(document, ({ host, nav, panel }) => {
  const log = import.meta.env.DEV;
  const tickMs = tickFromSearch(location.search);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const { scene, animators } = assembleWorld(undefined, { reducedMotion });

  buildIndex(nav, GROUPS, EXHIBITS);

  const LAYER_KEY: Record<string, StageLayer> = { g: "ground", h: "shadow", a: "accents" };

  void runBoot(host, "storybook", boot);

  async function boot(): Promise<void> {
    const app = new Application();
    await app.init({ resizeTo: host, background: ISO_COLORS.sky, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true });
    host.appendChild(app.canvas);
    app.ticker.maxFPS = 30;

    let stage: Stage | null = null, current: Exhibit | null = null, bloom: BloomProbe | null = null;
    let content: RenderItem[] | null = null;
    const layers: Record<StageLayer, boolean> = { ground: true, shadow: true, accents: true };
    let coverScale: number | null = null, lastFit: Fit | null = null;
    const fit = (): void => {
      if (!stage || !content) return;
      const w = host.clientWidth, h = host.clientHeight;
      const real = fitTransform(content, w, h);
      const f = coverScale === null ? real : fixedScaleFit(real, w, h, coverScale);
      stage.container.position.set(f.x, f.y);
      stage.container.scale.set(f.scale);
      lastFit = f;
    };
    const show = (e: Exhibit): void => {
      const mode = stage?.bloom ?? "off";
      stage?.destroy();
      const t0 = performance.now();
      let src: [WorldScene, ZonedAnimator[]], opts: { box: Box; h?: number; clip?: Box };
      if (e.kind === "region") {
        // the same box for both: the crop memo is keyed by Box identity
        src = [cropScene(scene, e.box), cropAnimators(animators, e.box)];
        opts = { box: e.box, h: e.h, clip: e.box };
      } else if (e.kind === "context") {
        src = [contextScene(scene, e, tickMs), contextAnimators(animators, e)];
        opts = { box: e.box, h: e.h, clip: e.box };
      } else {
        const piece = pieceScene(e.build, e.pad);
        src = [piece, e.animate ? [tag(e.animate({ reducedMotion }), e.zone)] : []];
        opts = solidsBox([...piece.ground, ...piece.solids]);
      }
      // before buildStage: it draws each animated layer once, so it starts from the sampled state
      const tf = performance.now();
      content = contentFrame(src[0], src[1], opts);
      const frameMs = performance.now() - tf;
      stage = buildStage(...src, { clip: opts.clip });
      app.stage.addChild(stage.container);
      for (const l of Object.keys(layers) as StageLayer[]) stage.setLayer(l, layers[l]);
      if (log) console.info(`[storybook] ${e.id}: first draw ${(performance.now() - t0 - frameMs).toFixed(1)} ms (frame ${frameMs.toFixed(1)} ms), ${stage.staticCount} static polygons`);
      renderReadout(panel, readout(...src));
      stage.setBloom(mode);
      current = e;
      fit();
      markCurrent(nav, e.id);
    };
    const fromHash = (): void => {
      const e = pickExhibit(location.hash);
      if (location.hash !== `#${e.id}`) history.replaceState(null, "", `#${e.id}`);
      if (e !== current) show(e);
    };
    fromHash();
    if (import.meta.env.DEV) {
      window.__lab = {
        get exhibitId() { return current?.id ?? null; },
        get coverScale() { return coverScale; },
        setCoverScale(s) { coverScale = s; fit(); },
        tickMs,
        get bloom() { return stage?.bloom ?? null; },
        fit: () => lastFit,
        tick(dtMs) { stage?.tick(dtMs); app.render(); },
        hostSize: () => ({ w: host.clientWidth, h: host.clientHeight }),
        async pixels(x, y, w, h) {
          const { pixels } = app.renderer.extract.pixels({ target: app.stage, frame: new Rectangle(x, y, w, h), resolution: 2, clearColor: ISO_COLORS.sky, antialias: true });
          let bin = "";
          for (let i = 0; i < pixels.length; i += 0x8000) bin += String.fromCharCode(...pixels.subarray(i, i + 0x8000));
          return btoa(bin);
        },
      };
    }
    window.addEventListener("hashchange", fromHash);
    app.renderer.on("resize", fit);
    // deferred like page.ts; later stages inherit the mode in show()
    // attachBloom keeps the stage and applies the verdict later: pass it the live one, not the first (which is destroyed on change)
    const live = { get bloom() { return stage!.bloom; }, setBloom(m: BloomMode) { stage!.setBloom(m); } };
    afterFirstRender(app.renderer.runners.postrender, () => { bloom = attachBloom({ app, stage: live, log, prefix: "storybook", force: bloomFromSearch(location.search) }); });

    const NEXT = new Set(["ArrowRight", "ArrowDown", "j"]), PREV = new Set(["ArrowLeft", "ArrowUp", "k"]);
    window.addEventListener("keydown", (ev) => {
      if (ev.altKey || ev.ctrlKey || ev.metaKey) return; // Alt/Cmd + arrow is the browser's back/forward
      if (current && (NEXT.has(ev.key) || PREV.has(ev.key))) { ev.preventDefault(); location.hash = stepExhibit(current.id, NEXT.has(ev.key) ? 1 : -1).id; }
      const layer = LAYER_KEY[ev.key];
      if (layer && stage && !ev.repeat) { layers[layer] = !layers[layer]; stage.setLayer(layer, layers[layer]); if (log) console.info(`[storybook] ${layer}: ${layers[layer] ? "visible" : "hidden"}`); }
      if (ev.key === "c" && !ev.repeat) { coverScale = nextCoverScale(coverScale); fit(); if (log) console.info(`[storybook] cover scale: ${coverScale ?? "real"}`); }
      if (ev.key === "6" && stage) { stage.setBloom(nextBloomMode(stage.bloom)); if (log) console.info(`[storybook] bloom by hand: ${stage.bloom}`); }
    });

    const speed = speedFromSearch(location.search);
    let worst = 0, since = 0;
    app.ticker.add((ticker) => {
      if (!stage) return;
      const t = performance.now();
      stage.tick(ticker.deltaMS * speed);
      const dt = performance.now() - t;
      bloom?.tick(dt);
      if (log) {
        worst = Math.max(worst, dt);
        since += ticker.deltaMS;
        if (since > 5000) { console.info(`[storybook] worst redraw in 5 s: ${worst.toFixed(2)} ms`); worst = 0; since = 0; }
      }
    });
  }
});
