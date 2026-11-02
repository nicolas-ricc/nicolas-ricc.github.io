import { layerLookup, type AnimLayer, type Animator } from "./animator";
import type { TerrainMesh } from "./terrain";
import { BANDS, createWaterAnim } from "./water-anim";

/** Adapts the water to the `Animator` contract. Claims every water body and the foam: the runtime does not paint them static. */
export function waterAnimator(terrain: TerrainMesh, opts: { reducedMotion: boolean }): Animator {
  const anim = createWaterAnim(terrain, opts);
  const layers: Record<string, () => AnimLayer> = {};
  for (let k = 0; k < BANDS; k++) layers[`water.band${k}`] = () => ({ kind: "water", water: anim.band(k) });
  layers["water.foam"] = () => ({ kind: "water", water: anim.foam() });
  return {
    ids: Object.keys(layers),
    claims: [...terrain.water, terrain.foam],
    layer: layerLookup("waterAnimator", layers),
    tick(dtMs) {
      const c = anim.tick(dtMs), out = new Set<string>();
      for (const k of c.bands) out.add(`water.band${k}`);
      if (c.foam) out.add("water.foam");
      return out;
    },
  };
}
