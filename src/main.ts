import { Application } from "pixi.js";
import blogJson from "../content/blog.json";
import cvJson from "../content/cv.json";
import portfolioJson from "../content/portfolio.json";
import feed from "../content/blog.generated.json";
import { Camera } from "./camera";
import { mergeBlogFeed } from "./content/blog-feed";
import { renderContent } from "./content/render";
import type { ZoneContent } from "./content/types";
import { markCurrent, placeLabel } from "./labels";
import { ISO_COLORS } from "./map/palette-iso";
import { zoneById, ZONE_IDS, type ZoneId } from "./map/zones";
import { pathForZone, zoneFromPath } from "./router";
import { showMap, showZone } from "./views";
import { assembleWorld } from "./world/assemble";
import { afterFirstRender } from "./world/bloom";
import { attachBloom, type BloomProbe } from "./world/bloom-runtime";
import { buildStage } from "./world/stage";
import type { WritingSite } from "./scenes/sign-platform";
import { signBox, WRITING_SITE_MARGIN, writingSite, zoneAtScreen, zoneSigns } from "./world/signs";
import { attachPan, keyPan } from "./pan";
import { clampToBleed, coverView, panView, sameView, zoneView, type View } from "./world/view";

const CONTENT: Record<ZoneId, ZoneContent> = {
  portfolio: portfolioJson as ZoneContent,
  cv: cvJson as ZoneContent,
  blog: mergeBlogFeed(blogJson as ZoneContent, feed.items),
};

