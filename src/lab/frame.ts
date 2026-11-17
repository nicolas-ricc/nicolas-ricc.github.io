import type { Accent } from "../iso/accent";
import { project } from "../iso/project";
import { buildRenderList, type RenderItem } from "../iso/render-list";
import type { Animator } from "../scenes/animator";
import { BEAM_PERIOD_MS } from "../scenes/sea-anim";
import type { WorldScene } from "../scenes/world";
import { type Box, boxFrame, FRAME_H, HALO_FALLBACK } from "../world/frame";

/** Animation samples per frame: 16 steps of `BEAM_PERIOD_MS / 16` make one full 8 s turn. */
export const FRAME_SAMPLES = 16;

const HALO_REACH = Math.max(...HALO_FALLBACK.map((h) => h.k));

/** A dot as its halo's four axis extremes (same bounding box as the disc), a poly as its projected points. */
function accentItems(accents: readonly Accent[]): RenderItem[] {
  return accents.map((a) => {
    if (a.kind === "poly") return { layer: "ground", pts: a.pts.flatMap((v) => { const s = project(v); return [s.x, s.y]; }), color: 0 };
    const { x, y } = project(a.at), R = a.r * HALO_REACH;
    return { layer: "ground", pts: [x - R, y, x + R, y, x, y - R, x, y + R], color: 0 };
  });
}

/** Items for `fitTransform` covering what an exhibit draws: the static list (terrain, ground, solids, shadows clipped to `clip`), static accents with halos, 16 animation samples (ticks the animators 8 s) and `boxFrame(box, h ?? FRAME_H)`. */
export function contentFrame(
  scene: Pick<WorldScene, "terrain" | "ground" | "solids" | "accents">,
  animators: readonly Animator[],
  opts: { box?: Box; h?: number; clip?: Box } = {},
): RenderItem[] {
  const { box, h, clip } = opts, { terrain } = scene;
  const out = buildRenderList([...terrain.ground, ...terrain.bleed, ...terrain.water, terrain.foam, ...scene.ground, ...scene.solids], undefined, clip);
  out.push(...accentItems(scene.accents));
  for (let k = 0; k < FRAME_SAMPLES; k++) {
    for (const an of animators) for (const id of an.ids) {
      const l = an.layer(id);
      if (l.kind === "solid") out.push(...buildRenderList(l.solids, l.heading, clip));
      else if (l.kind === "accent") out.push(...accentItems(l.accents));
      else out.push(...buildRenderList(l.water));
    }
    for (const an of animators) an.tick(BEAM_PERIOD_MS / FRAME_SAMPLES);
  }
  if (box) out.push(...boxFrame(box, h ?? FRAME_H));
  return out;
}
