# mapa: domain glossary

The site is an isometric night map in three zones (Portfolio, Resume, Blog). The code, the lab and the docs share the vocabulary below; the Spanish name, where the old specs and plans use one, is in parentheses, and each entry names the file and identifier that anchor it. Exhibit ids (`#faro`, `#estacion`) and the keys of `content/*.json` stay in Spanish because they are URLs and data, not names in the code. Architecture decisions are in `docs/adr/`.

### Veil
(Velo.) The sky-colored overlay drawn over the zones that are not in focus, together with the dimming of their lights. With a focus zone (`focusAlphas(focus)`), the other two zones get a veil alpha of `VEIL_ALPHA` (0.45) and an accent alpha of `ACCENT_DIM` (0.35); the focused zone, or every zone when nothing is focused, gets veil 0 and accents 1. The veil polygons (`veilPolygons`, built from `veilCells` and `veilRuns`) cover content plus bleed, one Graphics per zone. A light is veiled with the zone where it stands, except lights mounted on a ship, which follow the ship's zone: see `docs/adr/0001-veil-lights-follow-their-position.md`.
Code: `src/world/veil.ts` (`VEIL_ALPHA`, `ACCENT_DIM`, `focusAlphas`, `veilPolygons`, `accentsByZone`), `src/world/stage.ts` (`setFocus`).

### Zone
(Zona.) One of the three clickable regions of the world, `"portfolio"`, `"cv"` (Resume) or `"blog"`; the ids are also the routes. A point belongs to a zone by geography, not by a straight split: `worldZoneAt(x, y)` returns Portfolio for the headland, the reef and its shore (the lighthouse caps the shipyard), Resume for the seawall shore, and Blog only for the open sea. The same function classifies the veil cells, the static lights and the hit test.
Code: `src/map/geo.ts` (`WorldZone`, `worldZoneAt`), `src/world/veil.ts` (`WORLD_ZONES`).

### Accent
(Acento.) An artificial light, drawn on top of everything with additive blend: a `dot` (lamp, spark: position `at`, radius `r`, color) or a `poly` (lit window, beam: points, color, optional alpha). Accents are not solids and cast no shadow; the bloom (or its `fallback` halo) is drawn around them. Each accent belongs to a zone for the veil (`accentZone`: the point of a dot or the first vertex of a polygon, through `worldZoneAt`).
Code: `src/iso/accent.ts` (`Accent`, `accentItem`), `src/world/veil.ts` (`accentZone`), `src/world/frame.ts` (`drawAccents`).

### Animator
(Animador.) The Pixi-free contract between an animated scene and the runtime (`Animator`): the `ids` of its layers, `layer(id)` (an `AnimLayer`: a `solid`, `accent` or `water` layer), `tick(dtMs)` (the set of layer ids that need redrawing) and optional `claims` (terrain water it draws itself). Every animator that `assembleWorld` returns is tagged with its zone of origin (`ZonedAnimator`, `tag(animator, zone)`; `null` for the water). That tag serves the lab and the crops; the veil of its lights does not use it, only the zone a layer declares in `AnimLayer.zone` (see Veil).
Code: `src/scenes/animator.ts` (`Animator`, `AnimLayer`, `layerLookup`), `src/world/assemble.ts` (`ZonedAnimator`, `tag`, `assembleWorld`).

### Deck piece
(Pieza de cubierta.) A non-hull solid that stands on a ship's hull and overlaps it in plan. In the code (`hullSide`, in the sort frame, steps 1 and 2) it is one of two cases: its base is at or above the midship deck (`hull.at.z + hull.h`), or all four corners of its plan box lie inside the hull's deck ring and it rises above the deck. It is always drawn after the hull. A piece inside the deck ring that stays below the deck (sunk under it) is drawn before the hull.
Code: `hullSide` in `src/iso/depth.ts`; vocabulary from `docs/plans/2026-10-19-74-orden-piezas-barcos.md` ("Vocabulario") and `docs/plans/2026-11-02-195-lado-por-cara-del-casco.md`.

