# Tobogán gigante: reconstrucción como helter skelter

Fecha: 2026-11-16. Pieza: exhibit **Giant slide** (`tobogan`, `src/lab/exhibits.ts:176`),
builder `slide()` en `src/scenes/fair.ts:220`, constantes `SLIDE` en `fair.ts:42`.

Captura del estado actual: `assets/2026-11-16-feria/giant-slide.jpg`.
Referencias (Wikimedia Commons, CC BY-SA 2.0; créditos en `CREDITS.md`):
`assets/2026-11-16-helter-skelter-refs/01..06.jpg`. Las mejores para la
forma general son 01 (Margate) y 05 (Clacton). 02 (Goodwood) sirve para el
balcón de salida, la bandera y el techo cónico, y 04 para la salida y las
alfombras.

## Problema

La pieza actual es una torre cuadrada de deck de 4×4, un cono de cobre, una
escalera y 24 escalones `rotBox` sueltos en espiral, cada uno con su propia
baranda. Se ven como piezas sueltas sin sentido: no hay rampa continua ni
silueta reconocible. El dueño pidió **reconstruirla por completo** como un
helter skelter clásico de feria británica.

## Diseño

### Forma (lo que tiene que leerse en iso, en este orden de prioridad)

1. Una **torre troncocónica** tipo faro, con **franjas verticales alternadas**
   bien marcadas.
2. Encima, una **linterna** más angosta con ventanas en arco, un **domo o cono
   a gajos** y una **bandera**.
3. Una **canaleta continua** de un solo color que envuelve el cuerpo en
   diagonal unas 2 a 2.5 vueltas. Los tramos se unen borde con borde: nunca
   escalones separados.
4. Una **salida recta** a nivel del piso, la **puerta** de entrada con sus
   escalones y las **pilas de alfombras**.

### Proporciones (de las referencias, en múltiplos del diámetro de base D)

| Parte | Referencia | Objetivo en la pieza |
|---|---|---|
| Altura de la torre hasta la punta del techo (sin bandera) | 2.0–2.4 × D | ≈ 15 u con D ≈ 7 (r base 3.5) |
| Diámetro arriba del tronco | D / 1.6–1.8 | r ≈ 2.1 |
| Facetas del cuerpo | 12–16 | 12 o 16 lados |
| Linterna: diámetro / alto | 0.5–0.6 × D / 0.15–0.2 × altura | r ≈ 2, alto ≈ 2.5 |
| Ventanas de la linterna | 6–8 en arco | 6–8 plates (`disc`/`rect`) |
| Techo | domo a gajos o cono, alto 0.4–0.6 × diámetro de la linterna, alero 5–10 % | `dome` o `cone`, alto ≈ 1.5 |
| Bandera | asta ≈ 0.3 × alto de la linterna, Union Jack | asta `beam` + paño `poly` fino; **punta ≤ 18.5** |
| Balcón de salida | balcón con baranda que sale de la linterna | prisma chico + baranda, donde arranca la canaleta |
| Canaleta: vueltas | 2–2.5 | 2.5 |
| Canaleta: inicio / fin | arranca a 0.75–0.8 × altura, bajo la linterna | de z ≈ 11.5 a z ≈ 0.4 |
| Canaleta: ancho | 0.12–0.15 × D | ≈ 1.1 |
| Canaleta: sección | U, lecho plano con pared exterior de 0.4–0.5 × ancho | lecho + pared exterior ≈ 0.5 alto, con un filete claro arriba |
| Canaleta: montaje | pegada a la torre, sigue la conicidad (el radio baja al subir) | radio interior = radio de la torre a esa z + holgura mínima (ver profundidad) |
| Soportes | solo ménsulas diagonales desde la torre, cada 30–45° | `beam` de acero cada ~40° |
| Salida | la última media vuelta se aplana y sale tangente, recta, 0.5–0.8 × D, a la altura de la rodilla | tramo recto ≈ 5 u a z ≈ 0.4 sobre un deck bajo |
| Puerta | ≈ 0.15 × D de ancho, ≈ 0.12 × altura, cartel arriba | plate o prisma oscuro + tablero |
| Escalones de entrada | 6–10 con pasamanos | escalones cortos con pasamanos |
| Alfombras | pilas de 10–20 alfombras de coco marrón | 2 pilas de `deck` al pie de la salida y junto a la puerta |
| Cerco | cerco bajo de estacas alrededor de la base | opcional, si entra en el presupuesto |

### Color y materiales (solo `FAIR_MATS`, `fair.ts:56`)

- Cuerpo: franjas verticales `whitewash` / `signal`, una por faceta, pintadas
  con `plates` del cilindro (`src/iso/plate.ts`). Opcional: un rombo `safety`
  en cada franja roja (como en Margate y Clacton) y una banda de chevrons en la
  base.
- Canaleta: `signal` o `safety`, de un solo color, con un filete claro
  (`whitewash`) arriba de la pared exterior.
- Techo: gajos `signal`/`whitewash`, o `copper`.
- Ménsulas y barandas: `steel`. Alfombras y deck de salida: `deck`.

### Luces

