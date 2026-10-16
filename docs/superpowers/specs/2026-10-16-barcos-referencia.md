# Barcos de referencia para el mapa isométrico

**Fecha:** 2026-10-16
**Estado:** documento de referencia; las secciones de estilo se completan por tareas
**Issues:** #57 (flota de barcos del mapa) y #59 (este documento). Lo consumen #60, #61 y #62 para remodelar cada barco.
**Alcance:** reunir, para cada estilo de barco, los datos reales, los enlaces a fotos de referencia, los rasgos de silueta y una traducción a la escala y al kit del mapa. No cambia código.

Este documento es solo de enlaces: no se copia ninguna imagen al repositorio. Cada foto se cita con la URL de su página de origen y una descripción de qué ángulo muestra y qué se puede medir en ella.

## Escala y caja

- **Escala:** 1 u ≈ 1.5 m. Un barco de 90 m de eslora ocupa 60 u. La eslora real se divide por 1.5 salvo donde se aclare otra cosa.
- **Caja de una ruta:** 60 u de eslora total (incluido el empujador en el caso de `barge`), 10 u de manga y ningún sólido por encima de z = 13.
- **Agua:** z = −1. La cubierta queda en z = −1 + h, donde h es el parámetro de altura del casco en el kit. Las alturas se miden desde el agua, no desde z = 0.
- **Altura:** cuando el calado aéreo real supera unos 21 m (z = 13 equivale a 14 u sobre el agua, es decir 21 m), se comprime para entrar en la caja. Cada sección de estilo dice qué se comprimió y cuánto.
- **Objetivos por barco:** `cargo` 60 × 10 u, `tug` 19 × 7 u, `barge` 40 × 8 u de barcaza más empujador de 20 × 7 u (60 u en total).
- **Coordenadas locales de las piezas:** x crece de popa a proa (la popa está en 0), y crece hacia estribor. El kit rota esas coordenadas por el rumbo (`heading`) del barco.

### Proyección y caras visibles

`src/iso/project.ts` proyecta un punto del mundo (x este, y sur, z arriba) así:

- `xs = x − y`
- `ys = (x + y) / 2 − z · Z_SCALE`, con `Z_SCALE = 1.4`

La cámara mira desde la dirección `VIEW_DIR = normalize(1.4, 1.4, 1)`, y `tessellate` descarta toda cara cuya normal no tenga producto punto positivo con ella. Con esa dirección solo se ven tres caras de un sólido alineado a los ejes: la superior, la que mira a +x y la que mira a +y. Las caras que miran a −x y a −y nunca se ven.

Para un barco con rumbo 0 (local = mundo) eso significa que se ve la cubierta, la cara de proa (+x) y la de estribor (+y); la popa y el costado de babor quedan ocultos. Con otro rumbo cambia qué extremo del casco da hacia la cámara. Para decidir qué detallar, conviene pensar en los lados que la cámara ve en cada ruta y no repartir el esfuerzo en partes ocultas.

Dos consecuencias para el modelado:

- La exageración vertical estira todo 1.4 veces en pantalla: una altura de 1 u pesa más en la imagen que 1 u de eslora. Las superestructuras bajas ya se leen bien; las altas se comprimen primero.

## Kit y materiales

El kit local es la interfaz `Kit` de `src/scenes/ships.ts`. Cada barco es una función `(k, spec, solids, lights)` que empuja piezas a dos listas. Firmas (coordenadas locales, rotadas por el rumbo):

- `hull(dx, len, beam, h, sheer, topMat)`: casco lofteado (`kind: "hull"`). La obra viva usa siempre el material `hull`; `topMat` pinta la obra muerta y la cubierta se pinta con `deck`. `sheer` es el arrufo. El anillo de cubierta es fijo (`DECK_RING` en `src/iso/solids.ts`): popa redondeada, manga máxima al 57 % de la eslora, proa en punta. No se puede cambiar el contorno desde el kit.
- `box(dx, dy, w, d, z, h, mat, facade?)`: caja con huella rectangular. Produce un sólido `poly` (`kind: "poly"` con huella de cuatro puntos, no un `prism`), con fachada opcional (`Facade`: filas, columnas y ventana) en las paredes. `z` es la altura de la base, `h` el alto.
- `cyl(dx, dy, z, r, h, mat)`: cilindro de 8 lados (`kind: "cylinder"`).
- `dot(dx, dy, z, r, color)`: luz puntual, un acento.
- `poly(pts, color, alpha)`: polígono plano translúcido de color de acento. Es un acento, no un sólido, y no cuenta contra el presupuesto de sólidos. Los barcos actuales lo usan para las ventanas encendidas del puente.

