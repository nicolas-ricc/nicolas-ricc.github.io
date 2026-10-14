import { Application } from "pixi.js";
import blogJson from "../content/blog.json";
import cvJson from "../content/cv.json";
import portfolioJson from "../content/portfolio.json";
import feed from "../content/blog.generated.json";
import { Camera } from "./camera";
import { mergeBlogFeed } from "./content/blog-feed";
import { renderContent } from "./content/render";
import type { ZoneContent } from "./content/types";
import { v3 } from "./iso/geometry";
import { project } from "./iso/project";
import { worldZoneAt } from "./map/geo";
import { ISO_COLORS } from "./map/palette-iso";
import { zoneById, ZONE_IDS, type ZoneId } from "./map/zones";
import { pathForZone, zoneFromPath } from "./router";
import { LANDMARKS } from "./scenes/world";
import { showMap, showZone } from "./views";
import { assembleWorld } from "./world/assemble";
import { scheduleIdle } from "./world/bloom";
import { attachBloom, type BloomProbe } from "./world/bloom-runtime";
import { buildStage } from "./world/stage";
import { coverView, pointerToWorld, zoneView, type View } from "./world/view";

const CONTENT: Record<ZoneId, ZoneContent> = {
  portfolio: portfolioJson as ZoneContent,
  cv: cvJson as ZoneContent,
  blog: mergeBlogFeed(blogJson as ZoneContent, feed.items),
};

/** Altura (mundo) a la que cuelga el rótulo sobre el pie del landmark: por encima de la torre (30). */
const LABEL_Z = 34;

