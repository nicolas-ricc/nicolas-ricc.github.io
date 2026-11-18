import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import type { Solid } from "../iso/solids";
import { platformAnimator } from "./platform-animator";
import { seaPlatformAt, type WritingSite } from "./sign-platform";

const built = (site: WritingSite) => { const solids: Solid[] = [], accents: Accent[] = []; seaPlatformAt(solids, accents, site); return { solids, accents }; };
const BOTH = new Set(["platform.solid", "platform.lights"]);
const solidsOf = (a: ReturnType<typeof platformAnimator>) => { const l = a.layer("platform.solid"); if (l.kind !== "solid") throw new Error(l.kind); return l.solids; };

describe("platformAnimator (#427)", () => {
  it("two layers, platform.solid and platform.lights; the site starts wide unless given", () => {
    expect(platformAnimator().ids).toEqual(["platform.solid", "platform.lights"]);
    expect(platformAnimator().site).toBe("wide");
    expect(platformAnimator({ site: "tall" }).site).toBe("tall");
  });

  it("the layers hold seaPlatformAt's solids and accents at the current site; the lights declare no zone", () => {
    const a = platformAnimator(), { solids, accents } = built("wide");
    expect(a.layer("platform.solid")).toEqual({ kind: "solid", solids });
    const lights = a.layer("platform.lights");
    expect(lights).toEqual({ kind: "accent", accents });
    expect("zone" in lights).toBe(false);
  });

  it("tick reports both layers once after a site change, and nothing without one", () => {
    const a = platformAnimator();
    expect(a.tick(16)).toEqual(new Set());
    a.setSite("tall");
    expect(a.site).toBe("tall");
    expect(a.tick(16)).toEqual(BOTH);
    expect(solidsOf(a)).toEqual(built("tall").solids);
    expect(a.layer("platform.lights")).toEqual({ kind: "accent", accents: built("tall").accents });
    expect(a.tick(16)).toEqual(new Set());
  });

  it("setSite with the current site marks nothing", () => {
    const a = platformAnimator({ site: "tall" });
    a.setSite("tall");
    expect(a.tick(16)).toEqual(new Set());
  });

  it("there and back before a tick: the site did not change since the last tick, so nothing is redrawn", () => {
    const a = platformAnimator();
    a.setSite("tall");
    a.setSite("wide");
    expect(a.tick(16)).toEqual(new Set());
  });

  it("each site is built once: coming back to a site reuses its arrays", () => {
    const a = platformAnimator(), first = solidsOf(a);
    a.setSite("tall"); a.tick(16);
    a.setSite("wide"); a.tick(16);
    expect(solidsOf(a)).toBe(first);
  });

  it("a site change is not motion: tick(0) and tick(NaN) still report it", () => {
    const a = platformAnimator();
    a.setSite("tall");
    expect(a.tick(0)).toEqual(BOTH);
    a.setSite("wide");
    expect(a.tick(NaN)).toEqual(BOTH);
  });

  it("an unknown layer id throws", () => {
    expect(() => platformAnimator().layer("nope")).toThrow(/platformAnimator/);
  });
});
