# Barrio residencial costero en lugar de los labs del distrito tecnológico

**Fecha:** 2026-10-27
**Estado:** implementado en #249–#256 (rama `feature/240-barrio-costero`); los desvíos y la medición están en §11
**Alcance:** convertir la parte lejana del distrito tecnológico de Resume (los
"laboratorios" y los "atrios", al sudoeste de la ciudad, sobre el estuario) en
un **barrio residencial costero** que se entienda de un vistazo:

- monoblocks;
- casas bajas con techos de teja;
- una escuela;
- un club con cancha;
- plazas;
- una costanera con faroles sobre el muelle.

Ítem 4 de la captura anotada
(`assets/2026-10-27-anotaciones/mapa-anotado.jpg`, recorte `barrio-4.jpg`).

## 1. Situación actual

El área la genera **`src/scenes/tech.ts`** (`tech(zoneRng(seed, "cv", 2))`,
`world.ts:73`) sobre la grilla de **`src/scenes/sprawl-grid.ts`**:

- manzanas de 24×18;
- columnas `SUBURB_COLS` −84..−264 y `WEST_COLS` −48..162;
- filas `SUBURB_ROWS` 328..640, cada 24;
- una manzana existe si su centro cae en el cover con margen 30 y si
  `urbanAt` vale en sus esquinas.

`pickKind` (`tech.ts:38-46`) elige el tipo por distancia al contenido
(`dist`):

1. landmarks fijos (TELECOM, ARENA, AUDITORIUM);
2. parque 12 %;
3. torre si dist < 60;
4. campus o atrio si dist < 160;
5. lab en el resto.

Con la semilla del mundo hay 106 manzanas: 36 torres, 21 atrios, 17 campus,
17 labs, 12 parques y los 3 landmarks.

Por qué se ve monótono:

- **17 labs idénticos.** `lab()`, `tech.ts:101-108`: siempre una caja
  `officeDark` de 20×13×5 en el mismo lugar, 4–6 equipos de techo en
  zigzag, paneles `glass` casi negros y autos. **Sin ninguna luz.** Llenan
  el rectángulo de filas 496–592 × columnas 42..162.
- **~6 atrios copiados** al lado. `atrium()`, `:88-98`: dos placas
  `curtain` de 9×13 con offsets fijos, que solo cambian de altura, y nunca
  se encienden.
- `officeDark` y `glass`, oscurecidos, casi no se distinguen del asfalto.
  No hay ningún programa reconocible.
- **El muelle** es una sola franja `plaza`: `quay()`, `:164-168`, x 192..198,
  y 324..624, con bolardos. No tiene paseo, faroles ni gente.

El área es la esquina inferior izquierda de la vista cover (u ≈ 0..0.17,
v ≈ 0.60..0.82). El rótulo RESUME (`LABEL_AT.cv = (76, 446)`, `src/main.ts`)
queda encima de la ARENA (102, 448): **no se mueve**.

## 2. Objetivo y criterio de éxito

Que esa esquina se lea como **barrio residencial porteño frente al río**:
torres de vivienda con ventanas encendidas, techos de teja de casas,
una escuela, un club, plazas con árboles y una costanera iluminada.

Éxito:

- en la vista cover, alguien que no conoce el proyecto puede decir "es un
  barrio de viviendas junto al río";
- **ninguna manzana tiene la misma disposición que su vecina** (test, §6);
- cada pieza del inventario (§4) se ve en su exhibit del storybook.

## 3. Referencias

Fotos de licencia libre en `docs/superpowers/specs/assets/barrio-refs/`, con
créditos en `CREDITS.md`. **Mirarlas antes de modelar.**

| Pieza | Modelo real | Fotos |
|---|---|---|
| Monoblocks | **Barrio Simón Bolívar**, Parque Chacabuco: placas largas y finas (6–8:1) alrededor de un parque arbolado | `monoblocks/01`–`05` |
| Casas | **Ciudad Jardín Lomas del Palomar** y chalet californiano de Ituzaingó | `casas/01`–`05` |
| Escuela | **Escuela N.º 11 Florentino Ameghino** (La Plata): bloque largo de 2 pisos con zócalo verde y torres de ladrillo | `escuela-club/01`–`03` |
| Club | **Club Pedro Echagüe** (Floresta): frente a la calle con gimnasio de bóveda detrás; cancha de básquet de plaza (Munro) | `escuela-club/04`–`06` |
| Costanera | **Costanera Norte** (Av. Rafael Obligado): baranda calada, paseo, bicisenda, tipas, faroles, carritos, pescadores | `costanera/01`–`05` |

