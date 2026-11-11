# 0001. The veil dims a light with the zone where it stands

## Status

Accepted. Decided 2026-10-19 in issue #26 (follow-up of the point and lighthouse neons of issue #15); recorded 2026-11-02 in issue #194.

## Context

The veil (`VEIL_ALPHA`, `ACCENT_DIM` in `src/world/veil.ts`) darkens the zones that are not in focus and dims their lights. Static lights were already split by zone from their position (`accentZone`, which calls `worldZoneAt`). Animated lights were not: `buildStage` took the zone of the animator that owned the layer and veiled the whole layer with it.

That was wrong as soon as an animated light stood in another zone than its animator. Issue #15 added the neons of the point and the lighthouse (`sea.neon`), which belong to the Blog animator but fall on both sides of the zone seam; a sweep of 600 ticks of 500 ms measured 1800 of its 6600 samples in Portfolio. The same happened with the ships: the freighter (`sea.lights0`) put 28 of ~3000 samples on Portfolio ground, and the river bus lights (`sea.ferryLights`, a Blog animator layer) were entirely in Portfolio. The lights of those layers were therefore dimmed or lit by the zone of their animator, not by the zone of the ground they lit.

A ship is the one case where position is a bad key: it sails across the seam on its lanes, and a ship whose lights flip between veiled and lit as it crosses would look broken. Splitting the sea animator in two would have scattered the rule over `assemble.ts` and still left the point neons, which sit on both zones.

## Decision

A light is veiled with the zone where it stands, whether it is static or animated: each `Accent` goes to the zone given by `accentZone` (its point, or the first vertex of a polygon, through `worldZoneAt`).

The exception is lights mounted on a ship. An accent layer of the `Animator` contract (`AnimLayer` of kind `accent`) may declare a `zone`, and then all its lights are veiled with that zone, wherever they are. The layers that declare it are the ships' lights:

- `sea.lights0`, `sea.lights1`, `sea.lights2` (the freighter, the tug and the pusher convoy, `src/scenes/sea-animator.ts`) declare `"blog"`;
- `sea.ferryLights` (the river bus, the Tigre launch) declares `"portfolio"`.

The decision lives in one pure function, `accentsByZone(accents, zone?)` in `src/world/veil.ts`: with a `zone` it returns every light in that zone, without it it splits them by `accentZone`. `buildStage` (`src/world/stage.ts`) creates one Graphics per zone for each accent layer (a single one if the layer declares its zone) and draws into each its share of `accentsByZone`; the static lights use the same function, so there is one rule. `focusAlphas` and `worldZoneAt` do not change.

## Consequences

- A fixed animated light (the lighthouse beam, the point neons) is dimmed or lit with the ground it stands on, as a static light is. The veil of a layer no longer depends on the zone of its animator; `ZonedAnimator.zone` stays as the animator's zone of origin, which the lab crops use.
- Ships keep a single zone for their whole cycle, so their lights do not change veil while sailing across the seam. Freighter, tug and convoy are Blog's; the river bus is Portfolio's, since it shuttles on its own route (`FERRY_ROUTE`) by the fair.
- Other layers that declared a zone later for the same reason follow the exception: the train and the level crossing (`rail.lights`, `rail.crossing`, `rail.signals` and the storybook's `tren.lights`, all in `src/scenes/rail-animator.ts`) declare `"portfolio"`. Any new layer of lights that must not change zone with its position has to declare one; a layer that declares none is split by position.
- Since #56 the train crosses the Resume strip (`x -54..96, y 129..136`) and its layers keep declaring `portfolio`, like a vehicle (see 0002).
- Cost: a layer without a declared zone has three Graphics (one per zone), most of them empty, instead of one. The bloom mirror is taken from the same list of Graphics, so it needs no change.
- Out of scope, and still true: veiling animated solids or water by position, and optimizing the sea's redraw (#71).

Sources: `src/world/veil.ts` (`accentsByZone`, `accentZone`), `src/world/stage.ts`, `src/scenes/animator.ts` (`AnimLayer.zone`), `src/scenes/sea-animator.ts`, `src/scenes/rail-animator.ts`; plan `docs/plans/2026-10-19-26-velo-luces-por-posicion.md`.
