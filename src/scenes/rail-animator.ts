import { layerLookup, type AnimLayer, type Animator } from "./animator";
import { flip } from "./neon";
import { createRailAnim } from "./rail-anim";
import { emu, trainLen } from "./train";

/** Adapts the line's train to the `Animator` contract: the train (`rail.train`), its lights (`rail.lights`), those of the level crossing and the signals. The lights go in the Portfolio zone: the track and the station belong there. */
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

/** Every how many ms the train piece switches ends (headlights east, headlights west). */
export const PIECE_FLIP_MS = 4000;

/** The consist of the train piece: 4 cars centered on the origin, with the saloon lit. The exhibit builds the solids; `trainPieceAnimator`, the lights. */
export const pieceTrain = (lead: "e" | "w") => emu(-trainLen(4) / 2, 0, { cars: 4, lead, lit: true });

/**
 * Animator of the storybook's train piece: the train still at the origin and, in the `tren.lights` layer, its lights (saloon, sign, headlights and red lights). Every `PIECE_FLIP_MS` it flips the lead end, so both ends are seen; with `reducedMotion` it stays fixed facing east and `tick` marks nothing. The lights go in the Portfolio zone, as on the line.
 */
export function trainPieceAnimator(opts: { reducedMotion: boolean }): Animator {
  const { reducedMotion } = opts;
  let clock = 0, first = true, lead: "e" | "w" = "e";
  const lights = { e: pieceTrain("e").lights, w: pieceTrain("w").lights }; // two fixed sets: the layer is read several times per redraw
  const layers: Record<string, () => AnimLayer> = {
    "tren.lights": () => ({ kind: "accent", accents: lights[lead], zone: "portfolio" }),
  };
  return {
    ids: Object.keys(layers),
    layer: layerLookup("trainPieceAnimator", layers),
    tick(dtMs) {
      const out = new Set<string>();
      if (reducedMotion || dtMs <= 0) return out;
      clock += dtMs;
      const next = flip(Math.floor(clock / PIECE_FLIP_MS), "e", "w");
      // the first time it is always marked: the layer has not been drawn yet
      if (first || next !== lead) out.add("tren.lights");
      first = false; lead = next;
      return out;
    },
  };
}
