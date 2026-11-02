import { AlphaFilter, Application, Container, Graphics } from "pixi.js";
import { SHADOW_BAND_ALPHA, buildRenderList, type Layer, type RenderItem } from "../iso/render-list";
import { ISO_COLORS } from "../map/palette-iso";
import type { StyleId } from "../kit/types";
import { drawAccents, drawLayer, fitTransform } from "../world/frame";
import { kitScene } from "./kit-scene";

/**
 * Lab del kit: todas las recetas del registro sobre una grilla de lotes. Tecla
 * `s` cambia el seed; `1..4` el estilo (centro, bares, residencial, cívico).
 * Sin bloom ni animadores.
 */
const KEY_STYLE: Record<string, StyleId> = { "1": "centro", "2": "bares", "3": "residencial", "4": "civico" };
const LAYERS: readonly Layer[] = ["ground", "shadow", "shadowCore", "solid"];

const host = document.getElementById("lab-host") as HTMLDivElement;
let seed = 7, style: StyleId = "centro";
void boot();

async function boot(): Promise<void> {
  const app = new Application();
  await app.init({ resizeTo: host, background: ISO_COLORS.sky, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true });
  host.appendChild(app.canvas);
  const world = new Container(), layers = LAYERS.map(() => new Graphics()), lights = new Graphics();
  lights.blendMode = "add";
  // cada banda de sombra es una unión: el filtro va en un Container, igual que stage.ts
  for (const [i, l] of LAYERS.entries()) {
    if (l === "shadow" || l === "shadowCore") {
      const slot = new Container();
      slot.filters = [new AlphaFilter({ alpha: SHADOW_BAND_ALPHA })];
      slot.addChild(layers[i]!);
      world.addChild(slot);
    } else world.addChild(layers[i]!);
  }
  world.addChild(lights);
  app.stage.addChild(world);
  let items: RenderItem[] = [];
  const fit = (): void => { const f = fitTransform(items, host.clientWidth, host.clientHeight); world.position.set(f.x, f.y); world.scale.set(f.scale); };
  const draw = (): void => {
    const s = kitScene(seed, style);
    items = buildRenderList(s.solids);
    LAYERS.forEach((l, i) => drawLayer(layers[i]!, items, l));
    drawAccents(lights, s.accents);
    fit();
  };
  draw();
  app.renderer.on("resize", fit);
  window.addEventListener("keydown", (e) => {
    const next = KEY_STYLE[e.key];
    if (next) { style = next; draw(); }
    if (e.key === "s") { seed++; draw(); }
  });
}
