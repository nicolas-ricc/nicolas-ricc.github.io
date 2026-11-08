# mapa

Personal site: a night-time isometric map with three zones (Portfolio, Resume, Blog).

- `npm run dev` — development (downloads the blog feed first).
- `npm test` — unit tests (Vitest).
- `npm run build` — validates `content/*.json`, downloads the feed, builds and prerenders `/portfolio/`, `/cv/`, `/blog/`.
- `npm run typecheck` — `tsc --noEmit`. In a fresh clone run `npm run feed` first: `content/blog.generated.json` is gitignored and `src/main.ts` imports it (`predev`/`prebuild` already do it for you).

No public license: `private: true`, the `license` field (ISC) is a leftover of the scaffold and does not apply — the repo is not published to npm.

Domain vocabulary (veil, zone, accent, animator, deck and side pieces, hull rule, frame, lanes, exhibit) is defined in `CONTEXT.md`; architecture decisions are recorded in `docs/adr/`.

Editable content lives in `content/*.json`. `public/cv.pdf` is a copy of the CV from `riccomini-multiverse` (`cv/cv.pdf`); it is updated by hand with `gh api repos/nicolas-ricc/riccomini-multiverse/contents/cv/cv.pdf -H "Accept: application/vnd.github.raw" > public/cv.pdf`. Design in `docs/superpowers/specs/`. Plans live in two folders: `docs/plans/` (agent runs) and `docs/superpowers/plans/`; they are not moved, so as not to break links from issues and PRs.

## Isometric world