async function boot(): Promise<void> {
  const host = document.getElementById("canvas-host") as HTMLDivElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const log = import.meta.env.DEV;

  const app = new Application();
  await app.init({ resizeTo: host, background: ISO_COLORS.sky, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true });
  host.appendChild(app.canvas);
  app.ticker.maxFPS = 30;

  const t0 = performance.now();
  const { scene, animators } = assembleWorld(undefined, { reducedMotion: reduced });
  const stage = buildStage(scene, animators);
  app.stage.addChild(stage.container);
  if (log) console.info(`[mapa] primer dibujo: ${(performance.now() - t0).toFixed(1)} ms, ${stage.staticCount} polígonos estáticos`);

  let current: ZoneId | null = zoneFromPath(location.pathname);
  /** zona bajo el puntero o con un link enfocado; en vista activa manda `current` */
  let hot: ZoneId | null = null;

  const labels = new Map<ZoneId, HTMLAnchorElement>();
  for (const a of document.querySelectorAll<HTMLAnchorElement>("#zonas a[data-zone]")) {
    // validar contra ZONE_IDS en vez de castear: un data-zone espurio no entra al mapa
    const id = a.dataset.zone;
    if ((ZONE_IDS as readonly string[]).includes(id ?? "")) labels.set(id as ZoneId, a);
  }

  const placeLabels = (v: View): void => {
    for (const [id, a] of labels) {
      const l = LANDMARKS[id];
      const p = project(v3(l.x, l.y, LABEL_Z));
      const sx = p.x * v.scale + v.x, sy = p.y * v.scale + v.y;
      a.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -100%)`;
      // un rótulo fuera del host no debe recibir foco
      const inside = sx >= 0 && sx <= host.clientWidth && sy >= 0 && sy <= host.clientHeight;
      a.style.visibility = inside ? "" : "hidden";
    }
  };

  const camera = new Camera((s) => { stage.container.position.set(s.x, s.y); stage.container.scale.set(s.scale); placeLabels(s); }, { reducedMotion: reduced });

  const targetFor = (id: ZoneId | null): View => {
    const w = host.clientWidth, h = host.clientHeight;
    return id ? zoneView(id, w, h) : coverView(w, h);
  };

  const refreshFocus = (): void => { stage.setFocus(current ?? hot); };

  function render(id: ZoneId | null, animate: boolean): void {
    if (id) {
      const prerendered = document.body.dataset.zone === id && document.getElementById("content")!.childElementCount > 0;
      showZone(id, zoneById(id).name, prerendered ? null : renderContent(CONTENT[id]));
    } else {
      showMap();
    }
    for (const [lid, a] of labels) a.classList.toggle("dim", id !== null && id !== lid);
    refreshFocus();
    const t = targetFor(id);
    if (animate) void camera.tweenTo(t); else camera.jumpTo(t);
  }

  function navigate(id: ZoneId | null, push: boolean): void {
    // clic sobre la zona ya activa (o "volver" estando en el mapa): sin entrada de
    // historial duplicada. popstate no pasa por acá: setea current antes de render.
    if (id === current) return;
    current = id;
    if (push) history.pushState({ zone: id }, "", pathForZone(id));
    render(id, true);
  }

  // hover y clic sobre el canvas: puntero → mundo a z 0 → zona por geografía
  const zoneUnder = (e: PointerEvent | MouseEvent): ZoneId => {
    const r = app.canvas.getBoundingClientRect();
    const p = pointerToWorld(camera.state, e.clientX - r.left, e.clientY - r.top);
    return worldZoneAt(p.x, p.y);
  };
  app.canvas.style.cursor = "pointer";
  app.canvas.addEventListener("pointermove", (e) => { const z = zoneUnder(e); if (z !== hot) { hot = z; refreshFocus(); } });
  app.canvas.addEventListener("pointerleave", () => { hot = null; refreshFocus(); });
  app.canvas.addEventListener("click", (e) => navigate(zoneUnder(e), true));

  // los links del nav son los controles accesibles: foco o hover encienden su zona
  for (const [id, a] of labels) {
    a.addEventListener("mouseenter", () => { hot = id; refreshFocus(); });
    a.addEventListener("focus", () => { hot = id; refreshFocus(); });
    a.addEventListener("mouseleave", () => { hot = null; refreshFocus(); });
    a.addEventListener("blur", () => { hot = null; refreshFocus(); });
    a.addEventListener("click", (e) => { e.preventDefault(); navigate(id, true); });
  }

  // El host cambia de tamaño por CSS durante la transición: seguirlo frame a frame.
  new ResizeObserver(() => {
    app.resize();
    const t = targetFor(current);
    if (camera.isTweening) camera.retarget(t); else camera.jumpTo(t);
  }).observe(host);

  window.addEventListener("popstate", () => { current = zoneFromPath(location.pathname); render(current, true); });
  document.getElementById("back")!.addEventListener("click", (e) => { e.preventDefault(); navigate(null, true); });
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && current) navigate(null, true); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) app.ticker.stop(); else app.ticker.start(); });

  let worst = 0, since = 0;
  let bloom: BloomProbe | null = null;
  app.ticker.add((ticker) => {
    camera.tick(performance.now());
    const t = performance.now();
    stage.tick(ticker.deltaMS);
    const dt = performance.now() - t;
    bloom?.tick(dt);
    if (log) {
      worst = Math.max(worst, dt);
      since += ticker.deltaMS;
      if (since > 5000) { console.info(`[mapa] peor redibujo en 5 s: ${worst.toFixed(2)} ms`); worst = 0; since = 0; }
    }
  });

  // El primer render (sobre todo en una carga directa de /cv/) no debe animar: la clase
  // .zone recién se aplica acá, después del primer paint, y la grilla animaría sola.
  const root = document.documentElement;
  root.classList.add("no-anim");
  render(current, false);
  // el bloom entra en una tarea diferida: el primer dibujo se sirve sin filtro
  scheduleIdle(() => { bloom = attachBloom({ app, stage, log, prefix: "mapa" }); });
  // Los rótulos estaban ocultos (ver #zonas a en style.css) hasta este primer
  // jumpTo, que ya los colocó sobre su landmark: recién ahora se muestran.
  root.classList.add("mapa-listo");
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("no-anim")));
}

boot().catch((e: unknown) => {
  // Sin canvas (WebGL caído, init fallido) el sitio sigue siendo navegable: el CSS
  // de .no-canvas revela el <nav id="zonas"> y el contenido prerenderizado.
  console.error(e);
  document.documentElement.classList.add("no-canvas");
});