## 4. Diseño

### 4.1 Zonificación

En `pickKind`:

- **`atrium` y `lab` desaparecen.**
- Los landmarks (TELECOM, ARENA, AUDITORIUM), las torres (dist < 60), los
  campus y los parques **se quedan**. La franja de campus pasa a ser la
  transición entre las oficinas y el barrio.
- Tipos nuevos, en lugar de los atrios y los labs:
  - **monoblock**, más cerca de la ciudad: aprox. dist 60..130;
  - **casas**, más lejos: dist ≥ 130;
  - **escuela** y **club**: manzanas fijas y sin rng, como los landmarks,
    elegidas por el plan dentro de la parte **visible** del cover (filas
    496–568 × columnas 102..162 están adentro). Ninguna de las dos queda
    debajo del rótulo RESUME;
  - **plaza** de barrio con juegos: reemplaza parte de los parques
    genéricos dentro del barrio.
- Con la zonificación final, el barrio tiene al menos 2 manzanas de
  monoblocks, 4 de casas, 1 escuela, 1 club y 2 plazas visibles en la
  vista cover. El plan anota la tabla final de tipos por manzana.

### 4.2 Inventario por tipo (casillas para el PR)

**Monoblock (Simón Bolívar).** Una o dos placas por manzana, separadas por
parque.

- [ ] Placas largas y finas (≈ 20×5 en la manzana de 24×18), de **3 alturas
      distintas** dentro del tope de altura (`MAX_TECH_H` = 20).
- [ ] Revoque claro (`whitewash` o `stone`), planta baja de ladrillo
      (`brick`) en algunas.
- [ ] Fachada en grilla: pilastras que marcan vanos (`facade` con `piers`),
      ventanas chicas y **una o dos columnas de loggias** a todo lo alto con
      baranda.
- [ ] **Torre de tanques** sobre cada núcleo de escalera, un piso arriba de
      la azotea, 2–3 por placa, con antena.
- [ ] Parque entre placas: césped, árboles altos (conos `leaf`), senderos y
      faroles. No hay estacionamiento adentro.
- [ ] De noche: **ventanas encendidas al azar**, ≈ 30–45 % en ámbar, con
      variación entre placas. Las loggias encendidas se leen como franjas
      verticales.

**Casas (Ciudad Jardín / chalet californiano).** De 4 a 6 casas por
manzana, en lotes con retiro.

- [ ] Casas de 1–2 pisos, planta cuadrada o en L, con **techo de teja** a
      dos o cuatro aguas. Material nuevo `tile` (terracota); si la estación
      (`2026-10-27-estacion-terminal-design.md`) ya lo creó, se reusa.
- [ ] Variedad por rng en cada manzana: cantidad, orientación de la
      cumbrera, revoque claro o ladrillo, piñón al frente o ala lateral,
      chimenea, cochera con techo propio.
- [ ] Jardín delantero con **muro bajo** de ladrillo con reja oscura (o
      cerco vivo), y entrada de auto.
- [ ] **Árboles de vereda** (tipas, plátanos) en la línea de la calle y
      postes de luz.
- [ ] De noche: luz cálida en algunas ventanas y en la puerta. El
      conjunto es más tenue que los monoblocks.

**Escuela (Ameghino).**

- [ ] Bloque largo de 2 pisos (8–10:1) sobre la calle, revoque crema, con
      **zócalo verde oscuro** a todo lo largo: la firma de la escuela
      pública argentina. Material nuevo o `copper` si lee.
- [ ] **Dos torres de ladrillo** de ≈ 3 pisos que enmarcan la entrada, con
      remate y escudo (placa).
