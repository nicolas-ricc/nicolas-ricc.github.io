# The tinker scaffold keeps its posts off the factory siding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No ground post of the PORTFOLIO tinker sign stands on the factory siding's track; the #247 plan rule covers the sign's solids with no identity exemption, the sign's world-overlap test sees `strip` solids, and `REPORT.md` is regenerated.

**Architecture:** `tinkerSign` gains a `tracks` parameter (plan rectangles a ground post must keep off, default `SIDING_TRACKS`: the siding's track, y `SIDING_Y − 1 .. SIDING_Y + 1`). `post()` slides a post that lands on a track along `u` (the row's own direction, so it stays under its longitudinal beam) by the smallest amount that clears it, then `footAt` nudges it off hall edges as today, and a post still on a track throws. The piece exhibit passes `[]`: it has no siding, and its baseline hash must not move. The #247 test replaces the identity exemption with one rule for every band solid: clear the siding and the pieces in plan, or pass wholly above them (`b.min.z ≥ o.max.z`).

**Tech Stack:** TypeScript, Vitest, tsx scripts, agent-browser (`npm run legibility`).

**Spec:** issue #408 (follow-up of #392) — the issue body and its Agent Brief are the spec. Background: `docs/plans/2026-11-17-392-tinker-en-el-mundo.md` (Review Focus 2: the exemption this removes).

## Global Constraints

