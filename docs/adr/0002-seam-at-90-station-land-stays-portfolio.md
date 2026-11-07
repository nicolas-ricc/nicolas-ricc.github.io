# 0002. The seam drops to y 90 and the station land stays Portfolio

## Status

Accepted. Decided 2026-11-07 in story #56; recorded in issue #319.

## Context

The Portfolio/Resume seam sat at `ZONE_SPLIT_Y = 146`, which left Resume about 48 % of the strip shared by the two zones. Story #56 needs the city to start earlier, so the seam moves to `y 90`, which gives Resume about 59 % of the strip.

Two things already stand in the band `y 90..146` that Resume gains. The terminal station (#239) occupies `x 100..197, y 80..142` and is a Portfolio piece. The west line (`RAIL_Y = [131, 134]`) feeds it, and the train that runs on it needs that exact track: there is no corridor free at `y 84..90` to move it to. Meanwhile the river, the estuary and the island are coastline: their literals (`146`, `152`, `158` in `islandWestX`, `islandEastX`, `estuaryInset`) describe the shore, not the seam, and must not follow it.

## Decision

`ZONE_SPLIT_Y = 90`. Four consequences are fixed with it:

- The station keeps its zone through a geographic exception, like the headland of the lighthouse: `STATION_LAND = { x0: 96, y0: 90, x1: 198, y1: 146 }` and `inStationLand(x, y)` in `src/map/geo.ts` (multiples of 6, so veil and terrain cells are never split). `worldZoneAt` and `terrainAt` return Portfolio / the shipyard terrain for `y >= ZONE_SPLIT_Y` inside it, and Resume / the city terrain outside it.
- `RAIL_Y` stays `[131, 134]`. The track crosses the new Resume strip (`x -54..96`) and enters the station at its west edge, `x 96`.
- Nothing tall may stand south of the track until `y 158`: the occlusion rule of the train, `y_min − 1.4·z_max ≥ 134.5`, applies to every static solid there (north of the track, `y_max ≤ 130.8`). The railyards of Resume (`y 129..158`) are built within that rule.
- `ESTUARY_Y0 = 146` replaces `ZONE_SPLIT_Y` in `SEAM_CY`, `estuaryEast` and `estuaryReaches`: the river does not move.

`zoneFrame("portfolio")` ends at `STATION_LAND.y1` so the whole station stays in frame; `zoneFrame("cv")` starts at `ZONE_SPLIT_Y`. `GREEN_BELT` becomes the literal `y 116..158`, since the jungle wraps the track.

## Consequences

- The zone of a point is no longer a function of `y` alone: `x 96..198, y 90..146` is Portfolio. Clicks, the veil and the terrain read the exception through `inStationLand`. The strip `x 96..100` reads as Resume street but is Portfolio. The quay wall at `x 198..202` runs on to `y 142` and belongs to the station land's bank, so the Portfolio rule accepts it.
- Portfolio loses what it had south of 90 outside the station (the parking lot, the old west track, the scrap, the south jungle) and gets a fence along the seam. Every raised solid of the shipyard and the factory ends at `y 90.5` or falls inside `STATION_LAND`.
- The train crosses Resume ground and its layers keep declaring `portfolio` (see 0001).
- The new Resume strip starts as empty asphalt crossed by the track; the grid comes in later children of #56.
- The estuary, the island and every coastline literal are unchanged.

Sources: `src/map/geo.ts` (`ZONE_SPLIT_Y`, `STATION_LAND`, `ESTUARY_Y0`), `src/scenes/station.ts`, `src/scenes/terrain-classify.ts`, `src/world/frame.ts`; spec `docs/superpowers/specs/2026-10-15-costura-90-portfolio-denso-galpones-feria-design.md` (section 0); issue #319.