- [ ] Ventanas altas pareadas en vanos regulares entre pilastras.
- [ ] Patio detrás, en la cara visible si se puede: piso de baldosas,
      **mástil con bandera** y un patio cubierto (techo sobre columnas).
- [ ] De noche: farol de entrada y la caja de escalera encendida.

**Club (Pedro Echagüe + cancha).**

- [ ] Frente de 3 pisos sobre la calle, con **cartel azul y amarillo**
      (placa) y ventanal de escalera.
- [ ] **Gimnasio** detrás: nave con techo de **bóveda rebajada**,
      aproximada con faldones (`ramp`) o un `poly` de varios lados si no hay
      primitiva, y **banda de ventanas altas** encendidas.
- [ ] **Cancha al aire libre** de básquet, o de fútbol 5, pintada (azul y
      verde), con aros o arcos, cerco de alambre (`beam` finos) y 1–2
      torres de luz.
- [ ] De noche: el gimnasio y la cancha iluminados, el punto de luz del
      barrio.

**Plaza de barrio.**

- [ ] Senderos en diagonal, árboles, bancos y faroles.
- [ ] **Juegos**: hamacas, tobogán y calesita (cilindro bajo con techo
      cónico).
- [ ] Una **cancha** chica o un arenero.

**Costanera (Costanera Norte), sobre el muelle** (`quay()`, x 186..198,
y 324..624; la calle x 186..192 puede volverse paseo).

- [ ] **Baranda calada** sobre el borde del agua: postes cuadrados con
      capitel y paños con calados, como placas oscuras repetidas.
- [ ] **Paseo** de hormigón, cantero o seto, **bicisenda** (franja de
      asfalto con línea blanca) y franja de tierra con **tipas** grandes.
- [ ] **Faroles** altos y finos cada ≈ 15 u, con cabeza encendida (acento
      cálido), que dibujan la línea de la costa de noche.
- [ ] **Carritos** con sombrilla roja (`signal`) y mesitas, cada uno con un
      punto de luz cálido. 2–4 en todo el largo.
- [ ] **Pescadores** apoyados en la baranda: figuras mínimas (≥ 0.15 u) con
      caña (`beam` fina), 3–6 en total.
- [ ] Bancos y cestos.

### 4.3 Calles

Las calles del barrio siguen la grilla. Faroles de vereda en las manzanas
de casas y de monoblocks, con luz de sodio: acento ámbar, la regla de
Resume.

## 5. Reglas

- **Sin el kit de `feature/35-resume-nivel-2`.** Esa rama no está en `main`.
  Se modela con lo que hay en `main`: `prism` (techos flat, gable o step),
  `poly`, `ramp`, `cylinder`, `cone`, `beam`, `facade` con sus opciones,
  placas y `facadeAccents`. Si hace falta un techo a cuatro aguas
  (`hip`), se agrega al kit con sus tests.
- **Determinismo.** `tech` tiene su propio rng. Cambiar el orden de consumo
  re-sortea las manzanas siguientes; eso está permitido, y los tests se
  escriben sobre propiedades, no sobre posiciones sorteadas. Escuela, club
  y landmarks no usan rng.
- **Reglas de modelado** de `2026-10-24-fabrica-detalle-design.md` §2: el
  detalle va en las caras +x, +y y el techo, con tamaño mínimo 0.15.
