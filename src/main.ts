import { Application } from "pixi.js";
import blogJson from "../content/blog.json";
import cvJson from "../content/cv.json";
import portfolioJson from "../content/portfolio.json";
import feed from "../content/blog.generated.json";
import { Camera } from "./camera";
import { mergeBlogFeed } from "./content/blog-feed";
import { renderContent } from "./content/render";
import type { ZoneContent } from "./content/types";
import { v3, type Vec3 } from "./iso/geometry";
import { project } from "./iso/project";
import { worldZoneAt } from "./map/geo";
import { ISO_COLORS } from "./map/palette-iso";
import { zoneById, ZONE_IDS, type ZoneId } from "./map/zones";
import { pathForZone, zoneFromPath } from "./router";
import { showMap, showZone } from "./views";
import { assembleWorld } from "./world/assemble";
import { afterFirstRender } from "./world/bloom";
import { attachBloom, type BloomProbe } from "./world/bloom-runtime";
import { buildStage } from "./world/stage";
import { coverView, pointerToWorld, zoneView, type View } from "./world/view";

const CONTENT: Record<ZoneId, ZoneContent> = {
  portfolio: portfolioJson as ZoneContent,
  cv: cvJson as ZoneContent,
  blog: mergeBlogFeed(blogJson as ZoneContent, feed.items),
};

/**
 * Where each label goes (world, at ground level): centered on that point,
 * set apart from the landmark so it does not cover it. Portfolio over the long
 * shed of the harbor, Resume in the city next to the plaza, Blog on the open sea.
 */
const LABEL_AT: Record<ZoneId, Vec3> = {
  portfolio: v3(66, -128, 0),
  cv: v3(76, 446, 0),
  blog: v3(633, 145, 0),
};
/** Minimum gap (px) between a label and the edge of the host. */
const LABEL_MARGIN = 8;
const clamp = (n: number, lo: number, hi: number): number => Math.min(Math.max(n, lo), Math.max(lo, hi));

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
  if (log) console.info(`[mapa] first draw: ${(performance.now() - t0).toFixed(1)} ms, ${stage.staticCount} static polygons`);

  let current: ZoneId | null = zoneFromPath(location.pathname);
  /** zone under the pointer or with a focused link; in an active view `current` wins */
  let hot: ZoneId | null = null;

  const labels = new Map<ZoneId, HTMLAnchorElement>();
  for (const a of document.querySelectorAll<HTMLAnchorElement>("#zonas a[data-zone]")) {
    // validate against ZONE_IDS instead of casting: a stray data-zone does not enter the map
    const id = a.dataset.zone;
    if ((ZONE_IDS as readonly string[]).includes(id ?? "")) labels.set(id as ZoneId, a);
  }

  const placeLabels = (v: View): void => {
    for (const [id, a] of labels) {
      const p = project(LABEL_AT[id]);
      // if its spot falls outside the host (narrow screens), the label sticks to the nearest edge: always visible and focusable
      const hw = a.offsetWidth / 2 + LABEL_MARGIN, hh = a.offsetHeight / 2 + LABEL_MARGIN;
      const sx = clamp(p.x * v.scale + v.x, hw, host.clientWidth - hw), sy = clamp(p.y * v.scale + v.y, hh, host.clientHeight - hh);
      a.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%)`;
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
    // click on the already active zone (or "back" while on the map): no duplicate
    // history entry. popstate does not come through here: it sets current before render.
    if (id === current) return;
    current = id;
    if (push) history.pushState({ zone: id }, "", pathForZone(id));
    render(id, true);
  }

  // hover and click on the canvas: pointer → world at z 0 → zone by geography
  const zoneUnder = (e: PointerEvent | MouseEvent): ZoneId => {
    const r = app.canvas.getBoundingClientRect();
    const p = pointerToWorld(camera.state, e.clientX - r.left, e.clientY - r.top);
    return worldZoneAt(p.x, p.y);
  };
  app.canvas.style.cursor = "pointer";
  app.canvas.addEventListener("pointermove", (e) => { const z = zoneUnder(e); if (z !== hot) { hot = z; refreshFocus(); } });
  app.canvas.addEventListener("pointerleave", () => { hot = null; refreshFocus(); });
  app.canvas.addEventListener("click", (e) => navigate(zoneUnder(e), true));

  // the nav links are the accessible controls: focus or hover light up their zone
  for (const [id, a] of labels) {
    a.addEventListener("mouseenter", () => { hot = id; refreshFocus(); });
    a.addEventListener("focus", () => { hot = id; refreshFocus(); });
    a.addEventListener("mouseleave", () => { hot = null; refreshFocus(); });
    a.addEventListener("blur", () => { hot = null; refreshFocus(); });
    a.addEventListener("click", (e) => { e.preventDefault(); navigate(id, true); });
  }

  // The host resizes through CSS during the transition: follow it frame by frame.
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
      if (since > 5000) { console.info(`[mapa] worst redraw in 5 s: ${worst.toFixed(2)} ms`); worst = 0; since = 0; }
    }
  });

  // The first render (above all on a direct load of /cv/) must not animate: the .zone
  // class is only applied here, after the first paint, and the grid would animate on its own.
  const root = document.documentElement;
  root.classList.add("no-anim");
  render(current, false);
  // bloom attaches in the task after Pixi's first real render: the first frame is served without the filter
  afterFirstRender(app.renderer.runners.postrender, () => { bloom = attachBloom({ app, stage, log, prefix: "mapa" }); });
  // The labels were hidden (see #zonas a in style.css) until this first
  // jumpTo, which already put them in place: only now are they shown.
  root.classList.add("mapa-listo");
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("no-anim")));
}

boot().catch((e: unknown) => {
  // Without a canvas (WebGL down, failed init) the site is still navigable: the CSS
  // of .no-canvas reveals the <nav id="zonas"> and the prerendered content.
  console.error(e);
  document.documentElement.classList.add("no-canvas");
});
