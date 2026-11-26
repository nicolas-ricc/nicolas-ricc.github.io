# Resume: hotel en bloque con RESUME en la azotea, ciudad de oficinas y franja de arrastre — diseño

**Fecha:** 2026-11-26
**Estado:** diseño aprobado, sin implementar
**Antecede:** `2026-11-22-resume-centro-costero-design.md` (#471: plaza, avenidas,
barrios, hotel con cartel en fachada), `2026-10-27-barrio-costero-design.md`
(barrio del sur), `2026-11-17-carteles-de-zona-integracion-design.md` (cartel
RESUME y oráculo de legibilidad).
**Plano de estudio:** `assets/2026-11-26-resume-hotel-cartel-2-5d/plano.html`
(abrir en el navegador; pestañas Hoy / Propuesta, vistas Volumen / Planta, y el
cuadro "El hotel de cerca"). Capturas: `plano-ciudad.png`, `plano-hotel.png`.
Las parcelas de "Hoy" salen del código actual y las de "Propuesta" del mismo
código con las constantes nuevas. Las alturas de cada edificio en el plano son
ilustrativas dentro del tope de su barrio. El plano es un boceto: las medidas
finas las ajusta quien construye, siempre que se respeten las reglas de §4.

## 1. Intención

El cartel RESUME y la estructura donde va montado miran a cámara: están en un
plano `diagonalWall` (dirección `(1,−1)/√2`), que en la proyección del sitio
sale como un rectángulo derecho, de frente, como una calcomanía pegada sobre
una placa girada 45°. El resto del mundo es 2.5D sobre la grilla. Queremos que
**el cartel y el edificio que lo sostiene compartan la perspectiva del resto**,
que las letras tengan volumen y que **el hotel y la plaza sean los
protagonistas** de la escena.

En la conversación salieron, además:

- La placa finita donde hoy está montado el cartel queda rara. En su lugar,
  **la manzana entera del hotel sube como un solo bloque**, en el estilo de su
  base (revoque claro, pórtico, cornisa), y **RESUME va parado en la azotea**.
- La plaza y el hotel se **estiran a lo largo de la costa** (en y), y la
  Diagonal Sur se corre con ellos.
- El **barrio de casas bajas al sur de la plaza es demasiado grande**: se achica
  para dejarle lugar a la plaza y al hotel.
- Tiene que leerse como una **ciudad de oficinas**: más edificios altos, y lo
  que está detrás del hotel tiene que subir, porque hoy al lado del hotel se ve
  todo bajo.
- **Al arrastrar hacia el oeste aparece una zona vacía.** Se llena hasta donde
  llega el arrastre, y ahí los barrios no van en franjas fijas sino
  **mezclados**, para que se vea natural.
- El **Bulevar Central y la Costanera** se cortan en `y 480`; siguen hasta el
  borde sur y salen de la pantalla.

## 2. Objetivos, no objetivos y anti-objetivos

**Objetivos**

1. Trazado: plaza, lote del hotel, Diagonal Sur y Avenida del Sur 30 u más al
   sur; barrio bajo más chico; Bulevar y Costanera hasta el borde sur (§5).
2. Hotel en bloque sobre la grilla, azotea en `z 60`, con RESUME parado en la
   azotea con letras extruidas, reticulado y pasarela (§6).
3. Alturas de ciudad de oficinas por barrio (§7).
4. La franja que se ve al arrastrar, llena y con los barrios mezclados (§8).

**No objetivos**

- No cambian la geografía, el estuario, la estación de Portfolio
  (`STATION_LAND`), las playas ferroviarias, el puente ni la ribera este.
- No cambia la cámara: ni `coverView`, ni `clampToBleed`, ni el bleed, ni el
  zoom de la vista de zona.
- No cambian la tipografía ni la grilla de bombitas de las letras de marquesina
  (`MARQUEE_RESUME`); cambia el plano donde se apoyan y ganan profundidad.
- Dentro del encuadre inicial, los barrios siguen en su gradiente por
  distancia; la mezcla de §8 es solo fuera del encuadre.

**Anti-objetivos** (aunque funcione, sería un fracaso)

- Que el cartel siga viéndose como un rectángulo de frente, o que la estructura
  se lea separada del edificio.
- Que alguna torre tape el cartel en la vista de inicio o en la vista de zona.
- Que algún edificio tape el tren o la estación de Portfolio en pantalla.
- Que al arrastrar a cualquier tamaño de pantalla se vea suelo vacío, o una
  avenida que termina en la nada.
