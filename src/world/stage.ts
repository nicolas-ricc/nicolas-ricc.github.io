import { AlphaFilter, BlurFilter, type BlurFilterOptions, Container, Graphics } from "pixi.js";
import type { Accent } from "../iso/accent";
import { SHADOW_BAND_ALPHA, buildRenderList } from "../iso/render-list";
import type { WorldZone } from "../map/geo";
import { ISO_COLORS } from "../map/palette-iso";
import type { AnimLayer } from "../scenes/animator";
import type { WorldScene } from "../scenes/world";
import type { ZonedAnimator } from "./assemble";
import { HALO_BASE, HALO_FALLBACK, drawAccents, drawLayer, type HaloStyle } from "./frame";
import { WORLD_ZONES, accentZone, focusAlphas, veilPolygons } from "./veil";

export type BloomMode = "off" | "on" | "fallback";

/** Parámetros del BlurFilter del bloom; el lab los imprime. */
export const BLOOM_FILTER: BlurFilterOptions = { strength: 6, quality: 2, resolution: 0.5, blendMode: "add" };

/** `fallback` no tiene filtro: compensa con un halo más grande en cada luz. */
export function nextHalo(mode: BloomMode): HaloStyle {
  return mode === "fallback" ? HALO_FALLBACK : HALO_BASE;
}

export interface Stage {
  container: Container;
  staticCount: number;
  readonly bloom: BloomMode;
  setFocus(zone: WorldZone | null): void;
  setBloom(mode: BloomMode): void;
  tick(dtMs: number): void;
}

/** Constante de tiempo del lerp de alpha (velo y luces): min(1, dt / LERP_MS). */
const LERP_MS = 120;

interface AccentGraphics { g: Graphics; zone: WorldZone | null; base: number; draw: () => void; mirror?: Graphics }

/**
 * Arma las capas de una escena del mundo. Orden, de abajo hacia arriba: sangrado,
 * agua (estática más animada), suelo, banda completa de sombras, núcleo de
 * sombras, sólidos estáticos, sólidos animados, velos (uno por zona), acentos
 * estáticos (uno por zona) y una Graphics por capa de acentos animada.
 * El bloom es perezoso: arranca en `off`, sin `bloomSlot`; el primer `setBloom("on")`
 * lo arma (espejos de los acentos con filtro) y lo inserta justo debajo de `accentSlot`.
 */
