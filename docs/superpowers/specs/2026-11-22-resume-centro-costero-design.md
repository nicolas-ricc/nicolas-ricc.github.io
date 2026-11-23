# Resume: centro costero con plaza, avenidas y cartel en el hotel — diseño

**Fecha:** 2026-11-22
**Estado:** implementado (#471; rama feature/471-resume-centro-costero)
**Antecede:** `2026-09-14-resume-ciudad-design.md` (grilla y piezas fijas),
`2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md` (kit, zonificación,
luces), `2026-10-27-barrio-costero-design.md` (barrio del sur),
`2026-11-17-carteles-de-zona-integracion-design.md` (cartel RESUME).
**Plano de estudio:** `assets/2026-11-22-resume-centro-costero/plano.html` (abrir
en el navegador; pestaña A, "Continuidad") y la captura `plano-a.png`. Las
coordenadas de este documento salen de ese plano. El plano es un boceto: las
medidas finas las ajusta quien construye, siempre que se respeten las reglas
de §4.

## 1. Intención

Hoy Resume es un damero parejo de manzanas de 24 × 18 con una sola avenida, la
del puente. No tiene centro, las calles no tienen jerarquía y el estilo de los
edificios no cambia con la distancia. Queremos que la zona **se lea como una
ciudad real, con barrios y avenidas**:

- Como el espacio es poco, la zona es el **centro de una ciudad que limita con
  la costa** (el muelle oeste del estuario).
- Un **parque central del que salen las avenidas principales**.
- **Edificios clásicos de estilo porteño** alrededor del parque y, a medida que
  uno se aleja, **edificios más modernos**: torres y oficinas.
- Las calles tienen que estar pensadas para que **se vean las avenidas y sus
  conexiones**.
- Se **agrega detalle aunque rompa el estilo low poly**, pero **la grilla
  isométrica se mantiene**.
- El borde con el barrio costero del sur deja de ser un corte y pasa a ser una
  **transición continua y coherente**.
- El cartel RESUME pasa a una **fachada de un edificio ancho y alto, tipo hotel
  de cadena** (la referencia es un Marriott), y crece un **50%**. Deja el
  helipuerto.

## 2. Objetivos, no objetivos y anti-objetivos

**Objetivos**

1. Trazado nuevo de la ribera oeste: plaza mayor sobre la costanera, avenidas en
   abanico, bulevar, avenidas transversales y plazas en los cruces (§5).
2. Gradiente de barrios por distancia a la plaza: casco clásico, transición,
   moderno (§6).
3. Detalle porteño en los edificios del casco: ochavas, cúpulas en las esquinas,
   mansardas, balcones, basamentos con portales (§6.2).
4. El hotel con el cartel RESUME en su fachada, un 50% más grande que hoy (§7).
5. La grilla sigue al sur dentro del barrio costero, que se rehace sobre ella,
   con la densidad bajando de a escalones (§8).
6. La grilla también sigue al **oeste**, sobre el distrito tecnológico que hoy
   ocupa la vista al oeste de `x −54`. Ese distrito se rehace como el barrio
   moderno de §6.1 (§8.1).

**No objetivos**

- La ribera este (anillo, mercado, dársena, derrumbe, malecón, selva) no
  cambia, salvo lo que obligue la costanera al pegarse al muelle.
- No se tocan la geografía (estuario, muelle oeste `x 192..198`, costura `y 90`
  con Portfolio, costura `x 344` del malecón), la estación de Portfolio
  (`STATION_LAND`), las playas ferroviarias ni el puente (`y 207..217`).
- No cambian Portfolio ni Writing, ni los otros carteles.
- No se agregan texturas ni shaders: todo sigue siendo polígonos planos con la
  paleta.

**Anti-objetivos** (cosas que harían fallar el trabajo aunque funcione)

- Que se vuelva a leer como un tablero parejo: las avenidas tienen que
  destacarse de las calles a simple vista, al zoom del sitio.
- Un cartel menos legible que el de hoy, o tapado por algo delante.
- Torres al lado de casas bajas: el salto de altura tiene que ser gradual.
- Un borde sur cortado en seco, o un barrio con otra grilla que no empalma.
- Que el FPS del sitio empeore de forma visible: el presupuesto de redibujo ya
  está justo (memoria: el costo es CPU `stage.tick`, no GPU).

## 3. Situación actual

- **`src/scenes/city-grid.ts`** es la única fuente de verdad de la grilla:
  - manzanas `24 × 18`, calle `6`;
  - `WEST_COLS −48..162`, `ROWS 92..302`;
  - `AVENUE y 206..218` con `BOULEVARD`;
  - `PLAZA (102, 218, 54 × 18)` y `TOWER (121, 220, 16 × 14)` de altura 30;
  - `CITY_EDGE` sur `324`, cráteres y derrumbe.
  - De ahí lee el terreno (`terrain-classify.ts`); por eso varias constantes
    son múltiplos de `CELL = 6`.
- **`src/city/zoning.ts`** asigna barrio, receta y lote por manzana (`CATALOGUE`,
  `FIXED`, `maxHeightFor`). **`src/city/streets.ts`** pinta carriles, avenida,
  cruces peatonales y mobiliario. **`src/city/fixed.ts`** arma la plaza y la torre,
  el puente, el muelle, el derrumbe y los autos. **`src/city/lights.ts`** arma las
  luces.
- **`src/scenes/sign-crown.ts`** es el cartel:
  - `CROWN_SITE` en la azotea de la torre;
  - letras marquesina "Neon Light" de cap `8.7`, ancho de tinta `43.9`;
  - panel `49.9 × 14.1` en el plano diagonal `diagonalWall`;
  - estructura de acero y helipuerto.
  - `RESUME_SIGN` es la `SignSpec` que usa el oráculo de legibilidad
    (`src/kit/legibility.ts`) y que `src/world/signs.ts` engancha al enlace de la
    zona.
- **El barrio costero** (`src/scenes/tech.ts` + `src/scenes/sprawl-grid.ts` +
  `neighborhood-*.ts`) tiene su propia grilla de `24 × 18`, con filas `328..640`.
- **Presupuesto** (`src/scenes/city-budget.test.ts`): sólidos elevados de Resume
  ≤ 2 900, `strip` ≤ 190, acentos estáticos ≤ 1 300, polígonos estáticos del
  mundo ≤ 56 000, acentos del mundo ≤ 2 600.
- **Vista:** `coverQuad(16/9)` en `geo.ts`. El borde izquierdo de la vista es la
  recta `x − y = −419` y el superior, `y = −211 − x`. La profundidad útil
  norte-sur (vías a barrio) es de unas 7 manzanas.

## 4. Reglas de proyección que mandan el diseño

- Proyección: `sx = x − y`, `sy = (x + y)/2 − 1.4 z`.
- Una recta de `x` constante corre paralela al muelle en pantalla. Una diagonal
  del mundo a 45° se ve exactamente vertical u horizontal en pantalla.
- La cámara mira desde `+x +y`. Lo que está al sureste de un edificio queda
  delante de él en pantalla, y se ven sus caras que miran a `+x` y a `+y`.
- Un plano vertical a lo largo de `u = (1, −1)/√2` (`diagonalWall`) se ve como un
  rectángulo derecho: es el plano de los carteles.

## 5. Trazado

### Enfoques considerados

| | Idea | A favor | En contra |
|---|---|---|---|
| **A · Plaza en la costa** (elegido) | Modelo porteño: plaza fundacional contra la costanera, el puente desemboca en ella, avenidas en abanico hacia tierra | El centro toca el agua y el puente. Abanico angosto, pocas manzanas triangulares | Es medio abanico, no una estrella. La Diagonal Norte choca pronto con las vías |
| B · Damero platense | Parque cuadrado en el medio del damero, ejes y diagonales a 45°, avenidas cada 4 cuadras | La jerarquía más clara | El parque queda a unas 150 u de la costa. Muchas manzanas triangulares |
| C · Estrella y ronda | Rotonda con avenidas radiales y una avenida de ronda | Muy legible como centro | Pocas radiales entran en 7 manzanas de profundidad y la ronda se come el casco |

Se eligió **A**, con las plazas en los cruces que traía B. Durante la
conversación se le sumaron tres cosas: la continuidad hacia el barrio (§8), el
hotel con el cartel (§7) y la plaza alargada hacia el sur a lo largo de la
costanera, para que el hotel la tenga delante sin cortar la Diagonal Norte.

### 5.1 Grilla

- Manzanas de **24 × 24** con calles de **6** (paso 30). Origen `gx = 13`, `gy = 21`:
  columnas `…, 43, 73, 103, 133, 163` y filas `171, 201, 231, 261, …`.
- Cuadradas en vez de `24 × 18`: con la plaza, las diagonales y las ochavas, la
  manzana cuadrada se lee más porteña, y las diagonales la cortan en cuñas
  menos finas.
- Las manzanas se recortan contra las avenidas, las plazas, el muelle y la
  vista. Las piezas menores de 70 u² o muy finas (radio de inercia < 3.4) se
  descartan.

### 5.2 Ejes (coordenadas del mundo, `w` = ancho total)

| Nombre | Trazado | w | Notas |
|---|---|---|---|
| Costanera | `x 188`, de `y 160` al sur | 8 | Paseo con faroles sobre el muelle (`x 184..192`) |
| Plaza Mayor | `(132, 206, 54 × 85)` | — | Alargada sobre la costanera, de `y 206` a `291` (se suma unas dos filas). Recibe el puente en su parte norte |
| Avenida de la Plaza (el eje) | `y 228`, de la plaza (`x 132`) al oeste | 12 | Nace en el lado oeste de la plaza, entre el hotel (al sur) y la Diagonal Norte (al norte) |
| Diagonal Norte | `(132, 210)` hacia el oeste-noroeste (pendiente 118/392), **termina en la Avenida de las Vías** (`y 169`, `x ≈ −14`) | 10 | Sale de la esquina noroeste de la plaza. No cruza la franja verde ni las vías, que no se tocan. En su remate va una plaza de cruce |
| Diagonal Sur | `(132, 291) → (−420, 522)` | 10 | Sale de la esquina suroeste de la plaza, pasa al sur del hotel y entra al barrio |
| Bulevar Central | `x 10`, de `y 160` a `480` | 20 | Arbolado, paralelo a la costa: marca el fin del casco |
| Avenida de las Vías | `y 169`, de la costanera al oeste | 10 | Pegada a las playas ferroviarias |
| Avenida del Sur | `y 318` | 10 | Límite del casco con el barrio bajo |
| Avenida del Barrio | `y 378` | 10 | Dentro del barrio costero |

- **Plazas de cruce:** un octógono de radio 11 en cada cruce de una diagonal con
  una avenida o con el bulevar, a más de 50 u del centro de la plaza y a más de
  26 u de otra plaza de cruce.
- **El puente** sigue en `y 207..217` y desemboca en el cuerpo de la Plaza Mayor.
- **Jerarquía visible:** las avenidas llevan carriles marcados, cantero central
  donde el ancho lo permite (el bulevar, siempre), árboles en fila, faroles y
  semáforos en los cruces. Las calles comunes llevan solo la línea central.
  Esto sigue el lenguaje que `streets.ts` ya usa para la avenida del puente,
  extendido a los ejes nuevos.

## 6. Barrios y edificios

### 6.1 Gradiente

Distancia `d` desde el centro de la plaza `(159, 248)`:

| Barrio | Dónde | Alturas | Carácter |
|---|---|---|---|
| Casco clásico | `d < 105` | 5.5–8.5 (4 a 6 pisos) | Manzana cerrada con patio, ochava de 2.4, cúpula en la esquina que mira a la plaza |
| Transición | `105 ≤ d < 205` | 10–16 | Rentas de los años 50 a 70: racionalista, balcones corridos, ochava de 2 |
| Moderno | `d ≥ 205` y al norte de `y 290` | podio 3.5 + torre 24–50, o placa de 13–21 | Torres de oficinas con muro cortina sobre podio. **Solo al noroeste, contra las vías** |
| Bajo | `318 < y ≤ 380` | 3.5–6 | PH y casas chorizo de 2 a 3 pisos, con ochava |
| Residencial | `y > 380` | casas 2.4–4.2, monoblock 13 | Lotes de 5 de frente con casas de teja, algún monoblock de dos placas, algunas manzanas convertidas en plaza |

- Al sur de la Avenida del Sur, lo que la distancia diría "clásico" pasa a
  "bajo".
- Al sur de `y 290`, lo que diría "moderno" pasa a "transición". Así no quedan
  torres junto a casas.
- Los números son los del plano. Quien construye puede moverlos, con dos
  condiciones: que no haya saltos de más de un escalón entre manzanas vecinas y
  que las torres queden al noroeste.

### 6.2 Detalle porteño

Se permite más detalle que el low poly de hoy. La idea es que el casco se
reconozca como Buenos Aires de cerca, sin dejar de ser prismas sobre la grilla:

- **Ochavas** en todas las esquinas del casco y de la transición: es el rasgo más
  barato y el que más se lee.
- **Cúpulas** y torrecitas en las esquinas que miran a la plaza o a una avenida,
  con techo de pizarra (mansarda) o cúpula de cobre verdoso.
- **Basamento** con portal y planta baja comercial en los frentes de las
  avenidas. Cornisa marcada arriba del basamento y en el remate.
- **Balcones** salientes y ventanas verticales: ritmo de ventana alta, no de
  muro cortina, en el casco.
- **Transición:** balcones corridos, fachada de vidrio en planta baja, terrazas
  en retiro arriba.
- **Moderno:** podio con torre retirada, muro cortina frío, coronamientos
  planos con equipos.
- **Bajo y residencial:** frentes angostos de 5 a 8, techos de teja a dos
  aguas, patios al fondo, árboles de vereda.

El kit (`src/kit/`, recetas en `src/kit/forms/`) ya tiene `classic`, `chamfer`,
`decoStepped`, `podiumTower`, `courtyardO/U`, `rowHouses`, `patioResidential`
y otras. Lo esperable es ampliar el kit con recetas porteñas (cúpula de esquina,
mansarda, balcón) y no hacer piezas a mano por manzana. Las recetas tienen que
aceptar lotes no rectangulares, porque las diagonales generan cuñas.

### 6.3 Piezas singulares de la ribera oeste

Hoy la ribera oeste tiene piezas fijas: estación, teatro, palacio cívico,
biblioteca, obra en construcción, tanque de agua, mercado cubierto, barrio de
bares con neones, cráteres y pasarela. **Mi propuesta (decisión mía):** se
conservan como catálogo de piezas singulares y se reubican en el trazado nuevo
según su carácter:

- el palacio cívico, el teatro y la biblioteca, frente a la plaza o sobre el eje;
- los bares con neones, en la costanera al norte del puente (como hoy, en la
  ribera junto al muelle);
- la obra y el tanque, en la transición;
- los cráteres, en las calles comunes, nunca sobre una avenida.

La pasarela de `fixed.ts` (`FOOTBRIDGE_LOT`) y la ribera este no cambian.

## 7. El hotel y el cartel RESUME

### 7.1 Lugar

- Supermanzana de 2 × 2 sobre el lado oeste de la plaza, al sur del eje:
  `lote (73, 234, 54 × 51)`, que va de `x 73` a `127` y de `y 234` a `285`. Las
  dos calles internas desaparecen.
- Por delante, al sureste, está la mitad sur de la Plaza Mayor, de modo que
  entre el cartel y la cámara no hay nada alto. Las manzanas del casco que
  quedan delante, al sur del hotel, son bajas (hasta 8.5) y no llegan al
  cartel, que arranca en `z ≈ 31`.
- El eje corre por el norte del lote y la Diagonal Sur, por el sur. La Diagonal
  Norte sale de la esquina noroeste de la plaza, lejos del lote.
- Queda a unas 35 u de donde está la torre de hoy `(129, 227)`.

### 7.2 Edificio

- **Basamento clásico** de 3 pisos (`z 0..10`) que llena el lote, con ochavas,
  portal hacia la plaza y cornisa.
- **Placa** de `64 × 8` sobre el basamento, de `z 10` a `z 51`, con su eje largo
  a lo largo de `u = (1, −1)/√2` y centrada en el lote `(100, 259.5)`. Es una
  placa de hotel de los setenta: fachada larga de ventanas en banda, testeros
  ciegos y una sala de máquinas baja y al ras.
- **Sin helipuerto** ni estructura de acero en la azotea.
- La cara sureste de la placa (la que mira a `+x +y`) es un `diagonalWall`: en
  pantalla se ve como un rectángulo derecho, de frente.

### 7.3 Cartel

- Va **apoyado contra la cara sureste de la placa**, de punta a punta: ancho de
  unas 63, entre `z ≈ 31.5` y `z ≈ 49`, separado unos 0.15 de la fachada.
- Usa las mismas letras marquesina "Neon Light" de hoy (`MARQUEE_RESUME`, con
  focos) sobre un fondo oscuro.
- **Tamaño:** cap height `12.7` en vez de `8.7`, es decir ×1,46, que es el
  máximo que entra en los 64 de fachada. Ancho de tinta de unos 64.
- Panel con margen mínimo, porque las letras llenan la fachada. Si el oráculo
  pide margen, se baja el cap (piso: `12`) en vez de agrandar la placa.
- `RESUME_SIGN` sigue siendo la `SignSpec` del oráculo, con el mismo método:
  plano diagonal y fondo oscuro. Cambian el sitio y el tamaño. El enlace de la
  zona (`world/signs.ts`) se mueve con el cartel.
- La torre de hoy (`TOWER`), su piso encendido (`LIT_FLOOR`) y el helipuerto de
  `towerCrown` se retiran. Las luces animadas que dependían del piso encendido
  pasan a ventanas de la placa del hotel (unas cuantas habitaciones
  encendidas).

### 7.4 Riesgo de encuadre

La cima de la placa (`z 51`) tapa en pantalla una parte de las playas
ferroviarias. En el plano no llega a la estación de Portfolio, pero hay que
verificarlo con el encuadre real del sitio en los aspectos que soporta
`coverView`, y también con el encuadre de la zona Resume abierta.

- **Regla (decisión mía):** ningún edificio de Resume tapa en pantalla la
  estación de Portfolio (`STATION_LAND`). Tapar las playas ferroviarias está
  permitido.
- **Si el hotel la tapa:** se baja la placa, y el cartel con ella, hasta cumplir
  la regla, manteniendo el cap en 12 o más. Si con cap 12 sigue tapando, se
  vuelve a consultar.
- **Torres del barrio moderno:** la misma regla limita su altura. Para cada
  torre manda el menor valor entre su rango (24 a 50) y la altura que deja
  libre la estación.

### 7.5 Desvíos

| Tema | Spec (o antes, si la spec no lo fija) | Implementado | Motivo |
| --- | --- | --- | --- |
| Cap | 12.7 | `HOTEL_CAP` 12 | La regla `backingW` del oráculo deja 1.35 u de respaldo a cada lado de la tinta, sobre una fachada de 64: con 12.7 la tinta mide 64.07 y con 12, 60.54. |
| Sitio | apoyado contra la cara sureste, sin coordenada | `SIGN_SITE` (103.30, 262.80, 33.90) | La spec no daba coordenada: `SIGN_SITE` la fija en el centro de la línea de base, sobre la cara sureste. |
| Caja en pantalla | sin valor en la spec; antes, la de la corona: `−129.0..−67.0 × 118.4..130.6` | `−202.3..−116.7 × 118.8..135.6` | Es la caja proyectada de los quads del cartel: se corre 73 u a la izquierda y mide 85.6 u de ancho (la de la corona, 62). De ahí sale el desvío de los móviles verticales. |
| Móviles verticales | RESUME entero | `COVER_FOCUS_U` sigue en 0.39 y el hotel donde lo pone §7.1; RESUME se ve al 28 % (430×932), 48 % (390×750) y 37 % (360×740) (en #474 se midió 27.7 / 48.4 / 36.5 %) | Su enlace usa el modo de borde de `labelLayout`. Está entero en todo anfitrión de al menos 640 px de ancho y siempre entero en `zoneView("cv")`. Es la decisión D10 de #471. |

## 8. Continuidad con el barrio costero

- La grilla del §5.1 sigue al sur hasta `y ≈ 475`, dentro de lo que hoy es el
  barrio costero. Las avenidas del sur (la costanera, el bulevar, la Diagonal Sur
  y la Avenida del Barrio) entran en él.
- El barrio costero **se rehace sobre la grilla nueva**: manzanas de 24 × 24 en
  vez de 24 × 18. Conserva su programa de la spec del 2026-10-27 (monoblocks,
  casas de teja, escuela, club con cancha, plazas, costanera con faroles) y lo
  acomoda a las manzanas nuevas.
- Más al sur de `y ≈ 475`, hasta las filas que hoy llegan a `640`, el barrio
  sigue con la misma grilla y el mismo programa residencial. Quien construye
  decide cómo termina contra el sangrado.
- Es el costo más grande del proyecto: toca `tech.ts`, `sprawl-grid.ts`, los
  `neighborhood-*.ts` y sus pruebas.
- **Quién es dueño de qué (decisión mía):**
  - El módulo puro del trazado (§9) define la grilla, los ejes y los barrios de
    toda el área, sin rng.
  - La ciudad (`city.ts`, rng `cv`) construye lo que está al norte de la
    Avenida del Sur (`y 318`), que pasa a ser el nuevo `CITY_EDGE.south`,
    incluido el oeste (§8.1).
  - `tech.ts` (rng `cv, 2`) construye lo que está al sur y lee el mismo módulo.
    Cada lado mantiene su presupuesto (`city-budget` y `tech-budget`).
- **Piezas singulares del barrio (decisión mía):** el auditorio (hoy en el
  Bulevar Central) y la arena se reubican sobre la grilla nueva, igual que las
  piezas de §6.3. La escuela y el club se conservan.

### 8.1 El oeste

- Al oeste de `CITY_EDGE.west` (`x −54`) está el distrito tecnológico
  (`SUBURB_COLS −84..−264` × `ROWS 164..302`, de `tech.ts`), con la antena
  TELECOM en `(−114, 242)` y sus torres.
- **Se rehace sobre la grilla nueva** (decisión del dueño, 2026-11-22). El eje,
  las diagonales y el bulevar lo cruzan. Sus manzanas pasan a ser el barrio
  moderno (al norte de `y 290`) y la transición (al sur).
- TELECOM se conserva como pieza singular del barrio moderno y se reubica
  sobre la grilla, igual que las piezas de §6.3.
- El límite de la ciudad pasa a ser el borde de la vista (con el margen que hoy
  usa `sprawl-grid`), no `x −54`.
- **Dueño (decisión mía):** todo lo que está al norte de la Avenida del Sur,
  oeste incluido, lo construye la ciudad (`city.ts`, rng `cv`). `tech.ts` queda
  solo para el sur (§8).

## 9. Restricciones técnicas

- **Fuente única.** El trazado nuevo vive en un módulo puro, sin rng, del que
  leen el terreno, las calles, la zonificación y las luces, como hoy
  `city-grid.ts`. Las avenidas oblicuas obligan a guardar polígonos, no solo
  rectángulos: la función `inBlock` y el clasificador del terreno tienen que
  aceptarlos.
- **Terreno en celdas de 6.** `terrain-classify.ts` clasifica en celdas de
  `CELL = 6`. Las calles oblicuas no caen en celdas: lo esperable es que el
  terreno quede como asfalto y que las manzanas y los canteros se dibujen
  encima, como plintos (hoy ya funciona así).
- **Presupuesto.** Los topes de `city-budget.test.ts` se revisan con medición,
  como en la spec del 2026-10-15 §9. Si el detalle porteño los supera, primero
  se cachea la geometría estática (un render a textura de lo que no se anima) y
  después se suben los topes con el número medido. No hay que recortar detalle
  sin medir.
- **Legibilidad.** El cartel nuevo pasa el oráculo de `src/kit/legibility.ts`
  con el mismo criterio que el de hoy.
- **Presupuesto con el oeste.** Al pasar el oeste de `tech.ts` a la ciudad, su
  parte del presupuesto pasa de `tech-budget` a `city-budget`. Se mide antes y
  después y se mueve el número medido; no es una suba.
- **Pruebas que fijan geometría.** `city-grid.test.ts`, `streets.test.ts`,
  `zoning.test.ts`, `fixed.test.ts`, `lights.test.ts`, `rail-lands.test.ts`,
  `seam-90.test.ts`, `sprawl-grid.test.ts`, `tech*.test.ts`, `exhibits.test.ts`,
  `docs.test.ts` y `docs-glossary.test.ts` (que nombra `CROWN_SITE`,
  `towerCrown`, `RESUME_SIGN`). Se reescriben con el trazado nuevo y se
  actualizan las entradas del glosario y de los docs que nombran el sitio del
  cartel.
- **Lab.** Las páginas del lab que muestran Resume o el cartel
  (`/lab/resume.html` y las vitrinas de `src/lab/exhibits.ts`) se actualizan.

## 10. Orden sugerido

Es un proyecto grande. Se puede repartir en tickets que se entregan de a uno,
cada uno dejando el sitio andando:

1. **Trazado.** Módulo de grilla nuevo, terreno, calles y avenidas, plaza y
   plazas de cruce, con los edificios de hoy reasignados a las manzanas nuevas
   por la zonificación actual. La torre y el cartel de hoy se quedan donde están
   hasta el ticket 2. Ojo: la torre de hoy (`x 121..137`, `y 220..234`) cae
   en parte sobre la plaza nueva y sobre el eje, así que en este ticket hay que
   moverla de forma provisoria o dejarla en una isla.
2. **Hotel y cartel.** El hotel, el cartel en la fachada a ×1,46, el oráculo,
   el enlace de la zona y la baja de la torre y el helipuerto.
3. **Barrios y kit porteño.** El gradiente de §6.1, las recetas nuevas de §6.2
   y la reubicación de las piezas singulares de §6.3.
4. **Barrio costero en la grilla nueva** (§8).
4b. **El oeste en la grilla nueva** (§8.1). Va después del 3, porque usa las
    recetas modernas. Se puede trabajar en paralelo con el 4.
5. **Luces y presupuesto.** Ventanas, faroles de las avenidas nuevas, medición
   y, si hace falta, el caché estático.

## 11. Lo que queda a criterio de quien construye

- Las medidas finas de la grilla y de los ejes, siempre que se mantengan la
  forma del abanico, la plaza contra la costanera, el puente desembocando en
  ella y el hotel sobre su lado oeste, con la plaza delante.
- Las recetas concretas y sus pesos dentro de cada barrio.
- Cómo termina el barrio contra el sangrado, al sur de `y 475`.
- La técnica de caché, si el presupuesto la pide.

## 12. Desvíos y medición

Cierre de #471 (#480). Lo que la implementación hizo distinto de lo escrito
arriba, y lo que se midió al final. Las cifras de presupuesto y de cuadros por
segundo son del 2026-11-23.

### 12.1 Desvíos

- **(a) Cap del cartel.** `HOTEL_CAP` 12, no 12.7. La regla `backingW` del
  oráculo deja 1.35 u de respaldo a cada lado de la tinta sobre una fachada de
  64: con 12.7 la tinta mide 64.07 y con 12, 60.54. Está en §7.5.
- **(b) Móviles verticales.** RESUME se ve al 28 % en 430×932, al 48 % en
  390×750 y al 37 % en 360×740. Su enlace usa el modo de borde de
  `labelLayout`. Es la decisión D10 de #471 (§7.5).
- **(c) Regla de lado.** Las parcelas cuya caja envolvente tiene un lado < 9 se descartan
  aunque pasen el área ≥ 70 y el cociente 2A/perímetro ≥ 3.4. Al planificar
  #471 eran 8 piezas: 2 al norte de la plaza (astillas de 5 de ancho, `y 201..206`)
  y 6 en el sur.
- **(d) Celdas de las piezas singulares.** Leídas del código, no del plano.
  `FIXED_PARCELS` (`src/city/zoning.ts`): palacio cívico (163, 291), teatro
  (133, 291), biblioteca `LIBRARY_CELL` (73, 201) (no (103, 201) del plano: esa
  celda es una cuña de 21 × 5), obra `constructionSite` (43, 261), torre de agua
  `WATER_TOWER_CELL` (13, 291) y `TELECOM_CELL` (−107, 231). En
  `src/scenes/tech-zoning.ts`: `ARENA` (103, 411), `AUDITORIUM` (13, 351),
  `SCHOOL` (103, 501), `CLUB` (133, 531) y `PLAZAS` (133, 471) y (73, 441).
- **(e) TELECOM.** La torre de telecomunicaciones está en `(−107, 231)`, una
  parcela moderna del oeste. La construye `city()` (`fixed.ts`); no es receta
  del kit.
- **(f) El oeste.** Sin piso encendido ni coronas de neón en sus torres: son
  recetas `district` y moderno del kit, con ventanas del kit y neones del
  catálogo. El anillo del mástil de TELECOM se conserva, a cargo de `city-anim`.
- **(g) Luces.** `MAX_ANIMABLE` 40 se reparte entre los cuatro barrios (`ANIMABLE_BARRIOS`),
  en proporción a sus candidatas; bajo no tiene candidatas en la ciudad. Lo hace `animableQuota` (`src/city/lights.ts`).
  Candidatas en la semilla del mundo: clasico 60, transicion 527, moderno 720,
  bajo 0 (las ventanas del bajo del sur son `homes` de tech, ámbar, es decir
  cálidas). Cupo: clasico 3, transicion 16, bajo 0, moderno 21. Antes:
  transicion 36, clasico 4, moderno 0. El hotel tiene 96 cuartos con
  `ROOMS_LIT` 0.4.

### 12.2 Presupuesto, antes y después

`main` es origin/main c9df1fa (antes de #471); final, esta rama tras 49efcf6.
Regla de los topes: lo medido × 1.1, redondeado a la centena (a la decena en
`strip` y en `FACE_CAPS`).

| Cifra | main | final | Tope (final) |
| --- | --- | --- | --- |
| Sólidos elevados: astillero | 686 | 686 | 800 |
| Sólidos elevados: fábrica | 770 | 770 | 800 |
| Sólidos elevados: ciudad (Resume) | 1 454 | 1 518 | 1 700 |
| Sólidos elevados: feria | 565 | 565 | 600 |
| Sólidos elevados: tierra adentro | 453 | 453 | 500 |
| Sólidos elevados: tech | 1 490 | 1 136 | 1 200 |
| Franja de Resume (suelo `strip`) | 152 | 522 | 570 |
| Acentos estáticos de Resume | 1 165 | 1 280 | 1 400 |
| Polígonos estáticos del mundo (`stage.staticCount`) | 46 146 | 43 546 | 47 900 (era 56 000) |
| Acentos estáticos del mundo | 1 753 | 1 833 | 2 000 (era 2 600) |

Topes de caras de tech (medido final → tope): low 98 → 110, houses 61 → 70,
plaza 58 → 60, school 86 → 90, club 80 → 90, waterfront 331 → 360, monoblock
105 (el tope sigue en 115: es un límite de la generación), `ACCENT_CAP` 568 →
600. Caras del distrito 5 245, región 1 444.

### 12.3 Cuadros por segundo

Agent-browser headless, 1600×900×1. La línea `[mapa] bloom:` es la media de
60 cuadros de `tick + render`; tres cargas por lado, intercaladas. `main` se
sirvió desde un worktree en :5174 y la rama en :5173, con los mismos
`node_modules`.

| Medición | Lado | `tick` (ms) | `render` (ms) | `tick + render` (ms) |
| --- | --- | --- | --- | --- |
| Planificación (HEAD 343ed5e) | main | 12.0 / 12.0 / 11.2 → 11.73 | 5.1 / 4.8 / 5.3 → 5.07 | 16.80 |
| Planificación (HEAD 343ed5e) | rama | 11.4 / 11.2 / 11.4 → 11.33 | 4.9 / 5.1 / 5.1 → 5.03 | 16.37 |
| Final (HEAD 49efcf6) | main | 11.4 / 11.8 / 11.6 → 11.60 | 5.2 / 5.1 / 5.1 → 5.13 | 16.73 |
| Final (HEAD 49efcf6) | rama | 12.3 / 11.1 / 12.1 → 11.83 | 5.1 / 5.1 / 5.0 → 5.07 | 16.90 |

La diferencia es −0.43 ms en la planificación y +0.17 ms al final. No llega al
umbral de +2 ms, así que no hay caché estático: no se agregó ningún
`RenderTexture` con las capas estáticas de Resume, `stage.ts` no cambió y no
existe `stage.staticDraws`. En headless la página corre a unos 2 fps y el
veredicto del bloom es `fallback` de los dos lados (presupuesto 15 ms): la cifra
que importa es `tick`, la de CPU. Si un caché hiciera falta, cambiaría cómo se
dibujan los cuadros, no la geometría que cuentan los topes: las cifras de §12.2
no quedarían viejas.

### 12.4 Capturas

Todas a 2×, en `assets/2026-11-22-resume-centro-costero/cierre/`.

- [`sitio.png`](assets/2026-11-22-resume-centro-costero/cierre/sitio.png):
  `/`, 1600×900. El sitio es un mapa nocturno y no tiene modo día; "de día" es
  el sitio sin zona en foco.
- [`sitio-velo-cv.png`](assets/2026-11-22-resume-centro-costero/cierre/sitio-velo-cv.png):
  `/area/resume/`, 1600×900, con el velo sobre las otras zonas y el panel del CV
  abierto. El ticket decía `/area/cv/`, que no es una ruta (`src/map/zones.ts`
  tiene `area/resume`).
- [`lab-world-bloom.png`](assets/2026-11-22-resume-centro-costero/cierre/lab-world-bloom.png):
  `/lab/world.html`, 1600×900, tecla 6 (bloom encendido).
- [`sitio-390x750.png`](assets/2026-11-22-resume-centro-costero/cierre/sitio-390x750.png):
  `/`, 390×750, con el enlace RESUME en modo de borde.
- [`sitio-820x1180.png`](assets/2026-11-22-resume-centro-costero/cierre/sitio-820x1180.png):
  `/`, 820×1180.