### Side piece
(Pieza de costado.) A non-hull solid that overlaps the hull in plan but is neither a deck piece nor wholly under the keel (its top is more than 1e-6 above the hull box's lowest point). It hangs from a hull face. The face is the one of the hull's box against which the piece's center is farthest out, normalized by the hull half-extent along each axis (`u` along x, `w` along y; the larger of `|u|` and `|w|` decides, ties go to x). The outward normal of that face, projected on the view in the ship's frame (`vx`, `vy`), gives the side `t`: the piece is drawn after the hull if `t > 0` (near side), before it if `t < 0` (far side), and no rule applies if `|t| <= 1e-6` (view parallel to the face) or the piece is centered.
Code: `hullSide` in `src/iso/depth.ts`.

### Hull rule
(Regla del casco.) The three rules of #74 that `sortByDepth` applies to hulls, at any heading and also in static scenes (the ships, the shipyard hulls, the fair boats). (1) The side of a non-hull piece against a hull is decided by `hullSide` (deck piece or side piece, above), not by the depth key. (2) The hull separates: if one piece goes before a hull and another goes after it, the first goes before the second (`hullOrder`; if two hulls disagree, the first in the list wins). (3) A view parallel to the plane that separates two solids (view component within 1e-6) hides neither: separating along it counts as behind in both directions (`farAlong`, `isBehindView`). #195 changed rule 1 from the centroid test to the hull face the piece hangs from.
Code: `src/iso/depth.ts` (`sortByDepth`, `hullSide`, `hullOrder`, `farAlong`); `src/scenes/ships.ts`; tests `src/iso/depth.test.ts`, `src/scenes/ships-depth.test.ts`.

### Frame
(Marco.) A ship's local frame: the axes in which its solids are axis-aligned, x toward the bow and y to starboard, rotated by the ship's `heading`. `kit(at, heading)` in `ships.ts` builds the ship's pieces in it; `sortByDepth(solids, heading)` rotates the boxes and the view by `-heading` to evaluate depth and the hull rule in it (`vx`, `vy` are the view components in that frame); an `AnimLayer` of kind `solid` carries its `heading` for that sort. Not to be confused with `Frame` in `src/world/frame.ts` (`WorldZone | "all" | "cover"`), the camera framing of the page, which has its own functions `zoneFrame`, `coverFrame` and `boxFrame`.
Code: `src/iso/depth.ts` (`sortByDepth`, `worldAndFrameBounds`), `src/scenes/ships.ts` (`kit`), `src/scenes/animator.ts` (`AnimLayer.heading`).

### Lanes
(Carriles.) The two nearly straight routes the ships follow between the river mouth and the lower-left corner of the cover: the outbound lane `LANE_OUT` starts at the mouth (362, −16), skirts the point on the east and heads south-southwest until it leaves the cover; the return lane `LANE_BACK` enters from the lower left, runs about 42 u east of the outbound lane and ends at the mouth (397, −39). Ships move along them at `LANE_SPEED` (1.2 u/s), fade in and out (`FADE_U`) at the mouth, and cycle out, off camera (`OFF_MS`), back, in port (`PORT_MS`); ship k runs at phase k·T/3 of `CYCLE_MS`. They neither anchor nor turn in place.
Code: `src/scenes/sea-anim.ts` (`LANE_OUT`, `LANE_BACK`, `LANE_SPEED`, `shipStateAt`, `CYCLE_MS`); introduced in #87.

### Exhibit
(Exhibit.) One entry of the lab's structures storybook (`/lab/storybook.html`): a structure looked at on its own. It is either a `region` (a box `Box` cropped from the real world, with an optional framing height `h`) or a `piece` (a relocatable piece built at the origin by `build`, with an optional ground `pad` material and an optional `animate` animator, which the storybook tags with the exhibit's zone). The `id` is the URL hash (`#faro`) and stays Spanish; `title` and `group` (`GroupId`, listed in `GROUPS`) are English labels. `pickExhibit(hash)` resolves a hash (unknown or empty gives the first) and `stepExhibit(id, ±1)` walks the index, wrapping around.
Code: `src/lab/exhibits.ts` (`Exhibit`, `EXHIBITS`, `GROUPS`, `pickExhibit`, `stepExhibit`), `src/lab/storybook.ts`.

### Landmark
The one reference point per zone used to frame it: the gantry crane for Portfolio, the office tower for Resume and the lighthouse for Blog, in world coordinates.
Code: `src/scenes/world.ts` (`LANDMARKS`, `WorldScene.landmarks`).

### Bleed
(Sangrado.) The ring of terrain around all the content, so the cover camera never shows sky; built margins (hinterland, tech district) live on it. It extends the content by `BLEED` (`{ x: 342, y: 378 }`) on a grid of `CELL_BLEED` (18 u), and the veil covers content plus bleed.
Code: `src/map/geo.ts` (`BLEED`, `CELL_BLEED`), `src/world/veil.ts` (`veilCells`).

### Cover frame
The largest 16:9 rectangle that fits inside the projected content plus bleed, pulled in by `COVER_INSET` so it does not expose sky at the edge. It is the camera of the site (`coverView(w, h)`, which uses the real aspect of the host) and of lab key `4` (`coverFrame(16/9)`).
Code: `src/map/geo.ts` (`coverQuad`, `inCoverQuad`, `COVER_INSET`), `src/world/frame.ts` (`coverFrame`), `src/world/view.ts` (`coverView`).
