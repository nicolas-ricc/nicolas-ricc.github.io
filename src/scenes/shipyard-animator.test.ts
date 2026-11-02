import { describe, expect, it } from "vitest";
import { createRng } from "../map/seed";
import { shipyard } from "./shipyard";
import { TROLLEY_CYCLE_MS } from "./shipyard-anim";
import { shipyardAnimator } from "./shipyard-animator";

const setup = (reducedMotion = false) => {
  const scene = shipyard(createRng(7));
  return { scene, anim: shipyardAnimator(scene, createRng(3), { reducedMotion }) };
};

describe("shipyardAnimator", () => {
  it("exposes three named layers of the right kind", () => {
    const { scene, anim } = setup();
    expect([...anim.ids].sort()).toEqual(["sparks", "trolley", "trolleyLamp"]);
    const t = anim.layer("trolley");
    expect(t.kind === "solid" && t.solids).toEqual([scene.trolley]);
    expect(anim.layer("trolleyLamp").kind).toBe("accent");
    expect(anim.layer("sparks").kind).toBe("accent");
  });

  it("when the trolley moves, trolley and lamp change", () => {
    const { anim } = setup();
    const c = anim.tick(TROLLEY_CYCLE_MS / 2);
    expect(c.has("trolley")).toBe(true);
    expect(c.has("trolleyLamp")).toBe(true);
  });

  it("with reduced-motion nothing changes", () => {
    const { anim } = setup(true);
    expect(anim.tick(500).size).toBe(0);
  });
});
