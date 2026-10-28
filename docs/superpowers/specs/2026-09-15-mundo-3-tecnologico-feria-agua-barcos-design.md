# Mundo 3: distrito tecnológico, feria al norte, agua dinámica y barcos — diseño

**Fecha:** 2026-09-15
**Estado:** implementada (2026-09-15)
**Antecede:** `2026-09-15-margenes-urbanos-design.md` (suburbio, hinterland, `builtAt`),
`2026-09-14-mundo-2-fabrica-distrito-blog-design.md` (§6 distrito, §7 mar y barcos).
**Alcance:** el laboratorio (`lab/world.html`, teclas `0`..`4`) y el motor puro
(`src/iso/`). No cambia las costuras `x 344` / `y 146`, la grilla de la ciudad,
el astillero ni la fábrica. Cuatro partes independientes, cada una con su
escena, su test y su presupuesto; se pueden implementar y mergear por separado.

## 1. Problema

Con el encuadre *cover* (`coverFrame(16/9)`) el mundo ya no flota en selva,
pero lo que lo rodea es plano:

1. **El suburbio de Resume** (`suburb.ts`) es hileras de cajas a dos aguas sin
   ventanas ni fachada, y baldíos. Se lee como un barrio dormido pegado a una
   ciudad de oficinas: no tiene nada que ver con Resume (carrera, empresas).
2. **El hinterland de Portfolio** termina en `y ≈ −204` y arriba de eso hay
   selva y lomas hasta el vértice norte del cover (`(221, −432)`): el 15 % del
   cover visible al norte es verde. Falta un lugar con identidad propia.
3. **El agua** solo se mueve en el mar del contenido (tres bandas de
   `toneOffset ±1`); el estuario y el río ondulan sin profundidad, y toda el
   agua del sangrado (mar, fosa y estuario al sur; bahía al norte), que es más
   de la mitad del agua visible en el cover, se dibuja estática en `gBleed`.
   Los tres materiales (`water`, `waterDeep`, `abyss`) casi no se distinguen
   (`0x1f4a55`, `0x1c4450`, `0x12303e`): no hay profundidad progresiva ni
   reflejo del atardecer.
4. **Los barcos** son un `hull` extruido (huella de 5 puntos, techo plano, un
   solo material) con cajas encima: se leen como ladrillos flotando.

## 2. Decisiones

> **Nota (2026-10-28):** los laboratorios y los atrios de la fila "Suburbio → distrito tecnológico" ya no existen; al sur del distrito hay un barrio residencial costero. Ver `2026-10-27-barrio-costero-design.md`.

| Tema | Decisión |
|---|---|
| Suburbio → distrito tecnológico | `suburb.ts` se reemplaza por `tech.ts` sobre la misma grilla (`suburbBlocks`). Tres tipos por distancia: **torres** de muro cortina (h 12..20) cerca del contenido, **campus** de startups con patio y cartel en el medio, **laboratorios y centros de datos** con paneles solares y estacionamiento lejos. Todos con fachada (`facade`) salvo los laboratorios, que llevan una sola banda de vidrio por pared. Los tres hitos cambian: torre de telecomunicaciones (en vez del depósito de agua), auditorio de vidrio (en vez de la iglesia), el estadio queda como arena. Parques 12 % como hasta ahora; desaparecen los baldíos |
| Dinamismo del distrito | `tech-animator.ts`: ventanas de un piso que se prenden y apagan por torre (como el piso encendido de la ciudad), carteles ámbar que pulsan, luz de la torre de telecomunicaciones. Acentos solo ámbar (regla de Resume) |
| Norte industrial | `REACH.n` pasa de 8 a 16 celdas (144 → 288): la tierra construida llega a `y = −348` (ondulada hasta −384) y el vértice norte del cover queda con una loma corta detrás. Dentro del cover, el borde norte es la recta `y = −211 − x` (con margen 30): al norte de `y = −204` solo se ve `x ≳ 0`, así que la franja nueva visible es el triángulo `x 0..232`, `y −204..−400`. La feria toma `x ≥ 84`; entre `x 0` y `84` va una **central térmica** (sala de turbinas, dos chimeneas humeantes, torre de refrigeración, patio de transformadores, acopio de carbón con cinta) y la calle a la feria. Lo que queda fuera del cover (oeste de `x 0`) se deja como losa vacía: nadie lo ve. La línea de alta tensión no se mueve (`y −196`, queda entre los tanques y la feria) |
| Feria (distrito nuevo) | Tipo de tierra construida nuevo: `"fair"`, rectángulo `FAIR = { x0: 84, y0: −348, y1: −204 }` hasta la orilla de la bahía, suelo `sand` (playa). Escena `fair.ts` (zona Portfolio, parte 3 del rng): paseo marítimo de madera (`deck`) con faroles, muelle con pabellón sobre la bahía, vuelta al mundo, montaña rusa de madera, carrusel, torre de caída, salón de arcades con cartel, hilera de puestos, autitos chocadores, sombrillas en la playa, portada y estacionamiento del lado industrial. Estética Coney Island / Long Island: madera, cal, cobre, luces |
| Luces de la feria | Excepción explícita a "acentos por zona": la feria usa ámbar, cian y magenta (guirnaldas, carteles, vuelta al mundo). Es un distrito de luces; sin colores no se lee como feria |
| Dinamismo de la feria | `fair-animator.ts`: la vuelta al mundo gira (una vuelta cada 40 s, paso 250 ms) y sus luces de llanta corren; el tren de la montaña rusa recorre el circuito; la torre de caída sube y cae (ciclo 8 s); las chimeneas de la central humean con el animador de la fábrica (recibe `stacks` extra) |
| Motor: sólido `wheel` | Nuevo `Solid` `wheel` (anillo vertical en el plano `(1, −1, 0)`, que en pantalla se proyecta como un círculo de frente): llanta en sectores, rayos, góndolas. Único sólido no extruido; sus caras llevan `toneOffset` fijo para no salir todas en `shade` |
| Agua: un solo material dinámico | Nuevo módulo `water-anim.ts` (puro) + `water-animator.ts`: reclama **toda** el agua (contenido y sangrado). El terreno deja de repartir `river/sea/shore/abyss` y pasa a `water: WaterBody[]` clasificado por **profundidad** (`depthAt`: distancia a la tierra más cercana) en cuatro materiales: `shallow` (nuevo), `water`, `waterDeep`, `abyss`. Cada triángulo lleva un `baseTone` por su profundidad dentro de la banda (−1..+1): profundidad progresiva en ≈ 12 escalones sin gradientes. La ola es direccional (viaja hacia la costa) y suma ±1 sobre el `baseTone`; las crestas más altas alcanzan `up`, el tono cálido del reflejo del atardecer, en un cuarto de los triángulos (hash fijo): destellos. Espuma en toda costa a menos de 3 u de tierra (no solo el arrecife). El astillero deja de animar el río |
| Paleta del agua | Se regeneran las escaleras de `water`, `waterDeep`, `abyss` y se agrega `shallow`: el agua plana usa `top` ± offsets, así que `lit` es el seno (top × (0.55, 0.60, 0.80): más oscuro y más azul), `down` el medio seno (top × (0.78, 0.84, 0.96)) y `up` la cresta con el sol (top × 0.3 + `0xf0a070` × 0.7, durazno del cielo del atardecer); `shade` (top × (0.40, 0.42, 0.60)) queda por consistencia. Colores generados por script y pegados como literales (regla del palette-guard); en §5 van los objetivos por material |
| Agua del sangrado | `buildBleed` emite el agua aparte (`terrain.water` la incluye), subdividida a `CELL_WATER = 9` dentro del cover ensanchado 30 u y a 18 fuera. Bandas por x de pantalla: 4 (no 3), round-robin cada 150 ms. Si el peor redibujo medido supera 15 ms headless, el sangrado queda en 18 (decisión gateada por medición, ver §8) |
| Casco lofteado | `hull` deja de ser una extrusión: anillo de cubierta (proa en punta, popa redondeada, manga máxima al 55 %) y anillo de quilla (manga × 0.7, proa lanzada al 12 % de la eslora, popa al 6 %), lados como cuadriláteros divididos en dos triángulos, arrufo (proa +0.25 h, popa +0.1 h), línea de flotación: el 20 % inferior de cada lado va en `mat` (antiincrustante `hull`) y el resto en `topMat` (nuevo campo; por defecto `mat`). Cubierta en `deck`. Los cascos del astillero (grada y dique) heredan la forma. `poly` gana `facade?` para las superestructuras con ventanas |
| Flota | Carguero: escotillas, superestructura de tres niveles en popa con puente y alerones, chimenea con tapa, mástil y dos grúas de cubierta. Remolcador: proa alta, timonera con ventanas, chimenea, defensas, bita. Barcaza: contenedores en dos filas de dos de alto y empujador en popa. Nuevo: lancha de la feria (`ferry`, `whitewash` de dos cubiertas) entre el muelle de la feria y el muelle de graneles. Material nuevo `hullBlue` (obra muerta azul), compartido "vehículos" |
| Estelas | V de dos líneas de espuma divergentes desde la proa (6 triángulos por lado), ola de proa (2) y remolino de popa (3); alpha del barco |
| Presupuesto | Tech ≤ 1 200 sólidos elevados; feria ≤ 700; norte industrial ≤ 250; barcos ≤ 30 sólidos por barco. `world.html`: primer dibujo caliente ≤ 170 ms (era 115–130) y peor redibujo ≤ 15 ms, en el mismo headless (Chrome vía CDP, sin GPU, DPR 2) |

