import { Application } from "pixi.js";
import { ISO_COLORS } from "../map/palette-iso";
import type { WorldScene } from "../scenes/world";
import { assembleWorld, type ZonedAnimator } from "../world/assemble";
import { scheduleIdle } from "../world/bloom";
import { attachBloom, type BloomProbe } from "../world/bloom-runtime";
import { type Box, boxFrame, fitTransform } from "../world/frame";
import { type BloomMode, buildStage, type Stage, type StageLayer } from "../world/stage";
import { cropAnimators, cropScene, pieceScene, type Readout, readout, solidsBox } from "./crop";
import { EXHIBITS, type Exhibit, GROUPS, pickExhibit, stepExhibit } from "./exhibits";
import { bloomFromSearch, nextBloomMode } from "./page";

/**
 * Storybook de estructuras: un exhibit a la vez, recortado del mundo por su
 * caja o armado solo en el origen (piezas). El hash elige el exhibit; flechas
 * y j/k solo escriben el hash. 6 rota el bloom; ?bloom= lo fuerza y ?speed=
 * escala el reloj, como en page.ts. g, h y a ocultan o muestran suelo, sombras
 * y acentos (con el bloom) y se recuerdan entre exhibits.
 */
const host = document.getElementById("lab-host") as HTMLDivElement;
const nav = document.getElementById("exhibits") as HTMLElement;
const panel = document.getElementById("readout") as HTMLElement;
const log = import.meta.env.DEV;
const { scene, animators } = assembleWorld(undefined, { reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches });

for (const g of GROUPS) {
  const h = document.createElement("h2");
  h.textContent = g.title;
  const ul = document.createElement("ul");
  for (const e of EXHIBITS.filter((x) => x.group === g.id)) {
    const a = document.createElement("a");
    a.href = `#${e.id}`; a.textContent = e.title; a.dataset.id = e.id;
    const li = document.createElement("li"); li.appendChild(a); ul.appendChild(li);
  }
  nav.append(h, ul);
}

const n1 = (x: number): string => x.toFixed(1);

function renderReadout(r: Readout): void {
  const b = r.box;
  const rows: [string, string][] = [
    ["Sólidos", String(r.solids)],
    ["Caras", String(r.faces)],
    ["Acentos", String(r.accents)],
    ["Caja x", b ? `${n1(b.min.x)} … ${n1(b.max.x)}` : "—"],
    ["Caja y", b ? `${n1(b.min.y)} … ${n1(b.max.y)}` : "—"],
    ["Caja z", b ? `${n1(b.min.z)} … ${n1(b.max.z)}` : "—"],
    ["Ancho × fondo × alto", b ? `${n1(b.w)} × ${n1(b.d)} × ${n1(b.h)} u` : "—"],
    ["Materiales", r.materials.join(", ") || "—"],
    ["Colores de acento", r.accentColors.join(", ") || "—"],
  ];
  const dl = document.createElement("dl");
  for (const [k, v] of rows) {
    const dt = document.createElement("dt"), dd = document.createElement("dd");
    dt.textContent = k; dd.textContent = v;
    dl.append(dt, dd);
  }
  panel.replaceChildren(dl);
}

const LAYER_KEY: Record<string, StageLayer> = { g: "ground", h: "shadow", a: "accents" };

void boot();

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
    // sin `context: true` los GraphicsContext de cada Graphics sobreviven hasta el GC de Pixi
    stage?.container.destroy({ children: true, context: true });
    const t0 = performance.now();
    let src: [WorldScene, ZonedAnimator[]];
    if (e.kind === "region") {
      // la misma caja a ambos: el memo del recorte se indexa por identidad de Box
      src = [cropScene(scene, e.box), cropAnimators(animators, e.box)];
      stage = buildStage(...src);
      frame = { box: e.box, h: e.h };
    } else {
      const piece = pieceScene(e.build, e.pad);
      src = [piece, []];
      stage = buildStage(...src);
      frame = solidsBox([...piece.ground, ...piece.solids]);
    }
    app.stage.addChild(stage.container);
    for (const l of Object.keys(layers) as StageLayer[]) stage.setLayer(l, layers[l]);
    if (log) console.info(`[storybook] ${e.id}: primer dibujo ${(performance.now() - t0).toFixed(1)} ms, ${stage.staticCount} polígonos estáticos`);
    renderReadout(readout(...src));
    stage.setBloom(mode);
    current = e;
    fit();
    for (const a of nav.querySelectorAll<HTMLAnchorElement>("a")) {
      if (a.dataset.id === e.id) { a.setAttribute("aria-current", "page"); a.scrollIntoView({ block: "nearest" }); } // el índice no entra entero en la columna
      else a.removeAttribute("aria-current");
    }
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
    if (ev.key === "6" && stage) { stage.setBloom(nextBloomMode(stage.bloom)); if (log) console.info(`[storybook] bloom: ${stage.bloom}`); }
  });

  const speed = Number(new URLSearchParams(location.search).get("speed")) || 1;
  let worst = 0, since = 0;
  app.ticker.add((ticker) => {
    if (!stage) return;
    const t = performance.now();
    stage.tick(ticker.deltaMS * speed);
    const dt = performance.now() - t;
    bloom?.tick(dt);
    worst = Math.max(worst, dt);
    since += ticker.deltaMS;
    if (log && since > 5000) { console.info(`[storybook] peor redibujo en 5 s: ${worst.toFixed(2)} ms`); worst = 0; since = 0; }
  });
}
