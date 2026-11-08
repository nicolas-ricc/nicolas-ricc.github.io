import type { Accent } from "../iso/accent";
import { polyline, v3, type Polyline, type Vec2, type Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { SeaScene } from "./sea";
import { chase, flip, pulse } from "./neon";
import { ship as buildShip, shipAt, wake, type ShipKind } from "./ships";

/**
 * Animated Blog, without Pixi: three ships with their own cycle, their wakes and lights, the amber
 * lighthouse beam (warm light, not neon) and the two buoys, plus the neons of the point:
 * the gallery runs opposite to the beam, the coast ripples and the keeper's sign alternates.
 *
 * Two semi-straight lanes between the harbor mouth and the lower-left corner of the cover: the outbound leg (`LANE_OUT`)
 * starts at the harbor mouth (362, −16), skirts the point on the east and heads south-southwest until it leaves the cover;
 * the return leg (`LANE_BACK`) enters from the lower left, runs 42 u east of the outbound leg and ends at the harbor mouth
 * (397, −39). The ships appear and fade right there (`FADE_U` fade at both ends), with no
 * trip around the bay or turn in place. Each ship rotates `out → offscreen (OFF_MS) → back →
 * offscreen (PORT_MS, "enters port")` at the same speed and ship k at phase k·T/3 of the
 * period T = `CYCLE_MS` (≈ 1172 s). The water itself (split by depth in `terrain.ts`) is not
 * this file's business: `water-animator.ts` animates it. Spec §7; semi-straight routes in #87.
 */
// Outbound lane: the path of the hull's CENTER (see `shipAt` in ships.ts), so the three ship sizes
// share the same lane. It starts at the harbor mouth (362, −16), inside the cover, and leaves toward the
// south-southeast (on screen, down and slightly left). It skirts the lighthouse point on the east at
// ~25 u from its shore: the point and its 12 u shore are Portfolio and the reef cones on the north
// face (x 397..404, y 109..111) force passing at x ≥ 424 at y ≈ 86. Gentle turns of 6°, 7°, 22°,
// 13°, 3° and 5° on screen; from (420, 232) it runs straight 420 u until it leaves the cover.
//
// The sea end (377, 647) is set so the edge of the 16:9 cover falls `FADE_U` from the
// end: that fade happens in the bleed. The harbor-mouth one is visible, on purpose. Validated against water,
// `depthAt` ≥ 6, `worldZoneAt === "blog"` for x ≥ 380, occlusion by static solids (projected
// freighter hexagon against that of each solid, see sea-anim.test.ts), `coverQuad(16/9)` and the
// launch (> 20 u). That is why the buoys and the wreck were moved in sea.ts: a ship west or north
// of a solid that overlaps it on screen ends up behind. Do not move vertices more than 2 u without revalidating.
export const LANE_OUT: readonly Readonly<Vec2>[] = [{ x: 362, y: -16 }, { x: 398, y: 40 }, { x: 424, y: 86 }, { x: 437, y: 114 }, { x: 440, y: 142 }, { x: 434, y: 176 }, { x: 420, y: 232 }, { x: 377, y: 647 }];
// Return lane, in the direction of travel (sea → harbor mouth): the same curve as the outbound lane shifted 42 u
// east and reversed. Why 42 u and not ~30: the on-screen silhouette of a freighter (60 u long) is
// ~55 px tall, and with 30 or 36 u of lateral separation two freighters side by side overlap; 42 u is
// the minimum without overlap (minimum separation between centers 41.2 u). The launch stays far. Validated like
// the outbound lane and with the silhouettes of two freighters, one per lane, that never touch on screen.
export const LANE_BACK: readonly Readonly<Vec2>[] = [{ x: 424, y: 600 }, { x: 462, y: 237 }, { x: 475, y: 185 }, { x: 482, y: 144 }, { x: 477, y: 102 }, { x: 461, y: 66 }, { x: 434, y: 18 }, { x: 397, y: -39 }];
export const SHIPS: readonly { kind: ShipKind; phase: number }[] = [{ kind: "cargo", phase: 0 }, { kind: "tug", phase: 1 / 3 }, { kind: "barge", phase: 2 / 3 }];
// Single speed: with different speeds a ship would catch up with the one ahead in the same lane and they would overlap.
export const LANE_SPEED = 1.2;
export const FADE_U = 30, TURN_U = 20;
export const OFF_MS = 15000, PORT_MS = 30000;
export const BEAM_PERIOD_MS = 8000, BEAM_LEN = 24, BEAM_INNER = 12, BEAM_HALF = (7 * Math.PI) / 180;
export const BUOY_PERIOD_MS = 2000;
export const NEON_STEP_MS = 200, COAST_PERIOD_MS = 3000, KEEPER_SIGN_MS = 4000;
const GALLERY_R_DOT = 0.45, GALLERY_LIT = 2;

// Fair launch: shuttles between the tip of the fair's pier (`fair.ts`, north
// bay) and the bay shore in front of the bulk pier. All three points are in water
// (bayWater), and the north point moors at the fair's pier (see the Task 17 adjustment below).
//
// Controller ruling (Task 8, fix): a straight line between the two piers does not work because the west coast
// of the bay reaches x ≈ 277 near y −204 (a spit between the two piers). An intermediate
// point was added that goes around it on the east. The south point was moved 6 u further east than proposed
// ((235, −84) → (241, −84)): between the intermediate and the south, near (257, −126), the original line
// touched the same coast again (a second inlet, further south) and ended up less than 6 u from land.
// With the adjustment, the minimum `depthAt` along the whole polyline is exactly 6 (at that same point).
//
// Task 17 adjustment (Task 8 rule): with the fair built, the launch ends up behind the
// pier pavilion (`fair.ts`, `copper` cone, then at (243, −277)) on screen —`isBehind(ferry,
// pavilion)` gives `true`— near the north point, between 5 % and 15 % of the first leg. Moving
// the north point 2 u east would have cleared it, but the rule asks for steps of 6 u: it was moved
// ((248, −288) → (254, −288)); there is no more overlap on that leg and `depthAt` at the point stays
// well above 6 (≈ 37).
//
// With the fair moved 36 u south (2026-09-16) the pavilion ended up at (268, −241) and the north point
// keeps the same offset (+11, −11) from it: (279, −252). Verified with the same
// rule: the minimum `depthAt` along the polyline is still 6 and no static solid ends up
// in front of the launch on screen.
export const FERRY_ROUTE: readonly Vec2[] = [{ x: 279, y: -252 }, { x: 290, y: -212 }, { x: 241, y: -84 }];
export const FERRY_SPEED = 3, FERRY_PAUSE_MS = 4000;

export type Lane = "out" | "back";
const lanes: Record<Lane, Polyline> = { out: polyline(LANE_OUT), back: polyline(LANE_BACK) };
export const laneLength = (lane: Lane): number => lanes[lane].length;

const lerpAngle = (a: number, b: number, t: number): number => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; };