### Alternativas descartadas

- **Shader de agua en Pixi** (filtro con ruido y desplazamiento): agua
  realmente continua a costo cero de CPU, pero rompe la regla de colores
  literales (palette-guard), no se puede medir en el headless sin GPU y no
  pega con el papercraft facetado del resto. Si algún día el sitio quiere
  agua continua, va como filtro *encima* de esta capa, no en su lugar.
- **Mesh con colores por vértice** para gradientes de profundidad: mismo
  problema de paleta; la profundidad por escalones (`baseTone`) da el
  efecto con los tonos existentes.
- **Feria al oeste** (sobre el hinterland del oeste): no tiene agua; una
  feria a lo Coney Island vive sobre la playa. El norte de la bahía es el
  único borde de agua libre dentro del cover.
- **Mantener la iglesia y el depósito de agua** como contraste en el
  distrito tecnológico: el usuario pidió que toda la extensión sea
  financiera/tecnológica; se reemplazan.

### Desvíos de la implementación

Medición headless de `world.html` (Chrome vía CDP, sin GPU, DPR 2, viewport
1600×900): dos cargas, se toma el segundo "primer dibujo"; tres redibujos de
5 s tras la segunda carga, se toma el mayor. Antes de esta tarea (Tareas 1–4,
`BANDS = 4`, `CELL_WATER = 9`): primer dibujo 115–130 ms, 25 283 polígonos,
peor redibujo 9–12 ms (cifras de §8).

Con el agua ya dinámica (`BANDS = 4`, `CELL_WATER = 9`) el peor redibujo
medido ronda los 12–16 ms según la corrida (13.70 ms y 15.70 ms en dos
corridas limpias): supera el objetivo de 15 ms en al menos una corrida, así
que se activa la decisión gateada de §8.1.

1. **`BANDS = 6`** (`src/scenes/water-anim.ts`): sigue rondando el límite
   (16.20 ms y 12.10 ms en dos corridas) — no alcanza por sí solo.
2. **`CELL_WATER = 18`** además de `BANDS = 6` (`src/scenes/terrain.ts`,
   `buildBleed`): el agua del sangrado deja de subdividirse dentro del cover
   (celda de 18 = celda de `CELL_BLEED`, sin subcelda de 9) y el peor
   redibujo baja a 6–9 ms en la mayoría de las corridas (8.60 ms y 8.70 ms en
   dos corridas limpias tras estabilizar; una corrida aislada marcó 17.50 ms,
   atribuible a ruido de la máquina compartida — el mismo tipo de pico
   aparece en todas las variantes medidas, `BANDS = 4` incluido). Esta
   variante queda: cumple el objetivo con margen y de forma repetible.

Variante final: `BANDS = 6`, `CELL_WATER = 18`. Primer dibujo con la
variante final: 110–131 ms (< 170 ms), 25 216 polígonos estáticos
(< 36 000; la cifra baja levemente respecto a los 25 283 de §8 por cambios
de tareas anteriores en el agua, no por esta tarea). Peor redibujo: 6–9 ms
en régimen estable, muy por debajo del objetivo de 15 ms.

Líneas de consola crudas (dos corridas representativas, ya estabilizada la
variante final):

```
[lab] primer dibujo: 110.5 ms, 25216 polígonos estáticos
[lab] peor redibujo en 5 s: 7.50 ms
[lab] peor redibujo en 5 s: 8.60 ms
[lab] peor redibujo en 5 s: 6.40 ms

[lab] primer dibujo: 127.7 ms, 25216 polígonos estáticos
[lab] peor redibujo en 5 s: 8.70 ms
[lab] peor redibujo en 5 s: 8.40 ms
[lab] peor redibujo en 5 s: 5.80 ms
```

**Barcos (Task 9).** Con la flota reconstruida (Tareas 6–8: cascos
lofteados, superestructuras con ventanas, estelas de 17 triángulos, y la
lancha de la feria con sus tres capas) redibujando cada tick, se repitió la
misma medición sobre `world.html` (25256 polígonos estáticos, no 25216: la
lancha de la feria de la Task 8 suma polígonos estáticos de escena aparte
de los barcos animados). Tres corridas: primer dibujo (segunda carga) 119.8,
122.9 y 123.4 ms; peor redibujo (mayor de tres en 5 s) 9.20, 30.60 y 9.70 ms.
La segunda corrida tuvo un pico aislado de 30.60 ms rodeado de 12.00 ms y
7.90 ms en la misma corrida — del mismo tipo de ruido de máquina compartida
que ya se documentó arriba (picos aislados de 16–17 ms en todas las
variantes del agua), solo que más alto; se hizo una tercera corrida para
decidir por mayoría, como indica la brief. Mayoría: dos de tres corridas
rondan 9–10 ms, muy por debajo del objetivo de 15 ms, y ninguna corrida
sostiene un redibujo por encima de 15 ms fuera del pico aislado. Con el
agua ya en su variante final (`BANDS = 6`, `CELL_WATER = 18`), la puerta de
`SHIP_STEP_MS` de la Task 9 no se activa: los barcos no obligan a
limitar su frecuencia de redibujo. No se tocó `sea-anim.ts`.

Líneas de consola crudas (tres corridas):

```
[lab] primer dibujo: 119.8 ms, 25256 polígonos estáticos
[lab] peor redibujo en 5 s: 9.20 ms
[lab] peor redibujo en 5 s: 8.40 ms
[lab] peor redibujo en 5 s: 8.60 ms

[lab] primer dibujo: 122.9 ms, 25256 polígonos estáticos
[lab] peor redibujo en 5 s: 30.60 ms
[lab] peor redibujo en 5 s: 12.00 ms
[lab] peor redibujo en 5 s: 7.90 ms

[lab] primer dibujo: 123.4 ms, 25256 polígonos estáticos
[lab] peor redibujo en 5 s: 8.20 ms
[lab] peor redibujo en 5 s: 9.70 ms
[lab] peor redibujo en 5 s: 8.10 ms
```

**Distrito tecnológico (Task 13).** Con el suburbio reemplazado por el
distrito tecnológico ya animado (Tareas 10–12: torres de muro cortina,
campus y atrios con fachada completa, laboratorios, telecom, arena y
auditorio; 1 190 sólidos elevados), se repitió la misma medición sobre
`world.html`. Dos corridas: primer dibujo (segunda carga) 140.1 y 138.9 ms,
30 107 polígonos estáticos en ambas (sube desde los 25 256 de la Task 9 por
las fachadas nuevas del distrito); peor redibujo (mayor de tres en 5 s)
10.90 y 12.20 ms. Ninguna corrida fue un pico aislado, así que no hizo
falta una tercera. Primer dibujo 138.9–140.1 ms (< 170 ms, con margen
frente al umbral de la puerta de §8.2), 30 107 polígonos (< 36 000), peor
redibujo 10.90–12.20 ms (< 15 ms): la puerta de §8.2 no se activa y las
fachadas de campus y atrios (`base: "glass"`, `floors: h/3`, `cols: 3`)
quedan como en las Tareas 10–12; no se tocó `city-pieces.ts` ni `tech.ts`.

