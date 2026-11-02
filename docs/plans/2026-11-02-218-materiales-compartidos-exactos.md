# Exact equality for the materials Portfolio shares with the city (#218): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the `world.test.ts` test "astillero + fábrica, ciudad + distrito y Blog no comparten materiales de construcción, salvo los compartidos por regla" asserts the **exact** set of materials Portfolio shares with the city. Today it only checks a subset. With an exact set, the test fails when a shared material stops being used, and also when a new one appears.

**Architecture:** this is a test-only change in `src/scenes/world.test.ts`. The subset check (`arrayContaining(["rust", "steel"])` plus a `toContain` loop) becomes one `toEqual` against a sorted constant. The Portfolio side of the measurement also counts `w.factory!.excavator`, the Portfolio solids that live outside `factory.solids` since #216. Production code is unchanged, so the render is identical.

**Tech Stack:** TypeScript, Vitest.

**Spec:** issue #218 (follow-up of #208). Background: `docs/plans/2026-10-24-208-materiales-fabrica.md` §"Regla de zona como subconjunto".

## Global Constraints

- From the issue: "Cuando #213 y #216 estén mergeados, la aserción puede volver a la igualdad exacta … para que el test detecte si alguno deja de usarse." #213 and #216 are both closed.
- The Blog half of the test (`sharedWithBlog`) stays as it is. The issue only covers Portfolio ∩ city.
- `npm test` and `npm run typecheck` are green. Commits: the red assertion lands as `test(#218): evals`, and the measurement change as `fix(#218): …`.

## Data

I measured `world(7)` with the test's own formula (`s.mat` of every solid whose `kind !== "cone"`):

| Set | Materials |
|---|---|
| `shipyard.solids ∪ factory.solids` ∩ `city.solids` | `asphalt, paving, rust, steel, stone` |
| `factory.excavator` | `office, rust, safety, steel, whitewash` |
| `city.solids` | `asphalt, curtain, leaf, leafDark, office, officeDark, paving, plaza, rust, steel, stone` (no `safety`, `whitewash` or `glass`) |
| `city.solids` (does it contain `glass`?) | no. City glass only comes from facades (`facade.base: "glass"`, windows): faces generated in `src/iso/facade.ts`, never a solid's `mat` |

Every row was measured with a throwaway Vitest probe that applied the test's `mats()` to `world(7)` and was not committed. Once the change is in, the test itself reproduces the measurement: on failure, `toEqual` prints the received array.

The test's current allowlist is `["glass", "office", "rust", "steel", "asphalt", "stone", "paving"]`. #277 added `asphalt`, and #278 added `stone` and `paving`.

## Technical decisions (declared)

