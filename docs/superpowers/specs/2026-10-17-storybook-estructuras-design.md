# Storybook de estructuras — diseño

**Fecha:** 2026-10-17
**Estado:** implementado (#92..#97, historia #91); desvíos en §10
**Alcance:** una página del laboratorio que muestra cada tipo de edificio y
estructura del mundo isométrico aislado del resto, con su animación, para
estudiarlo y retocarlo de a uno. No cambia el aspecto del sitio ni el de las
otras páginas del lab.

## 1. Problema

Hoy la única forma de mirar una chimenea, el faro o la noria es encuadrar la
zona entera en `lab/world.html` y acercarse con la vista. El resto del mundo
tapa, distrae y cuesta dibujar. Para refinar una estructura hace falta verla
sola, grande, con su animador andando, y saber cuánto cuesta (polígonos) y
qué materiales usa.

Las estructuras de hoy no son piezas reubicables: casi todas son clausuras
privadas dentro de cada escena (`plant`, `chimneys`, `lighthouse`, las
atracciones de la feria) que escriben sólidos en coordenadas absolutas del
mundo. Solo unas pocas son funciones con posición (`towerCrane`, `lamp`,
`campus`, `jungle`, `ship`). Extraerlas todas es el trabajo del kit de
Resume nivel 2 (`2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md`
§5, issues #39..#42) y no se adelanta acá.

## 2. Decisiones

| Tema | Decisión |
|---|---|
| Qué se muestra | Todo el mundo, recortado por región: cada *exhibit* es una caja en coordenadas de mundo sobre el mundo real (`world(SEED)`), más un segundo tipo de exhibit para las piezas que ya son funciones reubicables (barcos, grúa torre, campus, selva, farol) |
| Cómo se aísla | Recorte de datos antes de armar el stage (enfoque A): se filtran suelo, sólidos, acentos y celdas del terreno por solape de su caja con la del exhibit, y se envuelven los animadores para que sus capas devuelvan solo lo que cae adentro. `buildStage` se reutiliza sin cambios de dibujo |
| Navegación | Una página, un exhibit a la vez: índice HTML a la izquierda agrupado por zona, canvas en el medio, panel de lectura a la derecha. El hash de la URL elige el exhibit; flechas lo cambian |
| Ayudas de estudio | Lectura (sólidos, caras, acentos, caja, materiales y colores de acento) y conmutadores de capa (suelo, sombras, acentos, bloom) |
| Fuera de alcance | Rotar el seed, notas por exhibit, rotar la cámara o la luz, barcos como región (se mueven y salen de cualquier caja), extraer estructuras a funciones |

Alternativas descartadas: enmascarar el stage del mundo entero en Pixi (la
máscara es una forma de pantalla, no una caja de mundo: los vecinos dentro
del hexágono proyectado siguen apareciendo, se dibuja todo el mundo por tick
y la lectura necesita el filtrado igual); agregar opciones a cada escena para
emitir una sola estructura (es el refactor que se descarta).

## 3. Catálogo (`src/lab/exhibits.ts`, puro)

```ts
interface Box { x0: number; y0: number; x1: number; y1: number }
type Exhibit =
  | { id: string; title: string; zone: WorldZone; kind: "region"; box: Box; h?: number }
  | { id: string; title: string; zone: WorldZone; kind: "piece"; build: (out: Solid[], accents: Accent[]) => void };
export const EXHIBITS: readonly Exhibit[];
```

- `id` es el fragmento de URL (`#chimeneas`): minúsculas, sin acentos, único.
- `h` es la altura del punto más alto, para el encuadre; por defecto 30 como
  `FRAME_H` en `frame.ts`.
- Las cajas se derivan de las constantes exportadas de cada escena (`PLANT`,
  `STACKS`, `COOLING`, `TANKS`, `SILOS`, `WHEEL`, `COASTER`, `DROP`,
  `LIGHTHOUSE`, `BRIDGE`, `MALECON`, `TELECOM`, `ARENA`, `AUDITORIUM`, etc.),
  con un margen de 2..4 u para que entren veredas, faroles y sombras cortas.
  Donde la constante es privada (gradas, dársena, pórtico del astillero,
  subestación, cinta) la caja se escribe a mano y el test de no-vacío (§7) la
  vigila.
- Un exhibit `piece` se construye sobre un pad de `paving` de 1 u de espesor
  centrado en el origen, sin terreno ni animadores. `build` llama a la
  función existente con una posición fija: `ship("cargo", {x:0,y:0}, 0)`,
  `towerCrane(out, accents, { at: {x:0,y:0}, mastH: 20, jibLen: 24, dir: "e", light: "amber" })`, etc.

Lista inicial, agrupada por zona (el orden es el del índice):

| Zona | Exhibits región | Exhibits pieza |
|---|---|---|
| Portfolio: fábrica | planta, chimeneas y torre de enfriamiento, subestación, playa de camiones, playa de vías, cinta transportadora | — |
| Portfolio: astillero | gradas, dársena, grúa pórtico, calle de faroles, naves | grúa torre, farol |
| Portfolio: hinterland | central térmica y torre de enfriamiento, tanques, silos, línea de torres de alta tensión, playa de contenedores | — |
| Portfolio: feria | noria, montaña rusa, torre de caída, carrusel, arcade, autitos chocadores, muelle | — |
| Resume: ciudad | plaza, torre, puente, malecón, manzana derrumbada, manzana del distrito, obra | campus, selva |
| Resume: tecnológico | mástil de telecomunicaciones, arena, auditorio, torres | — |
| Blog: mar | faro, casa del farero, boyas, pecio | carguero, remolcador, convoy con barcaza, lancha colectiva |

El catálogo es dato: agregar una estructura nueva al mundo es agregar una
fila, no tocar la escena.

## 4. Recorte (`src/lab/crop.ts`, puro)

```ts
export function overlaps(b: Bounds, box: Box): boolean;        // en x e y; z no cuenta
export function cropScene(scene: WorldScene, box: Box): WorldScene;
export function cropAnimators(animators: ZonedAnimator[], box: Box): ZonedAnimator[];
export function pieceScene(build: Exhibit["build"]): WorldScene;
```

- `cropScene` filtra `terrain.ground`, `terrain.water`, `terrain.bleed`,
  `ground`, `solids` por `overlaps(bounds(s), box)` y `accents` por tener al
  menos un vértice dentro de la caja (`at` para `dot`, cualquier punto de
  `pts` para `poly`). `terrain.foam` se conserva solo si solapa. Un sólido
  que cruza el borde se conserva entero (no se corta geometría). Los
  subobjetos por escena (`shipyard`, `city`, `sea`, …) y `landmarks` se
  copian tal cual: el stage no los lee.
- `cropAnimators` envuelve cada animador: mismos `ids`, mismo `tick`,
  `layer(id)` devuelve la capa con `solids`/`accents`/`water` filtrados con
  las mismas reglas, `claims` filtrados igual. Si ninguna capa del animador
  tiene contenido dentro de la caja en su estado inicial, el animador se
  descarta (no hace falta tickear el mar entero para mirar una chimenea).
  El filtrado de capas animadas corre por tick solo sobre las capas que el
  animador marcó como cambiadas; `bounds` por sólido es barato frente al
  teselado que sigue.
- `pieceScene` arma un `WorldScene` mínimo: terreno vacío (`ground`, `bleed`,
  `water` vacíos, `foam` un `ground` sin triángulos), `ground` con el pad,
  `solids` y `accents` de `build`, subescenas en `null`, `landmarks` en el origen.

## 5. Stage (`src/world/stage.ts`, compartido)

Un método nuevo en `Stage`:

```ts
setLayer(layer: "ground" | "shadow" | "accents", visible: boolean): void;
```

- `ground` muestra u oculta el sangrado, el slot de agua y la Graphics de
  suelo; `shadow`, los slots de banda y de núcleo de sombras; `accents`, el
  slot de acentos y el slot del bloom si existe.
- Solo cambia `visible` de contenedores que ya existen. El sitio no lo llama:
  nada cambia fuera del lab. Si más adelante el bloom se arma con `accents`
  oculto, el slot nace con la misma visibilidad que el de acentos.

## 6. Página (`lab/storybook.html`, `src/lab/storybook.ts`, `src/world/frame.ts`)

**Layout.** Tres columnas en CSS grid: `<nav id="exhibits">` (lista agrupada
por zona, enlace `href="#id"` por exhibit, el actual con `aria-current`),
`<div id="lab-host">` (canvas), `<aside id="readout">`. Fondo `#100e19`
como el resto del lab, texto en la misma tipografía del sistema. `noindex` y
`src="/src/lab/storybook.ts"` como exige `lab-excluded.test.ts`.

**Arranque.** `assembleWorld(undefined, { reducedMotion })` una sola vez
(el mundo entero, con sangrado: así los márgenes construidos existen). La
`Application` se crea una vez. Cada cambio de exhibit destruye el `Stage`
anterior (`container.destroy({ children: true })`), arma el nuevo con
`buildStage(cropScene(...), cropAnimators(...))` o `buildStage(pieceScene(...), [])`,
reaplica los conmutadores de capa y el modo de bloom vigentes y encuadra.

**Encuadre.** `boxFrame(box, h)` en `frame.ts`, al lado de `zoneFrame`: los
cuatro vértices de la caja proyectados, con `h` en la esquina norte como hace
`zoneFrame`. Para `piece`, la caja viene de `bounds` de sus sólidos. Se ajusta
con `fitTransform` y el margen por defecto; se reencuadra en `resize`.

**Selección.** El hash elige el exhibit; sin hash o con uno desconocido, el
primero (y se corrige el hash). `hashchange` cambia el exhibit, así los
enlaces del índice y las flechas comparten camino: las teclas solo escriben
`location.hash`.

**Teclas.** `→`/`↓`/`j` siguiente, `←`/`↑`/`k` anterior; `g` suelo, `h`
sombras, `a` acentos (conmutan y se recuerdan entre exhibits); `6` rota el
bloom como en las otras páginas; `?bloom=` fuerza el modo al cargar sin
medir, `?speed=` escala el reloj de los animadores. Las teclas `0`..`5` no
existen acá.

**Bloom.** Igual que `page.ts`: diferido con `scheduleIdle` y `attachBloom`
sobre el primer stage; al cambiar de exhibit se reaplica el modo vigente con
`setBloom` sin volver a medir.

**Log.** En `DEV`, `[storybook] <id>: primer dibujo N ms, M polígonos estáticos`
por exhibit, y el peor redibujo en 5 s como en `page.ts`.

## 7. Lectura (`<aside id="readout">`)

Calculada desde los datos recortados al cambiar de exhibit, no por tick:

| Campo | Fuente |
|---|---|
| Sólidos | `scene.ground.length + scene.solids.length` más los sólidos iniciales de las capas animadas |
| Caras | suma de `tessellate(s).length` sobre los mismos sólidos |
| Acentos | `scene.accents.length` más los iniciales de capas de acentos |
| Caja | min/max en x, y, z sobre `bounds` de los sólidos; además ancho, fondo y alto en u |
| Materiales | lista ordenada de `mat` (y `topMat`) distintos |
| Colores de acento | lista ordenada de `color` distintos |

Una función pura `readout(scene, animators): Readout` en `crop.ts` produce el
objeto; la página solo lo vuelca a HTML.

## 8. Tests

- `exhibits.test.ts`: ids únicos y con el patrón `^[a-z0-9-]+$`; cada región
  dentro del mundo más sangrado; contra `world(SEED)` cada región recorta al
  menos un sólido (así una escena que se mude deja un test rojo, no un
  exhibit vacío); cada pieza emite al menos un sólido.
- `crop.test.ts`: `overlaps` con cajas que tocan el borde; `cropScene`
  conserva un sólido que cruza el borde y descarta uno de afuera, filtra
  acentos `dot` y `poly`; `cropAnimators` conserva `ids` y el resultado de
  `tick`, filtra `claims`, descarta un animador vacío para la caja;
  `readout` cuenta y ordena.
- `stage.test.ts`: `setLayer` cambia `visible` de los contenedores correctos
  y el slot del bloom sigue al de acentos.
- `frame.test.ts`: `boxFrame` proyecta cuatro puntos y el de la esquina norte
  lleva `h`.
- `lab-excluded.test.ts` ya cubre la página nueva (`noindex`, entry, fuera
  del build).
- Verificación visual al cerrar: capturas con agent-browser a 1600×900 2x de
  cuatro exhibits (uno animado por zona y una pieza), y confirmar que
  `lab/world.html` se ve igual que antes.

## 9. Orden de implementación

1. `boxFrame` y `setLayer` (motor compartido), con tests.
2. `crop.ts` con `overlaps`, `cropScene`, `cropAnimators`, `pieceScene`,
   `readout`, con tests.
3. `exhibits.ts` con el catálogo y su test de no-vacío.
4. Página: html, `storybook.ts`, teclas, lectura, bloom.
5. Cierre: capturas, línea en el README del lab, estado de esta spec.

## 10. Desvíos

Lo que la implementación hizo distinto de lo escrito arriba, con su origen.

- §3 decía que `Box` se declaraba en `exhibits.ts`. Vive en `src/world/frame.ts`, porque lo consume `boxFrame` y `src/world/` no importa de `src/lab/` (#92).
- §3 definía el exhibit con `zone`. Lleva además `group`, uno de los siete de `GROUPS` (una fila de la tabla cada uno), porque `WorldZone` tiene solo tres valores y el índice agrupa en siete (#93).
- §3 armaba las piezas con `ship("cargo", {x:0,y:0}, 0)` y un pad de `paving` fijo. Las piezas llevan `pad?: Material` (los barcos, `water`) y los barcos se arman con `ship(kind, shipAt(kind, {x:0,y:0}, 0), 0)`, para que el punto medio de la unidad completa (empujador incluido) caiga en el origen (#94).
- §3 prometía una estructura por exhibit. Hay casos que no se aíslan: la grúa pórtico queda también dentro de "gradas", la grúa torre del desvío dentro de "playa de camiones" y de "cinta", y la torre de oficinas en el centro de la "plaza". Las estructuras largas (malecón, línea de alta tensión, boyas) van enteras aunque encuadren finas. La "dársena" es el agua entre el muelle (`QUAY_X`) y la escollera, desde la bocana (`MOUTH_Y`), no el dique seco `DOCK`; el plan de #93 la llamaba fondeadero `BERTH`, constante que ya no existe desde #87. La caja de las chimeneas se estira al norte `PUFF_RANGE` para que el humo no se corte (#92, #93).
- §4 decía que `cropScene` filtra `terrain.ground`, `terrain.water` y `terrain.bleed` por `overlaps(bounds(s), box)`. El terreno (`kind: "ground"`) se recorta por triángulo, no por la caja del sólido entero, porque las seis mallas cubren el mundo y se conservarían enteras. Un triángulo nunca se corta (#92).
- §4 no mencionaba memoización. `terrain.*` y `claims` pasan por un memo por `(box, sólido)` (`cropShared`), porque el runtime excluye el agua reclamada por identidad. Las capas animadas no se memoizan, porque mutan sus sólidos (#92).
- §4 firmaba `pieceScene(build)` con un pad de 1 u de espesor. Es `pieceScene(build, pad = "paving")` y el pad es una malla `ground` (tapa más las caras este y sur), no un prisma, para que se pinte antes que las sombras. Su lado sale de la caja de la pieza con un margen de 3 u, y la tapa queda en `Math.floor(min z)` (#94).
- §6 decía que la caja de una `piece` sale de `bounds` de sus sólidos y que `boxFrame` va al lado de `zoneFrame`. `zoneFrame` además delega en `boxFrame`, y las piezas se encuadran con `solidsBox` de sus sólidos, pad incluido (#92, #94).
- §6 no preveía el orden entre los conmutadores de capa y la medición del bloom. Si los acentos se apagan antes de la medición diferida del bloom, se mide con el bloom oculto. Se acepta, sin lógica extra: es una página de lab y `?bloom=` fija el modo (#96).
- §8 sitúa la página bajo la base del sitio. Se sirve en `/lab/storybook.html`, no en `/map/lab/…`, porque `vite.config.ts` fija `base: "/"`; `CLAUDE.md` sigue diciendo `/map/` (#99).
- §8 pedía capturas de cuatro exhibits. Las de cierre están en `docs/superpowers/specs/assets/97-storybook/` (`chimeneas`, `torre`, `faro`, `grua-torre`, `world`) y se tomaron con `?bloom=off` para no depender de la medición diferida en headless (#97).