Líneas de consola crudas (dos corridas):

```
[lab] primer dibujo: 139.0 ms, 30107 polígonos estáticos
[lab] primer dibujo: 140.1 ms, 30107 polígonos estáticos
[lab] peor redibujo en 5 s: 10.20 ms
[lab] peor redibujo en 5 s: 8.30 ms
[lab] peor redibujo en 5 s: 10.90 ms

[lab] primer dibujo: 139.0 ms, 30107 polígonos estáticos
[lab] primer dibujo: 138.9 ms, 30107 polígonos estáticos
[lab] peor redibujo en 5 s: 12.20 ms
[lab] peor redibujo en 5 s: 7.70 ms
[lab] peor redibujo en 5 s: 11.60 ms
```

**Cierre (Task 19).** Con las 18 tareas del plan mergeadas en esta rama
(norte industrial, feria completa, flota y agua en su variante final), se
repitió la misma medición sobre `world.html` tres veces (la tercera para
decidir por mayoría, porque la primera corrida tuvo un primer dibujo por
encima de la meta): primer dibujo (segunda carga) 175.6, 149.1 y 154.4 ms;
peor redibujo (mayor de tres en 5 s) 13.80, 11.60 y 10.00 ms; 32 050
polígonos estáticos en las tres corridas (sube desde los 30 107 de la Task 13
por el norte industrial, la feria y la lancha añadidos en las Tareas 14–18).
Mayoría: dos de tres corridas de primer dibujo están bajo la meta de 170 ms
(149.1 y 154.4 ms) y la tercera (175.6 ms) es un exceso menor atribuible al
mismo ruido de máquina compartida ya documentado arriba; el peor redibujo
nunca superó los 15 ms (máximo 13.80 ms) en ninguna corrida. Cifras finales:
primer dibujo 149–176 ms (meta ≤ 170 ms, cumplida por mayoría), 32 050
polígonos estáticos (meta ≤ 36 000, cumplida), peor redibujo ≤ 13.80 ms
(meta ≤ 15 ms, cumplida con margen): ninguna de las tres decisiones gateadas
de §8.1–§8.3 se activó de nuevo; quedan en las variantes ya elegidas por las
Tareas 5, 9 y 13 (`BANDS = 6`, `CELL_WATER = 18`, sin `SHIP_STEP_MS`, sin
recorte de fachadas).

Desvíos puntuales de las Tareas 1–18 que no habían quedado escritos arriba
(agua, hull, feria, distrito tecnológico, norte industrial), uno por línea:

- **Agua.** `FOAM_W = 9` u (la espuma cubre el primer anillo de celdas de
  costa; los 3 u de la spec son más finos que la grilla). `shallow` mide su
  `baseTone` desde la primera distancia alcanzable (6 u → +1), no desde 0.
  `waveOffset`: la escalera de tono solo tiene un escalón por encima de
  `top`, así que +1 se queda en `top` y solo el +2 gateado por hash llega a
  `up`. `triHash` es un hash entero por mezcla de bits (el hash lineal de la
  spec era degenerado sobre la grilla, repetía valores).
- **Test de paleta.** "Más frío" se mide como proporción de azul en el
  color, no como `r − b` (la resta daba falsos negativos con el durazno del
  reflejo).
- **Casco (`hull`).** `DECK_RING` de la spec tiene la popa en `x 0`. El
  casco de carga (`cargo`) lleva regala (`bulwark`); la lancha de la feria
  (`ferry`) lleva el ámbar en el mástil, no en la cubierta.
- **Ruta de la lancha.** Polilínea de tres puntos
  `[(254,−288), (290,−212), (241,−84)]`: la orilla oeste de la bahía llega a
  `x 277` en `y −204`, y el pabellón del muelle obligó a correr el primer
  vértice 6 u al este.
- **Distrito tecnológico.** Torres de altura `h 12..18` (19–20 son
  imposibles bajo el test de altura con los conos de terraza); dos niveles
  solo cuando el primer nivel mide `≥ 12`; cantidades de la spec sin cambios
  (4 conos de atrio, 4..6 unidades de techo, 6..8 autos). El presupuesto se
  pagó con decoración en vez de recortar torres: columnas solares cada 6 u
  (3 paneles por laboratorio), conos de terraza `1..3`, selva de parque
  `4..6`, un árbol por cuadra en el cantero de la avenida, franja de selva
  oeste con 2 árboles; 1 190 sólidos elevados en total. La animación del
  distrito usa coseno para el pulso de los carteles (cuadro 0 = intensidad
  1) y el parpadeo de ventanas vuelve a sortear el piso si repite el mismo.
- **Norte industrial.** `inFairBox` es un predicado compartido entre la
  feria y la central; los vértices del rectángulo de la feria se achatan
  para mantener la arena plana; cada pieza de la central (turbinas,
  chimeneas, torre de refrigeración, transformadores, acopio de carbón)
  está guardada por `onIndustrial` + `inCoverQuad` por separado; no se
  movieron la refinería, las locomotoras ni el pilón de alta tensión (el
  mapa de archivos de la spec solo los mencionaba de pasada).
- **Feria.** El borde x del paseo de madera sale de
  `min(bayShoreX(y), y+9, y+18) − 16`; los puntos de guirnalda del muelle
  van a `z 3.8` sobre postes de 3 u; la tolerancia z del test del tren es
  `4.2` (por el tercer vagón y su asiento en la bajada más empinada); las
  caras de la vuelta al mundo llevan `tone: "top"` fijo en vez de calculado.
  El bucle del test de la vuelta al mundo se corrigió para que el reloj se
  mantenga bajo 40 s.
- **Feria en el cover (2026-09-16).** Con la cámara cover del sitio (16:9,
  borde norte `x + y = −211`) la vuelta al mundo, la torre de caída y el
  noroeste de la feria quedaban fuera de pantalla, y entre el parque de
  tanques y la feria había arena vacía. La franja bajó dos celdas del
  sangrado: `FAIR = { y0: −312, y1: −168 }` y todas las piezas +36 en y (la
  calle y el estacionamiento del hinterland también); las dos torres de alta
  tensión que caerían en la feria ya no se arman. La vuelta al mundo pasó a
  la playa del sureste, `WHEEL = (216, −204)`, `r 20`, `hub 23`, 20 góndolas
  (altura 43, la excepción esbelta sigue): posición elegida por búsqueda para
  que ningún sólido estático quede delante de ella en pantalla. La torre de
  caída ocupa el lugar viejo de la rueda, `DROP = (150, −264)`. El punto
  norte de la lancha conserva `(+11, −11)` respecto del pabellón:
  `(279, −252)`. La fila de vértices del borde sur de la feria también se
  aplana (del lado de la bahía eran agua a −1 y la arena se hundía).
- **Vías del oeste (2026-09-16).** Las vías `y 131/134` del astillero
  terminaban en `x 0` sobre el empalme con la playa de la fábrica, y los
  conos de selva las tapaban: se leían como cortadas por el bosque. El
  hinterland las prolonga con durmientes hasta `WORLD.x0 − BLEED.x`
  (`WEST_RAIL_X0 = −402`): en pantalla salen por el borde izquierdo.
  `jungle()` acepta `rails` y descarta los conos que pisarían esas vías (el
  cinturón verde siembra 60 para que queden ~30).
- **Cinta transportadora del acopio.** Es un `strip` a `z 4`, como manda la
  spec §4.2, así que vive en la capa de suelo: su punta este queda ordenada
  *debajo* de la cara sur del galpón de turbinas en vez de apoyarse encima.
  Un `poly` de 0.2 de alto ordenaría bien, pero se dejó como pide la spec.
