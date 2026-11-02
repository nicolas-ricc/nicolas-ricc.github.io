import { Application } from "pixi.js";
import { ISO_COLORS } from "../map/palette-iso";
import type { WorldScene } from "../scenes/world";
import { assembleWorld, tag, type ZonedAnimator } from "../world/assemble";
import { afterFirstRender } from "../world/bloom";
import { attachBloom, type BloomProbe } from "../world/bloom-runtime";
import { type Box, boxFrame, fitTransform } from "../world/frame";
import { type BloomMode, buildStage, type Stage, type StageLayer } from "../world/stage";
import { runBoot } from "./boot";
import { cropAnimators, cropScene, pieceScene, readout, solidsBox } from "./crop";
import { EXHIBITS, type Exhibit, GROUPS, pickExhibit, stepExhibit } from "./exhibits";
import { bloomFromSearch, nextBloomMode, speedFromSearch } from "./page";
import { buildIndex, markCurrent, mountStorybook, renderReadout } from "./storybook-ui";

/**
 * Structures storybook: one exhibit at a time, cropped from the world by its
 * box or built alone at the origin (pieces). The hash picks the exhibit; arrows
 * and j/k only write the hash. 6 rotates the bloom; ?bloom= forces it and ?speed=
 * scales the clock up to 100 (?speed=0 freezes it), as in page.ts. g, h and a
 * hide or show ground, shadows and accents (with the bloom) and are remembered
 * across exhibits.
 */
mountStorybook(document, ({ host, nav, panel }) => {
  const log = import.meta.env.DEV;
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
    let frame: { box: Box; h?: number } | null = null;
    const layers: Record<StageLayer, boolean> = { ground: true, shadow: true, accents: true };
    const fit = (): void => {
      if (!stage || !frame) return;
      const f = fitTransform(boxFrame(frame.box, frame.h), host.clientWidth, host.clientHeight);
      stage.container.position.set(f.x, f.y);
      stage.container.scale.set(f.scale);
    };
    const show = (e: Exhibit): void => {
      const mode = stage?.bloom ?? "off";
      stage?.destroy();
      const t0 = performance.now();
      let src: [WorldScene, ZonedAnimator[]];
      if (e.kind === "region") {
        // the same box for both: the crop memo is keyed by Box identity
        src = [cropScene(scene, e.box), cropAnimators(animators, e.box)];
        stage = buildStage(...src);
        frame = { box: e.box, h: e.h };
      } else {
        const piece = pieceScene(e.build, e.pad);
        src = [piece, e.animate ? [tag(e.animate({ reducedMotion }), e.zone)] : []];
        stage = buildStage(...src);
        frame = solidsBox([...piece.ground, ...piece.solids]);
      }
      app.stage.addChild(stage.container);
      for (const l of Object.keys(layers) as StageLayer[]) stage.setLayer(l, layers[l]);
      if (log) console.info(`[storybook] ${e.id}: first draw ${(performance.now() - t0).toFixed(1)} ms, ${stage.staticCount} static polygons`);
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
