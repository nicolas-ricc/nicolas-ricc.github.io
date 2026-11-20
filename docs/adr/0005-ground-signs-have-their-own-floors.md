# 0005. Ground signs have their own floors

## Status

Accepted. Decided 2026-11-20 in story #451 (owner's size decision, applied in #460); recorded in issue #457.

## Context

Story #451 turned the Writing sign into a raft of planks lying on the water, with `WRITING` painted on it as a decal. The legibility oracle (`src/kit/legibility.ts`) was written for signs on walls and roofs: it expects the text plane to project at aspect 1, measures the x-height along the projected vertical, and holds every sign to the floors of `SIGN_RULES` (x-height, stroke, air and contrast per cover scale).

A word on the ground is seen at a grazing angle. The ground plane (`groundDiagonal`) projects v at 0.707 and u at 1.414, so the word shows at half its flat aspect, and its x-height, which runs along v, is the scarce dimension. With the vertical floors, the plan of #451 fixed the cap height at 20 (option (a)): the x-height measured 12.74 px at scale 1.17 and 9.04 px at 0.83. The owner judged that word too big.

## Decision

The oracle gains a ground-sign class and its own floors.

- A sign marked `ground` expects the aspect `GROUND_ASPECT` (0.5) and not 1; its x-height is measured along v; when it carries a `bar` (`CHAINSAW_BAR`, the thickness of the horizontal strokes) the stroke is the smaller of the stroke along u and the bar along v; and a coplanar decal is measured against its receiver (`staticContrast`, the planks).
- `checkSign` applies `SIGN_RULES.ground` to those signs instead of `SIGN_RULES`; vertical signs keep the floors by scale. The ground floors are x-height 10.5 / 7.5 px, stroke 1.6 / 1.2 px, air 2 / 1.5 px and contrast 7:1 at 1.17 / 0.83.
- The cap height of WRITING, `WRITING_CAP`, is 17.25 (owner's decision of 2026-11-20, #460).

Considered and rejected: option (a), keeping the vertical floors and a cap of 20. It passes level 2 but makes a word 84 u long and a raft of 88 u that the owner found too big for the scene, and the owner preferred the smaller word with floors fitted to a sign on the ground, which are still checked at level 3 on the rendered pixels.

## Consequences

- The word measures about 72.6 u and the raft 76.6 × 30.3 u. At 17.25 the x-height is 10.99 px at 1.17 and 7.80 px at 0.83 at rest, and 10.61 and 7.52 px in the worst pose of `CYCLE_POSES`.
- The southern stretch of `LANE_OUT` is shifted 15 u east and `zoneFrame("blog", "tall")` ends at y 450, so the raft fits the narrow site under the ship rules.
- Level 3 is the safety net of the lower floors, and for a ground sign it changed: a symmetric halo, counters filled through the glyph's plane, and an OCR that sees only the backed area, so that the edge of the raft is not read as a letter. `npm run legibility -- --tick <ms>` repeats it at a pose of the pitch-and-roll cycle (`REPORT-t7919.md`, `REPORT-t15838.md`). It excuses no row.
- Other ground signs can reuse the class; vertical signs are unaffected.

Sources: `src/kit/legibility.ts` (`SIGN_RULES`, `GROUND_ASPECT`, `checkSign`, `signMetrics`, `staticContrast`), `src/kit/lettering.ts` (`groundDiagonal`), `src/kit/marquee.ts` (`CHAINSAW_BAR`), `src/scenes/sign-platform.ts` (`WRITING_CAP`, `BLOG_SIGNS`, `CYCLE_POSES`), `src/scenes/raft.ts`, `scripts/legibility.ts`, `scripts/legibility-measure.ts`; spec `docs/superpowers/specs/2026-11-20-writing-balsa-tablones-design.md`; plans `docs/plans/2026-11-20-452-cartel-de-suelo.md` and `docs/plans/2026-11-20-460-cap-17-pisos-suelo.md`; ADR 0004; issues #451, #457, #460.
