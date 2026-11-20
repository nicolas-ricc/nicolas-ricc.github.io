# WRITING sobre una balsa de tablones: del tablero a un objeto de suelo

**Estado:** implementado (historia #451, tareas #452–#457 y #460).
**Fecha:** 2026-11-20.
**Decisión registrada:** `docs/adr/0005-ground-signs-have-their-own-floors.md`.

## 1. Contexto

En #441 el cartel de Writing pasó a ser una tabla flotante con la palabra en Chainsaw Carnage. En pantalla no se leía como un objeto: era un rectángulo plano pintado sobre el agua, sin grosor, sin juntas y sin contacto con ella, y la palabra era chica (caja alta 11.5). La historia #451 lo reemplaza por una balsa de tablones: una malla de madera con vigas, juntas y bordes desparejos, flotando con espuma y sombra de contacto, con `WRITING` pintada encima como calcomanía y un balanceo de cuerpo rígido.

Para eso el oráculo de legibilidad tuvo que aprender a medir un cartel que yace en el suelo en lugar de uno de pared, y el nivel 3 tuvo que dejar de suponer tinta clara y bordes verticales.

## 2. Decisiones

### 2.1 La clase de suelo del oráculo

`groundDiagonal` (`src/kit/lettering.ts`) es el plano de texto de la palabra: u = (√½, −√½, 0) y v = (−√½, −√½, 0), ambos sobre el suelo. Proyectados, v mide 0.707 de su longitud y u 1.414, de modo que la palabra se ve a la mitad de su aspecto plano. Por eso un cartel `ground` espera `GROUND_ASPECT` 0.5 y no 1: el oráculo mide el error de aspecto contra 0.5. La caja de x se mide a lo largo de v; la base y las verticales no cambian. `roofDiagonal` queda (lo usan sus tests) pero la plataforma ya no lo usa.

El grosor del trazo se mide, cuando el cartel trae `bar`, como el menor entre el trazo a lo largo de u y la barra a lo largo de v. `CHAINSAW_BAR` es 0.15 cajas altas: la mediana de la corrida vertical de tinta en los brazos de la `G` medida a 300 px por caja alta (`G` 0.150, `T` 0.173, `R` 0.193, `N` 0.217, `W` 0.260). Manda la barra: con la cara del asta (`CHAINSAW_FACE`, 0.12) proyectada a lo largo de v el trazo saldría más fino de lo que se ve.

### 2.2 El tamaño y los pisos propios (#460)

El plan de #451 fijó la caja alta en 20 con los pisos verticales de `SIGN_RULES` (opción (a)). A caja 20 la caja de x medía 12.74 px a 1.17 y 9.04 px a 0.83 en reposo. El dueño decidió el 2026-11-20, en #460, preferir la palabra más chica y bajar los pisos solo para el cartel de suelo: `WRITING_CAP` 17.25 y `SIGN_RULES.ground`, que `checkSign` aplica a los carteles `ground` (los verticales conservan los suyos). La opción (a) queda descartada en el ADR 0005. Con 17.25, la palabra mide 72.56 u (120.06 px a 1.17; con caja 20 eran 139.20 px), la caja de x 10.99 px a 1.17 y 7.80 px a 0.83 en reposo, y la balsa 76.6 × 30.3 u. El barrido de 20 a 22 del issue queda superado: no hizo falta.

### 2.3 La calcomanía en la pasada de sólidos

`SignSpec.color` es opcional y aparece `SignSpec.decal`: la pintura es una calcomanía, es decir, caras del mismo `mesh` que la madera, en la pasada de sólidos. No hay capa de luces ni bloom que excluir (la capa `platform.lights` ya no existe). Con `decal`, `staticContrast` es el mínimo, sobre cada cara pintada, del contraste entre su tono y el de la cara receptora coplanar de otro material (el tablón que la recibe); sin receptora, 1. La lámina bajo los tablones es el respaldo del oráculo.

### 2.4 `mesh` y el orden del pintor

`Solid` gana `{ kind: "mesh"; faces; mat }`: caras con normal derivada del polígono, tono por `shadeTone` y emitidas en el orden de la lista, de modo que el orden del pintor dentro del sólido es estable a cualquier inclinación. La transformación rígida vive en `src/iso/rigid.ts` (`rotateAbout`, `rigid`).

### 2.5 La balsa

`src/scenes/raft.ts` (`raftAt`, `raftPlane`, `RAFT`, `REST_POSE`, `buildRaft`, `raftEnvelope`) construye un solo `mesh` por pose: sombra de contacto, espuma, vigas, lámina, y tablones de atrás hacia adelante con sus vetas, clavos y calcomanías. `RAFT` fija `plankW` 2.4, `joint` 0.15, `plankH` 0.5, `ragged` 0.3 (cada extremo se corre hasta ±0.3 u), tres vigas y la banda mojada (`wetZ`). El tono de un tablón es +0 o +1 de la escalera. El respaldo de la lámina abarca el bloque entero de tablones (con `BOARD_PAD` 1.7, subido de 1.6 en #460 por los extremos irregulares).

### 2.6 Materiales y contraste

`timber` (`top` 0xb0a78a) y `navy` (`top` 0x070c24) son dos `cityLadder` de `BASE_TONES`. Frente al techo de la paleta, la luminancia relativa de la madera es 0.388 y la del azul marino 0.0044: 8.05:1 en el plan; `staticContrast` mide 8.04:1 en vivo, por encima del piso de 7:1.

### 2.7 La pose rígida

`RaftPose = { dz, pitch, roll }`, rotando alrededor de un centro fijo del sitio; el plano de texto se posa igual, así los cuadriláteros del oráculo y las calcomanías coinciden. `HEAVE` sigue (±0.15 u, 6700 ms); `PITCH` ±1.5° con periodo 9100 ms (alrededor del eje transversal `RAFT_N`, horizontal y perpendicular a u) y `ROLL` ±1.0° con periodo 7300 ms (alrededor de u). Los ángulos se cuantizan a `ANGLE_STEP` 0.1°; las tres fases arrancan en 0, así que t 0 es el reposo, y el reloj es periódico en `POSE_CYCLE_MS`. El animador guarda una pose por sitio (un memo de una entrada), solo reporta cuando cambia la pose cuantizada (a lo sumo 250 veces en 10 s, 25 por segundo en promedio) y queda quieto con `reducedMotion`. `CYCLE_POSES` lista 17 poses (reposo, las 8 esquinas del cubo de poses y `poseAt(k · 7919)`), que muestrean el nivel 2 y la regla de barcos.

### 2.8 Carril y encuadre

`LANE_OUT` corre 15 u al este en su tramo sur, para que la balsa más larga quepa en el sitio angosto con las reglas de los barcos: (486, 347) pasa a (501, 347), (500, 405) a (515, 405) y el extremo de mar a (522.7, 506.4), sobre la misma dirección. `LANE_BACK` no cambia. El `zoneFrame` de Blog en el sitio `tall` termina en y 450 (era 440).

### 2.9 Nivel 3 para carteles de suelo

- El halo es simétrico, min(núcleo, huecos) / max(núcleo, huecos); con tinta oscura el cociente anterior, huecos / núcleo, daba 81.82.
- Las contraformas se rellenan con el círculo de 16 puntos llevado por el plano del glifo: una elipse sobre el plano de suelo, el mismo disco en las paredes.
- En un cartel `ground`, el OCR solo ve el área respaldada: la caja de tinta de cada letra más `backingW` · ancho en su plano; el resto queda blanco. Es el arreglo de recorte que pidió el dueño: el diagnóstico de #460 se confirmó, porque la entrada de 0.83 mostraba el borde de la balsa como un marco negro y el OCR leía `wWRiTinG`.
- `npm run legibility -- --tick <ms>` escribe `REPORT-t<ms>.md` (con la línea `Tick: <ms> ms`) y recortes `-t<ms>`; `REPORT.md` es la corrida en reposo.

**Desvío.** El plan decía que `--tick` llamaría a `window.__lab.tick`. Los exhibits de contexto de Writing dibujan la balsa estática (`contextScene`) y sueltan su animador, así que un tick del escenario no podría posarla (y `contentFrame` ya hace avanzar los animadores 8 s al cargar). En su lugar, el storybook lee `?tick=<ms>` (`tickFromSearch`, `src/lab/page.ts`), `contextScene(scene, e, tMs)` construye la balsa en `poseAt(tMs)`, `contextSign(e, tMs)` (`src/lab/crop.ts`) es el cartel del oráculo en esa pose, `window.__lab.tickMs` devuelve el tick y el script lo espera.

### 2.10 Lo que se dejó fuera

La variación de alto por tablón. Un tablón 0.03 más alto taparía la pintura del vecino (el respaldo bajaría de 1 y la oclusión subiría hasta un 5 %) y a la escala de la escena no se ve. Quedan la variación de tono y los extremos desparejos.

## 3. Medición

### 3.1 Nivel 2

Caja alta 17.25, en reposo y en la peor pose de `CYCLE_POSES`:

| Escala | Alto de x (px) | Trazo (px) | Aire (px) |
| --- | --- | --- | --- |
| 1.17 | 10.99 / 10.61 | 2.14 / 2.07 | 3.10 / 3.05 |
| 0.83 | 7.80 / 7.52 | 1.52 / 1.47 | 2.20 / 2.16 |

Contraste estático 8.04:1. Es la misma cifra en `wide` y `tall`.

### 3.2 Nivel 3

Tres corridas del 2026-11-20, todas con salida 0, en los dos sitios (`plataforma-escena`, `plataforma-escena-angosta`):

| Corrida | Escala | Contraste | Halo | OCR |
| --- | --- | --- | --- | --- |
| `REPORT.md` (reposo) | 1.17 | 7.99:1 | 0.01 | `WRITING` |
| `REPORT.md` (reposo) | 0.83 | 7.52:1 | 0.01 | `WRITING` |
| `REPORT-t7919.md` | 1.17 | 7.99:1 | 0.01 | `WRITING` |
| `REPORT-t7919.md` | 0.83 | 7.99:1 | 0.01 | `WRITING` |
| `REPORT-t15838.md` | 1.17 | 7.99:1 | 0.01 | `WRITING` |
| `REPORT-t15838.md` | 0.83 | 7.99:1 | 0.01 | `WRITING` |

RESUME y PORTFOLIO no cambian y siguen en ✓; el nivel 3 no excusa ninguna fila.

## 4. Capturas

Las capturas de `plataforma-escena-117`, `plataforma-escena-083` y `plataforma-real` (`assets/374-carteles/`), `plataforma-escena-angosta-117` y `sitio-1600x900-ancho` (`assets/423-composicion-responsive/`) se regeneraron en #457 con caja alta 17.25. Los recortes de nivel 3 están en `assets/carteles-legibilidad/` (con los sufijos `-t7919` y `-t15838`). Las de la balsa, con el [README](assets/451-balsa-tablones/README.md) y el del [balanceo](assets/451-balsa-tablones/balanceo/README.md):

- `assets/451-balsa-tablones/balanceo/balanceo-1.png`
- `assets/451-balsa-tablones/balanceo/balanceo-2.png`
- `assets/451-balsa-tablones/balanceo/balanceo-3.png`
- `assets/451-balsa-tablones/balanceo/balanceo-4.png`
- `assets/451-balsa-tablones/balanceo/balanceo-5.png`
- `assets/451-balsa-tablones/balanceo/balanceo-6.png`
- `assets/451-balsa-tablones/escena-ancho-117.png`
- `assets/451-balsa-tablones/escena-angosto-117.png`
- `assets/451-balsa-tablones/pieza-083.png`
- `assets/451-balsa-tablones/pieza-real.png`

## 5. Planes de las tareas

- `docs/plans/2026-11-20-452-cartel-de-suelo.md`: #452, el cartel de suelo en el oráculo.
- `docs/plans/2026-11-20-453-mesh-rigid.md`: #453, el primitivo `mesh` y la transformación rígida.
- `docs/plans/2026-11-20-454-balsa-tablones.md`: #454, la balsa de tablones.
- `docs/plans/2026-11-20-455-balsa-contacto-agua.md`: #455, el contacto con el agua y la textura.
- `docs/plans/2026-11-20-456-cabeceo-rolido.md`: #456, el cabeceo y el rolido.
- `docs/plans/2026-11-20-460-cap-17-pisos-suelo.md`: #460, la caja alta 17.25 y los pisos de suelo.
- `docs/plans/2026-11-20-457-nivel3-suelo-cierre.md`: #457, el nivel 3 y el cierre.

La historia también deja anotado en la spec 2026-11-15 §8.2 (entrada «WRITING sobre la balsa de tablones (#451)») los valores vivos, y en el ADR `0005-ground-signs-have-their-own-floors.md` la decisión de los pisos.
