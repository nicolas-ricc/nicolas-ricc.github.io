import { describe, expect, it } from "vitest";
import { overlaps, screenBounds, type ScreenBounds } from "../iso/depth";
import { bounds, type Solid } from "../iso/solids";
import { checkSign, checkSignFont, COVER_LAPTOP, COVER_PHONE } from "../kit/legibility";
import { seaPlatformAt, type WritingSite } from "../scenes/sign-platform";
import { assembleWorld } from "../world/assemble";
import { signBox } from "../world/signs";
import { contextScene } from "./crop";
import { EXHIBITS } from "./exhibits";

// The sign gate (#376): every context exhibit passes level 1 (the font) and level 2 (the projected sign in its scene).
// Registering a sign's context exhibit is enough to put it under the gate.
const contexts = EXHIBITS.flatMap((e) => (e.kind === "context" ? [e] : []));
const { scene } = assembleWorld(undefined, { reducedMotion: false });
/** The Writing platform at `site`: since #427 it is not in `scene.solids` but in platformAnimator. */
const platform = (site: WritingSite): Solid[] => { const out: Solid[] = []; seaPlatformAt(out, [], site); return out; };
/** `b` grown by `d` screen units (scale 1) on each side. */
const grow = (b: ScreenBounds, d: number): ScreenBounds => ({ minX: b.minX - d, minY: b.minY - d, maxX: b.maxX + d, maxY: b.maxY + d });

describe("sign gate: levels 1 and 2 on every context exhibit", () => {
  it("there is at least one context exhibit", () => {
    expect(contexts.length).toBeGreaterThan(0);
  });
  describe.each(contexts.map((e) => [e.id, e] as const))("%s", (_id, e) => {
    it("checkSignFont = []", () => {
      expect(checkSignFont(e.sign)).toEqual([]);
    });
    const solids = contextScene(scene, e).solids;
    for (const scale of [COVER_LAPTOP, COVER_PHONE]) {
      it(`checkSign at ${scale} = []`, () => {
        expect(checkSign(e.sign, scale, solids)).toEqual([]);
      });
    }
    // The crop above only holds what lies in the exhibit's box; the whole world (#394) also brings any solid
    // that crosses the letters on screen from outside it; a Writing exhibit adds the platform of its site (#427).
    const near = [...scene.solids, ...(e.writingSite ? platform(e.writingSite) : [])].filter((s) => overlaps(screenBounds(bounds(s)), grow(signBox(e.sign), 4)));
    // the Writing board lies alone on open sea (#442): nothing but the board crosses its letters, a stronger statement than "something else does"
    if (e.writingSite) {
      it("nothing but the sign's own board crosses the letters' screen box", () => {
        expect(near).toEqual(e.sign.backing);
      });
    } else {
      it("world solids besides the sign's own backing cross the letters' screen box", () => {
        expect(near.length).toBeGreaterThan(e.sign.backing.length);
      });
    }
    for (const scale of [COVER_LAPTOP, COVER_PHONE]) {
      it(`checkSign against the whole world at ${scale} = []`, () => {
        expect(checkSign(e.sign, scale, near)).toEqual([]);
      });
    }
  });
});
