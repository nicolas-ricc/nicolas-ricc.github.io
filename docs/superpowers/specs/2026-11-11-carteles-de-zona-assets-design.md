# Carteles de zona: los assets, antes de integrarlos

**Fecha:** 2026-11-11
**Estado:** implementado (storybook; integración pendiente, §7)
**Alcance:** construir, **solo en el storybook**, los tres carteles que van a
reemplazar a los rótulos HTML de `#zonas` (Portfolio, Resume, Blog) como
objetos del mundo. Esta historia **no** toca el mundo, `main.ts`, `#zonas`,
el hit test ni el velo del sitio: los carteles se refinan como exhibits y su
integración es una historia aparte (§7).

## 1. Por qué un plano a 45°

`project()` es `x' = x − y`, `y' = (x + y)/2 − 1.4·z`. Medido por plano
(unidad de mundo → pantalla):

| Plano | Eje horizontal del texto | Eje vertical del texto | Lectura |
|---|---|---|---|
| Vertical, corre por (1, −1) (normal (1, 1, 0), mira a la cámara) | √2 ≈ 1.414, **horizontal** | 1.4, vertical | casi sin deformar (1 %) |
| Fachada sur (corre por x) | 1.118, baja 26.6° | 1.4 | buena si es grande |
| Fachada este (corre por y, leída hacia −y) | 1.118, sube 26.6° | 1.4 | buena si es grande |
| Suelo, por la diagonal (1, −1) | √2, horizontal | (1, 1)/√2 → 0.707: **aplastado a la mitad** | pobre salvo anamorfosis |

Con un plano vertical a 45° en planta el texto queda horizontal y casi
isótropo en pantalla, así que es la base de los tres carteles. La excepción
es el helipuerto (§3.1), que va sobre el suelo y por eso usa letras
anamórficas.

## 2. Una pieza común: `lettering`

Módulo nuevo `src/kit/lettering.ts`, sin dependencias de Pixi:

- **Plano de texto** `TextPlane = { origin: Vec3; u: Vec3; v: Vec3 }`: el
  texto se escribe en coordenadas (u, v) de 2D y sale como `Vec3` del mundo
  con `origin + u·a + v·b`. Hay helpers para los tres casos que se usan:
  `diagonalWall(at, z0)` (u = (1, −1, 0)/√2, v = (0, 0, 1)), `roofDiagonal(at, z)`
  (u = (1, −1, 0)/√2, v = (−1, −1, 0)/√2 · 2: anamórfico, compensa el 0.707) y
  `facade(edge, z0)`.
- **Fuente de trazo** (tubo de neón): polilíneas por glifo, en una grilla de
  diseño propia, **solo para las letras que se necesitan** (`P o r t f l i R
  e s u m B g`, mayúscula inicial y resto minúscula, que es como se escriben
  hoy los nombres). `strokeText(text, plane, size, width)` devuelve quads, uno
  por tramo, listos para `Accent` `poly`.
- **Relleno** (grafiti): `fillText` toma contornos de polígono por glifo y
  devuelve `Vec3[]` por contorno, para usar como plate o como accent.

Tests (vitest, como el resto de `src/kit`): un glifo en `diagonalWall`
proyecta a un segmento horizontal de largo √2·ancho; `roofDiagonal` da en
pantalla la misma relación de aspecto que `diagonalWall` (tolerancia 2 %);
todas las letras de los tres nombres existen en la fuente.

**Paleta.** `AccentColor` es una clave de `ISO_COLORS`. Los rótulos de hoy
usan `#ffc457` (Portfolio), `#8ec07c` (Resume) y `#7cf5ff` (Blog) en
`style.css`: si no hay claves que se le parezcan, se agregan a la paleta
(con su `…Mid`/`…Bleed` si el bloom las pide) y se suman a `ACCENT_COLORS`.

## 3. Los tres carteles

Cada uno es un exhibit `kind: "piece"` construido en el origen, reubicable,
con su `build(out, accents)` en un módulo de escena propio. La medida de cada
uno sale de §4, no de esta tabla.

### 3.1 Resume: helipuerto de azotea (`cartel-helipuerto`, grupo `city`)

