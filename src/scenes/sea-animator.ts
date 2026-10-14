import type { AnimLayer, Animator } from "./animator";
import type { SeaScene } from "./sea";
import { SHIPS, createSeaAnim } from "./sea-anim";

/** Adapta el mar al contrato `Animator`: barcos, haz del faro, boyas y neones de la punta (`sea.neon`). El agua no: la reparte terrain.ts y la anima water-animator.ts. */
export function seaAnimator(scene: SeaScene, opts: { reducedMotion: boolean }): Animator {
  const anim = createSeaAnim(scene, opts);
  const layers: Record<string, () => AnimLayer> = {
    "sea.beam": () => ({ kind: "accent", accents: anim.beam() }),
    "sea.buoys": () => ({ kind: "accent", accents: anim.buoys() }),
    "sea.neon": () => ({ kind: "accent", accents: anim.neon() }),
    "sea.ferry": () => { const f = anim.ferry(); return { kind: "solid", solids: f.solids }; },
    "sea.ferryWake": () => { const f = anim.ferry(); return { kind: "water", water: f.wake }; },
    "sea.ferryLights": () => { const f = anim.ferry(); return { kind: "accent", accents: f.lights }; },
  };
  SHIPS.forEach((_, k) => {
    layers[`sea.ship${k}`] = () => { const f = anim.ship(k); return { kind: "solid", solids: f.solids, alpha: f.alpha }; };
    layers[`sea.wake${k}`] = () => { const f = anim.ship(k); return { kind: "water", water: f.wake, alpha: f.alpha }; };
    layers[`sea.lights${k}`] = () => { const f = anim.ship(k); return { kind: "accent", accents: f.lights, alpha: f.alpha }; };
  });
  return {
    ids: Object.keys(layers),
    layer: (id) => layers[id]!(),
    tick(dtMs) {
      const c = anim.tick(dtMs);
      const out = new Set<string>();
      if (c.ships) SHIPS.forEach((_, k) => { out.add(`sea.ship${k}`); out.add(`sea.wake${k}`); out.add(`sea.lights${k}`); });
      if (c.beam) out.add("sea.beam");
      if (c.buoys) out.add("sea.buoys");
      if (c.neon) out.add("sea.neon");
      if (c.ferry) { out.add("sea.ferry"); out.add("sea.ferryWake"); out.add("sea.ferryLights"); }
      return out;
    },
  };
}
