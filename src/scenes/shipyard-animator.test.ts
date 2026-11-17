import { describe, expect, it } from "vitest";
import { createRng } from "../map/seed";
import { shipyard } from "./shipyard";
import { TROLLEY_CYCLE_MS } from "./shipyard-anim";
import { shipyardAnimator } from "./shipyard-animator";

const setup = (reducedMotion = false) => {
  const scene = shipyard(createRng(7));
  return { scene, anim: shipyardAnimator(scene, { reducedMotion }) };
};

describe("shipyardAnimator", () => {
  it("exposes one solid layer, the trolley (#403: no lamp, no sparks)", () => {
    const { scene, anim } = setup();
    expect([...anim.ids]).toEqual(["trolley"]);
    const t = anim.layer("trolley");
    expect(t.kind === "solid" && t.solids).toEqual([scene.trolley]);
  });

  it("when the trolley moves, the trolley changes", () => {
    const { anim } = setup();
    expect([...anim.tick(TROLLEY_CYCLE_MS / 2)]).toEqual(["trolley"]);
  });

  it("with reduced-motion nothing changes", () => {
    const { anim } = setup(true);
    expect(anim.tick(500).size).toBe(0);
  });
});