/** Point and heading at `dist` units from the start of the lane; the heading is interpolated over the TURN_U around each vertex. */
export function laneAt(lane: Lane, dist: number): { x: number; y: number; heading: number } {
  const route = lanes[lane], p = route.at(dist), seg = route.segs, i = p.seg, s = seg[i]!;
  const local = Math.hypot(p.x - s.a.x, p.y - s.a.y); // distance covered within the leg: `at` does not return the accumulated one
  let heading = s.heading;
  if (local < TURN_U / 2 && i > 0) heading = lerpAngle(seg[i - 1]!.heading, s.heading, 0.5 + local / TURN_U);
  else if (s.len - local < TURN_U / 2 && i < seg.length - 1) heading = lerpAngle(s.heading, seg[i + 1]!.heading, (TURN_U / 2 - (s.len - local)) / TURN_U);
  return { x: p.x, y: p.y, heading };
}

export type ShipLane = Lane | "offscreen";
export interface ShipState { lane: ShipLane; dist: number; heading: number }

const OUT_MS = (laneLength("out") / LANE_SPEED) * 1000, BACK_MS = (laneLength("back") / LANE_SPEED) * 1000;
export const CYCLE_MS = OUT_MS + OFF_MS + BACK_MS + PORT_MS;
const OUT_END_HEADING = laneAt("out", laneLength("out")).heading, BACK_END_HEADING = laneAt("back", laneLength("back")).heading;

