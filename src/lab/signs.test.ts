import { describe, expect, it } from "vitest";
import { overlaps, screenBounds, type ScreenBounds } from "../iso/depth";
import { bounds, type Solid } from "../iso/solids";
import { checkSign, checkSignFont, COVER_LAPTOP, COVER_PHONE, SIGN_RULES, signMetrics } from "../kit/legibility";
import { CYCLE_POSES, REST_POSE, seaPlatformAt, signAt, type RaftPose, type WritingSite } from "../scenes/sign-platform";
import { assembleWorld } from "../world/assemble";
import { signBox } from "../world/signs";
import { contextScene, cropScene, cropSolids } from "./crop";
import { EXHIBITS } from "./exhibits";

// The sign gate (#376): every context exhibit passes level 1 (the font) and level 2 (the projected sign in its scene).
// Registering a sign's context exhibit is enough to put it under the gate.
const contexts = EXHIBITS.flatMap((e) => (e.kind === "context" ? [e] : []));
const { scene } = assembleWorld(undefined, { reducedMotion: false });
/** The Writing platform at `site`: since #427 it is not in `scene.solids` but in platformAnimator. */
const platform = (site: WritingSite, pose: RaftPose = REST_POSE): Solid[] => { const out: Solid[] = []; seaPlatformAt(out, site, pose); return out; };
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

// The raft heaves, pitches and rolls (#444, #456): level 2 has to hold at every pose of CYCLE_POSES, not only at rest. The exhibits show the rest pose;
// here the crop keeps everything but the rest raft (`cropScene`, which `contextScene` extends with it) and takes the posed raft instead.
describe("sign gate: level 2 across the pose cycle of the Writing raft (#444, #456)", () => {
  const writing = contexts.flatMap((e) => (e.writingSite ? [[e.id, e, e.writingSite] as const] : []));
  it("both Writing sites have a context exhibit", () => {
    expect(writing.map(([, , site]) => site).sort()).toEqual(["tall", "wide"]);
  });
  describe.each(writing)("%s", (_id, e, site) => {
    const base = cropScene(scene, e.box).solids;
    it("the exhibit's scene is this crop plus the rest board, so swapping in the posed board audits the same scene", () => {
      expect(contextScene(scene, e).solids).toEqual([...base, ...cropSolids(platform(site), e.box)]);
      expect(cropSolids(platform(site), e.box)).toEqual(platform(site));
    });
    const deg = (r: number) => ((r * 180) / Math.PI).toFixed(1);
    CYCLE_POSES.forEach((pose, k) => {
      const sign = signAt(site, pose), board = platform(site, pose);
      const near = [...scene.solids, ...board].filter((s) => overlaps(screenBounds(bounds(s)), grow(signBox(sign), 4)));
      for (const scale of [COVER_LAPTOP, COVER_PHONE]) {
        it(`pose ${k}/17 (dz ${pose.dz.toFixed(2)}, pitch ${deg(pose.pitch)}°, roll ${deg(pose.roll)}°): checkSign at ${scale} = [] in the crop and against the whole world`, () => {
          expect(checkSign(sign, scale, [...base, ...board])).toEqual([]);
          expect(checkSign(sign, scale, near)).toEqual([]);
        });
      }
    });
  });
});

describe("Writing on the ground floors over the pose cycle (#460)", () => {
  it.each(["wide", "tall"] as const)("%s: the worst x-height over CYCLE_POSES is ≥ the ground floor at 1.17 and 0.83", (site) => {
    for (const scale of [COVER_LAPTOP, COVER_PHONE]) {
      const worst = Math.min(...CYCLE_POSES.map((p) => signMetrics(signAt(site, p), scale).xHeightPx));
      expect(worst, `${site} ${scale}`).toBeGreaterThanOrEqual(SIGN_RULES.ground[scale].xHeightPx);
    }
  });
});