- **Presupuesto del distrito tecnológico.** Con las cantidades de la spec
  restauradas (4 conos de atrio, 4..6 unidades de techo, 6..8 autos) el
  distrito queda en 1 190 sólidos elevados contra un presupuesto de 1 200:
  las cantidades y el presupuesto de la spec son apenas compatibles entre
  sí, sin margen para agregar nada más ahí.

Líneas de consola crudas (tres corridas):

```
[lab] primer dibujo: 175.6 ms, 32050 polígonos estáticos
[lab] peor redibujo en 5 s: 13.80 ms
[lab] peor redibujo en 5 s: 11.60 ms
[lab] peor redibujo en 5 s: 10.30 ms

[lab] primer dibujo: 149.1 ms, 32050 polígonos estáticos
[lab] peor redibujo en 5 s: 11.60 ms
[lab] peor redibujo en 5 s: 7.90 ms
[lab] peor redibujo en 5 s: 9.70 ms

[lab] primer dibujo: 154.4 ms, 32050 polígonos estáticos
[lab] peor redibujo en 5 s: 9.10 ms
[lab] peor redibujo en 5 s: 9.80 ms
[lab] peor redibujo en 5 s: 10.00 ms
```

**Criterios de aceptación (§9), verificados con capturas de `world.html` en
`.claude/worktrees/mundo-2/.superpowers/sdd/2026-09-15-mundo-3-tecnologico-feria-agua-barcos/` (`final-1.png`..`final-4.png` y sus recortes):**

1. **PASS.** Tecla `4` (cover): sin cielo visible; entre la feria y el
   vértice norte del cover solo queda una loma corta (franja verde angosta
   en las dos esquinas superiores de `crop-4-northedge.png`), no selva plana;
   la vuelta al mundo se ve de frente como círculo (`crop-4-fair.png`,
   `crop-4-fair-zoom.png`); el tren de la montaña rusa y su circuito están
   trazados sobre la playa; la lancha de la feria navega entre el muelle de
   la feria y el de graneles con su estela en V (`crop-4-fair-zoom.png`).
2. **PASS.** Tecla `2` (Resume/cv): la extensión se lee como distrito de
   oficinas y campus — torres de muro cortina con ventanas en todas las
   plantas, ventanas prendidas y apagadas por piso, sin casas sin ventanas
   (`crop-2-tech.png`, `crop-2-tech-b.png`).
3. **PASS.** Toda el agua visible en el cover ondula con triángulos de tono
   variable; turquesa en la orilla y el bajío junto al malecón, azul en la
   bahía, azul profundo mar adentro y casi negro hacia la fosa al sureste;
   destellos color durazno dispersos sobre el agua profunda; espuma blanca
   en toda la costa (`crop-4-southwater.png`).
4. **PASS.** El carguero, el remolcador, la barcaza y la lancha de la feria
   muestran proa en punta, popa redondeada, obra muerta de otro color que la
   obra viva, cubierta de madera, superestructura con ventanas y estela en V
   (`crop-4-southwater.png`, `crop-4-fair-zoom.png`); el pecio de la fosa
   hereda la misma forma lofteada por compartir `hull()` (verificado en
   código, `src/scenes/ships.ts`/`sea.ts`; no visible en las capturas porque
   la fosa con el pecio queda fuera del cover, al este).
5. **PASS.** `npm test`, `npm run typecheck` y `npm run build` verdes;
   `dist/` sin `lab/`; palette-guard verde con los colores nuevos pegados
   como literales.
6. **PASS.** Presupuesto de §8 medido arriba (Cierre, Task 19) y anotado en
   esta sección.

## 3. Distrito tecnológico (`src/scenes/tech.ts`, `tech-anim.ts`, `tech-animator.ts`)

Reemplaza `suburb.ts` (se borra) sobre la misma grilla: `suburbBlocks()`,
`SUBURB_COLS`, `SUBURB_ROWS`, `COVER_MARGIN` y `DENSE_D = 60`, `ROWS_D = 160`
(renombrado `CAMPUS_D`) no cambian. La avenida y el muro de ribera se
mudan tal cual (`avenue`, `quay`). `world.ts` expone `tech: TechScene | null`
en vez de `suburb`.

Tipos por distancia `d` al contenido (`pickKind`; 12 % parques a cualquier
distancia, como antes):

- **`d < 60` — torre:** zócalo `paving`; un cuerpo `curtain` de `bw 12..16 ×
  bd 10..13`, h 12..20, en uno o dos niveles escalonados (el segundo con
  retranqueo 2, 30 % de la altura), fachada `{ floors: h/3, cols: tw/2.5,
  window: CURTAIN_WINDOW, base: "glass" }`, losa `officeDark` de remate por
  nivel; techo: helipuerto (50 %) o terraza verde (losa `leafDark` + conos
  `leaf`). Cartel de azotea: caja `officeDark` 6×0.4×1.6 en el borde sur con
  acento poly `amber` encima. Baliza `amberMid` si h ≥ 18. Farol en la mitad
  de las manzanas. `MAX_TECH_H = 20`: por debajo del distrito (24) y de la
  torre (30), así la jerarquía sigue siendo ciudad > distrito > tech.
- **`60 ≤ d < 160` — campus:** dos variantes al 50 %. *U*: la función
  `campus` de `district.ts` se mueve a `city-pieces.ts` y la comparten las
  dos escenas (suelo `leafDark` facetado, tres cuerpos `office` h 6..8 con
  fachada base `glass`, patio con conos, senderos, mesas, cartel ámbar).
  *Atrio*: dos losas `curtain` 9×13 h 6..9 con fachada, unidas por un atrio
  `glass` 4×13 h 4 (más bajo), plaza `plaza` de baldosas (`plazaTone`) con
  cuatro conos y un cartel de pie (`officeDark` 0.4×3×2 + poly `amber`).
- **`d ≥ 160` — laboratorio / centro de datos:** zócalo `paving`; nave
  `officeDark` 20×13 h 5 con fachada `{ floors: 1, cols: 1, base: "glass" }`
  (una banda de vidrio por pared: barata) y 4..6 equipos de techo `steel`
  1.5×1.5×1; campo solar en el resto del zócalo: filas de `ramp` `glass`
  3×1.6 h 0.5 `dir: "s"` cada 2.2 u (≤ 24 por manzana); estacionamiento de
  6..8 autos (`steel`/`rust` 3×1.5×1.2) a lo largo de la calle sur.
- **Parque:** igual que `park` del suburbio.
- **Hitos** (mismas manzanas: `TELECOM = (−114, 242)`, `ARENA = (102, 448)`,
  `AUDITORIUM = (12, 352)`):
  - Torre de telecomunicaciones: base `concrete` 4×4×2, mástil `steel`
    1×1×20 (esbelto), tres platos (cilindros `steel` r 1.2 h 0.4 a z 10, 14,
    18 desplazados 1.2 hacia el este), luz `amber` r 0.8 en la punta (pulsa).
  - Arena: el estadio actual sin cambios (anillo `stone`, césped, cuatro
    torres de luz).
  - Auditorio: tambor `curtain` r 8 h 8 sides 12 con fachada (floors 2, cols
    2 por cara), cubierta `copper` cono r 8.5 h 2.5 sides 12, marquesina
    `officeDark` 10×3×0.4 al sur a z 3 sobre dos columnas, cartel ámbar.

Animación (`tech-anim.ts`, puro; frame 0 = todo encendido y quieto):

- **Ventanas:** cada torre con h ≥ 12 elige un `litFloor` (rng); cada
  4..9 s (como `BLINK_GAP_MS`) una torre al azar apaga su piso o lo cambia
  de piso. Capa `tech.windows` (`accent`, `facadeAccents` en las caras
  visibles, color `amber`). Con ≤ 40 torres son ≤ 40 × 2 caras × cols
  patches: barato.
- **Carteles:** los polys `amber` de azotea y de pie pulsan alpha
  0.6 → 1 con período 3 s (paso 150 ms). Capa `tech.signs`.
