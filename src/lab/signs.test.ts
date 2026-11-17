import { describe, expect, it } from "vitest";
import { overlaps, screenBounds, type ScreenBounds } from "../iso/depth";
import { bounds } from "../iso/solids";
import { checkSign, checkSignFont, COVER_LAPTOP, COVER_PHONE } from "../kit/legibility";
import { assembleWorld } from "../world/assemble";
import { signBox } from "../world/signs";
import { contextScene } from "./crop";
import { EXHIBITS } from "./exhibits";

// The sign gate (#376): every context exhibit passes level 1 (the font) and level 2 (the projected sign in its scene).
// Registering a sign's context exhibit is enough to put it under the gate.
const contexts = EXHIBITS.flatMap((e) => (e.kind === "context" ? [e] : []));
const { scene } = assembleWorld(undefined, { reducedMotion: false });
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
    // that crosses the letters on screen from outside it.
    const near = scene.solids.filter((s) => overlaps(screenBounds(bounds(s)), grow(signBox(e.sign), 4)));
    it("some world solids cross the letters' screen box", () => {
      expect(near.length).toBeGreaterThan(0);
    });
    for (const scale of [COVER_LAPTOP, COVER_PHONE]) {
      it(`checkSign against the whole world at ${scale} = []`, () => {
        expect(checkSign(e.sign, scale, near)).toEqual([]);
      });
    }
  });
});