1. **The excavator counts as Portfolio.** `office` reached Portfolio with the excavator (#216, decision of #207). The excavator is rendered from `factory.excavator` (the animated layer `factory.excavator` in `factory-animator.ts`), not from `factory.solids`. Without it the test cannot see `office`, which defeats the purpose the issue gives it: "detecte si alguno deja de usarse". The wheel (`excavatorWheel`) is left out. It is created per frame (`factory-anim.ts:40`) and is all `rust` (`excavator.ts:20-23`: `mat` and `buckets.mat`), which the set already contains.
2. **`glass` leaves the city-shared list.** The measurement is by solid `mat`. The city has no solid made of `glass`: its glass comes only from facade faces. If facade faces were counted, the test would mean something else, because every facade's sills, grids and slabs would enter the set too. That is outside this issue. A comment records why `glass` is missing.
3. **The expected set is `["asphalt", "office", "paving", "rust", "steel", "stone"]`, sorted, compared against the sorted intersection.** The issue's literal list (`glass, office, rust, steel`) predates #277 and #278. The issue asks for exact equality, and this is the exact set of today's scene.
4. **Comments stay in Spanish**, like the rest of `world.test.ts`. The per-material comments (#277, #278, #207) are kept.

## Review Focus

1. If one of the six materials stops being shared (for example, someone recolours the excavator platform), the test must fail. Covered by the exact `toEqual`.
2. A new shared material must fail too (the old loop already did this). Also covered by the `toEqual`.
3. The intersection's order depends on solid order. Sorting it keeps the test from breaking when solids are reordered. Covered by `.sort()` on both sides.
4. `w.factory` is null when the zone is missing. `world(7)` builds every zone, and the test already uses `!` for `shipyard`/`factory`, so the same pattern applies.
5. The Blog half must not change behaviour. `portfolio` also feeds the Blog loop, so adding the excavator adds `office`, `safety` and `whitewash` to the Portfolio side. The Blog loop iterates over `blog` materials, and `blog` has neither `office` nor `safety`. `whitewash` was already in `portfolio` (from the factory) and in `sharedWithBlog`. The Blog verdict therefore stays the same, and Step 5 runs that test as well.

---

### Task 1: exact Portfolio ∩ city assertion

**Files:**
- Modify: `src/scenes/world.test.ts:62-74`

**Interfaces:**
- Consumes: `world(7).factory!.excavator: Solid[]` (`FactoryScene` in `src/scenes/factory.ts:33`).
- Produces: nothing.

- [ ] **Step 1 (evals, red): replace lines 66–71 with the exact assertion**

```ts
const sharedWithCity = ["asphalt", "office", "paving", "rust", "steel", "stone"]; // ordenado; comentarios por material
expect([...portfolio].filter((m) => cv.has(m)).sort()).toEqual(sharedWithCity);
```

Comments to keep or add: `office`, the excavator platform (#207/#216); `asphalt`, the station traffic-light heads (#277); `stone` and `paving`, the clock tower and the esplanade (#278); no `glass`, with the reason from Decision 2.

- [ ] **Step 2: run it and confirm the failure**

Run: `npx vitest run src/scenes/world.test.ts -t "no comparten materiales"`
Expected: FAIL, because `office` is missing from the received array (the excavator is not counted yet).

- [ ] **Step 3: commit** `test(#218): evals`.

- [ ] **Step 4: count the excavator on the Portfolio side**

`portfolio = mats([...w.shipyard!.solids, ...w.factory!.solids, ...w.factory!.excavator])`, with a short comment explaining that the excavator lives outside `factory.solids` (#216).

- [ ] **Step 5: run it and confirm it passes**

Run: `npx vitest run src/scenes/world.test.ts`. Expected: PASS. Then run `npm test` and `npm run typecheck`, both green.

- [ ] **Step 6: commit** `fix(#218): igualdad exacta Portfolio ∩ ciudad, con la excavadora`.

## Assumptions

- **A1 (D1):** the excavator counts on the Portfolio side. Rejected alternative: leaving it out and also dropping `office` from the set. The test would then not see the material that #216 introduced and that the issue mentions by name.
- **A2 (D2):** `glass` is not part of the exact set, because the test measures solid `mat` and the city only has glass in facade faces (`city.ts:47`, `facade.ts:128`). Rejected alternative: counting facade and plate faces. That would change what "materiales de construcción" means in this test, and every facade material (sills, grids, slabs) would enter the set. No visual change either way, so this is not a spec ambiguity.
- **A3 (D3):** the extra materials `asphalt`, `stone` and `paving` are part of the rule. #277 ("sumar a la lista de la ciudad `asphalt` y `paving` si la estación los usa") and #278 ("si la estación usa `stone` (torre) hay que sumarlo con el motivo") added them on purpose.

## Grilling

- Rounds: 1. The revision corrected wording and added data, but changed no task or seam, so there was no second round.
- Questions: 13. By source: ISSUE 3 (Q1, Q4, Q7: #218, #277, #278), CODE 9 (Q2, Q3, Q5, Q6, Q8, Q9, Q10, Q12, Q13), NO SOURCE 1 (Q11, technical: the convention of a red `test(#N): evals` commit comes from the pipeline, and this repo's history has it, e.g. `test(#203)` 6b0bd05. The branch is squash-merged, so no red commit reaches `main`).
- Assumptions: A1–A3.
- Issues opened: none.