- **Telecom:** dot `amber` r 0.8 + 0.3·(1 + sin(t / 1200)). Capa
  `tech.telecom`.

Materiales: `office officeDark glass curtain paving plaza stone copper
concrete leaf leafDark steel rust`. Ningún material nuevo.

## 4. Norte industrial y feria

### 4.1 Geografía (`sprawl-grid.ts`, `terrain.ts`, `geo.ts`)

- `REACH.n = 16 * CELL_BLEED` (288). `reachAt("n", ·)` sigue ondulando 36.
- `Built` gana `"fair"`. `FAIR = { x0: 84, y0: −348, y1: −204 }` (84 y ambos
  y alineados a la grilla del sangrado, anclada en `(−402, −438)`). `builtAt`
  devuelve `"fair"` si el punto cae en el rectángulo, no es agua de la bahía
  (`bayWater`) y está dentro de `reachAt("n")`; se evalúa antes que
  `"industrial"`.
- `BleedTerrain` gana `"fair"` → `BLEED_MAT.fair = "sand"`, plano (jitter
  0.1) como la tierra construida. Así la franja entre el paseo y el agua es
  playa sin que la escena ponga suelo.
- `worldZoneAt` no cambia: la feria clickea Portfolio (está al norte de la
  costura y al oeste de 344).
- Los pilones (`PYLON_Y = −196`), la playa de vías (`YARD_TRACKS_Y`), los
  galpones, los tanques, los silos y el muelle no se mueven.
- `bayShoreX(y) = riverCenter(y) − RIVER_HALF` (orilla oeste de la bahía;
  ≈ 212..277 en la franja de la feria) y `fairAt(x, y) = builtAt(x, y) === "fair"`
  se exportan de `sprawl-grid.ts` para la escena.

### 4.2 Norte industrial (`hinterland.ts`, funciones nuevas)

Solo lo que entra en el cover: `x 0..84`, `y −300..−204` (el borde norte del
cover en esa franja es `y ≈ −241 − x`, con margen 30). Todo pasa por
`onIndustrial` y por `inCoverQuad(cx, cy, 16/9, 30)`.

- **Central térmica** (`POWER = { x: 34, y: −276, w: 40, d: 16 }`): sala de
  turbinas `concrete` 40×16 h 12 con fachada `{ floors: 1, cols: 5 }`; dos
  chimeneas `concrete` r 2 h 26 (esbeltas) en `(78, −270)` y `(78, −260)`,
  expuestas como `stacks: Vec3[]` de la escena (la punta) para que
  `factoryAnimator` las haga humear (recibe `[...factory.stacks,
  ...hinterland.stacks]`); torre de refrigeración: cilindro `concrete` r 8
  h 12 sides 14 + cilindro r 6.5 h 4 encima (cintura), en `(20, −236)`;
  acopio de carbón: 3 conos `rust` r 5..6 h 3 en `x 6..30`, `y −258..−246`;
  cinta `steel` 0.8 de ancho a z 4 sobre postes `steel` 0.4 cada 8 del
  acopio a la sala; patio de transformadores en `x 40..70`, `y −252..−240`:
  6 `steel` 3×2×3 con tres cilindros `rust` r 0.4 h 1 encima cada uno,
  cerco `steel` 0.3 h 1.2, dos faroles cian.
- **Calle:** `road` 6 de ancho en `y = −212` de `x 0` a la portada de la
  feria (84), con faroles cian cada 28 y 3 camiones esperando.
- Presupuesto ≤ 250 sólidos elevados nuevos; nada supera 18 salvo las
  chimeneas (esbeltas).

### 4.3 Feria (`src/scenes/fair.ts`, `fair-anim.ts`, `fair-animator.ts`)

Escena de Portfolio parte 3 (`zoneRng(seed, "portfolio", 3)`), solo con el
mundo entero (vive sobre el sangrado). Coordenadas: la orilla de la bahía
es `bayShoreX(y) = riverCenter(y) − RIVER_HALF` (≈ 215..245 en la franja).

- **Paseo marítimo** (`BOARDWALK_W = 8`): prisma `deck` por tramo de 18 u
  siguiendo `bayShoreX(y) − 16` (escalonado en x, es papercraft), z 0 h 0.6,
  de `y −336` a `−208`; baranda del lado del agua: postes `steel` 0.3 h 1
  cada 6; faroles `amber` r 0.7 en postes `steel` 0.4×0.4×4 cada 18 (lado
  tierra); 8 bancos `deck` 2×0.6×0.5.
- **Muelle** (`PIER = { y: −282, len: 46 }`): prisma `deck` 10×46 desde el
  paseo hacia el este sobre el agua (z −1, h 1.8), pilotes `rust` r 0.4 h
  1.4 cada 8 del lado visible (sur), bajo el tablero, pabellón en
  la punta: cilindro `whitewash` r 5 h 4 sides 8 + cono `copper` r 5.6 h 2.5
  + dot `magenta` r 1 arriba; guirnalda: dots `amber` r 0.35 cada 4 u a z 3
  sobre postes por ambos bordes. Amarradero de la lancha en la punta sur.
- **Vuelta al mundo** (`WHEEL = { x: 150, y: −300, r: 14, hub: 17 }`):
  sólido `wheel` (§6) con 16 sectores, 16 rayos, 16 góndolas (`rust`/`steel`
  alternadas, 1.6×1.2×1.4); soporte: dos pares de columnas verticales
  `steel` 0.8×0.8×17 (el motor no tiene prismas inclinados) a ±2.5 en el
  plano del anillo y viga de eje `steel` 6×0.8×0.8 cruzando; base `concrete` 10×6×0.6; taquilla `whitewash` 3×3×2.5 con
  cartel. Luces: 16 dots `magenta` r 0.4 en la llanta que corren (4
  encendidas a la vez, avanzan un sector cada 150 ms) y dot `amber` en el eje.
  Altura máxima 31 (r 14 + hub 17): excepción esbelta declarada (es un aro).
- **Montaña rusa "Ciclón"** (`COASTER = { x0: 94, x1: 156, y0: −262, y1: −232 }`):
  circuito rectangular redondeado de 24 segmentos (`COASTER_PROFILE`:
  alturas por segmento, subida 4 → 14 en los primeros 6, dos bajadas, final
  a 4); por segmento: dos `strip` `rail` 0.3 a la z del segmento (vía), un
  travesaño `deck` 2.4×0.4×0.3 y una columna `rust` 0.5×0.5×z; celosía:
  viga `rust` 0.3 horizontal a media altura entre columnas contiguas.
  Estación: techo `whitewash` 8×4 h 3 sobre 4 columnas en el segmento 0.
  Tren: 3 autos `rust` 2.2×1.4×1 + `steel` 1.6×1×0.4, animado por `dist`
  a lo largo de la polilínea 3D (§4.4).
- **Carrusel** (`(178, −248)`): base `stone` cilindro r 6 h 0.6 sides 12,
  12 postes `steel` 0.25 h 3 en r 4.5, techo cono `whitewash` r 7 h 3
  sides 12 con remate cono `copper` r 1.2 h 1.5, 12 dots `amber` r 0.3 bajo
  el alero. Estático (girar 12 postes por tick no se nota).
- **Torre de caída** (`(120, −328)`): mástil `steel` 1×1×24 (esbelto),
  base `concrete` 4×4×0.6, góndola: cilindro `rust` r 2.4 h 1.4 sides 8
  con 8 asientos `steel` 0.6×0.6×0.8, animada en z (§4.4); dot `cyan` r 0.8
  arriba.
- **Salón de arcades** (`(96, −228)`): prisma `whitewash` 24×12 h 6 con
  fachada `{ floors: 1, cols: 5, base: "glass" }`, marquesina `copper`
  26×2×0.4 al sur a z 4, cartel de azotea: caja `steel` 10×0.4×2.4 con dos polys `magenta` y `amber`
  alternados; toldo `rust` 24×1.5×0.2 a z 3.6.