- Que la franja de arrastre se lea como franjas paralelas de un solo tipo de
  barrio.
- Que se pierda el presupuesto de cuadro medido en #480.

## 3. Cómo funciona hoy (lo que se toca)

- `src/scenes/hotel-plan.ts`: `HOTEL_SLAB` (centro `{100, 259.5}`, media
  longitud 32, espesor 8, `z 10..51`, girada 45°), `HOTEL_CAP 12`,
  `HOTEL_TRACKING`, `SIGN_MARGIN`, `PANEL_*`, `SIGN_Z0 31.5`, `panelAt`, `on`,
  `slabFootprint`.
- `src/scenes/sign-hotel.ts`: `RESUME_SIGN` (`signSpec` sobre
  `diagonalWall`, `backing: [SIGN_PANEL]`, id `cartel-torre`), `hotelSign`,
  `hotel()` (base con ochavas `h 10`, cornisa, pórtico con faroles, placa con
  fachada 12 × 16, sala de máquinas), las habitaciones encendidas en la cara
  SE salvo la banda del cartel, `paperWindow`, `hotelStandIn`.
- `src/kit/lettering.ts`: ya existe el plano `facade(a, b, z0)`, alineado a la
  grilla. `src/kit/legibility.ts`: `SIGN_RULES` ya acepta la línea de base de
  fachada a 26.6° (`facadeBaselineDeg: 27`).
- `src/scenes/city-plan.ts`: `PLAZA_MAYOR {132, 206, 54, 85}`,
  `PLAZA_CENTER {159, 248}`, `HOTEL_LOT {73, 234, 54, 51}`, `AXES`
  (Costanera y Bulevar de `y 160` a `y 480`; Diagonal Sur de `(132, 291)` a
  `(−420, 522)`; Avenida del Sur en `y 318`; Avenida del Barrio en `y 378`),
  `barrioAt`, `CITY_BOUNDS.y1 318`, `parcels()` (filtra por `inCoverQuad`).
- `src/city/zoning.ts`: `neighborhoodCap` (clásico 8.5, transición 16, moderno
  50 en `towerZone` y si no `TOWER_FREE_H 21`, bajo 6), `trainCap`,
  `FRONT_CAP_H 10` vía `maxHeightFor`, `BARRIO_STEP`, `CATALOGUE`.
- `src/city/crossings.ts`: `inDomain` = al norte de `CITY_BOUNDS.y1` y dentro
  del encuadre más `COVER_MARGIN 30`.
- `src/city/streets.ts`: `boulevardStretches` sigue el tramo del eje
  `bulevar`; si el eje se alarga, el cantero lo acompaña.
- Barrio costero: `src/scenes/tech.ts` construye sobre `southParcels()`
  (`src/scenes/sprawl-grid.ts:86`), que son las parcelas del plano de la ciudad
  con centroide `y > 318`, hasta `y 650`, dentro del encuadre. No es una grilla
  aparte: el corte en 318 está repetido en `barrioAt`, `southParcels`,
  `builtParcels` (`zoning.ts`, `c.y < 318`), `CITY_BOUNDS` y `PLAN_BOUNDS`.
- `towerZone` (`zoning.ts:133`): `c.y < 290 && d >= 205`.
- Presupuesto vigente (`src/scenes/city-budget.test.ts`, medido en #480):
  sólidos elevados de la ciudad ≤ 1 700, tiras ≤ 570, acentos estáticos
  ≤ 1 400, y los topes del mundo entero que siguen en ese archivo.
- La Costanera como eje (`AXES`) termina en `y 480`, pero su paseo y sus
  faroles ya siguen dentro del costero más allá de `y 600`
  (`tech-south.test.ts:191`). El Bulevar sí se corta en 480.

## 4. Reglas que hay que respetar

- **Regla de las vías (`trainCap`)**: para cada sólido,
  `y_min − 1.4 · z_max ≥ 134.5`. Es lo que pone los techos del hotel y el cartel
  (§6).
- **Legibilidad**: el oráculo de `src/kit/legibility.ts` tiene que dar verde a
  `RESUME_SIGN` en su plano nuevo (altura x ≥ 12 px con encuadre 1.17, ≥ 8 px con
  0.83). Se necesitan unos 5.33 u de tinta por unidad de altura de mayúscula:
  con mayúscula 12 hacen falta unos 64 u de largo.
- **Nada tapa el cartel**: lo que está delante del cartel en pantalla tiene un
  tope (`maxHeightFor`), adaptado al cartel nuevo.
- **Escalón de un barrio** entre vecinos: moderno → transición → clásico → bajo.
- **Acentos arriba de todo** (ADR 0003): las letras y bombitas son acentos.
- **Presupuesto**: los topes de `src/scenes/city-budget.test.ts` (ciudad:
  sólidos elevados ≤ 1 700). Se pueden subir solo con medición en el PR:
  conteos nuevos × 1.1, y `stage.tick` y FPS contra `main` con el método de
  #480 sin empeorar más allá de su tolerancia. *(Decisión del diseño, no de la
  conversación.)*

