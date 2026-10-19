import { describe, expect, it } from "vitest";
import { sortByDepth } from "../iso/depth";
import { VIEW_DIR } from "../iso/project";
import { tessellateAll, type Solid } from "../iso/solids";
import { SHIP_SPECS, ship, type ShipKind } from "./ships";

const EPS = 1e-6;
const KINDS = Object.keys(SHIP_SPECS) as ShipKind[];
const AT = { x: 37, y: -12 };

/** Caja del sólido en el marco del barco: vértices trasladados a la popa y girados −heading. */
function localBox(s: Solid, heading: number) {
  const c = Math.cos(heading), sn = Math.sin(heading);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const f of tessellateAll(s)) for (const p of f.pts) {
    const dx = p.x - AT.x, dy = p.y - AT.y, v = [dx * c + dy * sn, -dx * sn + dy * c, p.z];
    for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i]!, v[i]!); max[i] = Math.max(max[i]!, v[i]!); }
  }
  return { min, max };
}

describe("orden de las piezas de cada barco respecto de su casco", () => {
  it("en 72 rumbos: piezas de cubierta después del casco, piezas de costado del lado que mira la vista", () => {
    const fails: string[] = [];
    for (const kind of KINDS) for (let deg = 0; deg < 360; deg += 5) {
      const h = (deg * Math.PI) / 180;
      const { solids } = ship(kind, AT, h), order = sortByDepth(solids, h);
      const vx = VIEW_DIR.x * Math.cos(h) + VIEW_DIR.y * Math.sin(h), vy = -VIEW_DIR.x * Math.sin(h) + VIEW_DIR.y * Math.cos(h);
      for (const hull of solids) {
        if (hull.kind !== "hull") continue;
        const hb = localBox(hull, h), deck = hull.at.z + hull.h, at = order.indexOf(hull);
        for (const [i, p] of solids.entries()) {
          if (p.kind === "hull") continue;
          const pb = localBox(p, h);
          const inPlan = pb.min[0]! < hb.max[0]! - EPS && hb.min[0]! < pb.max[0]! - EPS && pb.min[1]! < hb.max[1]! - EPS && hb.min[1]! < pb.max[1]! - EPS;
          if (!inPlan) continue;
          const after = order.indexOf(p) > at;
          if (pb.min[2]! >= deck - EPS) { if (!after) fails.push(`${kind} ${deg}°: pieza de cubierta #${i} antes del casco`); continue; }
          if (pb.max[2]! <= hb.min[2]! + EPS) continue; // bajo la quilla: no es pieza de costado
          const t = ((pb.min[0]! + pb.max[0]! - hb.min[0]! - hb.max[0]!) * vx + (pb.min[1]! + pb.max[1]! - hb.min[1]! - hb.max[1]!) * vy) / 2;
          if (Math.abs(t) <= EPS) continue; // la vista corre paralela: no hay lado
          if (after !== t > 0) fails.push(`${kind} ${deg}°: pieza de costado #${i} ${t > 0 ? "cercana antes" : "lejana después"} del casco`);
        }
      }
    }
    expect(fails).toEqual([]);
  });
});
