# Encuadre por aspecto: nunca mostrar fuera del cuadro 16:9

**Fecha:** 2026-11-11
**Estado:** aprobado, listo para agente
**Alcance:** cambiar `coverView` (y el acotado de `zoneView`) para que, en
pantallas más angostas que 16:9 (4:3, cuadradas, tablets en vertical,
celulares), la cámara no muestre terreno fuera del cuadro 16:9 y se corra
hacia la ciudad en vez de centrarse a ciegas. Las pantallas de 16:9 o más
anchas no cambian.

## 1. El problema, medido

El encuadre depende **solo del aspecto** del host (ancho/alto). Ni el tamaño
en píxeles ni el `devicePixelRatio` lo cambian: con 390×750 a DPR 1 y DPR 3
los rótulos caen en las mismas coordenadas CSS.

Hoy `coverView(w, h)` (`src/world/view.ts:30`) es
`fitTransform(coverFrame(w / h), …)`: el rectángulo **más grande** del aspecto
del host inscripto en el terreno con sangrado (`coverQuad(aspect)`,
`src/map/geo.ts:41`), centrado en el centro de `WORLD`. Al angostarse el host,
ese rectángulo se vuelve angosto y alto:

- recorta a los lados, justamente donde está la ciudad (oeste, a la
  izquierda en pantalla: el rótulo Resume está en `(76, 446)`, ya fuera de
  `WORLD`);
- suma terreno arriba y abajo que **no tiene contenido**, porque el sangrado
  solo se construye dentro del cuadro 16:9: `hinterland.ts:168` (`inCover`) y
  `blockAt` en `sprawl-grid.ts:85` descartan todo lo que queda a más de
  `COVER_MARGIN` = 30 de `coverQuad(16/9)`. Arriba queda suelo industrial
  pelado y selva (la "parte vacía" encima de la fábrica); abajo, mar sin
  barcos.

Medido sobre `main` en 1fa332c, muestreando la pantalla con `pointerToWorld`
contra `inCoverQuad(…, 16/9, 0)`:

| Aspecto | Ejemplo | Escala | Pantalla fuera del 16:9 | 16:9 visible |
|---|---|---|---|---|
| 2,12 | laptop 1366×768 | 1,17 | 8 % (a los lados) | 92 % |
| 1,78 | 16:9 | 1,49 | 0 % | 100 % |
| 1,60 | 16:10 | 1,26 | 5 % | 95 % |
| 1,42 | 4:3, 1280×1024 | 1,35 | 9 % | 88 % |
| 1,00 | cuadrado | 1,18 | 21 % | 71 % |
| 0,69 | iPad vertical | 1,39 | 29 % | 55 % |
| 0,52 | celular 390×750 | 0,83 | **33 %** (17 % arriba, 17 % abajo) | **44 %** |

## 2. La regla nueva

Sea `A = 16/9` y `a = w/h` el aspecto del host.

### 2.1 `coverView(w, h)`

- **`a ≥ A`:** sin cambios: `fitTransform(coverFrame(a), w, h, 0)`.
- **`a < A`:** el cuadro 16:9 llena el **alto** del host y el ancho visible
  es una ventana que se desliza dentro de él:
  1. `vw = h · A`; `base = fitTransform(coverFrame(A), vw, h, 0)`. Es el
     cuadro 16:9 llenando exacto un host virtual de `vw × h`, con su borde
     izquierdo en x = 0.
  2. La ventana visible (ancho `w`) se centra en la fracción `COVER_FOCUS_U`
     del ancho del cuadro, acotada para no salirse:
     `off = clamp(COVER_FOCUS_U · vw − w/2, 0, vw − w)`.
  3. `return { x: base.x − off, y: base.y, scale: base.scale }`.

`COVER_FOCUS_U = 0.35` es una constante exportada en `view.ts`, con
comentario: es la fracción del ancho del cuadro 16:9, desde su borde
izquierdo, donde se centra la vista en pantallas angostas. Se eligió para que
entren la ciudad, la fábrica y la isla.

Propiedades que salen de la regla y que hay que testear:

- **Continuidad en `a = A`:** con `w = vw`, `off = 0` y la vista coincide
  con la de hoy (la tecla 4 del lab sigue igual).
- **Sin sangrado vacío:** para `a ≤ A`, las cuatro esquinas de `viewCorners`
  caen dentro de `coverQuad(16/9)`, con tolerancia de coma flotante.
- **Más zoom en angostas:** la escala es `h / altoProyectado(coverQuad(16/9))`,
  siempre ≥ la de hoy. En celular sube de 0,83 a ≈1,23, lo que además hace
  legible el mapa.
- Con 4:3 la ventana es el 80 % del ancho, así que su centro queda acotado a
  [0,40, 0,60] y 0,35 se clava en 0,40. Recién por debajo de ≈1,25 el foco
  se aplica sin acotar.

### 2.2 `zoneView`: acotar al cuadro 16:9 cuando entra