## 5. Trazado (ticket 1)

| | Hoy | Propuesta |
|---|---|---|
| Plaza Mayor | `{132, 206, 54, 85}` (y 206–291) | `{132, 206, 54, 114}` (y 206–320) |
| `PLAZA_CENTER` | `{159, 248}` | `{159, 263}` |
| Lote del hotel | `{73, 234, 54, 51}` | `{73, 234, 54, 81}` |
| Diagonal Sur | `(132, 291) → (−420, 522)` | `(132, 320) → (−420, 551)` |
| Avenida del Sur | `y 318` | `y 348` |
| `CITY_BOUNDS.y1` | 318 | 348 |
| Corte ciudad / costero (los `318` de §3) | `y 318` | `y 378` (la Avenida del Barrio) |
| Entre la Avenida del Sur y la del Barrio (`y 348..378`) | — | una fila de manzanas de la ciudad, barrio clásico bajo (12–18) |
| Casas bajas (costero, `southParcels`) | desde `y 318` | desde `y 378` |
| Bulevar Central y Costanera | hasta `y 480` | hasta el borde sur del mundo (`y ≥ 714`, el bleed) |

- La Avenida del Barrio (`y 378`) no se mueve y pasa a ser el borde entre la
  ciudad y el costero. Todos los `318` de §3 se reemplazan por una sola
  constante (`378`). *(Decisión del diseño: el plano mostraba las casas desde
  `y 410`; la diferencia es una fila, y un solo corte simplifica.)*
- La Costanera: se alarga el eje hasta el borde y se verifica en pantalla que
  el paseo, los faroles y la calzada lleguen sin corte; el Bulevar es el corte
  que hoy se ve.