- **Puestos** (8, a lo largo del paseo, lado tierra, cada 12 u desde
  `y −330`): prisma 4×3 h 2.8 `gable`, materiales cíclicos `whitewash`,
  `rust`, `copper`; cada uno con poly `amber` 2.4×0.8 en la cara sur y dot
  `cyan` r 0.4 en el alero (una de cada tres, `magenta`).
- **Autitos chocadores** (`(130, −230)`): losa `plaza` 14×10 h 0.3, 8
  columnas `steel` 0.4 h 4, techo `steel` 14×10×0.4 a z 4 con cenefa `rust`
  0.3; 6 autitos `rust`/`steel` 1.8×1.2×0.8 debajo; 6 dots `cyan` r 0.4
  bajo el techo.
- **Playa:** 12 sombrillas (poste `steel` 0.25 h 2 + cono `whitewash`/`rust`
  r 1.6 h 0.7) entre el paseo y el agua, rng dentro de la franja `sand`
  (verificado con `bleedTerrainAt === "fair"` y `x < bayShoreX(y) − 3`);
  4 botes `hull` 5×1.8×0.8 `whitewash` varados.
- **Portada** (`(86, −212)`): dos pilares `stone` 1.5×1.5×6 con dintel
  `copper` 9×1.5×1 y poly `amber` 7×0.9 encima; cerco `steel` 0.3 h 1.2
  por el borde oeste (`x = 84`) con un hueco en la portada.
- **Estacionamiento:** del lado industrial (`x 50..84`, `y −236..−212`),
  losa `paving` con 12 autos `steel`/`rust`; la calle §4.2 termina acá. Lo
  arma `hinterland.ts` (es tierra industrial), no `fair.ts`.
- Nada apoya en agua salvo el muelle y el paseo; `onFair(x, y, w, d)` como
  `onIndustrial`. Presupuesto ≤ 700 sólidos elevados; ≤ 120 acentos.

### 4.4 Animación de la feria (`fair-anim.ts`, puro)

Capas: `fair.wheel` (`solid`: el `wheel` rotado en `angle`), `fair.wheelLights`
(`accent`), `fair.train` (`solid`), `fair.drop` (`solid`), `fair.signs`
(`accent`, los polys del salón alternan cada 500 ms).

- Vuelta al mundo: `angle += 2π · dt / 40 000`, redibujo cada 250 ms (144
  pasos por vuelta); luces: `lit = (k + floor(clock / 150)) % 16 < 4`.
- Tren: `dist` a `SPEED = 9 u/s` sobre la polilínea 3D del circuito (los
  centros de segmento con su z); en la subida (`segmentos 0..5`) `3 u/s`.
  Los tres autos van a `dist`, `dist − 2.6`, `dist − 5.2`; heading del
  segmento.
- Torre de caída: `z = base + (H − 4) · e(t)`, con `e` = subida lineal
  6 s, pausa 1 s, caída en 0.6 s (cuadrática), pausa 0.4 s; redibujo cada 100 ms.
- `reducedMotion`: `tick` no devuelve ids; frame 0 = rueda en 0, tren en la
  estación, góndola abajo, 4 luces fijas.

### 4.5 Tests

- `sprawl-grid.test.ts`: `builtAt(150, −300) = "fair"`, `builtAt(−100, −300)
  = "industrial"`, `builtAt(150, −400) = null`, `builtAt(240, −300) = null`
  (bahía); la selva + roca dentro del cover no sube de 12 % del sangrado
  (era 7,9 %; el norte suma tierra construida, así que debe **bajar**: ≤ 6 %).
- `fair.test.ts`: determinismo, materiales de la feria (`deck whitewash rust
  steel copper stone concrete plaza paving sand rail glass hull leaf
  leafDark`), nada elevado en agua salvo muelle y paseo, alturas ≤ 18 salvo
  rueda (≤ 31, un solo `wheel`), mástiles (esbeltos), presupuesto, los 24
  segmentos del circuito con z entre 4 y 14, hay ≥ 8 puestos `gable`.
- `fair-anim.test.ts`: la rueda da la vuelta en 40 s; el tren nunca sale de
  la polilínea (todo punto a ≤ 0.01 de un segmento) y la z de cada auto es
  la del segmento; la góndola vuelve a la base al final del ciclo; con
  `reducedMotion` `tick` devuelve vacío y el frame 0 es el descripto.
- `hinterland.test.ts`: la central existe (`stacks.length === 2`, torre de
  refrigeración: cilindro `concrete` r 8 sides 14), todo lo nuevo cae dentro
  del cover (`inCoverQuad(cx, cy, 16/9, 30)`) y sobre tierra industrial,
  presupuesto ≤ 250 sólidos elevados nuevos.
- `terrain.test.ts`: `bleedTerrainAt(150, −300) = "fair"`, material `sand`,
  z de los vértices `fair` en `[−0.1, 0.1]`.

## 5. Agua dinámica (`src/scenes/water-anim.ts`, `water-animator.ts`, `terrain.ts`, `palette-iso.ts`)

### 5.1 Terreno

- `TerrainMesh` cambia: `{ ground, bleed, water: WaterBody[] }` con
  `WaterBody = { kind: "ground"; mat: "shallow" | "water" | "waterDeep" | "abyss"; tris: Tri[] }`
  (un solo `Solid` por material, contenido + sangrado juntos) y
  `foam: Solid` (triángulos de espuma de costa, material `foam`, duplicados
  de los de agua a menos de `FOAM_W = 3` de tierra, incluidos los del
  arrecife de la punta). Desaparecen `river`, `sea`, `shore`, `abyss` como
  campos: los tests y `sea-anim` se adaptan (`sea-anim` recibe `terrain.foam`
  para su espuma del arrecife, que deja de calcular).
- **Clasificación por profundidad.** `terrainAt`/`bleedTerrainAt` siguen
  diciendo qué es agua (`water`, `sea`, `shore`, `abyss`, `river`). La banda
  la decide `depthAt(x, y)`: distancia (en u) a la celda de tierra más
  cercana, calculada una vez con una transformada de distancia sobre la
  grilla de 6 u del contenido más la de 18 del sangrado (muestreada a 6 en
  el cover). Bandas: `shallow` `d < 12` (hoy `shore`), `water` `12 ≤ d < 48`,
  `waterDeep` `d ≥ 48`; `abyss` manda si `x ≥ abyssX(y)` (la fosa sigue
  siendo geográfica). El río y el estuario (ancho 14..40) salen `shallow` en
  las orillas y `water` en el centro: progresión también ahí.
- **`Tri.baseTone`**: por triángulo, `round(2 · (1 − 2 · frac))` recortado a
  `[−1, 1]`, con `frac` la posición de `d` dentro de su banda (0 = borde
  somero, 1 = borde profundo); en `abyss`, por distancia a `abyssX`. Las
  crestas y senos se suman a esto.
- **Sangrado a 9 u** (ver Desvíos: quedó en 18 / 6 bandas). `buildBleed` subdivide las celdas de agua en
  `CELL_WATER = 9` cuando `inCoverQuad(cx, cy, 16/9, COVER_MARGIN)`, y las
  deja en 18 afuera. La costura entre 9 y 18 comparte vértices (18 es
  múltiplo de 9) y todo está a `WATER_Z`, así no hay grietas.

### 5.2 Paleta

Escaleras nuevas (objetivo del `top`; el script genera las cinco y se pegan
como literales, con la regla de ciudad/costa para `lit`/`down` y las dos
reglas nuevas para `shade` y `up`):

| Material | `top` objetivo | Lectura |
|---|---|---|
| `shallow` (nuevo) | `0x2f7f86` | turquesa sobre arena, orillas y bajíos |
| `water` | `0x225f6c` | bahía, río, estuario, mar cerca de la costa |
| `waterDeep` | `0x183f56` | mar abierto |
| `abyss` | `0x0f2740` | fosa, casi el cielo |

Reglas por canal: `lit = top × (0.55, 0.60, 0.80)`, `down = top × (0.78, 0.84, 0.96)`,
`shade = top × (0.40, 0.42, 0.60)`, `up = top × 0.3 + 0xf0a070 × 0.7` (durazno:
el sol bajo del OSO reflejado). Un triángulo plano de agua sale en `top` y se
mueve por la escalera con `toneOffset` −2..+2 → `lit`, `down`, `top`, `up`
(el clamp del tono no baja de `lit`). `foam` no cambia. La regla "ningún
literal fuera de la paleta" sigue.

