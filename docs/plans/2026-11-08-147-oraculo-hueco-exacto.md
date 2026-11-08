# Exact concave-gap oracle (#147): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `concaveIntruders` in `src/kit/kit.test.ts` stops sampling each solid's box on a 5×5 grid and measures exactly how much of the gap of a concave `poly` falls inside that box, so a narrow solid crossing the gap between two grid rows is caught.

**Architecture:** The gap of a concave `poly` is its convex hull minus its footprint. For every other solid `o` of the piece, with `B = bounds(o)` projected to plan, the gap area inside `B` is `area(clip(hull, B)) − area(clip(footprint, B))`, where `clip` is Sutherland-Hodgman of a polygon against an axis-aligned rectangle (it is exact in area for a concave subject, because the clip region is convex). `o` is an intruder when that area exceeds `GAP_AREA_EPS = 1e-6`. A solid flush with the faces of the gap contributes area 0, so the tolerance replaces `onEdge`; `inPoly`, `onEdge` and the 5×5 loop go away. Everything stays inside the test file: the oracle is test-only code.

**Tech Stack:** TypeScript strict, Vitest (`npm test`), `npm run typecheck`.

**Spec:** issue #147 and its triage "Agent Brief" comment of 2026-11-08 (behaviour, acceptance criteria, out of scope).

## Global Constraints

- Signature stays `concaveIntruders(solids: Solid[]): number`; it returns the number of (concave poly, foreign solid) pairs whose gap area inside the solid's plan box is `> 1e-6`. Callers keep `toBeGreaterThan(0)` / `toBe(0)`.
- Gap area = `area(clip(convexHull(footprint), box)) − area(clip(footprint, box))`, box = `bounds(o)` in x/y.
- `onEdge`, `inPoly` and the 5×5 sampling are deleted (nothing else uses them).
- The oracle stays in plan: z is out of scope. Recipes do not change.
- "no foreign solid inside the gap of a concave poly" stays green for every registered recipe. If a recipe fails, the PR reports it; the test is not relaxed.
- Test names, comments and identifiers in English, like the rest of `kit.test.ts`. No new dependencies.
- `npm test` and `npm run typecheck` green at the end.

## Declared decisions

1. **Return a count of intruding pairs, not the area.** The issue allows either; a count keeps both call sites and the failure message readable ("1 intruder") and leaves the two existing assertions untouched.
2. **Helpers local to `kit.test.ts`** (`clipToBox`, `area`). No production code needs polygon clipping; promoting them to `src/iso/geometry.ts` would add API with a single test caller (YAGNI).
3. **Degenerate boxes contribute 0.** A box with zero width or depth in plan has area 0 and can never be an intruder. Every `Solid` kind that a recipe emits has positive plan extent (`beam` and `strip` have `w`/`width`), so this does not hide a case today.

## Review Focus

1. A thin slab crossing the gap between grid rows (the issue's L and slab): must be an intruder. Pinned by Task 1's new test.
2. A footprint given clockwise instead of counter-clockwise: the area must be the same (absolute shoelace; Sutherland-Hodgman is orientation-agnostic for the subject). Pinned by Task 1's "either winding" test.
3. A solid whose box covers the whole concave poly (a roof slab larger than the L): the whole gap is inside the box, so it is an intruder. Pinned by Task 1's "covers the gap" assertion.
4. A solid that touches the gap only along a face or at the reflex vertex: area 0, not an intruder. Pinned by the existing "flush with the faces" test, which must stay green unchanged.
5. A solid entirely outside the convex hull: clipping the hull gives an empty polygon, area 0, not an intruder. Pinned by Task 1's "outside the hull" assertion.

---

### Task 1: Exact gap-area oracle

**Files:**
- Modify: `src/kit/kit.test.ts:24-58` (`inPoly`, `onEdge`, `concaveIntruders`) and `:71-85` (`describe("kit: the concave-gap oracle")`)

**Interfaces:**
- Consumes: `convexHull(input: Vec2[]): Vec2[]` (`src/iso/geometry.ts`), `bounds(s: Solid): Bounds` (`src/iso/solids.ts`).
- Produces: `concaveIntruders(solids: Solid[]): number` (same signature), used by the recipe contract test "no foreign solid inside the gap of a concave poly".

- [ ] **Step 1: Write the failing tests** in `describe("kit: the concave-gap oracle")`:

```ts
it("detects a thin slab crossing the gap between two rows of a 5×5 grid", () => {
  const L: Solid = { kind: "poly", footprint: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 14 }, { x: 0, y: 14 }], z: 0, h: 6, mat: "plaster" };
  const slab: Solid = { kind: "prism", at: { x: -6, y: 12, z: 0 }, w: 40, d: 0.5, h: 0.4, mat: "stone" };
  expect(concaveIntruders([L, slab])).toBe(1);
});

it("measures the gap with either winding of the footprint, and ignores what lies outside the hull", () => {
  const ccw = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 10 }, { x: 0, y: 10 }];
  for (const footprint of [ccw, [...ccw].reverse()]) {
    const L: Solid = { kind: "poly", footprint, z: 0, h: 6, mat: "plaster" };
    const roof: Solid = { kind: "prism", at: { x: -1, y: -1, z: 6 }, w: 12, d: 12, h: 0.4, mat: "stone" };
    const outside: Solid = { kind: "prism", at: { x: 12, y: 12, z: 0 }, w: 2, d: 2, h: 2, mat: "stone" };
    expect(concaveIntruders([L, roof])).toBe(1);
    expect(concaveIntruders([L, outside])).toBe(0);
  }
});
```

The two existing tests ("detects a solid inside the gap of an L and not one resting on the wing", "a solid flush with the faces of the gap …") stay as they are.

- [ ] **Step 2: Run to verify the slab test fails**

Run: `npx vitest run src/kit/kit.test.ts -t "concave-gap oracle"`
Expected: "detects a thin slab …" FAILS (`expected 0 to be 1`): no grid point of the slab's box lands in the gap (the one at x 4 is on the footprint's edge). "… either winding …" also FAILS (`expected 4 to be 1`): the old oracle counts sample points, not pairs. The two existing tests pass.

- [ ] **Step 3: Implement** in `src/kit/kit.test.ts`, replacing `inPoly`, `onEdge` and the body of `concaveIntruders`:
  - `const GAP_AREA_EPS = 1e-6;`
  - `function area(poly: Vec2[]): number` — absolute shoelace area.
  - `function clipToBox(poly: Vec2[], min: Vec2, max: Vec2): Vec2[]` — Sutherland-Hodgman against the four half-planes `x ≥ min.x`, `x ≤ max.x`, `y ≥ min.y`, `y ≤ max.y` in turn; intersection points on the boundary line computed by linear interpolation; returns `[]` when everything is clipped.
  - `concaveIntruders` keeps its outer loops and the `hull.length === footprint.length` convexity skip; per foreign solid it computes the gap area in `bounds(o)` (only `.x`/`.y` of `min`/`max`) and adds 1 when it is `> GAP_AREA_EPS`. Doc comment says what it measures and that flush faces contribute 0.
  - Remove the now unused `inPoly`/`onEdge`.

- [ ] **Step 4: Run the oracle and the recipe contract**

Run: `npx vitest run src/kit/kit.test.ts`
Expected: all PASS, including "no foreign solid inside the gap of a concave poly" for every recipe. If a recipe fails, stop and report it (do not relax the test, do not touch the recipe).

- [ ] **Step 5: Full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: both green.

- [ ] **Step 6: Commit**

```bash
git add src/kit/kit.test.ts
git commit -m "fix(#147): exact concave-gap oracle by rectangle clipping"
```