`prism` y `cone` existen como sólidos en `src/iso/solids.ts` (`prism` con techo plano, a dos aguas o escalonado; `cone` de `sides` lados, 6 por defecto), pero el `Kit` no los expone. Una tarea que los necesite agrega un helper al kit; no está resuelto en este documento. Las secciones de estilo pueden citarlos en las piezas sugeridas, con la salvedad de que requieren ese helper.

### Presupuesto

Decisión 3 de #57: hasta 40 sólidos y 8 luces por barco. En `barge` el límite cubre la barcaza y el empujador juntos. El casco cuenta como un sólido. Los `poly` de acento cuentan como luces.

### Materiales (`ISO_TONES`)

La lista de materiales es `ISO_TONES` en `src/map/palette-iso.ts`; el tipo `Material` es `keyof typeof ISO_TONES`. No existe `ISO_MATERIALS`, aunque el issue use ese nombre. Cada material tiene cinco tonos (`top`, `lit`, `shade`, `up`, `down`) y los sólidos los eligen por la normal de cada cara. Hoy los barcos usan los siete de `SHIP_MATS`: `hull`, `hullBlue`, `whitewash`, `steel`, `rust`, `deck` y `glass`. Los demás del atlas que sirven para barcos:

- `hull`: obra viva del casco (rojo oxidado oscuro). El kit lo fija; no se elige.
- `hullBlue`: obra muerta azul de cascos y amuradas; también castillos de proa.
- `deck`: cubierta de madera o pintada; la aplica el casco solo.
- `whitewash`: superestructura blanca, puentes, casetas.
- `glass`: ventanas, puente acristalado; también como `base` de una fachada.
- `steel`: grúas, mástiles, cruceta, tapas de chimenea, barandas.
- `rust`: chimeneas, escotillas, tolvas, defensas; barcazas oxidadas.
- `concrete`: carga cubierta, lastre o bloques; gris cálido.
- `copper`: verdín de cubierta; instalaciones pintadas de verde azulado.
- `foam`: espuma y detalles claros chicos (pinturas blancas apagadas, cabos, boyas).
- `slab`, `rail`: grises pardos de apoyo para piezas de carga o contenedores neutros.
- `brick`: ladrillo cálido; contenedores o cargas rojizas.
- `stone`, `sand`, `rock`: cargas a granel (áridos) en la barcaza.
- `curtain`, `office`, `officeDark`: azules y violetas fríos; contenedores de color o estructuras apagadas.
- `leaf`, `leafDark`: verde; contenedores o pintura verde (poco uso).

El agua (`shallow`, `water`, `waterDeep`, `abyss`) y `glint` no se usan en barcos. Las piezas sugeridas solo pueden nombrar claves de `ISO_TONES`.

### Acentos (`ACCENT_COLORS`)

Para luces y ventanas encendidas: `cyan`, `cyanMid`, `cyanBleed`, `amber`, `amberMid`, `amberBleed`, `magenta`, `magentaMid` y `magentaBleed`. Los acentos no se oscurecen con el crepúsculo, así los neones destacan sobre la escena. La convención actual de luces de navegación en los cuatro barcos:

- `magentaMid`: luz de tope, en el mástil o sobre el puente (punto de radio 0.7).
- `magenta`: luz de babor (punto de radio 0.4).
- `cyanMid`: luz de estribor (punto de radio 0.4).

La lancha de la feria (`ferry`) suma una `amber`. Los `magentaBleed` translúcidos de `poly` sirven para ventanas encendidas.

## `cargo` — Damen Combi Freighter 3850

Sección a completar en la tarea 2 del plan.

## `tug` — Damen ASD Tug 2810

Sección a completar en la tarea 3 del plan.

## `barge` — Empujador fluvial de tres cubiertas con barcaza tolva Jumbo Mississippi

Sección a completar en la tarea 4 del plan.

## Decisiones

Heredadas del plan de #57:

- `cargo` pasa a ser el Damen Combi Freighter 3850 y reemplaza al carguero genérico actual.
- `tug` pasa a ser el Damen ASD Tug 2810.
- `barge` pasa a ser un empujador fluvial con una barcaza tolva Jumbo del Mississippi. La barcaza va por delante y el empujador queda apoyado contra su popa, como en la operación real.
- Los identificadores de `ShipKind` (`cargo`, `tug`, `barge`, `ferry`) se mantienen, para no tocar las rutas ni la animación.
