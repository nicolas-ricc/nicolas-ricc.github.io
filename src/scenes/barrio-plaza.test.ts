import { describe, expect, it } from "vitest";
import { bounds } from "../iso/solids";
import { blockAt, faces, inside, newCtx } from "./barrio-fixtures";
import { plaza } from "./barrio-plaza";
import { blockParity } from "./tech-zoning";

describe("plaza de barrio (marcador)", () => {
  const b0 = blockAt(132, 496), b1 = blockAt(132, 472);
  const build = (b: typeof b0) => { const ctx = newCtx(); plaza(ctx, b); return ctx; };
  const lamps = (b: typeof b0) => build(b).solids.filter((s) => s.kind === "prism" && s.mat === "steel").map((s) => { const r = bounds(s); return [r.min.x - b.x, r.min.y - b.y]; });
  it("las dos plazas vecinas tienen paridad distinta", () => expect(blockParity(b0)).not.toBe(blockParity(b1)));
  for (const b of [b0, b1]) it(`(${b.x},${b.y}): césped, dos senderos en diagonal, calesita, dos faroles; dentro del tope`, () => {
    const ctx = build(b);
    expect(ctx.ground.filter((s) => s.kind === "strip" && s.mat === "paving" && s.width === 1.2)).toHaveLength(2);
    const ring = ctx.solids.filter((s) => s.kind === "cylinder" && s.mat === "signal");
    expect(ring).toHaveLength(1);
    const c = ring[0]!.kind === "cylinder" ? ring[0]!.at : null;
    if (blockParity(b) === 0) { expect(c!.x).toBeGreaterThan(b.x + 12); expect(c!.y).toBeLessThan(b.y + 9); }
    else { expect(c!.x).toBeLessThan(b.x + 12); expect(c!.y).toBeGreaterThan(b.y + 9); }
    expect(lamps(b)).toHaveLength(2);
    for (const s of [...ctx.solids, ...ctx.ground]) expect(inside(s, b, 2)).toBe(true);
    expect(faces(ctx)).toBeLessThanOrEqual(60);
  });
  it("los faroles cambian de lugar con la paridad", () => expect(lamps(b0)).not.toEqual(lamps(b1)));
});