export function buildStage(scene: WorldScene, animators: ZonedAnimator[]): Stage {
  const container = new Container();
  let bloom: BloomMode = "off", halo: HaloStyle = HALO_BASE, bloomSlot: Container | null = null;
  const gBleed = new Graphics(), gGround = new Graphics(), gShadow = new Graphics(), gCore = new Graphics(), gSolid = new Graphics();
  const waterSlot = new Container(), shadowSlot = new Container(), coreSlot = new Container(), solidSlot = new Container(), veilSlot = new Container(), accentSlot = new Container();
  // cada banda de sombra es una unión: el filtro aplica el alpha al conjunto,
  // no a cada polígono, así dos sombras superpuestas no se oscurecen dos veces
  shadowSlot.filters = [new AlphaFilter({ alpha: SHADOW_BAND_ALPHA })];
  coreSlot.filters = [new AlphaFilter({ alpha: SHADOW_BAND_ALPHA })];
  shadowSlot.addChild(gShadow);
  coreSlot.addChild(gCore);
  container.addChild(gBleed, waterSlot, gGround, shadowSlot, coreSlot, gSolid, solidSlot, veilSlot, accentSlot);

  const { terrain } = scene;
  drawLayer(gBleed, buildRenderList(terrain.bleed), "ground");
  const staticItems = buildRenderList([...terrain.ground, ...scene.ground, ...scene.solids]);
  drawLayer(gGround, staticItems, "ground");
  drawLayer(gShadow, staticItems, "shadow");
  drawLayer(gCore, staticItems, "shadowCore");
  drawLayer(gSolid, staticItems, "solid");

  // velos: una Graphics por zona, color cielo, alpha animado desde 0
  const veils = {} as Record<WorldZone, Graphics>;
  const polys = veilPolygons();
  for (const z of WORLD_ZONES) {
    const g = new Graphics();
    for (const p of polys[z]) g.poly(p, true).fill(ISO_COLORS.sky);
    g.alpha = 0;
    veils[z] = g;
    veilSlot.addChild(g);
  }

  // acentos estáticos repartidos por zona (worldZoneAt de su posición)
  const accents: AccentGraphics[] = [];
  const byZone: Record<WorldZone, Accent[]> = { portfolio: [], cv: [], blog: [] };
  for (const a of scene.accents) byZone[accentZone(a)].push(a);
  for (const z of WORLD_ZONES) {
    const g = new Graphics();
    g.blendMode = "add";
    const draw = (): void => drawAccents(g, byZone[z], halo);
    draw();
    accentSlot.addChild(g);
    accents.push({ g, zone: z, base: 1, draw });
  }

  // agua estática: todo cuerpo de agua que ningún animador reclame (camino de reserva)
  const animatedWater = new Set(animators.flatMap((a) => [...(a.claims ?? []), ...a.ids.flatMap((id) => { const l = a.layer(id); return l.kind === "water" ? l.water : []; })]));
  const staticWater = new Graphics();
  waterSlot.addChild(staticWater);
  drawLayer(staticWater, buildRenderList([...terrain.water, terrain.foam].filter((w) => !animatedWater.has(w))), "ground");

  // una Graphics (o par) por capa animada
  const redraw = new Map<string, () => void>();
  for (const a of animators) for (const id of a.ids) {
    const kind = a.layer(id).kind;
    if (kind === "water") {
      const g = new Graphics();
      waterSlot.addChild(g);
      redraw.set(id, () => { const l = a.layer(id) as AnimLayer & { kind: "water" }; drawLayer(g, buildRenderList(l.water), "ground"); g.alpha = l.alpha ?? 1; });
    } else if (kind === "solid") {
      const gs = new Graphics(), gc = new Graphics(), g = new Graphics();
      shadowSlot.addChild(gs); coreSlot.addChild(gc); solidSlot.addChild(g);
      redraw.set(id, () => { const l = a.layer(id) as AnimLayer & { kind: "solid" }; const items = buildRenderList(l.solids); drawLayer(gs, items, "shadow"); drawLayer(gc, items, "shadowCore"); drawLayer(g, items, "solid"); const al = l.alpha ?? 1; gs.alpha = gc.alpha = g.alpha = al; });
    } else {
      const g = new Graphics();
      g.blendMode = "add";
      accentSlot.addChild(g);
      const draw = (): void => { const l = a.layer(id) as AnimLayer & { kind: "accent" }; drawAccents(g, l.accents, halo); entry.base = l.alpha ?? 1; };
      const entry: AccentGraphics = { g, zone: a.zone, base: 1, draw };
      accents.push(entry);
      // el alpha propio de la capa (barcos que se desvanecen) se guarda; el alpha final lo pone el lerp
      redraw.set(id, draw);
    }
    redraw.get(id)!();
  }

  // lerp de alpha: objetivos por zona (focusAlphas) y valores actuales
  let target = focusAlphas(null);
  const current: Record<WorldZone, { veil: number; accents: number }> = { portfolio: { veil: 0, accents: 1 }, cv: { veil: 0, accents: 1 }, blog: { veil: 0, accents: 1 } };
  const applyAlphas = (): void => {
    for (const z of WORLD_ZONES) veils[z].alpha = current[z].veil;
    for (const e of accents) { e.g.alpha = e.base * (e.zone ? current[e.zone].accents : 1); if (e.mirror) e.mirror.alpha = e.g.alpha; }
  };
  // espejos de los acentos que comparten contexto con el original, bajo un filtro de desenfoque aditivo
  const buildBloomSlot = (): Container => {
    const slot = new Container();
    slot.blendMode = "add";
    slot.filters = [new BlurFilter(BLOOM_FILTER)];
    for (const e of accents) {
      const m = new Graphics({ context: e.g.context });
      m.blendMode = "add";
      slot.addChild(m);
      e.mirror = m;
    }
    return (bloomSlot = slot);
  };

  return {
    container,
    staticCount: staticItems.length,
    get bloom() { return bloom; },
    setFocus(zone) { target = focusAlphas(zone); },
    setBloom(mode) {
      if (mode === bloom) return;
      // el slot se arma antes de cambiar el modo: si el filtro fallara, el Stage sigue en el modo anterior
      if (mode === "on") container.addChildAt(bloomSlot ?? buildBloomSlot(), container.getChildIndex(accentSlot));
      else bloomSlot?.removeFromParent();
      bloom = mode;
      const h = nextHalo(mode);
      if (h !== halo) { halo = h; for (const e of accents) e.draw(); }
      applyAlphas();
    },
    tick(dtMs) {
      for (const a of animators) for (const id of a.tick(dtMs)) redraw.get(id)?.();
      const k = Math.min(1, dtMs / LERP_MS);
      for (const z of WORLD_ZONES) {
        current[z].veil += (target[z].veil - current[z].veil) * k;
        current[z].accents += (target[z].accents - current[z].accents) * k;
      }
      applyAlphas();
    },
  };
}
