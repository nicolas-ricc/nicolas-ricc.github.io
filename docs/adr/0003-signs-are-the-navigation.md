# 0003. The signs in the world are the navigation

## Status

Accepted. Decided 2026-11-17 in story #389; recorded in issue #394.

## Context

The site navigated through three `#zonas` links drawn over the canvas and a hit test (`worldZoneAt`) on the geography. Story #374 built a 3D sign per zone (the crown of the Resume tower, the tinker sign of the shipyard, the platform of the sea) and #389 put them in the real world. The question is what the signs are for: decoration next to the old links, or the controls themselves.

Two constraints shape the answer. The links must stay real `<a>` elements (keyboard, screen readers, routes). And the camera, `coverView` with `COVER_FOCUS_U`, is a pure function of the host that other stories rely on: on a portrait phone (390 px wide) the host is a narrow window of the 16:9 cover and not every sign fits in it.

## Decision

The 3D sign is the control of its zone.

- `zoneAtScreen` in `src/world/signs.ts` tests the polygons of the signs (`SIGNS`, `signPolygons`) before falling back to `worldZoneAt`, so a click on a sign is a click on its zone even where the geography says otherwise.
- The `<a>` stay as the accessible controls but are invisible: each is placed over its sign by `placeLabel` (`src/labels.ts`) from `signBox`, and `markCurrent` sets `aria-current="page"` instead of dimming.
- `labelLayout` falls back to the edge: when less than half of the word's box is inside the host, the link becomes the visible label, pinned to the edge of the host.
- The camera does not adapt to the signs: `coverView` and `COVER_FOCUS_U` in `src/world/view.ts` stay as they were.

## Consequences

- On a portrait phone Writing falls outside the window and its label goes to the edge; RESUME and PORTFOLIO stay on their signs (PORTFOLIO is cut about 11 px at the right edge but keeps more than half of its box). No `COVER_FOCUS_U` fits the three.
- The accents draw over everything, so a sign can show through what stands in front of it. Occlusion is solved by position (the platform moved to (392, 178)) and held by pure gates: the ship lanes and "no ship piece crosses the letters" in `src/scenes/sea-anim.test.ts`, and `checkSign` against the world's solids in `src/lab/signs.test.ts`, at scales 1.17 and 0.83.
- The sign is part of the world, so it counts in the budgets (static accents, polygons, raised solids), capped in tests.
- The old antenna of the tower is gone: the crown takes its place.

Sources: `src/world/signs.ts` (`SIGNS`, `signPolygons`, `signBox`, `zoneAtScreen`, `labelLayout`), `src/labels.ts` (`placeLabel`, `markCurrent`), `src/main.ts`, `src/world/view.ts` (`coverView`, `COVER_FOCUS_U`); spec `docs/superpowers/specs/2026-11-17-carteles-de-zona-integracion-design.md`; issues #389, #394.
