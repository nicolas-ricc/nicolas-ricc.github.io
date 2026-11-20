# Carteles de zona, segunda vuelta: integrados a la escena y legibles con garantías

**Fecha:** 2026-11-15
**Estado:** implementado (storybook e integración al sitio: #389, spec 2026-11-17)
**Reemplaza en parte a:** `2026-11-11-carteles-de-zona-assets-design.md` (#352).
El cartel de Blog (`#plataforma`) se queda; el de Resume y el de Portfolio se
rehacen. La integración a `#zonas` del sitio (§7 de esa spec) sigue fuera de
alcance (hecha después en #389; ver §7).

## 1. Qué salió mal en #352

Visto en el storybook publicado (`/lab/storybook.html`, tecla `c` a 1.17):

- **Resume A (`#cartel-helipuerto`) no se ve.** A la escala de portada la
  palabra es una mancha de 4 px sobre una pista clara.
- **Resume B (`#cartel-helipuerto-b`) tampoco se lee.** Pasaba el criterio de
  #352 (alto de x ≥ 10 px), pero en pantalla las letras se pegan y el halo
  verde claro se funde con la pista y el cielo. Era la mejor de las dos, pero
  no se entiende.
- **Portfolio (`#grafiti`) no es un grafiti.** Es otro cartel de neón ámbar
  apoyado en un muro. No se lee como pintada ni dice nada de Portfolio.
- **Blog (`#plataforma`) está bien.** Se queda.

La causa de fondo es que #352 midió **una sola cifra geométrica** (alto de x
en px) y la dio por buena. No midió el espaciado, el contraste ni el halo, y
nunca miró el cartel *en su escena*. Las cuentas con la fuente actual
(`src/kit/lettering.ts`) lo muestran:

- `GRID.gap = 1` unidad de grilla. A caja alta 8.55 u, una unidad de grilla
  mide 8.55 / 7 ≈ 1.22 u. El tubo de 1.0 u se come 1.0 de esa separación y
  deja **≈ 0.22 u de aire entre letras**, ≈ 0.36 px a 1.17. Las letras se
  tocan y el bloom cierra el resto.
- El aire entre letras (0.22 u) es **4.5 veces menor** que el grosor del
  trazo (1.0 u). En cualquier rótulo legible es al revés, o al menos parejo.
- Los carteles se juzgaron construidos en el origen sobre un pad liso, no
  sobre el edificio ni con el fondo que van a tener.

## 2. Objetivo

Tres carteles que **sean parte de la escena** (una pieza del edificio o del
lugar, no un letrero apoyado) y que **se lean sin esfuerzo** a la escala de
portada. Además, **guardrails automáticos** que fallen si un cartel, o la
fuente, deja de cumplirlo.

## 3. Los carteles

### 3.1 Resume: helipuerto en la corona de una torre corporativa

La idea del helipuerto se mantiene; la ejecución se rehace. El cartel tiene
que leerse como **la corona de un edificio de oficinas**, la marca de la
empresa en lo alto de la torre, con el helipuerto encima:

- El host es una torre corporativa del centro de Resume (el exhibit
  `#torre` o una de sus vecinas): no es una pieza suelta con su propia torre
  de mentira. La pieza se diseña a la medida de ese edificio (su huella, su
  altura y su remate) y el exhibit en contexto (§5) la muestra puesta ahí.
- La palabra **no va pintada sobre la pista** (A falló porque el suelo
  aplasta las letras a la mitad y porque la pista es clara). Va en un plano
  **vertical** que mire a la cámara: el faldón o la cornisa de la plataforma
  del helipuerto, un remate a 45° o letras corpóreas sobre el borde. Va
  **sobre un fondo oscuro** (el canto de la losa, un panel, el vidrio oscuro
  de la torre), nunca contra la pista clara ni contra el cielo sin respaldo.
- Letras **corpóreas iluminadas** (cara llena con canto, *channel letters*,
  como la marca de una corporación) o tubo grueso con respaldo. Nada de tubo
  fino flotando.
- El helipuerto sigue presente y reconocible: la "H", el círculo y las luces
  de borde. Pero es el contexto de la marca, no su soporte.
- **Una sola versión.** No hay A/B: la variante que no pasa los guardrails
  no se entrega.

### 3.2 Portfolio: el cartel del *tinker*

Portfolio es el taller de alguien que arma cosas. El cartel tiene que ser
**caótico y hecho a mano**, con piezas rescatadas, como si el dueño del
astillero lo hubiera soldado con lo que tenía:

- **Cada letra distinta** en material y técnica: una de chapa recortada y
  oxidada, otra de lamparitas de marquesina, otra de tubo de neón, otra
  pintada sobre un tambor o una tapa de contenedor, otra de perfil de hierro
  soldado. Las alturas y los ángulos varían un poco (letras torcidas, una
  colgada de una cadena), siempre dentro de los guardrails de §4.
- **Montado sobre algo del lugar**: un andamio, el brazo de una grúa, una pila
  de contenedores o la cumbrera de una nave del astillero, con cables
  colgando, una escalera y un reflector. Es parte del astillero, no un muro
  aparte.
- Vida: alguna lamparita que titila, una letra que parpadea a destiempo o
  una chispa de soldadura cerca (animador opcional, como los de las otras
  piezas).
- El ámbar de Portfolio se mantiene como color dominante de las luces. Los
  materiales opacos (óxido, chapa, pintura) dan el caos.
- El exhibit `#grafiti` se borra (y su `sign-graffiti.ts`), junto con su
  carpeta de referencias si ya no aplica. El nuevo lleva un id que diga lo
  que es (por ejemplo `#cartel-taller`).

### 3.3 Blog: plataforma en el agua (sin cambios de diseño)

`#plataforma` se queda como está. Solo cambia lo que cambie en la base común
(la fuente, el espaciado, el halo) para pasar los guardrails de §4, que
también se le aplican.

## 4. Guardrails de legibilidad

Son la parte central de la historia. Se dividen en tres niveles, de más
barato a más caro. Los dos primeros corren en `npm test` (vitest, sin
navegador); el tercero es un script con navegador que deja un reporte y
capturas que el PR adjunta.

Notación: `C` = caja alta en unidades de mundo, `w` = grosor del trazo (o del
borde, en letras corpóreas), `px(·)` = medida en px CSS a la escala de
portada.

### 4.1 Nivel 1: la fuente (`src/kit/lettering.ts`, pura)

Para cada glifo y cada palabra que se usa (`Resume`, `Portfolio`, `Blog`, y
cualquier palabra nueva que entre a la fuente), con el `size` y el `width`
con que la usa cada cartel:

| Regla | Valor | Por qué |
|---|---|---|
| Proporción trazo/caja alta `C / w` | entre 6 y 10 | más fino se pierde y más grueso empasta |
| Alto de x / caja alta | 0.68 … 0.76 | minúsculas legibles a distancia |
| **Aire entre letras vecinas**: distancia mínima entre los contornos engrosados de dos glifos consecutivos | ≥ 1.0 · w y ≤ 3.0 · w | hoy da 0.22 · w; es la falla principal |
| **Ritmo**: aire máximo / aire mínimo dentro de la palabra (medido entre los contornos, no entre las cajas) | ≤ 1.8 | espaciado parejo; pide kerning por par donde haga falta (`r`·`t`, `f`·`o`, `l`·`i`…) |
| **Contraformas** (el hueco de `o`, `e`, `a`, `B`, `R`, `P`, `g`) y huecos interiores de `m`, `u` | ancho libre ≥ 1.0 · w | que no se cierren con el trazo ni con el halo |
| Ancho de avance de las minúsculas | 0.45 … 0.80 · C (salvo `i`, `l`, `m`) | ni condensada ni expandida |
| Sin solapamiento | ningún par de glifos vecinos se interseca después de engrosar | hoy `R`·`e`, `s`·`u` y `u`·`m` casi se tocan |

`lettering` expone las funciones que los tests usan, por ejemplo
`letterGaps(text, size, width)` (aire entre cada par), `counterClearance(…)` y
`strokeRatio(…)`, para que cada cartel pueda afirmarlas sobre su propia
palabra. Las letras corpóreas o de relleno (`fillText` y lo que se agregue)
cumplen las mismas reglas sobre su contorno.

### 4.2 Nivel 2: el cartel proyectado (pura, por cartel)

Con la geometría ya puesta en el mundo (o en el exhibit en contexto) y
proyectada con `project()`:

| Regla | A 1.17 | A 0.83 |
|---|---|---|
| Alto de x en pantalla | ≥ **12 px** | ≥ 8 px |
| Trazo en pantalla (el lado menor de cada quad proyectado) | ≥ **2 px** | ≥ 1.5 px |
| Aire entre letras en pantalla | ≥ **2 px** | ≥ 1.5 px |
| Línea de base en pantalla | ≤ 3° de la horizontal, o ≤ 27° si va sobre una fachada sur o este (la pendiente iso de 26.6°) | idem |
| Verticales de las letras | ≤ 4° de la vertical (sin cizalla visible) | idem |
| Relación de aspecto de la palabra proyectada contra la de la palabra plana | ± 8 % (descarta anamorfosis rotas) | idem |
| **Contraste estático**: luminancia relativa (WCAG) del color de la letra (núcleo del accent, o el tono iluminado del material si es corpórea) contra el tono sombreado del respaldo que tiene detrás | ≥ **4.5 : 1** | ≥ 3 : 1 |
| Respaldo | cada letra tiene detrás, en pantalla, un sólido o plate propio del cartel u host (no el cielo, no la pista clara), que la excede en ≥ 1 · w por lado | idem |
| Oclusión | en el exhibit en contexto, ningún sólido proyectado tapa más del 5 % del área de las letras | idem |

### 4.3 Nivel 3: render real (script con navegador, evidencia del PR)

`npm run legibility` (script nuevo; usa agent-browser, como en el
`CLAUDE.md` del repo, con GPU si está disponible) abre cada exhibit en
contexto a 1.17 y a 0.83 **con bloom** y:

1. Recorta la caja de pantalla de la palabra con un margen y guarda el PNG en
   `docs/superpowers/specs/assets/carteles-legibilidad/<cartel>-<escala>.png`.
2. **Contraste medido en píxeles**: mediana de luminancia sobre los píxeles
   del núcleo de las letras (la máscara sale de la geometría del nivel 2)
   contra la del anillo de fondo de 1–3 · w alrededor. ≥ 4.5 : 1 a 1.17 y
   ≥ 3 : 1 a 0.83.
3. **Halo**: la luminancia mediana dentro de las contraformas y del aire
   entre letras es ≤ 50 % de la del núcleo. Si el bloom las llena, el cartel
   falla: se baja el alpha o el radio del halo *de ese cartel*, no el del
   mundo.
4. **OCR**: tesseract.js (dependencia de desarrollo, con los datos `eng`
   versionados en el repo para que no dependa de la red) lee el recorte. A
   1.17 tiene que devolver la palabra exacta (`Resume`, `Portfolio`, `Blog`);
   a 0.83, la palabra sin distinguir mayúsculas. Se permite un preproceso
   fijo y documentado (gris, escalado ×3, umbral), igual para los tres
   carteles. El OCR es un piso: si una persona no lo lee, no pasa aunque el
   OCR lo lea.
5. Escribe `docs/superpowers/specs/assets/carteles-legibilidad/REPORT.md`
   con una tabla por cartel y escala (cada métrica, umbral y ✓/✗) y los
   recortes enlazados.

El nivel 3 no corre en CI (no hay navegador ni GPU en el workflow de
deploy), pero el PR de cada cartel **adjunta el reporte con todo en ✓** y
una captura del exhibit en contexto a 1.17 y a 0.83.

## 5. Ver el cartel en su escena

Un cartel se juzga donde va a estar. El storybook suma, por cartel, un
exhibit **en contexto**: la región real del mundo alrededor de su sitio (la
torre corporativa de Resume, el rincón del astillero de Portfolio, el mar de
Blog), con el cartel agregado en su posición candidata. Así se ve con sus
vecinos, su fondo y la luz de la zona. El mundo real (`assembleWorld`, el
sitio) no cambia en esta historia: el cartel se suma solo dentro del
exhibit.

- El exhibit `piece` suelto de cada cartel se mantiene para trabajar el
  detalle; el que manda para los guardrails 4.2 y 4.3 es el de contexto.
- La posición candidata de cada cartel queda anotada como dato (una
  constante exportada) para la historia de integración.
- La tecla `c` del storybook sigue fijando 1.17 y 0.83.

Sitios candidatos (constantes exportadas, para la historia de integración):

- `CROWN_SITE` = (129, 227, 30), en `src/scenes/sign-crown.ts`: el centro de
  la azotea de la torre corporativa real de Resume.
- `TINKER_SITE` = (60, −24, 13.5), en `src/scenes/sign-tinker.ts`: la cumbrera
  del galpón de montaje sur del astillero.
- `PLATFORM_SITE` = (392, 178), en `src/scenes/sign-platform.ts`: el mar
  abierto entre las dos boyas (movida a (392, 178) en #389: a 8,2 u del
  carril de salida fallaba la regla de oclusión de los barcos; #390 la
  integra al mundo).

## 6. Criterios de aceptación

- [x] La fuente pasa §4.1 para las tres palabras con los `size` y `width` de
      cada cartel; los tests fallan si se vuelve a `gap` 1 con tubo de 1.0.
- [x] Resume (§3.1) está rehecho como la corona de una torre corporativa con
      helipuerto, en una sola versión; `#cartel-helipuerto-b` y su función
      se borran o se reemplazan.
- [x] Portfolio (§3.2) está rehecho como el cartel caótico del *tinker*,
      montado sobre algo del astillero; `#grafiti` y `sign-graffiti.ts` se
      borran.
- [x] Blog (§3.3) mantiene su diseño y pasa §4.
- [x] Cada cartel tiene su exhibit en contexto (§5) y pasa §4.2 en vitest.
- [x] `npm run legibility` existe, y `REPORT.md` muestra ✓ en las tres
      palabras a 1.17 y a 0.83, con los recortes versionados.
- [x] Referencias fotográficas nuevas (Commons, licencia libre, 1280 px,
      `CREDITS.md`) para la corona corporativa con helipuerto y para carteles
      hechos a mano con chatarra o lamparitas, con un inventario tildado
      contra capturas, como en #352.
- [x] `CONTEXT.md` (entrada *Sign*) y el README del storybook quedan al día
      con los ids nuevos.
- [x] `npm test` y `npm run typecheck` en verde.

## 7. Fuera de alcance

*Desvío (2026-11-17): integrado en #389; ver 2026-11-17-carteles-de-zona-integracion-design.md.*

- Poner los carteles en el mundo del sitio y reemplazar `#zonas` (hit test,
  velo, foco). Va en la historia de integración, que usa las posiciones
  candidatas de §5.
- Tocar el bloom global.

## 8. Desvíos y medición

Cierre de la historia (#374, tareas #375–#380). Lo que sigue es lo que se
midió en la rama y en qué se apartó la implementación de §1–§7. Los números
salen de los oráculos de `src/kit/` y de `REPORT.md`; los tests de
`src/lab/docs.test.ts` los recalculan.

### 8.1 Medición

Nivel 2 (`signMetrics`, `staticContrast`) y nivel 3 (`npm run legibility`,
tal como lo escribe `REPORT.md`) de cada exhibit en contexto, a 1.17 y a
0.83. Respaldo 1 y oclusión 0 en los seis casos. Base, verticales y error de
aspecto: RESUME 0°, 0°, 0.010; PORTFOLIO 0.23°, 3.03°, 0.077; WRITING 0°, 0°,
0.010. Las filas de `plataforma-escena` se remidieron en #445 (2026-11-20,
WRITING en Chainsaw Carnage sobre la tabla flotante, caja alta 11.5), con el
OCR leyendo `WRITING`: desde #445 el nivel 3 no excusa ninguna fila. Las
demás conservan las medidas del 2026-11-17.

| Exhibit | Escala | Alto de x (px) | Trazo (px) | Aire (px) | Contraste estático | Contraste (px) | Halo | OCR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `cartel-torre-escena` | 1.17 | 14.25 | 2.31 | 2.95 | 4.70 | 10.13:1 | 0.06 | `RESUME` |
| `cartel-torre-escena` | 0.83 | 10.11 | 1.64 | 2.10 | 4.70 | 8.89:1 | 0.05 | `RESUME` |
| `cartel-taller-escena` | 1.17 | 15.07 | 2.40 | 2.29 | 8.06 | 6.99:1 | 0.08 | `PORTFOLIO` |
| `cartel-taller-escena` | 0.83 | 10.69 | 1.70 | 1.62 | 8.06 | 5.93:1 | 0.08 | `PORTFOLIO` |
| `plataforma-escena` | 1.17 | 14.50 | 2.26 | 2.47 | 8.08 | 14.18:1 | 0.06 | `WRITING` |
| `plataforma-escena` | 0.83 | 10.29 | 1.60 | 1.75 | 8.08 | 12.41:1 | 0.06 | `WRITING` |

Nivel 1: aire mínimo y máximo entre letras, ritmo y la contraforma más
ajustada, todo en w. Las tres palabras van en fuentes de exhibición (§8.2),
así que ya ninguna usa `SIGN_FONT` (tamaño 10.3, trazo 1.35 u): sus filas se
miden con `checkLayouts` sobre sus propios glifos, con w = la cara de la
letra (1.41 u en RESUME, caja alta 8.7; 1.46 u en PORTFOLIO, caja alta 9.2;
1.38 u en WRITING, la cara de Chainsaw Carnage, `CHAINSAW_FACE` 0.12 cajas altas, caja alta 11.5).

| Palabra | Aire mín. (w) | Aire máx. (w) | Ritmo | Contraforma más ajustada (w) |
| --- | --- | --- | --- | --- |
| RESUME | 1.27 | 1.47 | 1.16 | 1.56 (`R`) |
| PORTFOLIO | 1.19 | 1.19 | 1.01 | 1.19 (`P`) |
| WRITING | 1.08 | 1.08 | 1.00 | 2.07 (`R`) |

Desde #442 las filas de WRITING miden la tabla flotante en Chainsaw Carnage, con caja alta 10.8 en #442 y 11.5 desde #445; las filas de la tabla de §8.1 son las de #445.

### 8.2 Desvíos de la historia

- **Fuente (#375).** `SIGN_FONT` queda en tamaño 10.3 y trazo 1.35, con
  `GRID.gap` 2 y una tabla `KERN` por par (`lo`, `li`, `io` en −1; `rt`, `tf`
  en −0.5), en vez de ensanchar `i` y `l`. Antes el aire era 0.22 w.
- **Contraformas por puntos de sondeo (#375).** Las contraformas se miden con
  puntos de sondeo dentro de cada una, no sobre un raster.
- **Blog (#376).** Lleva un panel de respaldo `officeDark` dentro del marco;
  el marco es más largo que la cubierta (palabra más 3 por lado, L = 28.07) y
  los postes se mueven hacia el centro (`POST_INSET` 6.5) para seguir sobre la
  cubierta.
- **Oclusión y respaldo por caras planas (#376).** Se calculan con las caras
  planas de `tessellate` y la profundidad del rayo de cámara, no con cajas
  AABB.
- **Nivel 3 con `extract.pixels` (#377).** Los píxeles salen de
  `extract.pixels` del stage a través de `window.__lab` (solo en DEV), con
  bloom.
- **Resume (#378).** La corona es un panel a lo largo de (1, −1) con la losa
  del helipuerto encima: el fondo del panel queda a +3.2 de la azotea (no
  +2.4, para no cortar la sala de máquinas) y la losa tiene r 7.
- **Glifo `m` (#378).** Los topes planos de los arcos pasan a 1 unidad de
  grilla; con 0.5 el trazo medía 1.22 px a 1.17 y no pasaba la regla de nivel 2.
- **Luz de la antena real (#378).** Se ve a través del panel de la corona
  (los acentos se dibujan sobre todo sólido). El mundo no cambia en esta
  historia: la decide la integración. #391 quitó la antena y su luz: la corona
  remata la torre. Sus sólidos tapan 2 faroles de la avenida y unas 40
  ventanas candidatas de la ciudad, y como `lights()` sortea solo las
  candidatas visibles, el reparto de ventanas encendidas cambia en toda la
  zona Resume (determinista).
- **Portfolio (#379).** El anfitrión es la cumbrera del galpón de montaje sur
  del astillero. El sitio se mantiene en `TINKER_SITE` y la cubierta sube
  `DECK_RISE` 3.5 (no 2.6), porque el pórtico de la fábrica tapaba los márgenes
  de `r` y `t`.
- **Punto de la `i` (#379).** Se cuadra al ancho del trazo (1.35) para que
  valga la regla de 2 px a 1.17.
- **Marquesina (#379).** Alpha 0.7 en vez de 0.5: con 0.5 el OCR leía
  `Portfolic`.
- **RESUME en Neon Light (después del cierre).** La palabra de la corona
  pasa a mayúsculas, `RESUME`, con la fuente de marquesina
  [Neon Light](https://www.1001fonts.com/neon-light-font.html) (Font
  Bundles): cara llena `greenMid` con una hilera de lamparitas
  `windowWarm`, sobre un panel de vidrio oscuro (`glass`, no `officeDark`:
  con `greenMid` el panel `officeDark` daba 4.26:1 de contraste estático).
  Caja alta `CROWN_CAP` 8.7 (la palabra mide lo mismo que la `Resume` de
  trazos) y `CROWN_TRACKING` 0.07 cajas altas, porque el espaciado de la
  fuente deja 0.83 w de aire. La licencia (*Premium License*) prohíbe
  distribuir la fuente o convertirla, así que el TTF no se versiona: solo la
  palabra compuesta, `src/kit/marquee-resume.ts`, generada por
  `scripts/marquee-word.py`; `src/kit/marquee.ts` la triangula (earcut) y
  `checkLayouts` le aplica el nivel 1. En el nivel 2 el alto de x es la caja
  alta (`xHeight`) y el trazo, la cara de la letra (`stroke`).
- **PORTFOLIO en CNRGN Builder (después del cierre).** La palabra del
  *tinker* pasa a mayúsculas, `PORTFOLIO`, con
  [CNRGN Builder](https://justfreefonts.com/fonts/cnrgn-builder/) (Brylle
  Conrad Co, gratis para uso personal y comercial; la licencia no autoriza a
  redistribuirla, así que tampoco se versiona el TTF: solo
  `src/kit/builder-portfolio.ts`, generada por `scripts/marquee-word.py`).
  La fuente es pesada (cara 0.175 cajas altas: proporción 5.7 y contraformas
  de 0.99 w), así que el generador la afina 0.0075 cajas altas por lado
  (cara 0.159) para entrar en las reglas de §4.1 sin aflojarlas. Caja alta
  `TINKER_CAP` 9.2 y `TINKER_TRACKING` 0.08. Cada letra conserva su técnica:
  la cara llena para el recorte y la pintura; la marquesina, el tubo de neón
  (0.45 de ancho) y el bastidor soldado siguen los contornos de la letra (el
  bastidor, achicado a 0.75 sobre el centro para no tocar los paneles
  vecinos). La primera `O` sube (`dz` 0.1, antes −0.3) porque un poste del
  pórtico le tapaba una esquina del margen. Las capturas de detalle y de
  titileo de §8.4 (`cartel-taller-detalle*`, `cartel-taller-titila-*`)
  siguen mostrando la `Portfolio` de trazos; las de escena y escala real
  están al día.
- **Writing en Black Chancery (después del cierre).** La sección Blog pasa
  a llamarse Writing (nombre de la zona, título del contenido y menú; el id
  `blog` y la ruta `/area/blog/` no cambian). El cartel de la plataforma dice
  `Writing` en [Black Chancery](https://www.1001fonts.com/blackchancery-font.html)
  (dominio público; igual que con las otras dos, solo se versiona la palabra
  compuesta, `src/kit/chancery-writing.ts`). Las letras se espacian por el
  aire entre caras (0.16 cajas altas, `scripts/marquee-word.py`), no por los
  avances de la fuente, porque el remate de la W se mete debajo de la `r`.
  Para que la altura de x (0.665 cajas altas) llegue a 12 px a 1.17, la caja
  alta es `WRITING_CAP` 11.2 y la palabra mide 59.5 u, contra 22 u de Blog:
  la plataforma se rehízo como una cubierta larga sobre la diagonal del
  cartel (`PLATFORM_DECK`, el marco más 6 por punta), con pilotes cada ≤ 10
  sobre los dos bordes largos, postes del marco cada ≤ 16, baranda al frente
  y en las puntas (postes y pasamanos con `interlock`), la escalera al frente
  y la casilla y el mástil en las puntas. El exhibit en contexto pasa a la
  caja 366..434 × 136..204. `checkLayouts` no mira la proporción de altura
  de x (0.665, la regla pide 0.68) ni los avances de minúsculas; los trazos
  finos y los remates de la caligrafía tampoco cuentan para el trazo, que es
  el asta principal.
- **WRITING en LostWages (#437).** El cartel de la plataforma pasa a
  `WRITING` en mayúsculas, con la fuente
  [LostWages](https://www.1001fonts.com/lostwages-font.html) (Nick Curtis,
  licencia *1001Fonts Free For Commercial Use*), en neón `cyan`. No se
  versiona ningún TTF: solo la palabra compuesta,
  `src/kit/lostwages-writing.ts`, generada por `scripts/marquee-word.py`
  (la `Writing` de Black Chancery de arriba queda como historia). Caja alta
  `WRITING_CAP` 9.4 y cara `LOSTWAGES_FACE` 0.138 cajas altas, con aire de
  0.145. La fuente tiene los tubos dobles, con una ranura entre ellos: el
  generador aplica un cierre morfológico de 0.015 cajas altas que la rellena
  y un `thin` negativo (−0.0133, que engorda la cara) para que los trazos más
  finos (`I`, `T`) lleguen a 0.138. Se fue el panel `officeDark` y se queda el
  marco: el respaldo para el oráculo son los postes del marco más un parche
  plano de mar. `SIGN_MARGIN` baja de 3 a 1.5 y `END` de 6 a 4, para que la
  cubierta del sitio angosto (alto) deje libre el carril de salida. El umbral
  de aspecto del sitio de Writing pasa de 1,54 (#429) a 1,55.
  El cierre se acepta con el mismo criterio que la erosión de
  CNRGN Builder (arriba): trata el contorno ya rasterizado en
  `marquee-word.py`; el archivo de la fuente ni se modifica ni se
  redistribuye. La EULA de LostWages (§3) prohíbe modificar o adaptar la
  fuente, así que sus glifos no se pueden redibujar.
  **Excepción de OCR (nivel 3, hasta #445).** Por decisión del autor, el OCR de
  `plataforma-escena` y `plataforma-escena-angosta` falla, solo para este
  cartel y solo en el OCR: el contraste y el halo siguen en ✓ y los niveles 1
  y 2 no se aflojan. `REPORT.md` lee `WRELENG` a 1.17 y `WREFHNG` a 0.83 en
  `plataforma-escena` (contraste 12.12:1 y 11.46:1, halo 0.05 y 0.03), y
  `WRELENG` y `WREFHNG` en `plataforma-escena-angosta` (contraste 10.22:1 y
  9.85:1, halo 0.08 y 0.05). La causa son las letras, no el peso: la `I` de
  LostWages, un asta con un lazo abajo y una barra en la base, se lee como
  `E`. Se usa la `I` normal, no la `ı` sin punto. `legibility-measure.ts`
  marca esas cuatro filas como `✗ (excepción, spec 2026-11-15 §8.2)` y no
  falla la corrida. La excepción cubre solo esa lectura errada: `WR`, tres
  letras y `NG` (`excused`); si el OCR deja de leer la palabra, la fila
  vuelve a fallar.
- **WRITING en Chainsaw Carnage, tabla flotante (#441).** El cartel de la
  plataforma pasa a ser una tabla plana que flota en el agua, con `WRITING`
  pintada encima en la fuente
  [Chainsaw Carnage](https://www.1001fonts.com/chainsaw-carnage-font.html)
  de GGBotNet, con licencia SIL Open Font License (descarga:
  https://www.1001fonts.com/download/chainsaw-carnage.zip). La licencia
  permite derivar, así que la palabra se compone con las curvas de la
  fuente. No se versiona ningún TTF: solo la palabra compuesta,
  `src/kit/chainsaw-writing.ts`, generada por `scripts/marquee-word.py` con
  `speck` 0.005 y `tol` 0.004 (de 1 474 a 382 triángulos) y aire 0.13. La
  caja alta es `WRITING_CAP` 11.5, la cara `CHAINSAW_FACE` 0.12 cajas altas
  y `CHAINSAW_X` 0.77 (las mayúsculas de la fuente saltan: el «alto de x» que mide
  el oráculo es el de la letra más baja, la `W` con su trazo suelto).
  La tabla es un `poly` de `officeDark` desde el agua (z −1) hasta
  `BOARD_TOP` −0.4, cuyo plan es la caja de tinta de la palabra más
  `BOARD_PAD` 1.6 por cada lado, sobre un plano `roofDiagonal`: la palabra
  se pinta con la anamorfosis de ese plano. La pintura va plana sobre la
  cara superior, a `PAINT_LIFT` 0.02 por encima, porque el oráculo necesita
  que la cara de respaldo quede estrictamente detrás del centro de cada
  glifo. El plan mide unas 51.6 × 35.5 u (`PLATFORM_DECK`; con caja alta
  10.8 eran 48.6 × 33.7). Los dos sitios no cambian: validación de agua,
  carriles de al menos 27 u y barcos a lo largo del ciclo del balanceo.
  La tabla se balancea (`HEAVE`: amp 0.15 u, periodo 6700 ms,
  cuantizado a `HEAVE_STEP` 0.01), solo en altura: no hay cabeceo ni
  alabeo porque ningún sólido se puede inclinar. La pintura se mueve con la
  tabla como un solo cuerpo. Con `reducedMotion` la tabla queda quieta.
  La pintura queda fuera del bloom y se lee como pintura, no como neón:
  `platform.lights` declara `bloom: false` (#443) y, desde #445, también
  cada acento de la pintura (`Accent` `poly` con `bloom: false`, que el
  stage respeta en los acentos estáticos). Así el storybook (la pieza y los
  dos exhibits en contexto, que llevan la tabla como acentos estáticos) y
  `npm run legibility` miden la misma pintura que muestra el sitio; antes
  los exhibits la dibujaban con el espejo del bloom.
  **Por qué 11.5 y no 10.8.** Con 10.8, el OCR a 0.83 leía `WRITHG` en los
  dos sitios (tesseract funde `IN` en una `H`). Se probaron la tabla en
  `glass`, la pintura con alpha 0.9 y las dos juntas, también a 10.8: seguía
  `WRITHG`. Barrido de la caja alta, con la pintura fuera del bloom:
  10.8 lee `WRITHG` a 0.83 y 11.2 lee `WRITE` a 1.17 y `WRITHG` a 0.83; 11.3,
  11.5, 11.6 y 11.8 leen `WRITING` en los dos sitios y las dos escalas,
  con contraste mínimo 11.35:1 (el primer barrido, con la pintura todavía
  en el bloom de los exhibits, dio la misma banda, 11.3 a 11.8, con
  contraste mínimo 8.87:1). 11.5 es el medio de la banda. La
  tabla sigue en `officeDark` y la pintura en alpha 0.85: no se tocó
  ninguno. Contraste estático 8.08:1; nivel 2 en §8.1.
  El umbral de aspecto del sitio de Writing pasa a 1,53 (ancho 1378 px a
  900 px de alto): depende de la caja alta, porque `writingSite` lee
  `signBox(BLOG_SIGNS.wide)`.
  **Nivel 3.** La excepción de OCR de #437 se eliminó: el nivel 3 no
  excusa ninguna fila. `plataforma-escena` a 1.17: contraste 14.18:1,
  halo 0.06, OCR `WRITING`; a 0.83: 12.41:1, 0.06, `WRITING`.
  `plataforma-escena-angosta` a 1.17: 11.93:1, 0.06, `WRITING`; a 0.83:
  11.35:1, 0.06, `WRITING`. Capturas del balanceo en §8.4.
- **Writing en el mundo (#390).** `PLATFORM_SITE` pasó a (392, 178) en #389:
  a 8,2 u del carril de salida fallaba la regla de oclusión de los barcos.
  `sea()` construye la plataforma ahí y `plataforma-escena` es un recorte
  del mundo (caja 358..426 × 144..212, sin `build`).
- **Seguimiento: #382.** `strokePx` sigue la letra del issue (el lado más
  corto de cada cuad proyectado) y el punto de la `i` lo tensiona. Con
  `PORTFOLIO` en CNRGN Builder ya no hay punto de la `i` en ningún cartel.

### 8.3 Tamaño frente al host

Ancho de la palabra y del anfitrión en pantalla a 1.17 (extensión en x de la
proyección por 1.17). Dato para la integración: el cartel de Resume es más del
doble de ancho que su torre (`CROWN_SITE`); el de Writing cabe en su
cubierta, que desde la segunda vuelta se estira a lo largo del cartel
(`PLATFORM_SITE`); el de Portfolio cabe en el galpón (`TINKER_SITE`).

| Cartel | Palabra (u) | Palabra (px a 1.17) | Anfitrión | Anfitrión (px a 1.17) |
| --- | --- | --- | --- | --- |
| RESUME | 43.89 | 72.62 | `TOWER` 16 × 14 | 35.10 |
| PORTFOLIO | 52.74 | 87.73 | galpón de montaje sur 90 × 16 (`SHIPYARD_HALLS[1]`) | 124.02 |
| WRITING | 48.37 | 80.04 | tabla 51.6 × 35.5 (`PLATFORM_DECK`) | 85.34 |

Desde #445 la fila de WRITING mide la tabla flotante en Chainsaw Carnage con caja alta 11.5 (10.8 en #442); la tabla de abajo son las medidas de #445.

### 8.4 Capturas

Capturas (3200 × 1800; las seis `-escena` con bloom) en
`docs/superpowers/specs/assets/374-carteles/`:

- `assets/374-carteles/cartel-torre-escena-117.png` y `assets/374-carteles/cartel-torre-escena-083.png`
- `assets/374-carteles/cartel-taller-escena-117.png` y `assets/374-carteles/cartel-taller-escena-083.png`
- `assets/374-carteles/plataforma-escena-117.png` y `assets/374-carteles/plataforma-escena-083.png` (regeneradas en #445 con la tabla flotante)
- `assets/374-carteles/cartel-torre-real.png`, `assets/374-carteles/cartel-taller-real.png` y `assets/374-carteles/plataforma-real.png` (escala real; la de la plataforma, regenerada en #445)
- `assets/423-composicion-responsive/plataforma-escena-angosta-117.png` y `assets/423-composicion-responsive/sitio-1600x900-ancho.png` (regeneradas en #445 con la tabla flotante)
- `assets/374-carteles/cartel-taller-detalle.png`, `assets/374-carteles/cartel-taller-detalle-sinacentos.png`, `assets/374-carteles/cartel-taller-titila-a.png` y `assets/374-carteles/cartel-taller-titila-b.png`

Recortes del nivel 3 y la imagen que vio el OCR (`-ocr`), con
[`REPORT.md`](assets/carteles-legibilidad/REPORT.md), en
`docs/superpowers/specs/assets/`:

- `assets/carteles-legibilidad/cartel-torre-escena-117.png` y `assets/carteles-legibilidad/cartel-torre-escena-083.png` (más los `-ocr` de cada uno)
- `assets/carteles-legibilidad/cartel-taller-escena-117.png` y `assets/carteles-legibilidad/cartel-taller-escena-083.png` (más los `-ocr` de cada uno)
- `assets/carteles-legibilidad/plataforma-escena-117.png` y `assets/carteles-legibilidad/plataforma-escena-083.png` (más los `-ocr` de cada uno)

Balanceo de la tabla flotante (#441, #445), cuatro poses a un cuarto de periodo
(3200 × 1800, con bloom), con su
[README](assets/441-tabla-flotante/README.md):

- `assets/441-tabla-flotante/balanceo-1.png` y `assets/441-tabla-flotante/balanceo-3.png` (reposo)
- `assets/441-tabla-flotante/balanceo-2.png` (+`amp`) y `assets/441-tabla-flotante/balanceo-4.png` (−`amp`)