*Desvío (2026-11-15): el helipuerto A/B de abajo quedó reemplazado en la
segunda vuelta por la corona de la torre corporativa (`cartel-torre`; en
escena, `cartel-torre-escena`), según
[`2026-11-15-carteles-de-zona-rediseno-design.md`](2026-11-15-carteles-de-zona-rediseno-design.md).
Lo que sigue queda como registro.*

Una azotea con helipuerto, como los de las torres de oficinas, donde el
cartel es la propia pista:

- Losa elevada sobre la azotea (una plataforma algo más alta que el
  parapeto, sobre pilares cortos o una estructura de vigas) con baranda o red
  perimetral.
- Las marcas de un helipuerto: círculo o cuadrado de borde, la "H", **luces
  de borde** como `dot` (perimetrales, de color, a intervalos regulares, como
  las de un helipuerto real) y un reflector bajo.
- La palabra **Resume** escrita sobre la pista con `roofDiagonal`, en tubo de
  neón verde (la clave del verde de Resume), a lo largo del eje (1, −1) para
  que se lea horizontal, ocupando el lado de la pista que mira a la cámara.
- La pieza se arma sobre una base del tamaño de la torre (`TOWER`: 16 × 14,
  `TOWER_H` 30) para poder juzgarla a la escala de su destino, pero no se
  pone en la torre en esta historia.

Por ser plana, es la que más depende de §4: si la anamorfosis no alcanza para
leerse en la vista de portada, la variante B es un cartel bajo de tubo a 45°
**sobre el borde de la pista** (un letrero de azotea clásico, apoyado en el
helipuerto). El storybook muestra las dos (`cartel-helipuerto` y
`cartel-helipuerto-b`) y la elección queda para el usuario.

### 3.2 Portfolio: muro grafiteado (`grafiti`, grupo `shipyard`)

*Desvío (2026-11-15): el muro grafiteado de abajo quedó reemplazado en la
segunda vuelta por el cartel del tinker (`cartel-taller`; en escena,
`cartel-taller-escena`), según
[`2026-11-15-carteles-de-zona-rediseno-design.md`](2026-11-15-carteles-de-zona-rediseno-design.md).
Lo que sigue queda como registro.*

Un muro de hormigón suelto en la zona portuaria, girado 45° en planta para
mirar a la cámara (sólido `poly` con huella de rectángulo rotado):

- Muro de bloques o paneles con algo de deterioro: juntas, manchas, un
  remate. Puede apoyarse en contrafuertes o llevar al lado unos tambores o un
  contenedor, como un muro del puerto.
- **Portfolio** en grafiti: letras de relleno con contorno y sombra 3D
  (estilo pieza o *throw-up*, legible, no *wildstyle* ilegible), pintadas con
  `fillText` como plates del muro. Hace falta una forma de plate nueva,
  `shape: "poly"` (contorno libre en (u, z)), además de `rect`/`disc`/`tri`.
- Pintura "medio neón": el relleno o un trazo interior en ámbar luminoso (la
  clave del ámbar de Portfolio) como accent, con el resto de la pintura opaca.
  Así se ve de noche sin dejar de ser una pintada. Dos o tres reflectores que
  bañan el muro (`dot` + un `poly` tenue de haz) justifican el brillo.
- Algún tag o detalle chico alrededor (goteos, una firma) para que se lea
  como grafiti y no como cartel.

### 3.3 Blog: plataforma en el agua (`plataforma`, grupo `sea`)

*Desvío (2026-11-15): en la segunda vuelta el cartel de Blog ganó un panel
`officeDark` de respaldo dentro del marco; el diseño es el mismo y se suma
el exhibit en escena `plataforma-escena`, según
[`2026-11-15-carteles-de-zona-rediseno-design.md`](2026-11-15-carteles-de-zona-rediseno-design.md).
Lo que sigue queda como registro.*

Una plataforma baja en mar abierto, discreta: no tiene que competir con el
faro.

- Pontón o plataforma sobre pilotes (amarre, baliza o plataforma de
  medición) con baranda, una escalera al agua y una luz de baliza.
- **Blog** en un cartel chico a 45° (`diagonalWall`) sobre la baranda, de
  tubo de neón cian (la clave del cian de Blog), con menos alpha que los
  otros dos.