- El Bulevar Central y la Costanera llegan al borde sur con todo lo suyo:
  cantero, árboles, faroles y cruces. Las casas del costero se corren para no
  pisarlos. El test de `src/scenes/tech-south.test.ts` ("the Avenida del Barrio,
  the Diagonal Sur, the costanera and the bulevar continue inside the barrio")
  se extiende para pedir que lleguen al borde sur.
- Las plazas de cruce, las ochavas y las piezas fijas que dependen de estas
  constantes se recalculan solas o se mueven con ellas; quien construye revisa
  los tests de `city-plan`, `crossings`, `axis-streets` y `axis-furniture`.

## 6. Hotel y cartel en 2.5D (ticket 2, depende del 1)

**El edificio**

- **Sin placa.** El hotel es la manzana entera: un solo bloque sobre la grilla,
  del tamaño de la base actual (lote menos vereda, unos 51 × 78), **desde el
  piso hasta la azotea en `z 60`**. Hoy la placa llega a 51.
- **Todo en el estilo de la base**: el revoque claro (`plaster`), las mismas
  ventanas y las ochavas de hoy. Conserva el pórtico con sus dos faroles en la
  cara que da a la plaza (+x) y remata con una **cornisa** en `z 60`.
- La cornisa que hoy marca `z 10` desaparece (en el plano no está), para que se
  lea como un solo edificio. Decisión de quien construye: puede quedar una
  moldura fina si hace falta para que no sea un cubo liso.
- La sala de máquinas queda sobre la azotea, detrás del cartel.
- Las habitaciones encendidas (acentos ámbar) pasan a la fachada del bloque, en
  las caras visibles; `paperWindow` sigue saliendo de una ventana de un piso
  medio en la cara de la plaza.
- Techo del bloque: `trainCap` permite hasta `z ≈ 72` con `y_min ≈ 235.5`; se
  queda en 60 porque lo que suba se lo saca al cartel.

**El cartel**

- **RESUME parado en la azotea**, sobre el borde que mira a la plaza (+x), con
  el texto a lo largo de la grilla (eje −y; en pantalla la palabra sube hacia la
  derecha a 26.6°). Plano `facade(a, b, z0)`, ya existente.
- Mayúscula **12**, igual que hoy, de `z ≈ 62` a `z ≈ 74`.
- Letras **extruidas 1.2 u** hacia +x (cara frontal, costados más oscuros, y las
  bombitas en la cara frontal).
- Detrás, un **reticulado de acero**: cordones horizontales, montantes cada
  ~6 u, diagonales y patas inclinadas hasta la azotea, hasta `z 75`. Delante,
  una **pasarela** con baranda.
- Tramo en y: de `~241` a `~308`. **Techo del conjunto `z 75`**, que es el
  límite de la regla de las vías: `241 − 1.4 · 75 = 136 ≥ 134.5`.
- Sin panel de vidrio: el fondo del cartel es el cielo. Si el oráculo pide un
  `backing`, se usa el reticulado o una placa fina dentro del reticulado; lo
  decide quien construye, sin aflojar las reglas.
- `RESUME_SIGN` cambia de plano; `hotelSign`, `hotelStandIn` y la exhibición
  del lab se actualizan. `FRONT_CAP_H` y `maxHeightFor` se adaptan al cartel
  nuevo; como el cartel está más arriba, probablemente se puedan aflojar los
  topes delante.

### 6.1 Desvíos (#494)

| Punto | Spec | Construido |
|---|---|---|
| Plano del cartel | `facade`, sin estirar | `facade` con estiramiento anamórfico K 1.17 (`SIGN_STRETCH`) |
| Tramo en y | `~241` a `~308` | tinta y 242.03..312.86 (placa 239.1..313.3) |
| Línea de base | z ≈ 62..74 (plan 61.4 / 73.4) | z 61.6 (tope 73.6) |
| Respaldo | sin vidrio; reticulado o placa fina | placa fina `navy` (no vidrio), `SIGN_BACKING` |
| Aspecto en el oráculo | medido como cartel de pared | los carteles `facade` se miden sobre los lados proyectados (como los de suelo); aspecto 0.0703 ≤ 0.08, límite sin cambios |
| `FRONT_CAP_H` | adaptado | reemplazado por un tope derivado de la placa (`maxHeightFor`) |

## 7. Alturas de ciudad de oficinas (ticket 3, depende del 1 y del 2)

| Barrio | Hoy | Propuesta |
|---|---|---|
| Clásico (d < 80 de la plaza) | 8.5 | 14–22 |
| Transición (80–150) | 16 | 24–34 |
| Moderno (d ≥ 150) | 21 · 50 en `towerZone` | 40–50 |
| Bajo | 6 | 6–8 |
| Hotel | 51 | 60 + cartel → 75 |

- La zona de torres empieza a unas dos cuadras de la plaza (d ≈ 150; hoy
  205), y su límite sur pasa de `y 290` a `y 320`, siguiendo el corrimiento de
  30 u del trazado. *(Decisión del diseño.)*
- **Las torres no pasan de 50**, así el cartel queda por encima de todo y se
  recorta contra el cielo. (El plano tiene un selector "torres hasta 66" para
  comparar; se descartó.)
- Por encima de todo sigue `trainCap`: la fila de `y 171` queda en unos 25.
- Las distancias del gradiente se miden desde el `PLAZA_CENTER` nuevo.
- Los delante del cartel respetan el tope adaptado de §6.
- Se actualiza el `CATALOGUE` por barrio si las recetas no dan esas alturas.
- Se mide presupuesto y FPS (método de #480) y se ajustan los topes si hace
  falta, con los números en el PR.

## 8. Franja de arrastre (ticket 4, independiente)

**Dónde.** Medido con `clampToBleed` en 9 configuraciones (inicio en 1920×1080,
1440×900, 1280×1024, 2560×1080, 390×750, 820×1180; zona "cv" en 770×1080,
1920×1080, 390×750): al arrastrar hacia el oeste se ve hasta la recta de
pantalla `x − y = −710`, con `x ≥ −394`, y la franja baja hasta el borde sur
(`y 711`). El encuadre termina en `x − y = −419`. Lo que está más al suroeste
de `−710` no se ve nunca y no se construye.

- `inDomain` y el filtro de `parcels()` pasan de "encuadre + `COVER_MARGIN`" a
  "lo alcanzable al arrastrar + un margen", definido con una función que derive
  de `clampToBleed` o una constante con test que lo verifique en esos 9 casos.
- Son unas **114 parcelas de ciudad** más y unas **80 casas** del costero hasta
  `y 711` (además del costero que ya existe).

**Mezcla.** Fuera del encuadre los barrios no van en franjas:

- Un campo suave de "cuán urbano" por punto: más alto al norte, más bajo al
  sur, más ruido de valor de dos escalas (períodos ~110 u y ~45 u), determinista
  por semilla.
- El campo elige el barrio de cada parcela (umbrales: moderno > transición >
  clásico > bajo). Así salen manchas de torres, medianos y casas que se meten
  unas en otras: grupos de medianos (y algún alto) entre las casas al sur,
  manchas de clásicos y transición entre las torres al norte.
- La mezcla entra de a poco entre `x − y = −400` y `−470`: dentro del encuadre
  no cambia nada y no se nota un corte.
- Después del campo corre la regla de escalón de un barrio, para limar saltos
  de dos escalones.
- **Quién construye.** El campo es una sola función de zonificación. Al norte
  del corte ciudad / costero las parcelas las construye la ciudad, como hoy.
  Al sur, el costero: cuando el campo dice "bajo", con sus casas; cuando dice
  otro barrio, con las recetas de la ciudad (`CATALOGUE`) para ese barrio. Los
  sólidos se cuentan donde se construyen (ciudad o costero) y cada presupuesto
  se mide aparte. *(Decisión del diseño.)*
- `southParcels` también deja de filtrar por el encuadre y usa la misma región
  alcanzable.
- Las casas fuera del encuadre son variadas: cada lote con su tamaño y
  posición, algunos con galpón, algunos vacíos o con patio. Las manzanas
  "bajo" de la ciudad se ven igual (casas, no bloques).
- La implementación del plano (`stripW`, `vnoise`, `urban`, `mixKind`,
  `houses` en `plano.html`) es una referencia, no el código a copiar.

## 9. Enfoques considerados

- **Cartel**
  - *Placa sobre la grilla con el cartel en la fachada.* Resolvía la
    perspectiva, pero la estructura seguía viéndose pegada encima de una placa
    finita. Descartado.
  - *Placa más alta con el cartel en la azotea.* Mejor silueta, pero seguía
    siendo una placa finita sobre un zócalo de otro estilo. Descartado.
  - **Elegido: la manzana entera sube como un bloque en el estilo de la base,
    con RESUME en la azotea.** Es el más simple de construir (un sólido) y el que
    mejor ancla el cartel. A cambio, es una masa más pesada y tapa más ciudad
    hacia el oeste.
- **Tamaño del cartel.** Con 48 u de largo la mayúscula queda en ~9, que no
  pasa el oráculo en el teléfono; por eso el lote se estira en y hasta tener
  64–68 u de cara.
- **Torres por encima del hotel (hasta 66).** Descartado: el cartel queda
  recortado contra torres encendidas.
- **Llenar el oeste hasta `x = −402`.** Primer intento, equivocado: la mayor
  parte del suroeste no se ve al arrastrar, y en cambio la franja baja que sí se
  ve (y 470–711) quedaba vacía. Se reemplazó por la región medida (§8).
- **Franja por bandas fijas.** Descartado: se lee artificial.

## 10. Tickets

1. **Trazado** (§5). Sin dependencias.
2. **Hotel y cartel en 2.5D** (§6). Depende del 1.
3. **Alturas de ciudad de oficinas** (§7). Depende del 1 y del 2.
4. **Franja de arrastre mezclada** (§8). Independiente; si se hace antes que
   el 1, el borde sur del costero se ajusta luego.

Cada ticket cierra con capturas antes y después de la vista de inicio
(1920×1080 y 390×750) y de la vista de zona Resume, y con las pruebas y el
typecheck en verde.

## 11. Lo que queda a criterio de quien construye

- Medidas finas del bloque, de la cornisa y del reticulado, dentro de las
  reglas de §4.
- Si queda una moldura a la altura de la base.
- El fondo del cartel ante el oráculo (ver §6).
- Cómo se adapta `FRONT_CAP_H` / `maxHeightFor`.
- Umbrales y amplitudes exactas del campo de mezcla.
