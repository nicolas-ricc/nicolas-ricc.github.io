import { AlphaFilter, BlurFilter, type BlurFilterOptions, Container, Graphics } from "pixi.js";
import { SHADOW_BAND_ALPHA, buildRenderList } from "../iso/render-list";
import type { WorldZone } from "../map/geo";
import { ISO_COLORS } from "../map/palette-iso";
import type { AnimLayer } from "../scenes/animator";
import type { WorldScene } from "../scenes/world";
import type { ZonedAnimator } from "./assemble";
import { HALO_BASE, HALO_FALLBACK, drawAccents, drawLayer, type HaloStyle } from "./frame";
import { WORLD_ZONES, accentsByZone, focusAlphas, veilPolygons } from "./veil";

export type BloomMode = "off" | "on" | "fallback";

/** BlurFilter parameters of the bloom; exported so the lab's log prints them (#18). */
export const BLOOM_FILTER: BlurFilterOptions = { strength: 6, quality: 2, resolution: 0.5, blendMode: "add" };

/** `fallback` has no filter: it compensates with a larger halo on each light. */
export function nextHalo(mode: BloomMode): HaloStyle {
  return mode === "fallback" ? HALO_FALLBACK : HALO_BASE;
}

export type StageLayer = "ground" | "shadow" | "accents";

export interface Stage {
  container: Container;
  staticCount: number;
  readonly bloom: BloomMode;
  setFocus(zone: WorldZone | null): void;
  setBloom(mode: BloomMode): void;
  /** For the lab only: toggles `visible` on the containers of a layer; the site does not call it. */
  setLayer(layer: StageLayer, visible: boolean): void;
  tick(dtMs: number): void;
  /** Frees the tree with its contexts, the `bloomSlot` even if it is outside the tree, and the filters; afterwards everything is a no-op. */
  destroy(): void;
}

/** Time constant of the alpha lerp (veil and lights): min(1, dt / LERP_MS). */
const LERP_MS = 120;

interface AccentGraphics { g: Graphics; zone: WorldZone; base: number; draw: () => void; mirror?: Graphics }

/**
 * Builds the layers of a world scene. Order, bottom to top: bleed,
 * water (static plus animated), ground, full shadow band, shadow
 * core, static solids, animated solids, veils (one per zone), static
 * accents (one per zone) and, per animated accent layer, one Graphics per zone
 * (a single one if the layer declares its zone).
 * The bloom is lazy: it starts at `off`, without a `bloomSlot`; the first `setBloom("on")`
 * builds it (mirrors of the accents with a filter) and inserts it right below `accentSlot`.
 * A `bloomSlot` built after `setLayer("accents", false)` is born hidden.
 */
