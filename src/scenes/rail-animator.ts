import { layerLookup, type AnimLayer, type Animator } from "./animator";
import { createRailAnim } from "./rail-anim";

/** Adapta el tren de la línea al contrato `Animator`: el tren (`rail.train`), sus luces (`rail.lights`), las del paso a nivel y los semáforos. Las luces van en la zona de Portfolio: la vía y la estación son de ahí. */
export function railAnimator(opts: { reducedMotion: boolean }): Animator {
  const anim = createRailAnim(opts);
  const layers: Record<string, () => AnimLayer> = {
    "rail.train": () => { const t = anim.train(); return { kind: "solid", solids: t.solids, alpha: t.alpha }; },
    "rail.lights": () => { const t = anim.train(); return { kind: "accent", accents: t.lights, alpha: t.alpha, zone: "portfolio" }; },
    "rail.crossing": () => ({ kind: "accent", accents: anim.crossing(), zone: "portfolio" }),
    "rail.signals": () => ({ kind: "accent", accents: anim.signals(), zone: "portfolio" }),
  };
  return {
    ids: Object.keys(layers),
    layer: layerLookup("railAnimator", layers),
    tick(dtMs) {
      const c = anim.tick(dtMs);
      const out = new Set<string>();
      if (c.train) { out.add("rail.train"); out.add("rail.lights"); }
      if (c.crossing) out.add("rail.crossing");
      if (c.signals) out.add("rail.signals");
      return out;
    },
  };
}
