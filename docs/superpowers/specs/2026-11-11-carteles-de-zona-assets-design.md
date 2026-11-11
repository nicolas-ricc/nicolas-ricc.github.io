# Carteles de zona: los assets, antes de integrarlos

**Fecha:** 2026-11-11
**Estado:** aprobado, listo para agente
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

- [ ] `src/kit/lettering.ts` con planos, fuente de trazo y relleno, y sus
      tests (§2).
- [ ] Plate `shape: "poly"` con test.
- [ ] Exhibits `cartel-helipuerto`, `cartel-helipuerto-b`, `grafiti` y
      `plataforma` en `EXHIBITS`, con título en inglés y su grupo de zona.
- [ ] Tecla de escala de portada en el storybook (§4), documentada en el
      comentario de teclas de `storybook.ts`.
- [ ] Medida de legibilidad de §4 anotada por cartel.
- [ ] Inventarios de §5 tildados con capturas a 2x
      (`agent-browser set viewport 1600 900 2`) de cada exhibit a escala real
      y a 1.17, con y sin bloom.
- [ ] `npm test` y `npm run typecheck` en verde; el glosario
      (`CONTEXT.md`) suma **Sign** (cartel) y **Lettering** con su código.
- [ ] Nada de `src/world/`, `src/main.ts`, `index.html` ni `style.css` cambia.

## 7. Fuera de alcance (historia siguiente)

La integración: dónde va cada cartel (la torre para Resume, el puerto para
Portfolio, el mar para Blog), el reemplazo visual de `#zonas` (los `<a>`
quedan como controles accesibles invisibles y el foco ilumina el cartel), el
hit test del cartel antes de `worldZoneAt`, el velo y el atenuado (`dim`), y
la oclusión (los accents se dibujan encima de todo y un cartel puede verse a
través de lo que tiene adelante).