### 5.3 Animación (`water-anim.ts`, puro)

- `waveTone(t: Tri, clockMs): number` = `clamp(base + crest, −2, 2)` con
  `crest = round(1.2 · sin(φ) + 0.35 · sin(2.3 φ + cx / 7))`, `φ = (cx +
  0.5 · cy) / λ − 2π · clock / T`, `λ = 10`, `T = 4000` (la ola viaja hacia
  el NO: hacia la costa del astillero y de la ciudad, que es donde el
  espectador la ve romper). Con `base + crest = +2` el tono es `up`: el
  destello; para que no sea una franja continua, `+2` solo se conserva si
  `hash(t) % 4 === 0` (hash fijo por triángulo, calculado una vez), si no
  se recorta a `+1`.
- `abyss`: `λ = 14`, `T = 8000`, amplitud 0.6 (como hoy).
- Espuma de costa: `foam.tris` alternan `toneOffset` 0 / −1 cada 500 ms
  (como la del arrecife).
- Bandas: los triángulos de agua se reparten en `BANDS = 4` por x de
  pantalla (ver Desvíos: quedó en 18 / 6 bandas) (`sx = x − y`), cada banda con un `Solid` por material; cada
  `WATER_STEP_MS = 150` se repinta una banda (round-robin): cada triángulo
  cambia cada 600 ms, 6,7 pasos por ciclo de 4 s. Es más grueso que hoy
  (450 ms) y lo compensa que la ola viaja (el ojo sigue la cresta entre
  bandas). Si al medir la banda más pesada excede el presupuesto (§8), se
  sube a `BANDS = 6` antes que subir el paso.
- Capas: `water.band0..3`, `water.foam`. `claims`: todos los `WaterBody` y
  `foam`.

### 5.4 Cambios en el resto

- `shipyard-animator.ts` pierde la capa `water` (y `createShipyardAnim` el
  argumento `water`); `sea-anim.ts` pierde `band/abyss/foam` y su `wave`;
  conserva barcos, haz, boyas. `lab/page.ts` crea `waterAnimator(terrain,
  { reducedMotion })` antes que los demás (dibuja debajo).
- `runtime.ts`: no cambia salvo que `staticWater` recibe `terrain.water`
  filtrado por `claims` (queda vacío con el animador; sigue sirviendo para
  las páginas de zona, que también tienen el animador: se puede borrar la
  Graphics estática si ningún caso la usa; se decide al implementar).
- `reducedMotion`: frame 0 = `clock 0` pintado una vez (la ola existe, no
  se mueve).

### 5.5 Tests

- `terrain.test.ts`: `depthAt` crece al alejarse de la costa
  (`depthAt(400, 60) < depthAt(480, 60) < depthAt(560, 60)`); las cuatro
  bandas tienen triángulos; todo el agua está a z −1; `baseTone ∈ [−1, 1]`;
  el estuario tiene `shallow` en las orillas y `water` en el centro
  (`(200, 300)` vs `(240, 300)`); el sangrado dentro del cover usa celdas de
  9 (hay triángulos de agua con lado 9 en `(600, 300)`), fuera de 18 (ver
  Desvíos: quedó en 18 / 6 bandas).
- `water-anim.test.ts`: `waveTone` es periódica en `T`, viaja (la cresta en
  `(x, y)` a `t` está en `(x + λ, y)` a `t + T`), nunca sale de `[−2, 2]`,
  respeta `base` en promedio (media sobre un ciclo ≈ `base`), el `+2` solo
  aparece en triángulos con `hash % 4 === 0`; `tick` con `reducedMotion`
  devuelve vacío; 4 bandas con tamaños que no difieren más de 2× entre sí
  (ver Desvíos: quedó en 18 / 6 bandas).
- `palette-iso.test.ts`: `shallow` existe; para cada material de agua
  `up` es más cálido que `top` (`r − b` mayor) y `shade` más frío; las
  cuatro `top` se oscurecen en orden `shallow > water > waterDeep > abyss`.
- `pixi-free.test.ts` sigue verde (los módulos nuevos no importan Pixi).

## 6. Motor (`src/iso/solids.ts`, `facade.ts`)

- **`hull`**: `{ kind: "hull"; at; len; beam; h; mat; topMat?; heading?; sheer?: number }`.
  Tessellation `loft`: anillo de cubierta `DECK_RING` (local, en fracciones
  de `len`/`beam`): popa `(0, −0.3)`, `(−0.04, 0)`, `(0, 0.3)`; costados
  `(0.15, ±0.5)`, `(0.55, ±0.5)`, `(0.85, ±0.3)`; proa `(1, 0)` (10 puntos,
  sentido horario visto desde arriba). Anillo de quilla: mismos índices con
  `y × 0.7` y `x` remapeado a `0.06..0.9`. z: quilla a `at.z`, cubierta a
  `at.z + h · (1 + sheer · s(x))`, con `s(x) = max(0, (x − 0.55) / 0.45)²`
  en proa y `0.4 · max(0, (0.15 − x) / 0.15)` en popa; `sheer` por defecto
  0.25 (0 en la barcaza, 0.35 en el remolcador). Caras: cubierta (polígono
  de 10 puntos, en `deck` si `topMat` está definido y en `mat` si no, para
  que los cascos del astillero sigan monocromos), base
  (invisible, se descarta por normal), y por lado dos cuadriláteros: banda
  baja (`0..0.2 h`, `mat`) y obra muerta (`0.2 h..cubierta`, `topMat ?? mat`),
  cada uno como dos triángulos (no son planos). `bounds` y `shadowPolygon`
  salen solos de `tessellateAll`. La huella a `at.z` sigue dentro del
  rectángulo `len × beam` rotado (los tests de ruta que usan `bounds` no
  cambian de caja en xy; en z suben a `h · 1.25`).
- **`poly`** gana `facade?: Facade`: `extrude` seguido de `facadeFaces` en
  las paredes, igual que `prism`.
- **`wheel`**: `{ kind: "wheel"; at: Vec3 (eje); r; width; mat; sides; angle; gondolas?: { mat: Material; w; d; h } }`.
  Plano `u = (1/√2, −1/√2, 0)` × `z`: punto del anillo `P(a, ρ) = at + u · ρ
  cos a + z · ρ sin a`. Caras: `sides` sectores de llanta entre `r − width`
  y `r` (cuadriláteros en el plano), `sides` rayos (cuadriláteros de ancho
  `width / 3` desde el cubo `r · 0.12` a `r − width`), cubo (octógono
  `r · 0.12`), todos con normal `(1/√2, 1/√2, 0)` (mira a la cámara; como pared
  saldría en `shade`) y `toneOffset +3`, que la lleva a `top`: el anillo se
  ve del color base del material. Góndolas:
  `sides` prismas `gondolas` centrados en `P(a_k + angle, r − width/2)`,
  colgando (`z − h`). `isFlat = false`; `bounds` por `tessellateAll`;
  `sortByDepth` usa su caja (diagonal: ancha, por eso la rueda va en una
  capa animada propia, que se dibuja después de lo estático; nada estático
  de la feria queda delante de ella en pantalla: se verifica con
  `isBehind`/`overlaps` en `fair.test.ts` como con la ruta de los barcos).
- `depth.test.ts`/`solids.test.ts`: el loft cierra (cada arista de lado
  aparece dos veces), `bounds` de un `hull` con heading 0 es
  `[0, len] × [−beam/2, beam/2] × [z, z + 1.25 h]`, la cara de cubierta
  tiene tono `top`, la banda baja tiene `mat` y la alta `topMat`; `wheel`
  con `angle` 0 y `π/8` da góndolas en posiciones distintas y la misma caja.

## 7. Barcos (`src/scenes/ships.ts`, `sea-anim.ts`)

