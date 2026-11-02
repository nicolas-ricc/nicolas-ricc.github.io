import { Application } from "pixi.js";
import { ISO_COLORS } from "../map/palette-iso";
import type { WorldScene } from "../scenes/world";
import { assembleWorld, tag, type ZonedAnimator } from "../world/assemble";
import { scheduleIdle } from "../world/bloom";
import { attachBloom, type BloomProbe } from "../world/bloom-runtime";
import { type Box, boxFrame, fitTransform } from "../world/frame";
import { type BloomMode, buildStage, type Stage, type StageLayer } from "../world/stage";
import { runBoot } from "./boot";
import { cropAnimators, cropScene, pieceScene, readout, solidsBox } from "./crop";
import { EXHIBITS, type Exhibit, GROUPS, pickExhibit, stepExhibit } from "./exhibits";
import { bloomFromSearch, nextBloomMode, speedFromSearch } from "./page";
import { buildIndex, markCurrent, mountStorybook, renderReadout } from "./storybook-ui";

/**
 * Storybook de estructuras: un exhibit a la vez, recortado del mundo por su
 * caja o armado solo en el origen (piezas). El hash elige el exhibit; flechas
 * y j/k solo escriben el hash. 6 rota el bloom; ?bloom= lo fuerza y ?speed=
 * escala el reloj hasta 100 (?speed=0 lo congela), como en page.ts. g, h y a
 * ocultan o muestran suelo, sombras y acentos (con el bloom) y se recuerdan
 * entre exhibits.
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
        // la misma caja a ambos: el memo del recorte se indexa por identidad de Box
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
      if (log) console.info(`[storybook] ${e.id}: primer dibujo ${(performance.now() - t0).toFixed(1)} ms, ${stage.staticCount} polígonos estáticos`);
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
    // diferido como en page.ts; los stages siguientes heredan el modo en show()
    // attachBloom guarda el stage y aplica el veredicto más tarde: se le pasa el vigente, no el primero (que se destruye al cambiar)
    const live = { get bloom() { return stage!.bloom; }, setBloom(m: BloomMode) { stage!.setBloom(m); } };
    scheduleIdle(() => { bloom = attachBloom({ app, stage: live, log, prefix: "storybook", force: bloomFromSearch(location.search) }); });

    const NEXT = new Set(["ArrowRight", "ArrowDown", "j"]), PREV = new Set(["ArrowLeft", "ArrowUp", "k"]);
    window.addEventListener("keydown", (ev) => {
      if (ev.altKey || ev.ctrlKey || ev.metaKey) return; // Alt/Cmd + flecha es atrás/adelante del navegador
      if (current && (NEXT.has(ev.key) || PREV.has(ev.key))) { ev.preventDefault(); location.hash = stepExhibit(current.id, NEXT.has(ev.key) ? 1 : -1).id; }
      const layer = LAYER_KEY[ev.key];
      if (layer && stage && !ev.repeat) { layers[layer] = !layers[layer]; stage.setLayer(layer, layers[layer]); if (log) console.info(`[storybook] ${layer}: ${layers[layer] ? "visible" : "oculto"}`); }
      if (ev.key === "6" && stage) { stage.setBloom(nextBloomMode(stage.bloom)); if (log) console.info(`[storybook] bloom a mano: ${stage.bloom}`); }
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
        if (since > 5000) { console.info(`[storybook] peor redibujo en 5 s: ${worst.toFixed(2)} ms`); worst = 0; since = 0; }
      }
    });
  }
});