**Ningún accent `dot`.** El dueño no quiere las luces redondas con halo (ver
#395), y la luz ámbar de la punta actual (`fair.ts:234`) se va. Si hace falta
brillo, que sea un accent `poly` fino sin halo, por ejemplo un filete en la
pared de la canaleta o en las costillas del techo, y con moderación. La pieza
se tiene que leer bien sin luces.

### Construcción (primitivas)

- **Tronco cónico:** no hay primitiva de tronco de cono. Apilar 3–4 cilindros
  de radio decreciente con el mismo número de lados, o rebanar la torre en
  bandas horizontales (ver profundidad). El escalonado no se tiene que notar:
  las franjas deben seguir alineadas de banda a banda.
- **Canaleta:** `beam` es la única primitiva que se inclina libremente. Armar
  el lecho como una cadena de `beam` (w ≈ 1.1, h ≈ 0.15) con extremos sobre la
  hélice cada 10–15°, y la pared exterior como una segunda cadena de `beam`
  angostos y altos. Los extremos compartidos garantizan la continuidad. No usar
  `rotBox`/`poly`, que tienen la cara de arriba plana y dan escalones, ni
  `ramp`, que solo inclina en los ejes.
- Linterna: `cylinder` con plates de ventanas. Techo: `dome` (rings) o `cone`.

### Profundidad (riesgo principal)

`src/iso/depth.ts` (`isBehind`) ordena sólidos enteros por separación de AABB
en x, y o z. Un tramo de canaleta cuyo AABB se superpone con el de la torre en
x e y, a la misma z, no tiene eje separador. En las diagonales, una canaleta
pegada a una torre redonda cae justo en ese caso, y el orden queda ambiguo.

Hay que resolverlo con una de estas dos opciones (o las dos), y verificarlo
visualmente:

- tramos cortos y radio interior de la canaleta ≥ ~1.4 × el semiancho de la
  torre a esa altura, o
- la torre rebanada en bandas horizontales (una por media vuelta), para que
  cada tramo quede separado en z de las bandas de arriba y de abajo.

La canaleta no puede quedar tapada por la torre en la cara visible, ni la torre
asomar por encima de la canaleta.

### Restricciones (tests existentes)

- Altura máxima (`fair.test.ts:41`): todo sólido no esbelto con max z ≤ 18.5.
  Los `beam` cuentan. **Bandera incluida, todo ≤ 18.5.**
- Presupuesto (`fair.test.ts:20,349`): sólidos elevados de toda la feria en
  (250, 700], accents ≤ 200. La pieza actual usa ~30 sólidos, y la nueva
  probablemente use ~70–90. Medir el total.
- Huella: dentro de la feria (x ≥ 83.5, y en [−312, −167.5], zona portfolio).
  No hay ningún otro sólido en x 100–136, y −312…−270, así que la pieza puede
  crecer hasta un radio de ~10 alrededor de `(118, −292)`, salida incluida
  (manteniéndose dentro de y −310…−272). Vecinos más cercanos: el tren
  fantasma (x 98–118, y −258…−246) y la casa de espejos (x 124–140,
  y −258…−246). El test de piezas nuevas (`fair.test.ts:327-339`) prohíbe que
  se superpongan.
- Modo `legacyOnly` (`fair.test.ts:325`): la pieza no existe en legacy.

### Tests a reescribir

Hay que reescribir el bloque "giant slide (#327)" (`fair.test.ts:194-212`),
que hoy fija el deck 4×4×14, el cono 3×2, ≥ 24 escalones a r 5, ≥ 24 vigas y
el dot ámbar, para que fije la forma nueva:

- `SLIDE` con las dimensiones nuevas (r de base, alto, vueltas).
- Un tronco con radio decreciente con la altura y franjas alternadas
  (plates de dos materiales en facetas consecutivas).
- La canaleta como cadena continua: el extremo `to` de cada tramo coincide con
  el `from` del siguiente (tolerancia 1e-6), z estrictamente decreciente,
  ≥ 2 vueltas y radio que crece al bajar.
- La salida recta tangente al final de la hélice, a z ≤ 0.6.
- Cero accents `dot` en la pieza.
- La punta de la bandera ≤ 18.5.

Actualizar también el comentario de `SLIDE` en `fair.ts:41`.

## Inventario (el PR lo tilda contra capturas del storybook)

- [ ] Tronco cónico de 12–16 facetas con franjas verticales `whitewash`/`signal`
- [ ] Rombos o chevrons (opcional)
- [ ] Linterna más angosta con 6–8 ventanas
- [ ] Balcón de salida con baranda en la linterna, donde arranca la canaleta
- [ ] Techo a gajos (domo o cono) con alero
- [ ] Bandera en asta, punta ≤ 18.5
- [ ] Canaleta continua de 2.5 vueltas, lecho + pared exterior + filete claro, sin escalones visibles
- [ ] Ménsulas diagonales de acero cada ~40°
- [ ] Salida recta tangente a nivel del piso, sobre deck bajo
- [ ] Puerta con cartel y escalones con pasamanos
- [ ] 2 pilas de alfombras
- [ ] Sin accents `dot`
- [ ] Orden de profundidad correcto en toda la vuelta (capturas en el storybook con `?c=` cercano, y en el mundo)

## Criterios de aceptación

1. El exhibit Giant slide se lee como helter skelter: tronco rayado, linterna
   con techo y bandera, canaleta continua y salida. El PR adjunta capturas
   antes y después del storybook (desktop 1600×900 y teléfono ≈ 412×915, 2×) y
   del sitio, en la zona de la feria.
2. La canaleta no muestra cortes, escalones ni errores de orden contra la
   torre en ningún ángulo visible.
3. Se respetan los tests de altura, presupuesto, huella y legacy, y el bloque
   del tobogán está reescrito como arriba.
4. `npm test` y `npm run typecheck` pasan.
