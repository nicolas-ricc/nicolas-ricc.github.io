# 0004. The Writing site depends on the host

## Status

Accepted. Decided 2026-11-18 in story #423; recorded in issue #429.

## Context

ADR 0003 made the signs the controls of their zones and left Writing outside the window on a portrait phone: its label went to the edge of the host and no `COVER_FOCUS_U` fitted the three signs. Story #423 asks for one composition that reads on every screen, so the question is how to bring Writing into view without a second world for phones.

## Decision

The world is one. What changed for every screen is shared: the lighthouse headland moved as a rigid block (`HEADLAND_SHIFT` in `src/map/geo.ts`), so `worldZoneAt` now reads it as Blog instead of Portfolio, and the ship lanes (`LANE_OUT`, `LANE_BACK` in `src/scenes/sea-anim.ts`) changed their southern stretch to match.

The only exception is the Writing platform, which has two sites (`PLATFORM_SITES`, `BLOG_SIGNS` in `src/scenes/sign-platform.ts`): `wide` and `tall`.

- `writingSite(w, h)` in `src/world/signs.ts` picks `wide` when the box of the word plus `WRITING_SITE_MARGIN` fits inside the window of `coverView`, and `tall` otherwise.
- The site is decided from `#app`, the host without an open zone, inside the `ResizeObserver` of `src/main.ts` (`syncSite`), not frame by frame during the zone transition. While a zone is open the host is narrower by design and must not move the platform.
- `platformAnimator` (`src/scenes/platform-animator.ts`) relocates the platform with `setSite` and builds each site once; it does not rebuild the world.

## Consequences

- `zoneSigns(site)` and `zoneAtScreen` carry the site, so the sign, the invisible link and the click all follow the platform.
- `zoneFrame("blog", site)` is extended at the `tall` site so that the zone frame includes the platform; `zoneView` keeps the sign inside the host.
- The platform leaves `scene.solids`: it lives in the animator, and the tests reach it through `seaPlatformAt`.
- The gates (occlusion, lanes, legibility of the sign) run with both sites.
- The headland no longer closes the shipyard, and the strip of jungle of the old site goes to Resume under ADR 0002, where the seam and the green belt are already defined.

Sources: `src/world/signs.ts` (`writingSite`, `zoneSigns`, `zoneAtScreen`), `src/world/sign-box.ts` (`WRITING_SITE_MARGIN`), `src/world/view.ts` (`coverView`, `zoneView`), `src/world/frame.ts` (`zoneFrame`), `src/scenes/sign-platform.ts` (`PLATFORM_SITES`, `BLOG_SIGNS`, `seaPlatformAt`), `src/scenes/platform-animator.ts`, `src/scenes/sea-anim.ts`, `src/map/geo.ts`, `src/main.ts`; spec `docs/superpowers/specs/2026-11-18-composicion-responsive-design.md`; ADR 0002, ADR 0003; issues #423, #429.
