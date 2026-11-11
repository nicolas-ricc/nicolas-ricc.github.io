import { describe, expect, it } from "vitest";
import { createRng } from "../map/seed";
import { fair } from "./fair";
import { fairAnimator } from "./fair-animator";

describe("fairAnimator", () => {
  it("exposes wheel, lights, train, tower and signs; with reduced-motion it returns no ids", () => {
    const a = fairAnimator(fair(createRng(7)), { reducedMotion: false });
    expect([...a.ids].sort()).toEqual(["fair.drop", "fair.logs", "fair.neon", "fair.signs", "fair.train", "fair.wheel", "fair.wheelLights"]);
    expect(a.layer("fair.logs").kind).toBe("solid");
    expect(a.layer("fair.wheel").kind).toBe("solid"); expect(a.layer("fair.wheelLights").kind).toBe("accent");
    expect(a.tick(250).has("fair.wheel")).toBe(true);
    expect(a.tick(1000).has("fair.logs")).toBe(true);
    expect(fairAnimator(fair(createRng(7)), { reducedMotion: true }).tick(1000).size).toBe(0);
  });
  it("fair.neon is a cyan/magenta accent layer that changes as the clock advances", () => {
    const a = fairAnimator(fair(createRng(7)), { reducedMotion: false });
    const l0 = a.layer("fair.neon");
    expect(l0.kind).toBe("accent");
    if (l0.kind === "accent") for (const x of l0.accents) expect(x.color).toMatch(/^(cyan|magenta)/);
    expect(a.tick(200).has("fair.neon")).toBe(true);
    expect(a.layer("fair.neon")).not.toEqual(l0);
  });
  it("same seed → same sequence", () => {
    const mk = () => fairAnimator(fair(createRng(7)), { reducedMotion: false });
    const a = mk(), b = mk();
    for (const dt of [16, 33, 100, 250, 1000, 5000, 7000, 33]) { expect([...a.tick(dt)]).toEqual([...b.tick(dt)]); for (const id of a.ids) expect(a.layer(id)).toEqual(b.layer(id)); }
  });
});
