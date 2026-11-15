# Carteles de zona, segunda vuelta: integrados a la escena y legibles con garantías

**Fecha:** 2026-11-15
**Estado:** diseño
**Reemplaza en parte a:** `2026-11-11-carteles-de-zona-assets-design.md` (#352).
El cartel de Blog (`#plataforma`) se queda; el de Resume y el de Portfolio se
rehacen. La integración a `#zonas` del sitio (§7 de esa spec) sigue fuera de
alcance.

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

## 6. Criterios de aceptación

- [ ] La fuente pasa §4.1 para las tres palabras con los `size` y `width` de
      cada cartel; los tests fallan si se vuelve a `gap` 1 con tubo de 1.0.
- [ ] Resume (§3.1) está rehecho como la corona de una torre corporativa con
      helipuerto, en una sola versión; `#cartel-helipuerto-b` y su función
      se borran o se reemplazan.
- [ ] Portfolio (§3.2) está rehecho como el cartel caótico del *tinker*,
      montado sobre algo del astillero; `#grafiti` y `sign-graffiti.ts` se
      borran.
- [ ] Blog (§3.3) mantiene su diseño y pasa §4.
- [ ] Cada cartel tiene su exhibit en contexto (§5) y pasa §4.2 en vitest.
- [ ] `npm run legibility` existe, y `REPORT.md` muestra ✓ en las tres
      palabras a 1.17 y a 0.83, con los recortes versionados.
- [ ] Referencias fotográficas nuevas (Commons, licencia libre, 1280 px,
      `CREDITS.md`) para la corona corporativa con helipuerto y para carteles
      hechos a mano con chatarra o lamparitas, con un inventario tildado
      contra capturas, como en #352.
- [ ] `CONTEXT.md` (entrada *Sign*) y el README del storybook quedan al día
      con los ids nuevos.
- [ ] `npm test` y `npm run typecheck` en verde.

## 7. Fuera de alcance

- Poner los carteles en el mundo del sitio y reemplazar `#zonas` (hit test,
  velo, foco). Va en la historia de integración, que usa las posiciones
  candidatas de §5.
- Tocar el bloom global.