The site (the root of myxomatosis.xyz; the zones live under `/area/` because `/blog/` is the Hugo blog) shows the whole isometric world: a pure engine in
`src/iso/`, shared terrain in `src/scenes/terrain.ts`, scenes in
`src/scenes/`, including `factory.ts` (Portfolio's factory: the boiler house
of the Fábrica de Luz, Mistley's maltings and a water tank on legs, three
chimneys with marker bands, an outdoor substation and a bucket-wheel
excavator with an animated wheel, `factory.wheel`), `city.ts`
(the Resume orchestrator) and `sea.ts` (point, lighthouse and ships of Blog). The pieces of
Resume live in `src/city/` (`zoning.ts` neighborhoods, `fixed.ts` fixed pieces,
`streets.ts` streets, `lights.ts` windows, neon signs and washed facades) and in the
kit `src/kit/` (explored in `lab/kit.html`). At the end
of the west track, where the shipyard's boiler shop used to be, stands the
terminal station (`station.ts`, modeled on Tigre Station of the Mitre
Line: a brick building with tile roofs, clock tower, platforms with
green canopies, buffer stops and a level crossing), with a parked three-car
set on track 2 and a four-car EMU train (`train.ts`) that enters along the
west track from the edge of the bleed, waits 30 s against the buffer stops and leaves
again (`rail.train`, `rail-anim.ts`). The three ships (Damen Combi
Freighter 3850, Damen ASD Tug 2810 and a river pusher with a Jumbo barge)
appear at the river mouth and run along two lanes, nearly straight: `LANE_OUT` goes down
toward the lower-left of the screen until it leaves
the cover and `LANE_BACK` returns to the river mouth, where they fade out ("coming
into port"); they neither anchor nor turn in place. The fair's boat is a Tigre
river bus and the wreck in the trench, a coaster split in two. The
world has its origin at `(-60, -60)` and a terrain bleed around all
the content, so that the *cover* camera never shows sky; on the
bleed live the built margins, `hinterland.ts` (Portfolio's industry
to the north and west of the factory, with its power plant) and
`tech.ts` (Resume's tech district west of the city and, to the south,
on the estuary, a coastal residential neighborhood: monoblocks, houses with tile
roofs, a school, a club, plazas and an illuminated waterfront on the pier),
separated by a green belt; `fair.ts` is the beach fair on the
bay, north of the factory; the estuary and the sea continue south until they
meet. The factory takes the place the shipyard sheds had,
between the rail yard and the transfer street, in front of the siding, with the
inclined belt going down to the truck yard (the long belt is gone); the
assembly halls, the workshops and the material yard of the shipyard lie to the
north, behind the factory. The seam between Portfolio and Resume lies at
`y 90` (`ZONE_SPLIT_Y`), with the terminal station as the exception: its
land (`STATION_LAND`, the station land) stays Portfolio. South of the seam,
west of the station, a new strip of Resume
holds a row of reconverted warehouses with the covered market (row 92), a
freight row and the rail lands, a fenced band around the west track with a
siding and a parked freight train; on the east bank, the dock inlet has a
fish market, a food hall and fishing boats. The shipyard gains a floating dock,
a container yard, quay cranes and sheet metal. The fair gains a ghost train, a
mirror house, a slide, a log flume, booths and food trucks.

The runtime that builds and animates that world lives in `src/world/` and is shared by the
site and the lab: `stage.ts` (layers, veils and lights per zone: each light, static or
animated, is veiled with the zone of its position, except those of a ship, which follow
the ship's zone),
`assemble.ts` (scene + animators tagged by zone), `frame.ts`
(pure framings, `zoneFrame`/`coverFrame`), `veil.ts` (veil polygons per
zone) and `view.ts` (pure camera: `coverView`, `zoneView`, `clampToBleed`,
`unproject`). The site frames with `coverView(host)` (the real aspect ratio of
`#canvas-host`), not with `coverFrame(16/9)` like the lab.
In Resume, `city-anim.ts` adds the `city.windows` layer (up to 40 windows of
downtown and the residential area that switch on and off keeping the percentage
±5 %) and, inside `city.neon`, the flickering neon sign of a bar on the pier or a brewery of row 92; the
rest of the windows and neon signs go to the static accents.

`npm run dev` and open `/lab/world.html` for the lab: thin
pages (`src/lab/page.ts`) that import `assembleWorld`/`buildStage` from
`src/world/` and add `Application`, keys and the performance log.
`/lab/portfolio.html` shows only the shipyard; `/lab/resume.html`
shows the office city plus the shipyard, framed on Resume;
`/lab/blog.html` shows the point, the lighthouse, the trench and the ships,
framed on Blog. Keys `0`..`3` frame world, Portfolio, Resume and
Blog; `4` frames with `coverFrame(16/9)`; `5` rotates the veil focus among
off, Portfolio, Resume and Blog; `6` rotates the lights' bloom among
`off`, `on` and `fallback`; `?bloom=on|off|fallback` forces it on load.
The keys frame; they do not crop: when focusing a zone the neighboring ones peek in
at the edge. `/lab/kit.html` shows every recipe of the kit
(`src/kit/`) on a grid, one row per family (`modern`, `courtyard`,
`lowrise`, `composite`, `curved`, `landmarks`, `industrial`, `reconversion` and `harbor`, see
`src/kit/forms/`); key `s` changes the seed and `1..4` the style (downtown,
bars, residential, civic), except on the `industrial` and `harbor` rows, which always
use their own style, and on the `reconversion` row, which always uses the
warehouses style (freight for `freightShed` and `openDock`). It is not part of the production build. To change a scene,
edit its list of solids; for the look, `src/map/palette-iso.ts`.
Specs in `docs/superpowers/specs/`
(`2026-09-13-portfolio-isometrico-design.md`, `2026-09-14-mundo-isometrico-design.md`,
`2026-09-14-resume-ciudad-design.md`,
`2026-09-14-mundo-2-fabrica-distrito-blog-design.md`,
`2026-09-15-margenes-urbanos-design.md`,
`2026-09-15-mundo-3-tecnologico-feria-agua-barcos-design.md`,
`2026-09-15-reintegracion-mundo-iso-design.md`,
`2026-10-14-cyberpunk-crepusculo-neones-bloom-design.md`,
`2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md`,
`2026-10-15-costura-90-portfolio-denso-galpones-feria-design.md`,
`2026-10-16-barcos-referencia.md`,
`2026-10-17-barcos-inventario.md`,
`2026-10-17-storybook-estructuras-design.md`,
`2026-10-24-fabrica-detalle-design.md`,
`2026-10-27-fabrica-mudanza-design.md`,
`2026-10-27-estacion-terminal-design.md`,
`2026-10-27-barrio-costero-design.md`).

`/lab/storybook.html` is the structures storybook: it shows one building or
structure at a time, cropped from the world by its box (or built alone at the
origin, for relocatable pieces such as ships and the tower crane; the station
is `#estacion` and `#paso-a-nivel`, regions with the animated train, and `#tren`, the
piece whose lights flip ends every 4 s), with its
animation and a readout panel (solids, ground, faces, accents, box, materials).
The URL hash picks the exhibit (`#faro`); arrows (`←`/`→`, `↑`/`↓`)
or `j`/`k` move to the next or the previous one; `g`, `h` and `a` hide or
show ground, shadows and accents; `6` rotates the bloom, `?bloom=` forces it and
`?speed=` scales the animation clock up to 100 (`?speed=0`
freezes it; above 100 it is 1). The seam at 90 added ten exhibits:
`#dique-flotante`, `#patio-contenedores` and `#grua-muelle` (shipyard), `#tren-fantasma`, `#casa-espejos`, `#tobogan` and
`#tronco-acuatico` (fair), and `#galpones`, `#playa-carga` and
`#mercado-pescado` (city).

The lights' bloom is not part of the first draw: the site and the lab
enable it after Pixi's first real render (the `postrender` of
`app.renderer`), in the following task (`afterFirstRender`,
`src/world/bloom.ts`; `attachBloom`, `src/world/bloom-runtime.ts`), not by
rAF order nor by `requestIdleCallback`, and they measure 60 frames. If the
average of tick plus render exceeds 15 ms, they remove it and leave a larger
halo on the light points (`fallback`). In development the decision is logged, for
example `[mapa] bloom: average 9.9 ms over 60 frames (tick 6.4 + render
3.5), budget 15 ms → on` (with the `[lab]` prefix in the
lab). In the lab, `?bloom=` forces the mode without measuring and `6` rotates
it.

## Tests

Convention: the engine tests do not use Pixi. The guard
`src/iso/pixi-free.test.ts` fails if a source in `src/iso/` or `src/scenes/`
imports `pixi.js`, or if a test in `src/` names it, with single or
double quotes, `import()` or `import type`. Test doubles
(fakes) are used instead. The explicit exceptions are the tests of Pixi modules,
`src/world/stage.test.ts` and `src/world/bloom-runtime.test.ts` (`PIXI_TESTS`
in the guard, #166); a new exception is added there and in this paragraph.
