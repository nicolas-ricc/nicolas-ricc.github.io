import type { Accent } from "../iso/accent";
import { hides, overlaps, screenBounds } from "../iso/depth";
import { facadeWindows, type Facade } from "../iso/facade";
import type { Vec3 } from "../iso/geometry";
import { bounds, isFlat, visibleWalls, type Solid } from "../iso/solids";
import type { Rng } from "../map/seed";
import { lightBox, WINDOW_ALPHA } from "../city/lights";

/**
 * windowCool windows of the Portfolio halls, workshops and sheds. Only ground-floor rectangular
 * walls count (`facadeWindows` assumes the base on `pts[0]→pts[1]`: gables and the second
 * step level are out). Pure module: shipyard() pours the result. Windows hidden by another
 * raised solid are not lit; the factory is out of scope (#332).
 */
export interface WindowCandidate { pts: Vec3[]; owner: Solid; hidden: boolean }

const LIT = 0.3;
const SHED_X = 300; // sheds: any gable prism from here east (no measures, in case #323 changes them)
const HALL: Facade = { floors: 1, cols: 12 };
const WORKSHOP: Facade = { floors: 1, cols: 5 };
const SHED: Facade = { floors: 1, cols: 10 };

/** Facade of a window owner, or `null`. Halls and workshops by their literal measures in shipyard.ts. */
function facadeOf(s: Solid & { kind: "prism" }): Facade | null {
  if (s.roof === "gable" && s.at.x >= SHED_X) return SHED;
  if (s.mat !== "concrete") return null;
  if (s.roof === "gable" && s.w === 90 && s.d === 16 && s.h === 10) return HALL;
  if (s.roof === "step" && s.w === 24 && s.d === 14 && s.h === 7) return WORKSHOP;
  return null;
}

export function windowCandidates(solids: Solid[]): WindowCandidate[] {
  const occluders = solids.filter((s) => !isFlat(s)).map((s) => ({ s, b: bounds(s), sb: screenBounds(bounds(s)) }));
  const out: WindowCandidate[] = [];
  for (const owner of solids) {
    if (owner.kind !== "prism") continue;
    const facade = facadeOf(owner);
    if (!facade) continue;
    const shed = facade === SHED;
    for (const wall of visibleWalls(owner)) {
      const [p0, p1] = [wall.pts[0]!, wall.pts[1]!];
      if (wall.pts.length !== 4 || p0.z !== owner.at.z || p1.z !== owner.at.z) continue;
      if (shed ? wall.normal.x <= 0 : wall.normal.x <= 0 && wall.normal.y <= 0) continue;
      for (const { pts } of facadeWindows(wall, facade)) {
        const box = lightBox(pts), sb = screenBounds(box);
        out.push({ pts, owner, hidden: occluders.some((o) => o.s !== owner && overlaps(sb, o.sb) && hides(box, o.b)) });
      }
    }
  }
  return out;
}

/** Lights 30 % of the visible candidates: the `round(0.3 n)` of lowest rng key, in candidate order. */
export function portfolioWindows(solids: Solid[], rng: Rng): Accent[] {
  const vis = windowCandidates(solids).filter((c) => !c.hidden);
  const keys = vis.map(() => rng.next());
  const lowest = keys.map((k, i) => ({ k, i })).sort((a, b) => a.k - b.k).slice(0, Math.round(LIT * vis.length));
  const on = new Set(lowest.map((e) => e.i));
  return vis.filter((_, i) => on.has(i)).map((c): Accent => ({ kind: "poly", pts: c.pts, color: "windowCool", alpha: WINDOW_ALPHA }));
}