/** State of a ship at `ms` from the start of its cycle (`0 ≤ ms < CYCLE_MS`): outbound, off camera, return, in port (off camera). */
export function shipStateAt(ms: number): ShipState {
  if (ms < OUT_MS) { const dist = (ms / 1000) * LANE_SPEED; return { lane: "out", dist, heading: laneAt("out", dist).heading }; }
  ms -= OUT_MS;
  if (ms < OFF_MS) return { lane: "offscreen", dist: laneLength("out"), heading: OUT_END_HEADING };
  ms -= OFF_MS;
  if (ms < BACK_MS) { const dist = (ms / 1000) * LANE_SPEED; return { lane: "back", dist, heading: laneAt("back", dist).heading }; }
  return { lane: "offscreen", dist: laneLength("back"), heading: BACK_END_HEADING };
}

/** Fade of FADE_U at both ends of each lane; off camera, 0. */
export function alphaAt(lane: ShipLane, dist: number): number {
  if (lane === "offscreen") return 0;
  return Math.max(0, Math.min(1, dist / FADE_U, (laneLength(lane) - dist) / FADE_U));
}

export interface ShipFrame { solids: Solid[]; lights: Accent[]; wake: Solid[]; alpha: number; heading?: number }
export interface SeaChanges { ships: boolean[]; beam: boolean; buoys: boolean; ferry: boolean; neon: boolean }
export interface SeaAnim {
  ship(k: number): ShipFrame;
  state(k: number): ShipState;
  beam(): Accent[];
  buoys(): Accent[];
  ferry(): ShipFrame;
  neon(): Accent[];
  tick(dtMs: number): SeaChanges;
}