async function boot(): Promise<void> {
  const host = document.getElementById("canvas-host") as HTMLDivElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const log = import.meta.env.DEV;

  const app = new Application();
  await app.init({ resizeTo: host, background: ISO_COLORS.sky, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true });
  host.appendChild(app.canvas);
  app.ticker.maxFPS = 30;

  const t0 = performance.now();
  const { scene, animators, platform } = assembleWorld(undefined, { reducedMotion: reduced });
  // the site is decided with #app (the page grid), not with the host: the host changes size when a zone opens and the platform must not move
  const appEl = document.getElementById("app") as HTMLElement;
  let site: WritingSite = writingSite(appEl.clientWidth, appEl.clientHeight);
  platform?.setSite(site);
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
      // over its sign; if the sign leaves the host (narrow screens), the label sticks to the nearest edge: always visible and focusable
      placeLabel(a, signBox(zoneSigns(site)[id]), v, { w: host.clientWidth, h: host.clientHeight }, WRITING_SITE_MARGIN);
    }
  };

  const camera = new Camera((s) => { stage.container.position.set(s.x, s.y); stage.container.scale.set(s.scale); placeLabels(s); }, { reducedMotion: reduced });

  const syncSite = (): void => {
    const next = writingSite(appEl.clientWidth, appEl.clientHeight);
    if (next === site) return;
    site = next;
    platform?.setSite(site);
    placeLabels(camera.state);
  };

  const targetFor = (id: ZoneId | null): View => {
    const w = host.clientWidth, h = host.clientHeight;
    return id ? zoneView(id, w, h, site) : coverView(w, h);
  };

  const refreshFocus = (): void => { stage.setFocus(current ?? hot); };

  const recenter = document.getElementById("recentrar") as HTMLButtonElement;
  /** the map view differs from coverView: the recenter button shows */
  let moved = false;
  const syncMoved = (): void => {
    moved = current === null && !sameView(camera.state, coverView(host.clientWidth, host.clientHeight));
    recenter.hidden = !moved;
  };
  // on the host, not the canvas: a drag may start on a sign link or the button over the canvas
  const pan = attachPan(host, {
    // jumping to the current state ends any active tween, so the drag wins
    onStart: () => camera.jumpTo(camera.state),
    onPan: (dx, dy) => { camera.jumpTo(panView(camera.state, dx, dy, host.clientWidth, host.clientHeight)); syncMoved(); },
  });
  const recenterView = (): void => {
    // the button is about to hide: keep keyboard focus on the map instead of dropping it to <body>
    const hadFocus = document.activeElement === recenter;
    moved = false;
    recenter.hidden = true;
    void camera.tweenTo(coverView(host.clientWidth, host.clientHeight));
    if (hadFocus) host.focus();
  };

  function render(id: ZoneId | null, animate: boolean): void {
    pan.setEnabled(id === null);
    // both branches aim at their main view (zoneView or coverView): nothing is moved any more
    moved = false;
    recenter.hidden = true;
    // in a zone the host's drag and arrow controls are off: out of the tab order
    host.tabIndex = id === null ? 0 : -1;
    if (id) {
      const prerendered = document.body.dataset.zone === id && document.getElementById("content")!.childElementCount > 0;
      showZone(id, zoneById(id).name, prerendered ? null : renderContent(CONTENT[id]));
    } else {
      showMap();
    }
    markCurrent(labels, id);
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

  // hover and click on the canvas: pointer → the sign under it, else the zone by geography
  const zoneUnder = (e: PointerEvent | MouseEvent): ZoneId => {
    const r = app.canvas.getBoundingClientRect();
    return zoneAtScreen(camera.state, e.clientX - r.left, e.clientY - r.top, site);
  };
  // hover is frozen while dragging: the hot zone stays what it was at drag start
  app.canvas.addEventListener("pointermove", (e) => { if (pan.dragging) return; const z = zoneUnder(e); if (z !== hot) { hot = z; refreshFocus(); } });
  app.canvas.addEventListener("pointerleave", () => { if (pan.dragging) return; hot = null; refreshFocus(); });
  app.canvas.addEventListener("click", (e) => { if (pan.consumeClick()) return; navigate(zoneUnder(e), true); });
  recenter.addEventListener("click", () => { if (!pan.consumeClick()) recenterView(); });

  // the nav links are the accessible controls: focus or hover light up their zone
  for (const [id, a] of labels) {
    // a native link drag would cancel the pointer: the map drag owns the gesture
    a.draggable = false;
    a.addEventListener("mouseenter", () => { if (pan.dragging) return; hot = id; refreshFocus(); });
    a.addEventListener("focus", () => { hot = id; refreshFocus(); });
    a.addEventListener("mouseleave", () => { if (pan.dragging) return; hot = null; refreshFocus(); });
    a.addEventListener("blur", () => { hot = null; refreshFocus(); });
    a.addEventListener("click", (e) => { e.preventDefault(); if (pan.consumeClick()) return; navigate(id, true); });
  }

  // The host resizes through CSS during the transition: follow it frame by frame.
  new ResizeObserver(() => {
    app.resize();
    syncSite();
    if (camera.isTweening) camera.retarget(targetFor(current));
    else if (moved) { camera.jumpTo(clampToBleed(camera.state, host.clientWidth, host.clientHeight)); syncMoved(); } // keep the moved view, clamped to the new size
    else camera.jumpTo(targetFor(current));
  }).observe(host);

  window.addEventListener("popstate", () => { current = zoneFromPath(location.pathname); render(current, true); });
  document.getElementById("back")!.addEventListener("click", (e) => { e.preventDefault(); navigate(null, true); });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && current) navigate(null, true);
    // arrows and 0/Home act on the map only, and never steal keys from the zone content
    if (current !== null || document.getElementById("content")!.contains(document.activeElement)) return;
    const k = keyPan(e, host.clientWidth, host.clientHeight);
    if (k === null) return;
    e.preventDefault();
    if (k === "home") { recenterView(); return; }
    camera.jumpTo(panView(camera.state, k.dx, k.dy, host.clientWidth, host.clientHeight));
    syncMoved();
  });
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
  // no canvas: drop the host's tab stop, role and label, they would promise a drag that does not exist
  const host = document.getElementById("canvas-host");
  for (const attr of ["tabindex", "role", "aria-label"]) host?.removeAttribute(attr);
});
