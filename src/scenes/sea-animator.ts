import { layerLookup, type AnimLayer, type Animator } from "./animator";
import type { SeaScene } from "./sea";
import { SHIPS, createSeaAnim } from "./sea-anim";

/** Adapts the sea to the `Animator` contract: ships, lighthouse beam, buoys and neons of the point (`sea.neon`). Not the water: terrain.ts splits it and water-animator.ts animates it. */
export function seaAnimator(scene: SeaScene, opts: { reducedMotion: boolean }): Animator {
  const anim = createSeaAnim(scene, opts);
  const layers: Record<string, () => AnimLayer> = {
    "sea.beam": () => ({ kind: "accent", accents: anim.beam() }),
    "sea.buoys": () => ({ kind: "accent", accents: anim.buoys() }),
    "sea.neon": () => ({ kind: "accent", accents: anim.neon() }),
    "sea.ferry": () => { const f = anim.ferry(); return { kind: "solid", solids: f.solids }; },
    "sea.ferryWake": () => { const f = anim.ferry(); return { kind: "water", water: f.wake }; },
    // the launch always runs through Portfolio waters
    "sea.ferryLights": () => { const f = anim.ferry(); return { kind: "accent", accents: f.lights, zone: "portfolio" }; },
  };
  SHIPS.forEach((_, k) => {
    layers[`sea.ship${k}`] = () => { const f = anim.ship(k); return { kind: "solid", solids: f.solids, alpha: f.alpha, heading: f.heading }; };
    layers[`sea.wake${k}`] = () => { const f = anim.ship(k); return { kind: "water", water: f.wake, alpha: f.alpha }; };
    // the ships spend almost their whole route in Blog
    layers[`sea.lights${k}`] = () => { const f = anim.ship(k); return { kind: "accent", accents: f.lights, alpha: f.alpha, zone: "blog" }; };
  });
  return {
    ids: Object.keys(layers),
    layer: layerLookup("seaAnimator", layers),
    tick(dtMs) {
      const c = anim.tick(dtMs);
      const out = new Set<string>();
      SHIPS.forEach((_, k) => { if (c.ships[k]) { out.add(`sea.ship${k}`); out.add(`sea.wake${k}`); out.add(`sea.lights${k}`); } });
      if (c.beam) out.add("sea.beam");
      if (c.buoys) out.add("sea.buoys");
      if (c.neon) out.add("sea.neon");
      if (c.ferry) { out.add("sea.ferry"); out.add("sea.ferryWake"); out.add("sea.ferryLights"); }
      return out;
    },
  };
}