export function buildStage(scene: WorldScene, animators: ZonedAnimator[]): Stage {
  const container = new Container();
  let bloom: BloomMode = "off", halo: HaloStyle = HALO_BASE, bloomSlot: Container | null = null, accentsVisible = true, destroyed = false;
  const gBleed = new Graphics(), gGround = new Graphics(), gShadow = new Graphics(), gCore = new Graphics(), gSolid = new Graphics();
  const waterSlot = new Container(), shadowSlot = new Container(), coreSlot = new Container(), solidSlot = new Container(), veilSlot = new Container(), accentSlot = new Container();
  // each shadow band is a union: the filter applies the alpha to the whole,
  // not to each polygon, so two overlapping shadows do not darken twice
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

  // veils: one Graphics per zone, sky color, alpha animated from 0
  const veils = {} as Record<WorldZone, Graphics>;
  const polys = veilPolygons();
  for (const z of WORLD_ZONES) {
    const g = new Graphics();
    for (const p of polys[z]) g.poly(p, true).fill(ISO_COLORS.sky);
    g.alpha = 0;
    veils[z] = g;
    veilSlot.addChild(g);
  }

  // static accents split by zone (worldZoneAt of their position)
  const accents: AccentGraphics[] = [];
  const byZone = accentsByZone(scene.accents);
  for (const z of WORLD_ZONES) {
    const g = new Graphics();
    g.blendMode = "add";
    const draw = (): void => drawAccents(g, byZone[z], halo);
    draw();
    accentSlot.addChild(g);
    accents.push({ g, zone: z, base: 1, draw });
  }

  // static water: every body of water that no animator claims (fallback path)
  const animatedWater = new Set(animators.flatMap((a) => [...(a.claims ?? []), ...a.ids.flatMap((id) => { const l = a.layer(id); return l.kind === "water" ? l.water : []; })]));
  const staticWater = new Graphics();
  waterSlot.addChild(staticWater);
  drawLayer(staticWater, buildRenderList([...terrain.water, terrain.foam].filter((w) => !animatedWater.has(w))), "ground");

  // one Graphics (or pair) per animated layer
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
      redraw.set(id, () => { const l = a.layer(id) as AnimLayer & { kind: "solid" }; const items = buildRenderList(l.solids, l.heading); drawLayer(gs, items, "shadow"); drawLayer(gc, items, "shadowCore"); drawLayer(g, items, "solid"); const al = l.alpha ?? 1; gs.alpha = gc.alpha = g.alpha = al; });
    } else {
      // one Graphics per zone: each light is veiled with the zone it is in, unless the layer declares its own (ships)
      const declared = (a.layer(id) as AnimLayer & { kind: "accent" }).zone;
      const draw = (): void => {
        const l = a.layer(id) as AnimLayer & { kind: "accent" };
        const byZone = accentsByZone(l.accents, declared);
        // the layer's own alpha (ships that fade out) is stored; the final alpha is set by the lerp
        for (const e of entries) { drawAccents(e.g, byZone[e.zone], halo); e.base = l.alpha ?? 1; }
      };
      const entries = (declared ? [declared] : WORLD_ZONES).map((zone): AccentGraphics => {
        const g = new Graphics();
        g.blendMode = "add";
        accentSlot.addChild(g);
        const e: AccentGraphics = { g, zone, base: 1, draw };
        accents.push(e);
        return e;
      });
      redraw.set(id, draw);
    }
    redraw.get(id)!();
  }

  // alpha lerp: per-zone targets (focusAlphas) and current values
  let target = focusAlphas(null);
  const current: Record<WorldZone, { veil: number; accents: number }> = { portfolio: { veil: 0, accents: 1 }, cv: { veil: 0, accents: 1 }, blog: { veil: 0, accents: 1 } };
  const applyAlphas = (): void => {
    for (const z of WORLD_ZONES) veils[z].alpha = current[z].veil;
    for (const e of accents) { e.g.alpha = e.base * current[e.zone].accents; if (e.mirror) e.mirror.alpha = e.g.alpha; }
  };
  const buildBloomSlot = (): Container => {
    const slot = new Container();
    slot.blendMode = "add";
    slot.visible = accentsVisible;
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
    setFocus(zone) { if (!destroyed) target = focusAlphas(zone); },
    setBloom(mode) {
      if (destroyed || mode === bloom) return;
      // the slot is built before changing the mode: if the filter failed, the Stage stays in the previous mode
      if (mode === "on") container.addChildAt(bloomSlot ?? buildBloomSlot(), container.getChildIndex(accentSlot));
      else bloomSlot?.removeFromParent();
      bloom = mode;
      const h = nextHalo(mode);
      // the Graphics of one layer share draw: each layer is redrawn once
      if (h !== halo) { halo = h; for (const draw of new Set(accents.map((e) => e.draw))) draw(); }
      applyAlphas();
    },
    setLayer(layer, visible) {
      if (destroyed) return;
      if (layer === "ground") gBleed.visible = waterSlot.visible = gGround.visible = visible;
      else if (layer === "shadow") shadowSlot.visible = coreSlot.visible = visible;
      else {
        accentsVisible = accentSlot.visible = visible;
        if (bloomSlot) bloomSlot.visible = visible;
      }
    },
    tick(dtMs) {
      if (destroyed) return;
      for (const a of animators) for (const id of a.tick(dtMs)) redraw.get(id)?.();
      const k = Math.min(1, dtMs / LERP_MS);
      for (const z of WORLD_ZONES) {
        current[z].veil += (target[z].veil - current[z].veil) * k;
        current[z].accents += (target[z].accents - current[z].accents) * k;
      }
      applyAlphas();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      // Container.destroy does not destroy `filters`; read them first, because afterwards the getter no longer returns them
      const filters = [shadowSlot, coreSlot, bloomSlot].flatMap((c) => c?.filters ?? []);
      // the mirrors share the context of their original: the tree frees it with `context: true`
      bloomSlot?.destroy({ children: true });
      container.destroy({ children: true, context: true });
      for (const f of filters) f.destroy();
    },
  };
}
