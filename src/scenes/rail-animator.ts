import { layerLookup, type AnimLayer, type Animator } from "./animator";
import { flip } from "./neon";
import { createRailAnim } from "./rail-anim";
import { emu, trainLen } from "./train";

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

/** Cada cuántos ms la pieza del tren cambia de punta (faros al este, faros al oeste). */
export const PIECE_FLIP_MS = 4000;

/** La formación de la pieza `tren`: 4 coches centrados en el origen, con el salón encendido. Los sólidos los arma el exhibit; las luces, `trainPieceAnimator`. */
export const pieceTrain = (lead: "e" | "w") => emu(-trainLen(4) / 2, 0, { cars: 4, lead, lit: true });

/**
 * Animador de la pieza `tren` del storybook: el tren quieto en el origen y, en la capa `tren.lights`, sus luces (salón, cartel, faros y rojas). Cada `PIECE_FLIP_MS` invierte la punta, así se ven los dos extremos; con `reducedMotion` queda fijo mirando al este y `tick` no marca nada. Las luces van en la zona de Portfolio, como en la línea.
 */
export function trainPieceAnimator(opts: { reducedMotion: boolean }): Animator {
  const { reducedMotion } = opts;
  let clock = 0, first = true, lead: "e" | "w" = "e";
  const lights = { e: pieceTrain("e").lights, w: pieceTrain("w").lights }; // dos juegos fijos: la capa se lee varias veces por redibujo
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
      // la primera vez se marca siempre: la capa todavía no se dibujó
      if (first || next !== lead) out.add("tren.lights");
      first = false; lead = next;
      return out;
    },
  };
}