- `pad: "water"`, como las otras piezas del grupo `sea`.

## 4. Medir la legibilidad

Antes de cerrar las medidas, el agente mide con el storybook:

- **Escala de prueba:** la de `coverView` en 1366 × 768 (≈ 1.17) y en
  celular 390 × 750 (≈ 0.83; ver
  `2026-11-11-encuadre-por-aspecto-design.md` §1). El storybook suma una
  tecla que fija la escala del exhibit a esos valores (por ejemplo `c`
  alterna real/1.17/0.83) para poder juzgar el cartel al tamaño con que se
  va a ver en la portada.
- **Criterio:** a 1.17 el alto de la x de las minúsculas mide al menos
  **10 px CSS** y el trazo al menos 1.5 px; a 0.83 la palabra se sigue
  reconociendo. De ahí sale el tamaño mínimo en unidades de mundo de cada
  cartel, y queda anotado en la spec o el PR con la cuenta.
- Si un cartel resulta enorme frente a su base, se dice en el PR con una
  captura: es un dato para la integración, no un motivo para achicarlo por
  debajo del criterio.

## 5. Referencias

Como con las piezas anteriores: un agente de investigación por cartel
(helipuerto de azotea iluminado de noche; muro portuario con grafiti; pontón
o plataforma de amarre con baliza), 4–8 fotos de Commons con licencia libre
reducidas a 1280 px en `docs/superpowers/specs/assets/carteles-refs/` con
`CREDITS.md`. Las fotos de stock se citan solo por URL. Por cada cartel queda
un inventario con casillas (las marcas del helipuerto, los elementos del
muro y del grafiti, las partes del pontón) que el PR tilda contra capturas
del storybook.

## 6. Criterios de aceptación

- [x] `src/kit/lettering.ts` con planos, fuente de trazo y relleno, y sus
      tests (§2).
- [x] Plate `shape: "poly"` con test.
- [x] Exhibits `cartel-helipuerto`, `cartel-helipuerto-b`, `grafiti` y
      `plataforma` en `EXHIBITS`, con título en inglés y su grupo de zona.
- [x] Tecla de escala de portada en el storybook (§4), documentada en el
      comentario de teclas de `storybook.ts`.
- [x] Medida de legibilidad de §4 anotada por cartel.
- [x] Inventarios de §5 tildados con capturas a 2x
      (`agent-browser set viewport 1600 900 2`) de cada exhibit a escala real
      y a 1.17, con y sin bloom.
- [x] `npm test` y `npm run typecheck` en verde; el glosario
      (`CONTEXT.md`) suma **Sign** (cartel) y **Lettering** con su código.
- [x] Nada de `src/world/`, `src/main.ts`, `index.html` ni `style.css` cambia.

## 7. Fuera de alcance (historia siguiente)

*Desvío (2026-11-17): integrado en #389; ver 2026-11-17-carteles-de-zona-integracion-design.md.*

La integración: dónde va cada cartel (la torre para Resume, el puerto para
Portfolio, el mar para Blog), el reemplazo visual de `#zonas` (los `<a>`
quedan como controles accesibles invisibles y el foco ilumina el cartel), el
hit test del cartel antes de `worldZoneAt`, el velo y el atenuado (`dim`), y
la oclusión (los accents se dibujan encima de todo y un cartel puede verse a
través de lo que tiene adelante).

## 8. Desvíos y medición

Lo que dejaron las historias #360 a #363 (PR #367, #370, #368 y #369), con
los números tal como se midieron.

### 8.1 Medición de legibilidad

