import { describe, expect, it } from "vitest";
import { createRng } from "../map/seed";
import { tech } from "./tech";
import { techAnimator } from "./tech-animator";

describe("techAnimator", () => {
  it("exposes windows, signs and telecom; with reduced-motion it returns no ids", () => {
    const a = techAnimator(tech(createRng(7)), createRng(3), { reducedMotion: false });
    expect([...a.ids].sort()).toEqual(["tech.homes", "tech.neon", "tech.signs", "tech.telecom", "tech.windows"]);
    expect(a.layer("tech.windows").kind).toBe("accent");
    expect(techAnimator(tech(createRng(7)), createRng(3), { reducedMotion: true }).tick(1000).size).toBe(0);
  });
  it("tech.neon is a cyan/magenta accent layer that changes as the clock advances", () => {
    const a = techAnimator(tech(createRng(7)), createRng(3), { reducedMotion: false });
    const l0 = a.layer("tech.neon");
    expect(l0.kind).toBe("accent");
    if (l0.kind === "accent") for (const x of l0.accents) expect(x.color).toMatch(/^(cyan|magenta)/);
    let seen = false;
    for (let i = 0; i < 20; i++) if (a.tick(100).has("tech.neon")) seen = true;
    expect(seen).toBe(true);
    expect(a.layer("tech.neon")).not.toEqual(l0);
  });
  it("same seed → same sequence", () => {
    const mk = () => techAnimator(tech(createRng(7)), createRng(3), { reducedMotion: false });
    const a = mk(), b = mk();
    for (const dt of [16, 33, 100, 250, 1000, 5000, 7000, 33]) { expect([...a.tick(dt)]).toEqual([...b.tick(dt)]); for (const id of a.ids) expect(a.layer(id)).toEqual(b.layer(id)); }
  });
});
