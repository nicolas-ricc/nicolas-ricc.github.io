import { describe, expect, it } from "vitest";
import { sortByDepth } from "../iso/depth";
import { VIEW_DIR } from "../iso/project";
import { hullRings, tessellateAll, type Solid } from "../iso/solids";
import { pointInPolygon } from "../map/geo";
import { SHIP_SPECS, ship, type ShipKind } from "./ships";

const EPS = 1e-6;
const KINDS = Object.keys(SHIP_SPECS) as ShipKind[];
const AT = { x: 37, y: -12 };

/** Ship-frame transform: translated to the stern point and rotated by −heading. */
const toLocal = (x: number, y: number, heading: number): [number, number] => {
  const c = Math.cos(heading), sn = Math.sin(heading), dx = x - AT.x, dy = y - AT.y;
  return [dx * c + dy * sn, -dx * sn + dy * c];
};

/** Box of the solid in the ship frame (vertices through `toLocal`). */
function localBox(s: Solid, heading: number) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const f of tessellateAll(s)) for (const p of f.pts) {
    const v = [...toLocal(p.x, p.y, heading), p.z];
    for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i]!, v[i]!); max[i] = Math.max(max[i]!, v[i]!); }
  }
  return { min, max };
}

type Box = ReturnType<typeof localBox>;

/**
 * Expected side of a piece against its hull (1 after, −1 before, 0 no rule), from the #195 definition: deck piece;
 * inside the deck outline (after if it rises above the midship deck, else before); under the keel; otherwise by the
 * outward normal of the hull face it hangs from (an end if |u| >= |w|, else a band), dotted with the view.
 */
function expectedSide(hb: Box, pb: Box, deck: number, ring: number[], vx: number, vy: number): number {
  if (pb.min[2]! >= deck - EPS) return 1;
  const corners = [[pb.min[0]!, pb.min[1]!], [pb.max[0]!, pb.min[1]!], [pb.max[0]!, pb.max[1]!], [pb.min[0]!, pb.max[1]!]];
  if (corners.every(([x, y]) => pointInPolygon(x!, y!, ring))) return pb.max[2]! > deck + EPS ? 1 : -1;
  if (pb.max[2]! <= hb.min[2]! + EPS) return 0;
  const u = (pb.min[0]! + pb.max[0]! - hb.min[0]! - hb.max[0]!) / (hb.max[0]! - hb.min[0]!);
  const w = (pb.min[1]! + pb.max[1]! - hb.min[1]! - hb.max[1]!) / (hb.max[1]! - hb.min[1]!);
  const t = Math.abs(u) >= Math.abs(w) ? Math.sign(u) * vx : Math.sign(w) * vy;
  return Math.abs(t) <= EPS ? 0 : Math.sign(t);
}

describe("order of each ship's pieces against its hull", () => {
  it("at 72 headings: deck pieces after the hull, side pieces on the side of the hull face they hang from", () => {
    const fails: string[] = [];
    for (const kind of KINDS) for (let deg = 0; deg < 360; deg += 5) {
      const h = (deg * Math.PI) / 180;
      const { solids } = ship(kind, AT, h), order = sortByDepth(solids, h);
      // view in the ship frame (rotation only: translation does not change a direction)
      const vx = VIEW_DIR.x * Math.cos(h) + VIEW_DIR.y * Math.sin(h), vy = -VIEW_DIR.x * Math.sin(h) + VIEW_DIR.y * Math.cos(h);
      for (const hull of solids) {
        if (hull.kind !== "hull") continue;
        const hb = localBox(hull, h), deck = hull.at.z + hull.h, at = order.indexOf(hull);
        const ring = hullRings(hull).deck.flatMap((q) => toLocal(q.x, q.y, h));
        for (const [i, p] of solids.entries()) {
          if (p.kind === "hull") continue;
          const pb = localBox(p, h);
          const inPlan = pb.min[0]! < hb.max[0]! - EPS && hb.min[0]! < pb.max[0]! - EPS && pb.min[1]! < hb.max[1]! - EPS && hb.min[1]! < pb.max[1]! - EPS;
          if (!inPlan) continue;
          const side = expectedSide(hb, pb, deck, ring, vx, vy);
          if (side === 0) continue; // under the keel, or the face is edge-on to the view: no side
          const after = order.indexOf(p) > at;
          if (after !== side > 0) fails.push(`${kind} ${deg}°: piece #${i} expected ${side > 0 ? "after" : "before"} the hull`);
        }
      }
    }
    expect(fails).toEqual([]);
  });

  it("the ferry's aft starboard fender at heading 0 is drawn after the hull (#195)", () => {
    const { solids } = ship("ferry", AT, 0);
    const hull = solids.find((s) => s.kind === "hull")!;
    const fenders = solids.filter((s): s is Solid & { kind: "cylinder" } => s.kind === "cylinder" && s.mat === "asphalt");
    const aft = fenders.reduce((a, b) => (b.at.x < a.at.x ? b : a));
    expect(aft.at.x - AT.x).toBeCloseTo(5);
    expect(aft.at.y - AT.y).toBeCloseTo(2.05);
    const order = sortByDepth(solids, 0);
    expect(order.indexOf(aft)).toBeGreaterThan(order.indexOf(hull));
  });
});
