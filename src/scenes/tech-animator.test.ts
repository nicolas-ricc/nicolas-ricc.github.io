import { describe, expect, it } from "vitest";
import { createRng } from "../map/seed";
import { tech } from "./tech";
import { techAnimator } from "./tech-animator";

describe("techAnimator", () => {
  it("exposes signs and homes; with reduced-motion it returns no ids", () => {
    const a = techAnimator(tech(createRng(7)), createRng(3), { reducedMotion: false });
    expect([...a.ids].sort()).toEqual(["tech.homes", "tech.signs"]);
    expect(a.layer("tech.signs").kind).toBe("accent");
    expect(techAnimator(tech(createRng(7)), createRng(3), { reducedMotion: true }).tick(1000).size).toBe(0);
  });
  it("tech.signs changes as the clock advances", () => {
    const a = techAnimator(tech(createRng(7)), createRng(3), { reducedMotion: false });
    const l0 = a.layer("tech.signs");
    expect(l0.kind).toBe("accent");
    expect(a.tick(1000).has("tech.signs")).toBe(true);
    expect(a.layer("tech.signs")).not.toEqual(l0);
  });
  it("same seed → same sequence", () => {
    const mk = () => techAnimator(tech(createRng(7)), createRng(3), { reducedMotion: false });
    const a = mk(), b = mk();
    for (const dt of [16, 33, 100, 250, 1000, 5000, 7000, 33]) { expect([...a.tick(dt)]).toEqual([...b.tick(dt)]); for (const id of a.ids) expect(a.layer(id)).toEqual(b.layer(id)); }
  });
});