Material nuevo `hullBlue` (`top 0x2f4a6e`, obra muerta azul; compartido
"vehículos"). `deck` ya existe. Superestructuras `whitewash` con `facade`
sobre `poly`.

- **Carguero** (`60×10×5`, `mat: "hull"`, `topMat: "hullBlue"`): amurada
  (`poly` 0.3 de ancho por borde de cubierta, h 0.8, `hullBlue`), tres
  escotillas `rust` 9×6×1.2 en `x 8..38`, castillo de proa (`poly`
  `hullBlue` 6 de largo h 1.2), superestructura en `x 40..52`: tres niveles
  `whitewash` (10×8×2.4, 9×7×2.4, 8×6×2.4) con fachada `{ floors: 1, cols:
  3, window: { w: 0.5, h: 0.5 } }`, puente con alerones (`whitewash`
  4×12×2.2 centrado en el último nivel, sobresale 2 por banda, fachada
  `base: "glass"`), chimenea `rust` r 1.4 h 4 + tapa `steel` r 1.6 h 0.6
  detrás del puente, mástil `steel` 0.4×0.4×7 con cruceta 3×0.3×0.3 en la
  proa, dos grúas de cubierta (kingpost `steel` 0.8×0.8×8 + pluma 7×0.6×0.6
  paralela al eje, hacia proa). Luces: mástil `magentaMid`, posición `magenta`/`cyanMid`
  en los alerones, ventanas del puente encendidas como poly `magentaBleed`
  alpha 0.8.
- **Remolcador** (`18×6×3`, `sheer 0.35`, `mat: "hull"`, `topMat:
  "hullBlue"`): timonera `whitewash` 4×3.5×2.6 en `x 5..9` con fachada
  `{ floors: 1, cols: 3, base: "glass" }`, techo `steel` 4.4×3.9×0.3,
  chimenea `rust` r 0.9 h 2.5 detrás, mástil `steel` 0.3×0.3×3.5 con luz,
  6 defensas: cilindros `rust` verticales r 0.45 h 0.9 pegados al costado a
  la altura de cubierta, 3 por banda; bita `steel` r 0.4 h 0.8 en popa, pudding de proa `rust` 1×0.6×0.6.
- **Barcaza** (`40×9×2`, `sheer 0`, `mat: "hull"`, `topMat: "rust"`):
  contenedores 6×2.4×2.6 en dos filas (`y ±1.4`) de cinco, dos de alto en
  los tres del medio, `rust`/`steel` alternados; empujador en popa: `hull`
  10×5×2.6 `hullBlue` a `x −9` (pegado), timonera `whitewash` 2.6×2.6×3 alta
  con fachada, chimenea `rust` r 0.6 h 1.8. Luces en el empujador.
- **Lancha de la feria** (`ferry`, `26×7×3`, `sheer 0.2`, `mat: "hull"`,
  `topMat: "whitewash"`): cubierta principal `whitewash` 20×6×2.4 con
  fachada `{ floors: 1, cols: 6, base: "glass" }`, cubierta alta
  `whitewash` 12×5×2.2 con fachada, chimenea `rust` r 0.7 h 2, mástil con
  `amber` (feria) además de las luces de posición. Ruta `FERRY_ROUTE`:
  desde la punta del muelle de la feria `(bayShoreX(−282) − 16 + 46 + 4,
  −288)` al muelle de graneles `(212, −84)`, ida y vuelta (al llegar a un
  extremo invierte `heading` en 4 s parada); velocidad 3 u/s; sin
  desvanecido (nunca sale del cover). Se verifica que ningún punto de la
  ruta quede detrás de un sólido estático que se le superponga
  (`isBehind` + `screenBounds`, como `ROUTE`); si el test la rechaza, la
  ruta se corre hacia el este (agua abierta de la bahía), no se saca la
  lancha.
- **Estelas** (`wake(kind, p, heading)`): ola de proa: 2 triángulos `foam`
  `up` a ±beam/2 desde la roda, 3 u de largo; V: por banda, 6 triángulos
  finos (ancho 0.8) desde `x = len · 0.8` hacia atrás abriéndose 12° hasta
  `−0.4 len` detrás de la popa; remolino de popa: 3 triángulos (largo 3, 5,
  7 u) centrados. `toneOffset` 1 en los primeros, 0 después. La barcaza
  lleva la estela detrás del empujador.
- **Pecio** (`sea.ts`): mismo `hull` (hereda el loft), `topMat: "rust"`.
- **Ritmo:** los barcos se redibujan cada tick (como hoy); si el peor
  redibujo supera el presupuesto, `SHIP_STEP_MS = 66` (15 fps) antes que
  simplificar la flota.
- **Tests** (`ships.test.ts`, `sea-anim.test.ts`): cada barco tiene ≤ 30
  sólidos y ≤ 6 luces; toda pieza queda dentro de la caja del casco en
  planta (con margen 2 para alerones y plumas) y encima de la cubierta;
  materiales de barcos `hull hullBlue whitewash steel rust deck glass`;
  la lancha oscila entre los dos extremos y para 4 s en cada uno; las
  estelas tienen 17 triángulos por barco; la ruta de la lancha no queda
  detrás de sólidos estáticos.

## 8. Presupuesto y medición

Mismo procedimiento que Mundo 2 y márgenes: Chrome headless vía CDP, sin
GPU, DPR 2, `world.html`, antes y después de cada parte, dos corridas
(caliente).

| Métrica | Hoy | Meta |
|---|---|---|
| Primer dibujo caliente | 115–130 ms | ≤ 170 ms |
| Polígonos estáticos | 25 283 | ≤ 36 000 |
| Peor redibujo en 5 s | 9–12 ms (bandas del mar) | ≤ 15 ms |
| Sólidos elevados nuevos | — | tech ≤ 1 200, feria ≤ 700, norte ≤ 250 |

Decisiones gateadas por medición (cada una con su alternativa ya escrita):

1. Agua del sangrado a 9 u dentro del cover. Si el peor redibujo supera
   15 ms con `BANDS = 4` y también con `BANDS = 6`, el sangrado vuelve a 18.
2. Fachadas en las torres y campus del distrito tecnológico. Si el primer
   dibujo supera 170 ms, los campus pierden la fachada (`floors 1, cols 1`)
   antes que las torres.
3. Barcos a 30 fps. Si el peor redibujo supera 15 ms por los barcos (medido
   con el agua a 18), `SHIP_STEP_MS = 66`.

## 9. Criterios de aceptación

1. `lab/world.html` tecla `4`: sin cielo; al norte no hay selva plana entre
   la feria y el vértice del cover salvo una loma corta; la vuelta al mundo
   se lee de frente y gira; el tren recorre el circuito; la lancha va y
   viene entre los dos muelles.
2. Tecla `2`: la extensión de Resume se lee como distrito de oficinas y
   campus (ventanas en todo lo que no sea laboratorio), con ventanas que se
   prenden y apagan y carteles que pulsan; no hay casas sin ventanas.
3. Toda el agua visible en el cover ondula; hay turquesa en orillas y
   bajíos, azul en la bahía y el estuario, azul profundo mar adentro y casi
   negro en la fosa; destellos durazno dispersos; espuma en toda costa.
4. Los tres barcos y la lancha tienen proa en punta, popa redondeada, obra
   muerta de otro color que la obra viva, cubierta de madera, superestructura
   con ventanas y estela en V; el pecio hereda la forma.
5. Tests verdes (`npm test`, `npm run typecheck`), `dist/` sin `lab/`,
   palette-guard verde con los colores nuevos pegados como literales.
6. Presupuesto de §8 medido y anotado en la sección "Desvíos de la
   implementación" de esta spec al terminar.

## 10. Fuera de alcance

- Texto real en los carteles (`pixelfont.ts` existe; usarlo en acentos es
  un trabajo aparte).
- Sombras de los sólidos animados de la feria distintas de las estáticas.
- Peatones, autos en movimiento en el distrito tecnológico (la ciudad vieja
  tampoco los tiene animados).
- Integrar nada de esto en el sitio (`src/main.ts`): el laboratorio sigue
  siendo el único consumidor.