- **Luces.** Resume es ámbar; las coronas de neón cian y magenta de las
  torres siguen siendo la excepción. Las ventanas de las viviendas se
  encienden con el mismo mecanismo que las torres (`tech-anim.ts`,
  `scene.towers` o una lista nueva), con el tiempo de pared (no
  temporizadores propios, ver #192).
- **Presupuesto.** Hoy `tech` tiene ≈ 1186 sólidos elevados con el rng del
  mundo, con un tope de 1200 (`tech.test.ts`), y la región de los labs suma
  ≈ 913 caras. El tope del test puede subir, pero:
  - las caras de la región reemplazada no crecen más de **+25 %**;
  - las caras totales de `tech` no crecen más de **+10 %**;
  - se informan acentos, polígonos estáticos y tiempo de bloom
    (`BLOOM_BUDGET_MS`) antes y después, con el método del CLAUDE.md. El
    bloom ya está fuera de presupuesto (#229): este cambio no puede
    empeorarlo más de 1 ms.

## 6. Tests

- **Actualizar a propósito** `tech.test.ts`:
  - el test que fija la caja de lab (`officeDark` h 5, w 20) se va;
  - "más de 40 rampas `glass`" y "más de 10 carteles ámbar" se ajustan a
    lo que quede;
  - el tope de sólidos se recalcula con el presupuesto de §5;
  - siguen valiendo: zona cv, y ≥ 146, nada sobre el agua, altura
    ≤ `MAX_TECH_H` + 1.5, materiales en `TECH_MATS` (se agregan los nuevos),
    fachada en todo prisma grande.
- **Nuevo, variedad:** dos manzanas vecinas del barrio, de cualquier tipo,
  nunca generan la misma disposición (firma: tipo, cantidad y huellas de sus
  edificios redondeadas).
- **Nuevo, zonificación:** con la semilla del mundo, la tabla de §4.1
  (mínimos por tipo visibles en el cover) se cumple.
- **Nuevo, costanera:** faroles cada ≤ 16 u en todo el largo del muelle;
  baranda continua salvo en los accesos; nada sobre el agua.
- **Nuevo, luces:** las ventanas de monoblocks y casas son acentos ámbar y
  el porcentaje encendido queda en el rango de §4.2.
- `tech-anim.test.ts`, `tech-animator.test.ts`, `animators.test.ts`,
  `world.test.ts` siguen pasando.

## 7. Storybook y capturas

- Exhibits nuevos en `src/lab/exhibits.ts` (y en `CATALOG` de
  `exhibits.test.ts`, catálogo `tecnologico`, y en el índice del spec del
  storybook):
  - `monoblock`, `casas`, `escuela`, `club` y `plaza`: regiones de una
    manzana de cada tipo;
  - `costanera`: un tramo del muelle;
  - `barrio`: la esquina entera.
- El PR trae capturas **antes/después** de la vista cover del sitio
  (`http://localhost:5173/`, 1600×900 a 2x), un recorte de la esquina a la
  escala de `assets/2026-10-27-anotaciones/barrio-4.jpg` y los exhibits
  nuevos, en `docs/superpowers/specs/assets/2026-10-27-barrio/`.
- Cada casilla de §4.2 marcada en el PR, señalando dónde se ve.

## 8. Documentación

- Docstring de `tech.ts` y README (párrafo del mundo: "distrito tecnológico
  de Resume al oeste y al sur de la ciudad" pasa a contar el barrio).
- En `2026-09-15-mundo-3-tecnologico-feria-agua-barcos-design.md`, una nota
  arriba de la tabla de tipos que remita a este spec.

## 9. Criterios de aceptación

- [ ] `npm run typecheck` y `npm test` pasan, incluida la guarda de paleta.
- [ ] Sin `lab` ni `atrium`; zonificación de §4.1 con su tabla en el PR.
- [ ] Inventario §4.2 completo y marcado; exhibits nuevos.
- [ ] Tests de variedad, zonificación, costanera y luces.
- [ ] Presupuesto de §5 medido y anotado; bloom ≤ +1 ms.
- [ ] Capturas antes/después en el PR y en `assets/2026-10-27-barrio/`.
- [ ] Sección "Desvíos" al final de este spec.

## 10. Fuera de alcance

- Mover el rótulo RESUME o cambiar el encuadre de Resume.
- Las torres, los campus, los landmarks y la avenida del distrito
  tecnológico.
- Fusionar la rama `feature/35-resume-nivel-2`.
- Autos o gente en movimiento.

## 11. Desvíos

Lo que quedó distinto del diseño y lo que se midió al cerrar la historia.
"Antes" es b9550c5, el merge-base con `main` sobre el que se midieron
`TECH_FACES_BEFORE` y `REGION_FACES_BEFORE` y se tomó `cover-antes.png`.
`origin/main` ya tiene las costas de la isla (#237), que la rama no tiene:
medir contra él mezclaría ese cambio en los deltas.

### 11.1 Lo que la historia decidió distinto

- Ventanas por placas en banda en vez de `facade`, por presupuesto (#249, #250).
- Techos solo a dos aguas con `roofMat`, sin `hip` (#249, #251).
- Escuela de proporción ≈ 3:1 con fachada al este y vestíbulo con la puerta (#252).
- Exhibit `plaza-barrio`, porque el id `plaza` ya existía (#249).
- Plazas con césped liso en vez de `tiles`, y senderos `poly` en vez de `strip`,
  porque el césped tapa los `strip` (#254).
- Zonificación en pre-pase (`zoneKinds`), con damero monoblock/campus, plazas
  fijas y `blockParity` por índice de fila en `ROWS` en las filas de la ciudad
  (para `y ≥ 328` da lo mismo que la fórmula del diseño) (#249).
- Costanera con `ACCESSES = [400, 500, 600]` y su recorte de presupuesto:
  3 bancos, 3 cestos y sombrillas de 4 lados (#255).
- Casas: 4–5 por manzana (no 6), lote sur 0 vacío para la cochera y ala solo
  al este (#251).
- Monoblock: no emite las ventanas tapadas por la placa delantera
  (`occluded()`), porque `tech.homes` se dibuja sobre los sólidos (#250).
- Club: la luz de la banda sur solo en el tramo visible (#253).
- Sin cancha chica en la plaza: el spec pide "cancha o arenero" y quedó el
  arenero (#254).
- Tope de sólidos elevados de `tech` en `tech.test.ts`: `< 1700`. Medido
  N = 1505 sobre `tech(createRng(7))`; tope = `ceil(1505 × 1,10 / 100) × 100`.

### 11.2 Caras y acentos

Caras de `tech` (sólidos + suelo, `tech(zoneRng(SEED, "cv", 2))`):

| | antes | después | Δ |
|---|---|---|---|
| total del distrito (`TECH_FACES_BEFORE`) | 8458 | 8592 | +134 (+1,58 %) |
| región `BARRIO_REGION` (`REGION_FACES_BEFORE`) | 1286 | 1296 | +10 (+0,78 %) |
| acentos estáticos | 94 | 191 | +97 (+103,2 %) |
| acentos en el frame 0 de las capas `accent` | 508 | 1004 | +496 (+97,6 %) |
| acentos, suma | 602 | 1195 | +593 (+98,5 %) |

Caras por exhibit, medidas con `readout(cropScene(scene, e.box),
cropAnimators(animators, e.box)).faces`. "Antes" es la misma caja sobre el
mundo de b9550c5 (labs y atrios); el marcador es el valor que dio #249 con las
piezas mínimas, según los PRs de los hijos. El panel del storybook coincide
con el script en los siete.

| exhibit | antes (b9550c5, misma caja) | marcador (#249) | después |
|---|---|---|---|
| `monoblock` | 101 | 15 | 114 |
| `casas` | 52 | 25 | 55 |
| `escuela` | 52 | 6 | 86 |
| `club` | 55 | 6 | 80 |
| `plaza-barrio` | 46 | 16 | 58 |
| `costanera` | 49 | 94 | 221 |
| `barrio` | 1355 | — | 1529 |

Las cajas de "antes" son las de `src/lab/exhibits.ts`, corridas 3 u hacia atrás
en x e y: `monoblock` (132, 448), `casas` (132, 520), `escuela` (102, 520), `club`
(132, 544), `plaza-barrio` (132, 496) con 30×24; `costanera` (184, 480)–(199, 568);
`barrio` (40, 470)–(199, 612). Las caras del exhibit incluyen a los vecinos
que caen dentro de la caja (por eso `costanera` da 221 y `facesIn` del
rectángulo, 349).

Zonificación del mundo (`zoneKinds` sobre las 106 manzanas): 34 `tower`,
18 `monoblock`, 15 `campus`, 10 `park`, 7 `plaza`, 17 `casas`, 1 `escuela`,
1 `club`, 1 `telecom`, 1 `arena`, 1 `auditorium`. La tabla manzana por manzana
está en el PR.

### 11.3 Capturas y totals

Capturas en `assets/2026-10-27-barrio/` (1600×900 a 2x, PNG de 3200×1800):

- Cover del sitio: [antes](assets/2026-10-27-barrio/cover-antes.png) y
  [después](assets/2026-10-27-barrio/cover-despues.png).
- Esquina de Resume (recorte de los dos covers):
  [antes](assets/2026-10-27-barrio/barrio-4-antes.png) y
  [después](assets/2026-10-27-barrio/barrio-4-despues.png). La caja es la misma
  en los dos: esquina (5, 1002), 840×600 sobre 3200×1800, con el rótulo RESUME
  con su caja en ≈ (25, 50) del recorte.
- Mundo (`/lab/world.html?speed=0`, tecla `2`):
  [antes](assets/2026-10-27-barrio/mundo-antes.png) y
  [después](assets/2026-10-27-barrio/mundo-despues.png).
- Exhibit `barrio` (`/lab/storybook.html?speed=0#barrio`):
  [después](assets/2026-10-27-barrio/barrio-despues.png).

`totals` de `rendering.capture()` en `/lab/world.html` sin parámetros, en la
primera corrida caliente y después de la línea `[lab] bloom:` (antes de ella
el conteo no es estable). El modo de bloom fue `activo` de los dos lados.

| clave | antes | después |
|---|---|---|
| containers | 9 | 9 |
| graphics | 175 | 181 |
| meshes | 0 | 0 |
| sprites | 0 | 0 |
| texts | 0 | 0 |
| tilingSprites | 0 | 0 |
| nineSliceSprites | 0 | 0 |
| filters | 3 | 3 |
| masks | 0 | 0 |
| **suma sin containers** | **178** | **184** |
| instrucciones | 69 | 71 |

`drawCalls` salió 0 de los dos lados; no es fiable (ver `CLAUDE.md`).

### 11.4 Bloom

`/lab/world.html` sin parámetros, una carga fría descartada y tres corridas
calientes (recargas) por lado. De cada corrida, la línea `[lab] bloom: …` y el
primer `[lab] peor redibujo en 5 s: …` posterior.

```
antes (b9550c5, puerto 5174)
[lab] bloom: promedio 12.8 ms en 60 frames (tick 8.8 + render 4.0), presupuesto 15 ms → activo
[lab] peor redibujo en 5 s: 17.80 ms
[lab] bloom: promedio 12.7 ms en 60 frames (tick 8.7 + render 4.0), presupuesto 15 ms → activo
[lab] peor redibujo en 5 s: 20.00 ms
[lab] bloom: promedio 12.9 ms en 60 frames (tick 8.7 + render 4.1), presupuesto 15 ms → activo
[lab] peor redibujo en 5 s: 20.20 ms

después (rama, puerto 5173)
[lab] bloom: promedio 13.2 ms en 60 frames (tick 8.8 + render 4.4), presupuesto 15 ms → activo
[lab] peor redibujo en 5 s: 17.20 ms
[lab] bloom: promedio 13.1 ms en 60 frames (tick 8.9 + render 4.2), presupuesto 15 ms → activo
[lab] peor redibujo en 5 s: 21.40 ms
[lab] bloom: promedio 13.3 ms en 60 frames (tick 9.0 + render 4.3), presupuesto 15 ms → activo
[lab] peor redibujo en 5 s: 21.70 ms
```

| | antes | después | delta |
|---|---|---|---|
| mediana del promedio de bloom (ms) | 12.8 | 13.2 | +0.4 |
| mediana del peor redibujo (ms) | 20.0 | 21.4 | +1.4 |

La mediana del bloom sube 0,4 ms, dentro del +1 ms del criterio de §9 (que
es del bloom). La mediana del **peor redibujo** sube 1,4 ms, y eso sí supera
1 ms; el criterio no lo cubre, y el rango entre corridas es del mismo orden
(antes 17.8–20.2 ms, después 17.2–21.7 ms). Las seis corridas quedaron en
modo `activo`.

Entorno: Pixi 8.20.1, renderer webgl2, PixiJS DevTools enganchado
(`isPixiActive` = `pixi-active`); agent-browser 0.27.0 headless
(`--headless=new`), viewport 1600×900 a 2x.