- Base branch: `feature/389-carteles-en-el-mapa` (#392 lives there, not on `main`); the PR goes there.
- `npm test` and `npm run typecheck` green at the end of every task.
- Code, comments and identifiers in `src/` and `scripts/` in English (`src/english.test.ts`); `docs/` in Spanish or English as the surrounding file.
- The factory (#379 geometry, `src/scenes/factory.ts`) does not change.
- The `cartel-taller` piece does not change: `src/scenes/world-baseline.test.ts` stays green without re-recording.
- `footAt`'s hall-edge behaviour does not change: the existing `posts: … none across a hall edge` tests stay green.
- No visible change at cover scale: only the one post moves, by < 1 u.
- `REPORT.md` is only written by `npm run legibility` (full run).

## Review Focus

1. **Between the rails is still the track.** Nudging the post just off the north rail strip (0.11 u) would plant it between the two rails, where a train runs. Expected: the keep-out is the whole track (both rails and the gauge, y −9..−7), so the post leaves it entirely. (Task 1 test "no ground solid of the sign stands on the siding track".)
2. **A post moved across its row floats beside its beam.** An axis-aligned nudge of ~0.6 u moves the post off the line of the longitudinal beam it carries (beam 0.25 wide). Expected: the post slides along `u`, so its centre keeps its offset `b` across the row. (Task 1 test "a post moved off a track stays in its row".)
3. **Overhead parts are not on the track.** The deck, beams, planks and panels cross the siding in plan at z ≥ 14.96, and one beam crosses the tower crane's counterweight box in plan at z 16.6..16.85 (counterweight z 18.5..20). Expected: the #247 rule accepts a solid whose z range is wholly above (or below) the obstacle; the post at z 0 is caught. (Task 2.)
4. **The piece exhibit has no siding.** At the origin the scaffold crosses y −8 too; the world's track must not move its posts. Expected: the exhibit passes `tracks = []` and the `cartel-taller` baseline hash is unchanged. (Task 1, baseline test.)
5. **Strips in the overlap test.** Including `strip` solids in "no sign solid overlaps a world solid" must catch the rail post and nothing legitimate. Expected: after the fix the list of clashes is empty; if another strip (road, path) under a ground post shows up, it is reported, not silently excluded. (Task 1.)

---

### Task 1: Ground posts keep off the siding track

**Files:**
- Modify: `src/scenes/sign-tinker.ts` (`Track`, `SIDING_TRACKS`, `post`, `scaffold`, `tinkerSign`)
- Modify: `src/lab/exhibits.ts:133` (piece exhibit passes `[]`)
- Test: `src/scenes/sign-tinker.test.ts`

**Interfaces:**
- Produces: `export type Track = Hall;` (a plan rectangle a ground post keeps off); `export const SIDING_TRACKS: readonly Track[] = [{ x0: WORLD.x0, y0: SIDING_Y - 1, x1: 110, y1: SIDING_Y + 1 }]` (`SIDING_Y` imported from `./factory`, `WORLD` from `../map/geo`; 110 and ±1 match `siding()` in `factory.ts`: rails ±0.8, 0.4 wide, to x 110); `tinkerSign(out, accents, at, halls = SHIPYARD_HALLS, tracks: readonly Track[] = SIDING_TRACKS): void`.

- [ ] **Step 1: Write the failing tests** in `sign-tinker.test.ts`
  - `SIDING_TRACKS` matches the factory's rails: for `world(7).factory!.ground` strips with y in −9.01..−6.99, every rail's plan box lies inside `SIDING_TRACKS[0]`, and the track's y extent equals the union of the rails' (−9, −7).
  - "no ground solid of the sign stands on the siding track": every solid of `sign(TINKER_SITE).out` with `bounds(s).min.z < 0.1 + 1e-9` (rail top) has a plan box disjoint from every `SIDING_TRACKS` rect (touching allowed, 1e-9).
  - "a post moved off a track stays in its row": build `sign(TINKER_SITE)` with `tracks = []` and with the default tracks; exactly one steel post differs between the two (the one at x 44.41, y −8.41 in the `[]` build); its displacement `d` has `dot(d, N) ≈ 0` (1e-9, slid along `U` only), `|d| < 1`, and its new plan box clears `SIDING_TRACKS[0]`. Uses only the exported API and the test file's own `U`/`N` (`sign-tinker.test.ts:18`); no internals are exported.
  - "no sign solid overlaps a world solid…": drop `&& s.kind !== "strip"` from the `raised` filter (rename it `world`/`others`), so strips count.
  - Existing: the `sign()` helper keeps `SHIPYARD_HALLS` and the default tracks; `piece()` and the `["piece", PIECE_AT, [STAND_IN_HALL]]` cases pass `[]` for tracks.
- [ ] **Step 2: Run** `npx vitest run src/scenes/sign-tinker.test.ts` → the track tests and the overlap test FAIL (post at y −8.71..−8.41 on the north rail).
- [ ] **Step 3: Implement.** `post(out, cx, cy, top, halls, tracks)`: first slide the centre along `U` by the smallest `t` that clears each track it overlaps (for a 0.3 foot and rect `r`, the four boundary values of `t` that separate it in x or y, `EDGE` margin, smallest `|t|`); then `footAt` as today; throw `"tinkerSign: no post position clear of the tracks"` if the final foot still overlaps a track. `scaffold` and `tinkerSign` thread `tracks` through. `exhibits.ts`: `tinkerSign(out, accents, PIECE_AT, [STAND_IN_HALL], [])`.
- [ ] **Step 4: Run** `npx vitest run src/scenes/sign-tinker.test.ts src/scenes/world-baseline.test.ts src/lab` → PASS (the `cartel-taller` hash unchanged).
- [ ] **Step 5: Commit** `fix(#408): tinker scaffold posts keep off the siding track`.

### Task 2: #247 rule without the sign's exemption

**Files:**
- Modify: `src/scenes/world.test.ts:119-145`

**Interfaces:**
- Consumes: Task 1 (no ground post on the track).

- [ ] **Step 1:** Remove the identity exemption (the `sign`/`signKeys` block, its comment and the count check) and the now-unused `TINKER_SITE`/`tinkerSign` imports if nothing else uses them. `band` = all of `all`. For each `(s, o)` pair (the loop runs band solid `s` against obstacle `o` in one direction only) the assertion becomes: disjoint in plan (as today) **or** disjoint in z — `b.min.z >= o.max.z - 1e-9` (wholly above) or `b.max.z <= o.min.z + 1e-9` (wholly below: the sign's beam at z 16.6..16.85 under the crane counterweight at z 18.5..20). Comment: the sign's deck, beams and panels cross the siding and the crane's counterweight overhead (#408).
- [ ] **Step 2: Run** `npx vitest run src/scenes/world.test.ts` → PASS with Task 1. The red is observed, not reasoned: in the evals stage this test change is committed before Task 1 and must FAIL on the `prism/steel` post at x 44.41.
- [ ] **Step 3: Commit** `test(#408): #247 rule covers the tinker sign, overhead parts allowed`.

### Task 3: Regenerate `REPORT.md`

**Files:**
- Regenerate: `docs/superpowers/specs/assets/carteles-legibilidad/REPORT.md` and its PNG crops (`npm run legibility`, full run).
- Modify only if cells moved: §8.1 rows of `docs/superpowers/specs/2026-11-15-carteles-de-zona-rediseno-design.md` (`src/lab/docs.test.ts` cross-checks them).

- [ ] **Step 1:** `npm run legibility` → `REPORT.md` with 18 ✓ and "Sin violaciones.".
- [ ] **Step 2:** `npx vitest run src/lab/docs.test.ts` → PASS; if it fails, sync the §8.1 cells with `REPORT.md`.
- [ ] **Step 3:** `npm test && npm run typecheck` → green. Commit `docs(#408): REPORT.md regenerated`.

## Assumptions

- A1 (scope): "no sign solid overlaps either rail in plan" = no sign solid stands on the track. Source: the issue's own options ("que `footAt` también esquive las vías del desvío, o mover/quitar ese poste. Después habría que retirar la exención") fix only the post, and "Out of scope: … redesigning the sign or its scaffold"; the deck crosses the siding overhead by design (`world.test.ts:125`: "stands over the siding at z ≥ 16.6 but for one ground post"). Rejected: moving the whole sign off the siding.
- A2: #247 forbids touching ("does not touch the siding, the wagons, the locomotive or the tower crane", `world.test.ts:119`); a solid wholly above or below an obstacle does not touch it, so the rule becomes plan-disjoint or z-disjoint for every band solid. Rejected: keeping a sign-only exemption (the issue asks to remove it).
- A3: the keep-out is the whole track (rails and gauge, `factory.ts:98`: rails at `SIDING_Y ± 0.8`, 0.4 wide, x `WORLD.x0`..110); the siding lays no other strip. Rejected: only the rail strips (would leave the post between the rails).
- A4: the post slides along `U`, not axis-aligned, so it stays under its longitudinal beam. Rejected: `footAt`-style axis nudge.
- A5: an unclearable post throws, like `footAt` already does (`sign-tinker.ts:200`): the geometry is deterministic, so the whole-world tests turn it into a CI failure, never a production crash. A final track check after `footAt` catches a hall nudge back onto the track; no such case exists in the real geometry, so no dedicated test.
- A6: `tracks` defaults to `SIDING_TRACKS`, mirroring `halls = SHIPYARD_HALLS` (`sign-tinker.ts:250`). `sign-tinker → factory` is an acyclic import (`factory.ts:1-13` imports neither `shipyard` nor `sign-tinker`); no ADR covers scene layering (`docs/adr/` has 0001 veil, 0002 seam).
- A7: if counting `strip` in the overlap test exposes a non-rail strip (road, path) under a ground post, that is fixed the same way (keep-out) if it is a track, or recorded in the stage comment and narrowed in the test with a reason if it is pavement a post may stand on.
- A8: `REPORT.md` and its crops are committed as `npm run legibility` writes them (`scripts/legibility.ts:2-14`), noise included, as #392 did.

## Self-review

- Criteria → tasks: "#392 merged" → base branch; "no sign solid on either rail in plan; #247 without exemption" → T1 + T2 (overhead parts allowed by z, see Review Focus 3); "world-overlap check includes `strip`" → T1; "#379 unchanged, `footAt` hall tests pass" → T1 (factory untouched, hall tests kept); "`REPORT.md` regenerated, test + typecheck" → T3.
- Assumption A1: "no sign solid overlaps either rail in plan" is read as "no sign solid stands on the track": the deck and the word span the siding overhead by design (#392), and redesigning the sign is out of scope.

## Grilling

- Rounds: 1 (fixes were local: test design of the moved post, z-disjoint both ways, observed red; no seam changed, so no second round).
- Questions: 16. Sources: ISSUE 3 (Q2, Q3, Q10 with the stage-0 comment), CODE 11 (Q1 `world.test.ts:133-141`, Q4 `world.test.ts:128` — `all` is shipyard solids without cones, x < 198, y < 0, not factory strips; Q5 `world-baseline.test.ts:14-31` only piece hashes; Q6 `sign-tinker.ts:200`; Q8 `sign-tinker.ts:206-207` axis-aligned `prism(f.x, f.y, base, POST, POST…)`; Q9 `factory.ts:97-101`; Q12 `sign-tinker.test.ts:18`; Q13 `sign-tinker.ts:250`, `factory.ts:1-13`; Q14 vitest strips types, red now observed in evals; Q16 `sign-tinker.ts:250` four params today, branch at 45193b3), DOC 0, NO SOURCE 2 (Q7 → A5, Q15 → A8; both technical assumptions).
- Assumptions: A1–A8 above. Issues opened: none. Status: ok.
