import { describe, expect, it } from "vitest";
import type { Vec2 } from "../iso/geometry";
import { bounds, type Solid } from "../iso/solids";
import { createRng } from "../map/seed";
import { CAR } from "../kit/props";
import { crosswalks, onOrdinaryStreet, axisSpan } from "../city/crossings";
import { AVENUE, BRIDGE, DARSENA, EAST_RING, PROMENADE, blocks } from "./city-grid";
import { FOOTBRIDGE_LOT } from "../city/zoning";
import { AXES, HOTEL_LOT, PLAZA_MAYOR, inRect, crossingPlazas, inCrossingPlaza, inParcel, polyCentroid } from "./city-plan";
import { city } from "./city";
import { SEED } from "../map/seed";
import { zoneRng } from "./world";
import { inPlaza } from "../city/streets";
import { PLINTH_H } from "./city-pieces";

const s = city(createRng(7), createRng(8), createRng(9));

describe("city streets (#473)", () => {
  it("no parked car within 3 of a crosswalk", () => {
    const boxes = crosswalks().flatMap((w) => w.strips.map(([p, q]) => ({ x0: Math.min(p.x, q.x) - 0.4, x1: Math.max(p.x, q.x) + 0.4, y0: Math.min(p.y, q.y) - 0.4, y1: Math.max(p.y, q.y) + 0.4 })));
    const cars = s.solids.filter((x) => x.kind === "prism" && (x.mat === "steel" || x.mat === "rust") && x.w === CAR.w && x.d === CAR.d && x.h === 1.2);
    expect(cars.length).toBeGreaterThan(0);
    for (const c of cars) {
      const b = bounds(c);
      for (const k of boxes) expect(b.min.x - 3 < k.x1 && b.max.x + 3 > k.x0 && b.min.y - 3 < k.y1 && b.max.y + 3 > k.y0, `car at ${b.min.x},${b.min.y}`).toBe(false);
    }
  });

  it("street lamps only on axes, plaza, crossing plazas, costanera, bridge and promenade; none on ordinary streets", () => {
    const lamps = s.accents.filter((a): a is typeof a & { kind: "dot" } => a.kind === "dot" && a.color === "amber" && a.r === 0.6);
    expect(lamps.length).toBeGreaterThanOrEqual(20);
    const onAxisSidewalk = (p: Vec2) => AXES.some((a) => {
      const sp = axisSpan(a);
      if (!sp) return false;
      const [f, t] = sp, L = Math.hypot(t.x - f.x, t.y - f.y), ux = (t.x - f.x) / L, uy = (t.y - f.y) / L;
      const along = (p.x - f.x) * ux + (p.y - f.y) * uy, across = Math.abs(-(p.x - f.x) * uy + (p.y - f.y) * ux);
      return along >= -1 && along <= L + 1 && across <= a.w / 2 + 2;
    });
    const centers = crossingPlazas().map(polyCentroid);
    for (const l of lamps) {
      const p = { x: l.at.x, y: l.at.y }, tag = `${p.x},${p.y}`;
      const inPlaza = p.x >= PLAZA_MAYOR.x && p.x <= PLAZA_MAYOR.x + PLAZA_MAYOR.w && p.y >= PLAZA_MAYOR.y && p.y <= PLAZA_MAYOR.y + PLAZA_MAYOR.d;
      const inCrossing = inCrossingPlaza(p.x, p.y) || centers.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 1);
      const costanera = Math.abs(p.x - 190.8) < 1e-6;
      const east = p.x >= EAST_RING.x0 && p.y >= AVENUE.y0 - 3 && p.y <= AVENUE.y1 + 3, promenade = p.x >= PROMENADE.x0, bridge = p.x >= BRIDGE.x0 && p.x <= BRIDGE.x1 && p.y >= BRIDGE.y0 - 1 && p.y <= BRIDGE.y1 + 1;
      const inlet = p.x >= DARSENA.x0 - 2 && p.x <= DARSENA.x1 + 2 && p.y >= DARSENA.y0 - 2 && p.y <= DARSENA.y1 + 2;
      const yard = p.y === 150.3 && [-39.7, 0.3, 40.3, 80.3].includes(p.x), kit = blocks().some((b) => p.x >= b.x - 1 && p.x <= b.x + b.w + 1 && p.y >= b.y - 1 && p.y <= b.y + b.d + 1) || inParcel(p.x, p.y) || (p.x >= FOOTBRIDGE_LOT.x && p.x <= FOOTBRIDGE_LOT.x + FOOTBRIDGE_LOT.w && p.y >= FOOTBRIDGE_LOT.y && p.y <= FOOTBRIDGE_LOT.y + FOOTBRIDGE_LOT.d);
      expect(onAxisSidewalk(p) || inPlaza || inCrossing || costanera || bridge || east || promenade || inlet || yard || kit, tag).toBe(true);
      expect(onOrdinaryStreet(p, 0) && !inParcel(p.x, p.y), `${tag} on an ordinary street`).toBe(false);
    }
  });

  it("every new post stands on the solid below it and cuts into no other solid (site seed and seed 7)", () => {
    for (const sc of [city(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1), zoneRng(SEED, "cv", 3)), s]) {
      const isPost = (x: Solid): x is Solid & { kind: "prism" } => x.kind === "prism" && x.mat === "steel" && ((x.w === 0.6 && x.d === 0.6 && x.h === 5) || (x.w === 0.3 && x.d === 0.3 && x.h === 4));
      const posts = sc.solids.filter(isPost).filter((x) => x.at.x < EAST_RING.x0 && x.at.y >= 158 && !inRect(HOTEL_LOT, x.at.x, x.at.y)); // the hotel's own portal lamps (#474) are not this child's
      expect(posts.length).toBeGreaterThan(80);
      const others = sc.solids.filter((x) => !isPost(x)).map(bounds);
      for (const p of posts) {
        const b = bounds(p), cx = p.at.x + p.w / 2, cy = p.at.y + p.d / 2, tag = `post at ${cx.toFixed(2)},${cy.toFixed(2)}`;
        const hit = others.find((o) => b.min.x < o.max.x - 1e-6 && o.min.x < b.max.x - 1e-6 && b.min.y < o.max.y - 1e-6 && o.min.y < b.max.y - 1e-6 && b.min.z < o.max.z - 1e-6 && o.min.z < b.max.z - 1e-6
          && !(o.min.z >= p.at.z + p.h - 1e-6)); // the traffic light's own head sits on top of its post
        expect(hit, `${tag} cuts into ${JSON.stringify(hit)}`).toBeUndefined();
        const under = others.filter((o) => o.min.x <= cx && cx <= o.max.x && o.min.y <= cy && cy <= o.max.y && o.max.z <= p.at.z + 1e-6).reduce((z, o) => Math.max(z, o.max.z), 0);
        expect(Math.abs(p.at.z - under) < 1e-6 || (inPlaza(cx, cy) && p.at.z === 0.05) || (inParcel(cx, cy) && p.at.z === PLINTH_H), `${tag} at z ${p.at.z}, ground ${under}`).toBe(true); // a recipe with its own ground lifts it to the plinth height, with no plinth solid
      }
      for (let i = 0; i < posts.length; i++) for (let j = i + 1; j < posts.length; j++) {
        const a = bounds(posts[i]!), b = bounds(posts[j]!);
        expect(a.min.x < b.max.x && b.min.x < a.max.x && a.min.y < b.max.y && b.min.y < a.max.y, `posts ${posts[i]!.at.x},${posts[i]!.at.y} and ${posts[j]!.at.x},${posts[j]!.at.y}`).toBe(false);
      }
    }
  });
});
