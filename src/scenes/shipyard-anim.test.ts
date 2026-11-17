import { describe, expect, it } from "vitest";
import { createRng } from "../map/seed";
import { shipyard } from "./shipyard";
import { TROLLEY_CYCLE_MS, TROLLEY_PAUSE_MS, createShipyardAnim } from "./shipyard-anim";

const setup = (reducedMotion = false) => {
  const scene = shipyard(createRng(7));
  return { scene, anim: createShipyardAnim(scene, { reducedMotion }) };
};

describe("shipyard-anim", () => {
  it("the trolley never leaves the beam and returns to the start after a cycle", () => {
    const { scene, anim } = setup();
    const [y0, y1] = scene.trolleyRange;
    for (let t = 0; t < TROLLEY_CYCLE_MS; t += 33) {
      anim.tick(33);
      expect(scene.trolley.at.y).toBeGreaterThanOrEqual(y0 - 1e-9);
      expect(scene.trolley.at.y).toBeLessThanOrEqual(y1 + 1e-9);
    }
    anim.tick(TROLLEY_CYCLE_MS - (Math.floor(TROLLEY_CYCLE_MS / 33) * 33));
    expect(scene.trolley.at.y).toBeCloseTo(y0, 3);
  });

  it("during the initial pause the trolley does not move and tick reports no change", () => {
    const { scene, anim } = setup();
    const y = scene.trolley.at.y;
    const c = anim.tick(TROLLEY_PAUSE_MS / 2);
    expect(scene.trolley.at.y).toBe(y);
    expect(c).toEqual({ trolley: false });
  });

  it("at mid-cycle the trolley is at the other end", () => {
    const { scene, anim } = setup();
    expect(anim.tick(TROLLEY_CYCLE_MS / 2)).toEqual({ trolley: true });
    expect(scene.trolley.at.y).toBeCloseTo(scene.trolleyRange[1], 3);
  });

  it("with reduced-motion nothing ever changes", () => {
    const { scene, anim } = setup(true);
    const y = scene.trolley.at.y;
    for (let i = 0; i < 100; i++) expect(anim.tick(200)).toEqual({ trolley: false });
    expect(scene.trolley.at.y).toBe(y);
  });

  it("no lamp and no sparks (#403): the animation only moves the trolley", () => {
    expect(Object.keys(setup().anim)).toEqual(["tick"]);
  });
});

describe("shipyard-anim: chunking (#125)", () => {
  const chunked = (dts: number[]) => {
    const { scene, anim } = setup();
    for (const dt of dts) anim.tick(dt);
    return scene.trolley.at.y;
  };
  const repeat = (n: number, dt: number) => Array.from({ length: n }, () => dt);
  it("one 60 s tick leaves the same as 600 ticks of 100 ms", () => {
    expect(chunked([60000])).toBeCloseTo(chunked(repeat(600, 100)), 9);
  });
  it("an irregular chunking leaves the same as its sum", () => {
    const dts = [16, 33, 100, 250, 1000, 5000, 7000, 33, 1234];
    expect(chunked(dts)).toBeCloseTo(chunked([dts.reduce((s, x) => s + x, 0)]), 9);
  });
  it("an invalid dt changes nothing", () => {
    const { scene, anim } = setup();
    const y = scene.trolley.at.y;
    for (const dt of [0, -5, NaN, Infinity]) expect(anim.tick(dt)).toEqual({ trolley: false });
    expect(scene.trolley.at.y).toBe(y);
  });
});