Helipuerto de Resume, A y B (#361, PR #370):

| | Caja alta (u) | x (u) | `xHeightPx(size, 1.17)` | `xHeightPx(size, 0.83)` | Trazo a 1.17 (vert. ·√2 / horiz. ·1.4) | Largo de la palabra (u) | Base |
|---|---|---|---|---|---|---|---|
| **A** (pista) | **3.490** | 2.49 | **4.08 px** ✗ | 2.90 px | 1.32 / 1.31 px ✗ | 12.46 | losa 22 × 22 sobre torre 16 × 14 |
| **B** (tubo) | **8.55** | 6.11 | **10.0035 px** ✓ | 7.10 px | 1.65 / 1.64 px ✓ | 30.54 (marco 32.54) | losa 22 × 22; cuerda de 10 u en el centro del marco |

Veredicto: A ✗ (4.08 px < 10 a 1.17, con la mayor caja alta que entra en la
pista, 3.490 u; el "≈ 6.8 u" del plan no cumple su propia regla: a 6.8 el
rectángulo de la palabra mide 24.3 × 13.5 = 328 u² y el triángulo SE tiene
242 u²). B ✓.

Muro de Portfolio (#362, PR #368):

| | Caja alta (u) | x (u) | `xHeightPx` a 1.17 | `xHeightPx` a 0.83 | Trazo interior a 1.17 | Trazo del relleno a 1.17 | Largo de la palabra (u) | Base |
|---|---|---|---|---|---|---|---|---|
| Portfolio | 8.55 | 6.107 | **10.003 px** ✓ | 7.096 px | 1.0 u → 1.65 px (vert., ·√2) / 1.64 px (horiz., ·1.4) ✓ | 1.6 u → 2.65 / 2.62 px | 37.86 | muro 42.86 × 1.2 × 11.8 |

Veredicto: Portfolio ✓.

Plataforma de Blog (#363, PR #369):

| | Caja alta (u) | x (u) | `xHeightPx` a 1.17 | `xHeightPx` a 0.83 | Tubo a 1.17 (1.0 u) | Largo de la palabra (u) | Base |
|---|---|---|---|---|---|---|---|
| Blog | 8.55 | 6.107 | **10.00 px** ✓ (≥ 10) | 7.10 px | 1.65 px (vert., ·√2) / 1.64 px (horiz., ·1.4) ✓ | 15.879 (marco 16.879) | cubierta 14 × 12, tope en z 1.6; tope del cartel en z 12.425 |

Veredicto: Blog ✓.

La cuenta del criterio: `sizeForXHeight(10, 1.17)` ≈ 8.547…, y se usa 8.55
literal porque `xHeightPx(8.547…)` da 9.999999999999996, menos de 10 en coma
flotante. Con 8.55 B da 10.0035 px, Portfolio 10.003 px y Blog 10.00 px: es el mismo `xHeightPx(8.55, 1.17)`, redondeado distinto en cada PR.

A 0.83, B, Portfolio y Blog se reconocen. A es una mancha verde chica sobre
la pista. La elección entre A y B queda para el usuario (§3.1).

### 8.2 Desvíos de la historia

- **Factor anamórfico exacto.** El plano `roofDiagonal` usa `(−1.4, −1.4, 0)`
  (es decir `(−Z_SCALE, −Z_SCALE, 0)`) y no "· 2".
- **`fillText` deriva el relleno del trazo.** Es un cuadrilátero por segmento
  más un cuadrado en cada vértice interior, no una fuente de contorno.
- **Un `CREDITS.md` por carpeta de fotos**, más el índice en
  `assets/carteles-refs/`.
- **La tecla `c` fija 1.17 y 0.83 como constantes.** `coverView` dio 1.27
  (1.272) en un 1366×768 entero sobre la base de la historia, medido antes de
  que #365 reescribiera `coverView` en `main`.

### 8.3 Desvíos de los hijos

- **#360 (PR #367), base común:**
  - 14 glifos, no 15: la lista `P o r t f l i R e s u m B g` tiene 14
    letras distintas.
  - El grosor del trazo vive en el espacio del texto y después pasa por el
    plano.
  - El espacio avanza `GRID.space` y no dibuja nada.
  - Los placeholders van centrados sobre su base.
- **#361 (PR #370), helipuerto:**
  - A queda en 3.490 y B usa 8.55 literal (§8.1).
  - `interlock()` solo sobre la estructura de acero: pilares, vigas, postes
    y tensores.
  - La viga inferior de B va en dos mitades colineales, partidas en el poste
    central.
  - Los postes de B arrancan a z 32.95, el tope del disco.
  - Los tensores terminan corridos hacia afuera.
  - El reflector bajo tiene h 1.
  - `industrialLamp` trae foco cian y se lo recolorea a ámbar.
  - Notas para la elección A/B: el reflector SE cae sobre la "u", dos luces
    de borde caen sobre la línea base de A y la "H" blanca sobre el disco
    blanco se lee débil.
- **#362 (PR #368), grafiti:**
  - Trazo interior de 1.0 u, no 0.5 (a 0.5 daba 0.83 px a 1.17).
  - Reflectores de h 1.2, no 5, para que no tapen letras.
  - La interpenetración se comprueba también en el marco del muro.
  - Ubicación del contenedor: 2 u delante de la cara, pasada la firma.
  - La firma queda sobre la "o" final.
  - Los haces, a alpha 0.12, se ven muy tenues.
- **#363 (PR #369), plataforma:**
  - Los postes del cartel van detrás del marco: dos postes en los extremos
    de una viga de 16.88 u no caben en la cubierta.
  - El descendente de la `g` baja del marco, hasta z ≈ 0.06.
  - Lo "discreto" sale del alpha 0.75, no del tamaño.
  - La baliza queda en parte detrás de la `g`.
- **Nota de tamaño.** Todos los carteles son grandes frente a su base: la palabra de B mide
  30.5 u sobre una torre de 16 × 14, el muro 42.9 u y el marco de Blog
  10.8 u sobre una cubierta de 14 × 12. Es un dato para la integración (§4).

### 8.4 Capturas

En `assets/352-carteles/`, a 3200 × 1800 (1600 × 900 a 2x), cinco por
cartel: `<id>-real-bloom.png`, `<id>-real-nobloom.png`, `<id>-117-bloom.png`,
`<id>-117-nobloom.png` y `<id>-083.png`.

| id | real, bloom | real, sin bloom | 1.17, bloom | 1.17, sin bloom | 0.83 |
|---|---|---|---|---|---|
| `cartel-helipuerto` | [real-bloom](assets/352-carteles/cartel-helipuerto-real-bloom.png) | [real-nobloom](assets/352-carteles/cartel-helipuerto-real-nobloom.png) | [117-bloom](assets/352-carteles/cartel-helipuerto-117-bloom.png) | [117-nobloom](assets/352-carteles/cartel-helipuerto-117-nobloom.png) | [083](assets/352-carteles/cartel-helipuerto-083.png) |
| `cartel-helipuerto-b` | [real-bloom](assets/352-carteles/cartel-helipuerto-b-real-bloom.png) | [real-nobloom](assets/352-carteles/cartel-helipuerto-b-real-nobloom.png) | [117-bloom](assets/352-carteles/cartel-helipuerto-b-117-bloom.png) | [117-nobloom](assets/352-carteles/cartel-helipuerto-b-117-nobloom.png) | [083](assets/352-carteles/cartel-helipuerto-b-083.png) |
| `grafiti` | [real-bloom](assets/352-carteles/grafiti-real-bloom.png) | [real-nobloom](assets/352-carteles/grafiti-real-nobloom.png) | [117-bloom](assets/352-carteles/grafiti-117-bloom.png) | [117-nobloom](assets/352-carteles/grafiti-117-nobloom.png) | [083](assets/352-carteles/grafiti-083.png) |
| `plataforma` | [real-bloom](assets/352-carteles/plataforma-real-bloom.png) | [real-nobloom](assets/352-carteles/plataforma-real-nobloom.png) | [117-bloom](assets/352-carteles/plataforma-117-bloom.png) | [117-nobloom](assets/352-carteles/plataforma-117-nobloom.png) | [083](assets/352-carteles/plataforma-083.png) |

Además, `assets/352-carteles/plataforma-real-noaccents.png` (tecla `a`, 3200 ×
1800) muestra la estructura que tapa el cartel.

Quedan cuatro capturas históricas de los placeholders de #360 (780 × 437),
desactualizadas porque los exhibits ya no se ven así:
- [`cartel-helipuerto-real-base.png`](assets/352-carteles/cartel-helipuerto-real-base.png)
- [`cartel-helipuerto-b-real-base.png`](assets/352-carteles/cartel-helipuerto-b-real-base.png)
- [`grafiti-real-base.png`](assets/352-carteles/grafiti-real-base.png)
- [`plataforma-real-base.png`](assets/352-carteles/plataforma-real-base.png)
