/** Screen box of a sign's word, split out of `signs.ts` so `view.ts` can use it without an import cycle (#428). Pure geometry. */
import type { ScreenBounds } from "../iso/depth";
import { project } from "../iso/project";
import type { SignSpec } from "../kit/legibility";

/** Minimum host px between Writing's word and every host edge (#428). */
export const WRITING_SITE_MARGIN = 8;

const boxes = new WeakMap<SignSpec, ScreenBounds>();

/** Screen box of the projected glyph quads (the word itself). Memoized. */
export function signBox(spec: SignSpec): ScreenBounds {
  let b = boxes.get(spec);
  if (!b) {
    const pts = spec.glyphs.flatMap((g) => g.quads.flat()).map(project);
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    b = { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
    boxes.set(spec, b);
  }
  return b;
}
