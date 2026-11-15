import { describe, expect, it } from "vitest";
import { checkFont, checkSign, COVER_LAPTOP, COVER_PHONE } from "../kit/legibility";
import { assembleWorld } from "../world/assemble";
import { contextScene } from "./crop";
import { EXHIBITS } from "./exhibits";

// The sign gate (#376): every context exhibit passes level 1 (the font) and level 2 (the projected sign in its scene).
// Registering a sign's context exhibit is enough to put it under the gate.
const contexts = EXHIBITS.flatMap((e) => (e.kind === "context" ? [e] : []));
const { scene } = assembleWorld(undefined, { reducedMotion: false });

describe("sign gate: levels 1 and 2 on every context exhibit", () => {
  it("there is at least one context exhibit", () => {
    expect(contexts.length).toBeGreaterThan(0);
  });
  describe.each(contexts.map((e) => [e.id, e] as const))("%s", (_id, e) => {
    it("checkFont = []", () => {
      expect(checkFont(e.sign.text, e.sign.size, e.sign.width)).toEqual([]);
    });
    const solids = contextScene(scene, e).solids;
    for (const scale of [COVER_LAPTOP, COVER_PHONE]) {
      it(`checkSign at ${scale} = []`, () => {
        expect(checkSign(e.sign, scale, solids)).toEqual([]);
      });
    }
  });
});