`zoneView` ya usa `coverView(w, h).scale × ZONE_MIN_ZOOM` como piso, así que
hereda el zoom nuevo sin tocarlo. Hoy el resultado pasa por `clampToBleed`,
que deja ver hasta el borde del sangrado, incluidas las zonas sin construir.
Con el panel de contenido abierto, el host del mapa es angosto (en escritorio
2fr/5fr ≈ aspecto 0,8), así que esto pasa siempre.

Agregar `clampToCover(v, w, h)`. En coordenadas proyectadas, el cuadro 16:9
es un rectángulo alineado a los ejes de pantalla, así que el acotado es
**por eje** e independiente:

- en x: si `anchoProyectado16:9 · s ≥ w`, correr `v.x` lo mínimo para que el
  cuadro cubra `[0, w]`; si no entra, dejar x como venga;
- en y: lo mismo con el alto.

`zoneView` aplica `clampToCover` y después `clampToBleed`, que sigue siendo
la red de seguridad. Con el piso nuevo, para `a < A` el cuadro siempre entra
en alto; para `a > A` puede no entrar en ancho, y ahí manda `clampToBleed`
como hoy.

### 2.3 Lo que no cambia

- Los rótulos: `placeLabels` (`main.ts`) ya los pega al borde si su punto
  queda fuera del host.
- La generación del sangrado (`COVER_MARGIN`, `inCoverQuad(…, 16/9, …)`): el
  punto del cambio es no mostrar lo que no se construye, no construir más.
- `coverQuad`, `coverFrame`, `zoneFrame("cover")` y el lab.
- Pantallas con `a ≥ 16/9`.

## 3. Evidencia del prototipo

Se probó la regla 2.1 con un parche descartable sobre 1fa332c. En
`assets/2026-11-11-encuadre-por-aspecto/`:

- `cover-antes-despues.jpg`: pares antes/después en 390×750 (foco 0,35),
  820×1180 (0,35) y 1280×900 (0,40). En celular y tablet desaparece la franja
  vacía de arriba y entra la ciudad. En 4:3 la ciudad gana lugar y el mar
  abierto de la derecha pierde.
- `zona-resume-antes-despues.jpg` y `zona-portfolio-antes-despues.jpg`:
  vistas de zona en 1920×955 y 390×750, actual y con el piso nuevo. En
  escritorio la zona llena el host y no queda selva vacía arriba. En celular
  (host 40vh, aspecto ≈1,3) casi no cambia.

El prototipo no tenía `clampToCover`. Eso es nuevo de este spec y hay que
verificarlo con capturas.

## 4. Tests (`src/world/view.test.ts`)

Reemplazan o amplían los de `coverView` y `zoneView`:

1. Para cada tamaño de `SIZES` y además 390×750, 820×1180, 900×900 y
   1280×900, las esquinas de `coverView` caen dentro del sangrado (como hoy).
   Si `a ≤ 16/9`, también caen dentro de `coverQuad(16/9)`.
2. Continuidad: `coverView(1600, 900)` es igual, a 1e-6, a
   `fitTransform(coverFrame(16/9), 1600, 900, 0)`. El test actual del ancho
   1600 se queda.
3. Foco: en 390×750, la x de pantalla del punto del cuadro 16:9 en la
   fracción `COVER_FOCUS_U` es `w/2`. En 1280×900 (acotado) el borde
   izquierdo del cuadro está en x = 0 o el derecho en x = w, según qué lado
   acote.
4. Escala: para `a < 16/9`, `coverView(w, h).scale ≥` la escala de la regla
   vieja (calculada en el test con `fitTransform(coverFrame(w/h), …)`).
5. `zoneView` para las tres zonas y los tamaños de (1), más 768×955 (zona en
   escritorio) y 390×300 (zona en celular): las esquinas quedan dentro del
   sangrado con `VIEW_INSET`. En cada eje donde el cuadro 16:9 a esa escala
   cubre el host, quedan dentro de `coverQuad(16/9)`.
6. `clampToCover` es idempotente y no toca una vista que ya está adentro.

## 5. Verificación visual (en el PR)

Con agent-browser (ver `CLAUDE.md`; `localhost`, no `127.0.0.1`), capturas
del mapa en 390×750, 820×1180, 900×900, 1280×900, 1600×900 y 1920×955, y de
`/area/resume/`, `/area/portfolio/` y `/area/blog/` en 1920×955 y 390×750.
Criterios:

- en ninguna captura de mapa con aspecto ≤ 16:9 se ve una franja de suelo
  industrial pelado o de selva arriba;
- en 390×750 se ve la ciudad (edificios con ventanas encendidas) en al menos
  un tercio del ancho, y los tres rótulos son visibles;
- 1600×900 y 1920×955 son idénticas a las de antes del cambio.

Si 0,35 no cumple el segundo criterio después de los cambios de contenido que
hayan entrado a `main`, ajustar `COVER_FOCUS_U` y anotar el valor y el motivo
en el PR.

## 6. Fuera de alcance (posibles tickets aparte)

- **Arrastrar para recorrer** el mapa en celular dentro del cuadro 16:9.
- **Pantallas más anchas que 16:9** (8 % fuera del cuadro, a los lados): en
  las capturas de 1366×768 no se nota, pero el mismo criterio aplicaría
  acotando el ancho.
- Construir el sangrado para más aspectos que 16:9.