export function createSeaAnim(scene: SeaScene, opts: { reducedMotion: boolean }): SeaAnim {
  let clock = 0, buoyStep = 0, neonStep = 0, first = true;
  const cycle = SHIPS.map((s) => s.phase * CYCLE_MS);
  const states = cycle.map(shipStateAt);

  // The launch walks FERRY_ROUTE with no turn smoothing at the vertices (unlike the ships,
  // it turns on the spot): the heading is that of the current leg, reversed on the way back. `polyline.at` already
  // clamps the distance to the two ends, which is exactly where the launch stops.
  const ferryLine = polyline(FERRY_ROUTE);
  const ferryLen = ferryLine.length;
  const ferryPointAt = ferryLine.at;
  let ferryDist = 0, ferryDir = 1, ferryPause = FERRY_PAUSE_MS;
  const ferryFrame = (): ShipFrame => {
    const pt = ferryPointAt(ferryDist), p = { x: pt.x, y: pt.y }, heading = ferryDir > 0 ? pt.heading : pt.heading + Math.PI;
    const built = buildShip("ferry", p, heading);
    return { solids: built.solids, lights: built.lights, wake: [{ kind: "ground", mat: "foam", tris: wake("ferry", p, heading) }], alpha: 1 };
  };

  const shipFrame = (k: number): ShipFrame => {
    const s = states[k]!;
    if (s.lane === "offscreen") return { solids: [], lights: [], wake: [], alpha: 0 };
    const p = laneAt(s.lane, s.dist);
    const kind = SHIPS[k]!.kind, at = shipAt(kind, p, s.heading);
    const built = buildShip(kind, at, s.heading);
    const wakeTris = [{ kind: "ground" as const, mat: "foam" as const, tris: wake(kind, at, s.heading) }];
    return { solids: built.solids, lights: built.lights, wake: wakeTris, alpha: alphaAt(s.lane, s.dist), heading: s.heading };
  };

  const angleAt = (t: number): number => (opts.reducedMotion ? 0 : ((t % BEAM_PERIOD_MS) / BEAM_PERIOD_MS) * Math.PI * 2);
  const beamAngle = (): number => angleAt(clock);
  const wedge = (a: number, len: number, color: Accent["color"], alpha: number): Accent => {
    const o: Vec3 = scene.lantern;
    return { kind: "poly", pts: [v3(o.x, o.y, o.z), v3(o.x + len * Math.cos(a - BEAM_HALF), o.y + len * Math.sin(a - BEAM_HALF), o.z), v3(o.x + len * Math.cos(a + BEAM_HALF), o.y + len * Math.sin(a + BEAM_HALF), o.z)], color, alpha };
  };

  const buoyOn = (k: number): boolean => Math.floor((clock + k * (BUOY_PERIOD_MS / 2)) / (BUOY_PERIOD_MS / 2)) % 2 === 0;

  /** Gallery, coast and sign. Step 0 (and reduced motion) = fixed lit state; the gallery runs opposite to the beam. */
  const neon = (): Accent[] => {
    const { gallery, coast, keeperSign } = scene.neon, at = neonStep * NEON_STEP_MS;
    const on = chase(gallery.length, -neonStep, GALLERY_LIT);
    return [
      ...gallery.filter((_, k) => on[k]).map((p): Accent => ({ kind: "dot", at: p, r: GALLERY_R_DOT, color: "magenta" })),
      ...coast.map((p, k): Accent => ({ kind: "dot", at: p, r: 0.3 + 0.3 * (neonStep === 0 ? 1 : pulse(at, COAST_PERIOD_MS, k / coast.length)), color: "cyan" })),
      { ...keeperSign, color: flip(Math.floor(at / KEEPER_SIGN_MS), "cyan", "magenta") },
    ];
  };

  return {
    ship: shipFrame,
    state: (k) => states[k]!,
    beam: () => {
      const a = beamAngle();
      return [wedge(a, BEAM_LEN, "amberBleed", 0.5), wedge(a, BEAM_INNER, "amber", 0.6)];
    },
    buoys: () => scene.buoys.flatMap((b, k) => (buoyOn(k) ? [{ kind: "dot" as const, at: v3(b.x, b.y, b.z + 0.3), r: 0.8, color: "magentaMid" as const }] : [])),
    ferry: ferryFrame,
    neon,
    tick(dtMs) {
      if (opts.reducedMotion || !Number.isFinite(dtMs) || dtMs <= 0) return { ships: SHIPS.map(() => false), beam: false, buoys: false, ferry: false, neon: false };
      const all = first; first = false;
      const angle = angleAt(clock);
      clock += dtMs;
      // the rounding of `%` can only over-mark the beam, never under-mark it: the frame comes from the same `angleAt(clock)`
      const c: SeaChanges = { ships: [], beam: all || angleAt(clock) !== angle, buoys: all, ferry: all, neon: all };
      for (let k = 0; k < SHIPS.length; k++) {
        const prev = states[k]!;
        cycle[k] = (cycle[k]! + dtMs) % CYCLE_MS; states[k] = shipStateAt(cycle[k]!);
        const next = states[k]!;
        // a state transition always marks (#64), even if dist and heading coincided
        c.ships[k] = all || prev.lane !== next.lane || prev.dist !== next.dist || prev.heading !== next.heading;
      }
      const bs = Math.floor(clock / (BUOY_PERIOD_MS / 2));
      if (bs !== buoyStep) { buoyStep = bs; c.buoys = true; }
      // the time left over from the pause or from a leg carries into the next phase within the same tick
      for (let left = dtMs; left > 0;) {
        if (ferryPause > 0) {
          const used = Math.min(ferryPause, left);
          ferryPause -= used; left -= used;
          continue;
        }
        c.ferry = true;
        const toEnd = ((ferryDir > 0 ? ferryLen - ferryDist : ferryDist) / FERRY_SPEED) * 1000;
        if (toEnd > left) { ferryDist += (ferryDir * FERRY_SPEED * left) / 1000; break; }
        left -= toEnd;
        ferryDist = ferryDir > 0 ? ferryLen : 0; ferryDir = -ferryDir; ferryPause = FERRY_PAUSE_MS;
      }
      const ns = Math.floor(clock / NEON_STEP_MS);
      if (ns !== neonStep) { neonStep = ns; c.neon = true; }
      return c;
    },
  };
}
