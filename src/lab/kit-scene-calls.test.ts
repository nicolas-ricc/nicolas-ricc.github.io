import { describe, expect, it, vi } from "vitest";
import { RECIPES } from "../kit/index";
import { kitScene } from "./kit-scene";

// Own file: the mock wraps every recipe of the registry with a counter and must not leak into kit-scene.test.ts.
const calls = vi.hoisted(() => ({}) as Record<string, number>);
vi.mock("../kit/index", async (orig) => {
  const m = await orig<typeof import("../kit/index")>();
  return { ...m, RECIPES: m.RECIPES.map((d) => ({ ...d, recipe: (...a: Parameters<typeof d.recipe>) => { calls[d.name] = (calls[d.name] ?? 0) + 1; return d.recipe(...a); } })) };
});

describe("kit lab scene: recipe calls", () => {
  it("each recipe is called once per lot", () => {
    for (let s = 1; s <= 5; s++) {
      for (const k of Object.keys(calls)) delete calls[k];
      kitScene(s, "downtown");
      expect(Object.keys(calls).sort()).toEqual(RECIPES.map((r) => r.name).sort()); // the mock applied: every recipe was counted
      for (const [name, n] of Object.entries(calls)) expect(n, `seed ${s} ${name}`).toBe(1);
    }
  });
});
