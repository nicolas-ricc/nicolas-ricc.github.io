# mapa

Sitio personal: un mapa isométrico nocturno con tres zonas (Portfolio, Resume, Blog).

- `npm run dev` — desarrollo (baja el feed del blog primero).
- `npm test` — tests unitarios (Vitest).
- `npm run build` — valida `content/*.json`, baja el feed, buildea y prerenderiza `/portfolio/`, `/cv/`, `/blog/`.
- `npm run typecheck` — `tsc --noEmit`. En un clone fresco correr `npm run feed` primero: `content/blog.generated.json` está gitignoreado y `src/main.ts` lo importa (`predev`/`prebuild` ya lo hacen por vos).

Sin licencia pública: `private: true`, el campo `license` (ISC) queda como resto del scaffold y no aplica — el repo no se publica en npm.

Contenido editable en `content/*.json`. Diseño en `docs/superpowers/specs/`, plan en `docs/superpowers/plans/`.

## Mundo isométrico

El sitio (la raíz de myxomatosis.xyz; la zona Blog vive en `/escritos/` porque `/blog/` es el blog Hugo) muestra el mundo isométrico completo: motor puro en
`src/iso/`, terreno compartido en `src/scenes/terrain.ts`, escenas en
`src/scenes/`, incluidas `factory.ts` (fábrica de Portfolio), `district.ts`
(distrito moderno de Resume) y `sea.ts` (punta, faro y barcos de Blog). El
mundo tiene origen en `(-60, -60)` y un sangrado de terreno alrededor de todo
el contenido, para que la cámara *cover* nunca muestre cielo; sobre el
sangrado viven los márgenes construidos, `hinterland.ts` (industria de
Portfolio al norte y al oeste de la fábrica, con su central térmica) y
`tech.ts` (distrito tecnológico de Resume al oeste y al sur de la ciudad),
separados por un cinturón verde; `fair.ts` es la feria de la playa sobre la
bahía, al norte de la fábrica; el estuario y el mar siguen hacia el sur hasta
juntarse.

El runtime que arma y anima ese mundo vive en `src/world/` y lo comparten el
sitio y el laboratorio: `stage.ts` (capas, velos y luces por zona),
`assemble.ts` (escena + animadores etiquetados por zona), `frame.ts`
(encuadres puros, `zoneFrame`/`coverFrame`), `veil.ts` (polígonos del velo por
zona) y `view.ts` (cámara pura: `coverView`, `zoneView`, `clampToBleed`,
`unproject`). El sitio encuadra con `coverView(host)` (el aspecto real del
`#canvas-host`), no con `coverFrame(16/9)` como el laboratorio.

`npm run dev` y abrir `/lab/world.html` para el laboratorio: páginas
finas (`src/lab/page.ts`) que importan `assembleWorld`/`buildStage` de
`src/world/` y agregan `Application`, teclas y el log de rendimiento.
`/lab/portfolio.html` muestra solo el astillero; `/lab/resume.html`
muestra la ciudad de oficinas más el astillero, encuadrados en Resume;
`/lab/blog.html` muestra la punta, el faro, la fosa y los barcos,
encuadrados en Blog. Teclas `0`..`3` encuadran mundo, Portfolio, Resume y
Blog; `4` encuadra con `coverFrame(16/9)`; `5` rota el foco del velo entre
apagado, Portfolio, Resume y Blog. Las teclas encuadran; no recortan: al
enfocar una zona las vecinas asoman por el borde. No entra en el build de
producción. Para cambiar una escena, editar su lista de sólidos; para el
look, `src/map/palette-iso.ts`. Specs en `docs/superpowers/specs/`
(`2026-09-13-portfolio-isometrico-design.md`, `2026-09-14-mundo-isometrico-design.md`,
`2026-09-14-resume-ciudad-design.md`,
`2026-09-14-mundo-2-fabrica-distrito-blog-design.md`,
`2026-09-15-margenes-urbanos-design.md`,
`2026-09-15-mundo-3-tecnologico-feria-agua-barcos-design.md`,
`2026-09-15-reintegracion-mundo-iso-design.md`).
