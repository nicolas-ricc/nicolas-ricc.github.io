# Resume nivel 2: kit de formas, zonificación y luces — diseño

**Fecha:** 2026-10-15
**Estado:** aprobada en conversación; pendiente de plan
**Antecede:** `2026-09-14-resume-ciudad-design.md` (grilla, piezas fijas, rulings),
`2026-09-14-mundo-2-fabrica-distrito-blog-design.md` §6 (distrito),
`2026-09-15-mundo-3-tecnologico-feria-agua-barcos-design.md` §3 (tecnológico),
`2026-10-14-cyberpunk-crepusculo-neones-bloom-design.md` (paleta ×0.7, neones, bloom).
**Alcance:** la zona Resume dentro del contenido (`x −54..344`, `y 158..324`):
ciudad vieja, distrito moderno y las piezas fijas (puente, malecón, muelle
oeste, derrumbe, plaza). El motor puro (`src/iso/`) y la paleta. El distrito
tecnológico del sangrado, Portfolio y Blog **no** cambian en esta etapa; el kit
queda listo para que lo adopten después. La geografía (estuario, malecón,
costuras `x 344` / `y 146`, terreno) no se mueve.

## 1. Problema

El análisis de escena de 2026-10-14 sobre Resume encontró:

1. **Formas.** Todo edificio es un prisma rectangular con cornisa y un detalle
   de techo. Los cuatro tipos de manzana (torre, pareja, bajo en L, devorada)
   se distinguen por tamaño y no por forma. No hay patios, retranqueos
   asimétricos, curvas ni cubiertas.
2. **Color.** Cinco tonos por material, elegidos solo por la normal. Dos
   edificios vecinos del mismo material son idénticos; una pared de 18 de alto
   es un solo color.
3. **Planificación.** La grilla es correcta pero el contenido se sortea manzana
   por manzana con pesos globales: no hay barrios, no hay nodos salvo la plaza,
   y las cabeceras del puente están vacías. Según Lynch: bordes e hito bien;
   sendas secundarias, nodos y barrios flojos.
4. **Luces.** Un piso encendido en la torre, faroles ámbar, charcos, y desde la
   historia #11 carteles cian y magenta a media altura en las torres del
   distrito (`facadeSign`, h ≥ 12) y luces animadas en el malecón. Las
   ventanas comunes siguen siendo `glass` oscuro: no hay luz cálida o fría
   por ventana ni nada a nivel de calle.
5. **Kit.** No existe: `prism`, `tiles`, `lamp`, `campus`, `towerCrane` y
   `jungle` son las únicas piezas con función. Bolardo, auto, helipuerto,
   terraza verde y cartel están duplicados inline en dos o tres archivos con
   medidas distintas.
6. **Geometría barata y cara a la vez.** Los 663 `strip` de carriles son casi la
   mitad de la geometría de la zona y al zoom del sitio se leen como ruido.

## 2. Decisiones

| Tema | Decisión |
|---|---|
| Enfoque | Kit declarativo + zonificación (enfoque A de la conversación): recetas puras en `src/kit/`, mapa de barrios con catálogo en `src/city/zoning.ts`, luces en `src/city/lights.ts`; `city.ts` y `district.ts` pasan a ser orquestadores finos |
| Gradientes | Más tonos por material: escalera de **nueve** tonos en vez de cinco, fill plano por polígono. Sin mesh ni shader (ver alternativas descartadas) |
| Planificación | Zonificación + catálogo por barrio. El mapa de barrios y las piezas singulares van a mano; dentro de cada barrio el rng elige del catálogo con pesos |
| Formas | Las cuatro familias: manzana cerrada con patio, volúmenes compuestos y retranqueos, curvas y cubiertas, estructuras singulares |
| Neones | Barrio de bares en la ribera oeste junto al muelle: columnas `102..186`, filas `164..206`. Neones solo en frentes abiertos (avenida y calle del muelle) |
| Cálido / frío | Lo decide el barrio y el material: oficinas y muro cortina frías, residencial, bares y clásicos cálidas, el centro mezclado |
| Alcance | Ciudad vieja + distrito moderno + piezas fijas rehechas. Tecnológico después |
| Texturas | Siguen sin existir. Todo polígono plano con color de la paleta |
| Lo que ya hay de #11 | Se conserva: paleta ×0.7 vía `palette-base.ts` + `npm run palette`, bloom diferido, carteles de fachada del distrito y luces del malecón, helper `neon.ts` (`pulse`, `chase`, `flip`), guarda de acentos de Portfolio. El kit absorbe `facadeSign` como prop `sign`; las nuevas capas animadas usan `neon.ts` |
| Presupuesto | Ver §9. Sube, pero medido y con tope |

### Alternativas descartadas

- **Gradiente real por cara** (Mesh con color por vértice o shader): rompe el
  palette-guard, no se mide en el headless sin GPU, no pega con el papercraft
  facetado. Si algún día se quiere, va encima de esta capa, no en su lugar.
- **Manzana por manzana a mano**: control total pero no escala a las otras
  zonas y cada retoque es editar una tabla de 60 filas.
- **Agujeros genéricos en `poly`**: la manzana con patio no los necesita (ver
  §3) y obligarían a triangular el techo.
- **Sólido `ring` monolítico** (lo que se dijo en la conversación): se descarta
  por el orden de pintado. `sortByDepth` ordena por caja AABB; un anillo entero
  contiene su patio, así que un árbol en el patio se dibujaría antes que el
  anillo y la pared interior que mira a la cámara lo taparía. El patio se
  compone de **cuatro alas** (prismas que no se solapan), y entonces los
  objetos del patio se ordenan entre las alas correctamente. Misma regla para
  U y C.

## 3. Motor: primitivas (`src/iso/solids.ts`, `facade.ts`, `light.ts`)

### Orientación por sentido de giro

`extrude()` orienta hoy cada pared con el centroide del sólido (`face()`),
que falla en huellas cóncavas. Pasa a orientar por el sentido de giro de la
huella: **horario visto desde arriba = exterior**. La normal de la pared
`a→b` es la perpendicular que apunta hacia afuera según ese giro. `poly` queda
válido para L, U, C, T y chaflanes. El techo y la base no cambian. Los demás
sólidos (cone, hull, wheel) siguen como están.

Ruling de profundidad que acompaña: **nada ajeno a la receta entra en el hueco
de una huella cóncava** (una L, una U). Si el hueco tiene mobiliario, la receta
compone alas en vez de un `poly`. Test en el kit (§5).

### Sólidos nuevos

| Sólido | Campos | Caras | Uso |
|---|---|---|---|
| `dome` | `at` (centro de la base), `r`, `h`, `sides` (12..16), `rings` (3..4) | un cuadrilátero por anillo × meridiano, casquete final en triángulos; tono por normal | rotonda, palacio cívico, teatro, estación |
| `vault` | `at` (esquina NO), `len`, `w`, `h`, `axis: "x" \| "y"`, `segments` (6..8) | medio cilindro en franjas longitudinales más dos hastiales semicirculares | mercado cubierto, estación, galpones del muelle |
| techo `hip` en `prism` | `roof: "hip"` | cuatro faldones a `GABLE_RATIO`, cumbrera corta en el eje largo | residencial, bares, estación |

`cone` de 4 u 8 lados sigue siendo la pirámide y el chapitel.

### Fachada

- `facade` pasa a ser válido en `cylinder`: con 12..16 lados da fachada curva.
  `facadeFaces` ya trabaja pared por pared; solo cambia el `tessellateAll`.
- `base: "arcade"` nuevo: arcos de medio punto (6 segmentos por arco, uno por
  columna de la fachada) a `toneOffset −2`, con pilares entre arcos a
  `toneOffset −1`. Mismo mecanismo que `glass` y `portico`.
- **Gradiente por altura**: la fachada emite por piso una banda de pared del
  material del muro con `toneOffset` que sube con el piso: `0` en el tercio
  inferior, `+1` en el medio, `+2` en el superior, para edificios de ≥ 4 pisos;
  `0` y `+1` para 2..3 pisos. La pared cruda queda tapada.
- La fachada devuelve además la lista de ventanas (`windowPatches` ya existe)
  con su piso: la usa el kit para publicar `windows` (§5) y las luces para
  encender ventanas sueltas (§7).

### Tono por sólido

`Solid` gana `tone?: number` (−2..+2), un desplazamiento base que se suma a
todas sus caras antes del `toneOffset` de cada una. Permite variar edificios
vecinos del mismo material sin materiales nuevos. `tessellate` lo aplica; los
tests de paleta no cambian porque el color final sigue saliendo de `toneColor`.

## 4. Paleta de nueve tonos (`src/map/palette-iso.ts`)

`TONE_LADDER` pasa de cinco a nueve, de oscuro a claro:

```
deep, shade, dim, lit, down, top, up, pale, glow
```

`shadeTone` sigue devolviendo uno de los cinco de siempre (`shade lit down
top up`) por la normal; `toneOffset` y `tone` se mueven por los nueve. Todo
material recibe las nueve entradas, agua incluida (así `water-anim` no cambia).

Los cuatro tonos nuevos se definen sobre `BASE_TONES` de `palette-base.ts`
(la paleta sin oscurecer) con la regla de abajo, y `scripts/darken-palette.ts`
(`npm run palette`) los oscurece ×0.7 junto con los cinco de siempre e imprime
los literales que se pegan en `palette-iso.ts`. El test existente "base ×
DARKEN por canal (±1)" cubre los nueve. La regla, aplicada sobre la base:

| Tono | Regla |
|---|---|
| `deep` | `shade × (0.70, 0.72, 0.80)` (más oscuro y más azul) |
| `dim` | media aritmética de `shade` y `lit` |
| `pale` | media aritmética de `up` y `glow` (decidido en #36, opción A: así la luminancia crece estrictamente a lo largo de la escalera) |
| `glow` | `up × (1.12, 1.08, 1.02)`, saturado a 255 |

Materiales nuevos, exclusivos de Resume:

| Material | `top` objetivo | Uso |
|---|---|---|
| `plaster` | ocre rosado cálido `0xb89a86` | residencial de patios, bares |
| `terracotta` | teja `0x9a5a3c` | cubiertas `hip` del residencial y los bares |
| `marble` | blanco cálido `0xcfc4b0` | cívico: palacio, teatro, biblioteca |
| `awning` | verde botella `0x3a5a4a` | toldos de bares y kioscos |

Los `top` de arriba son valores de **base** (sin oscurecer); sus cinco tonos
salen con la regla "ciudad y costa", los cuatro nuevos con la de arriba, y el
script los oscurece ×0.7. El test de paleta exige luminancia monótona a lo
largo de la escalera para cada material.

Acentos nuevos en `ISO_COLORS` (los acentos no se oscurecen, como los nueve
existentes; `portfolio-accents.test.ts` no cambia porque Portfolio no los usa):

| Acento | Color | Uso |
|---|---|---|
| `windowWarm` | `0xffd9a0` | ventana encendida cálida |
| `windowCool` | `0xa8d8ff` | ventana encendida fría |

Los neones usan `amber`, `magenta` y `cyan` con sus `Mid` y `Bleed`, que la
historia #11 ya habilitó en Resume. La regla nueva es de **altura y lugar**:
los neones a nivel de calle (z < 4) existen solo en el barrio de bares; los
carteles de fachada a media altura del distrito (#11) y los de azotea siguen
donde están, como prop `sign` del kit.

## 5. Kit (`src/kit/`)

Módulo puro, sin rng global ni Pixi. Lo consumen `city.ts`, `district.ts` y,
después, cualquier zona.

### Contrato

```ts
interface Lot { x: number; y: number; w: number; d: number; z: number; open: Side[] }  // open: lados con frente abierto (avenida, agua, plaza)
interface Style { mat: Material; trim: Material; roof: Material; tone: number; floorH: number; window: "windowWarm" | "windowCool" }
interface Window { pts: Vec3[]; floor: number; wall: Vec3 /* normal */; building: number }
interface Slot { pts: Vec3[]; wall: Vec3; kind: "neon" | "sign" }
interface Piece { solids: Solid[]; accents: Accent[]; windows: Window[]; slots: Slot[]; landmarkTop?: Vec3 }
type Recipe = (lot: Lot, rng: Rng, style: Style) => Piece;
```

Reglas de toda receta: todo sólido dentro del lote (más el vuelo de cornisa,
0.8); nada por debajo de `lot.z`; altura ≤ 18 salvo recetas marcadas
`landmark` (≤ 24 con cúpula o chapitel); determinista por rng; publica todas
sus ventanas de paredes **que miran a la cámara** (normal con componente
`+x` o `+y`); no toca `accents` para ventanas, eso es de `lights.ts`.

### Formas (`src/kit/forms/`)

| Archivo | Recetas |
|---|---|
| `courtyard.ts` | **O** (cuatro alas, patio con baldosas o verde, pasaje en el ala sur), **U** (abierta a un lado `open`), **C** (dos patios), **patio residencial** (O baja h 6..9, `plaster` + `terracotta` `hip`, árboles de patio) |
| `composite.ts` | **podio + torre** (podio todo el lote h 4..6, torre 10×10 a 12×12 h 12..18 descentrada), **gemelas con puente** (dos torres 8×10 y puente a media altura), **déco escalonada** (tres cuerpos con chaflán y chapitel `cone` 4 lados), **chaflán** (poly con esquina cortada hacia la calle más ancha), **L con torre** (ala baja en L y torre en la esquina) |
| `curved.ts` | **torre cilíndrica** (cylinder 16 lados con fachada), **rotonda** (cylinder 12 lados + `dome`), **nave abovedada** (`vault` + fachada `arcade`), **galería** (planta baja `arcade`, dos pisos encima, techo `hip`) |
| `lowrise.ts` | **hilera de locales** (4..5 lotes angostos de 4..6 de ancho, 2..3 pisos, toldos, `hip` o terraza; publica `slots` de neón en planta baja hacia `open`), **casas en hilera**, **ruina devorada** (lo de hoy, con el kit) |
| `landmarks.ts` | **mercado cubierto** (`vault` central + dos naves laterales + torre del reloj), **estación** (`vault` + `dome` sobre el hall + reloj), **teatro** (tambor + `dome` + columnata `arcade` + marquesina), **palacio cívico** (chaflán + `hip` + `dome` central + escalinata `ramp`), **biblioteca** (galería `arcade` en `marble` + patio), **torre de agua ornamental** (cylinder sobre cuatro patas + `dome` `copper`), **puente peatonal** (tablero de 55 sobre tres arcos de piedra) |

Lo que ya existe en `district.ts` (torre de vidrio escalonada, clásico de
piedra, campus, obra) se muda a `src/kit/forms/modern.ts` sin cambiar su
salida visual más que por la paleta.

### Techos (`src/kit/roofs.ts`)

Cornisa (material `trim`, h 0.4, vuela 0.5), escalón, `gable`, `hip`, terraza
verde, pirámide, cúpula. Un solo lugar para la regla "sobre un techo
retranqueado el detalle apoya en la huella retranqueada".

### Props (`src/kit/props.ts`)

Una función por prop, una medida por rol. Reemplaza todas las copias inline.

| Prop | Medida |
|---|---|
| farol | poste `steel` 0.6×0.6×5, `dot` ámbar r 0.6 |
| semáforo | poste 0.3×0.3×4, caja `officeDark` 0.5×0.5×1.2 |
| auto | 3×1.5×1.2, `steel`/`rust`; **una sola medida** |
| banco, mesa, silla | `paving` 2×0.6×0.5; 1×1×0.7; 0.5×0.5×0.5 |
| bolardo | cylinder `rust` r 0.4 h 0.8, 6 lados |
| árbol de calle / de patio / selva | cone r 1.5 h 4; r 1 h 2.5; `jungle` (r 2..4, h 5..9) |
| toldo | `ramp` `awning` 0.8 de vuelo, h 0.4, `dir` hacia la calle |
| kiosco | prisma 2×2×2.4 `officeDark` + `hip` `terracotta` |
| cartel | caja `officeDark` + poly ámbar (la única implementación) |
| neón | poly del color + poly `Bleed` 1.3× detrás (halo) |
| fuente | cylinder `marble` r 3 h 0.6 + cylinder r 0.6 h 1.5 + charco `amberBleed` |
| tanque de agua, sala de máquinas, antena, helipuerto, baliza, equipos, panel solar, cerco, contenedor | las medidas de hoy, una sola vez |
| guirnalda | `dot`s ámbar r 0.25 cada 1.5 a lo largo de una polilínea a z 3 |

### Laboratorio

`lab/kit.html` + `src/lab/kit.ts`: todas las recetas sobre lotes de 24×18 en
una grilla de 30×24, una fila por archivo de formas, con el estilo de su barrio
por defecto. Teclas: `s` cambia el seed, `1..4` cambia el estilo. Fondo
`#100e19` como el resto del lab. Es la página de QA del kit y la referencia
visual para las otras zonas.

## 6. Zonificación (`src/city/zoning.ts`)

Sobre la grilla de `city-grid.ts`, que no cambia (`WEST_COLS`, `EAST_COLS`,
`ROWS`, `PLAZA`, `SITE`, `COLLAPSED`). Cada manzana recibe un **barrio** por
tabla a mano y cada barrio un **catálogo**: recetas con peso, estilo, política
de luces.

### Barrios

| Barrio | Manzanas | Carácter | Catálogo (peso) | Estilo | Luces |
|---|---|---|---|---|---|
| **Centro** | `72, 188`; cols `72..162` × fila `242`; `42, 218` | financiero alrededor de la plaza y la avenida | podio+torre 30, déco 20, chaflán 20, clásico 15, torre cilíndrica 15 | `office`/`officeDark`/`stone`/`curtain`, `tone` −1..+1 | 45 % encendidas, 70 % frías |
| **Bares (muelle)** | cols `102, 132, 162` × filas `164, 188` | locales con bares, terrazas al agua | hilera de locales 50, galería 20, patio bajo 20, O baja 10 | `plaster`/`officeDark`/`terracotta`/`awning` | 70 % encendidas, 90 % cálidas; neones en frentes abiertos |
| **Residencial de patios** | cols `−48..66` × filas `164..260` menos distrito y centro | manzanas cerradas con patio, techos de teja | patio residencial 40, O 20, U 15, casas en hilera 15, ruina devorada 10 | `plaster`/`stone`/`terracotta` | 55 % encendidas, 95 % cálidas |
| **Cívico** | plaza; `72, 218` (teatro); `162, 218` (palacio cívico); `42, 242` (biblioteca) | nodo principal | fijos | `marble`/`stone`/`copper` | fachadas bañadas (`amberBleed` poly en planta baja), 30 % frías |
| **Ribera este** | cols `280, 310` × filas `164..242`, menos el derrumbe (`COLLAPSED`) | ciudad vieja devorada, mercado frente al puente | mercado fijo en `280, 188`; resto: clásico 30, L con torre 30, ruina devorada 40 | `office`/`officeDark` | 25 % encendidas, mezcla |
| **Distrito moderno** | `DISTRICT_COLS`/`DISTRICT_ROWS` | como hoy, sobre el kit | torre de vidrio 30, gemelas 20, clásico 20, campus 20, cilíndrica 10; obra fija en `SITE` | `curtain`/`stone`/`copper` | 40 % encendidas, 85 % frías |

Piezas singulares fijas, además de las de la tabla: **estación** en `−18, 188`
(la avenida y el tren siguen al oeste), **torre de agua ornamental** en el
patio de `12, 164`, **puente peatonal** sobre el estuario en `y 176` desde el
muelle oeste (`x 198`) hasta la ribera este (`estuaryEast(176) ≈ 252`), que
une el barrio de bares con el mercado: la cabecera del puente de la avenida y
este puente peatonal son los dos nodos nuevos de la ribera.

Rulings que se conservan: la fila frente a la torre (`row 3`, `x 96..162`)
topa a 10 (`maxHeightFor`); el piso encendido de la torre no puede quedar
detrás de nada (`maxDistrictHeight`); nada supera 18 salvo la torre (30) y los
landmarks (≤ 24).

Variación: `zoning` asigna a cada manzana un `tone` por rng (−1..+1) y
rechaza repetir la misma receta en dos manzanas adyacentes del residencial.

### Calles

Los carriles discontinuos quedan **solo en la avenida y el anillo este**; las
demás calles llevan una línea central continua de 0.3 (`strip` único por
tramo). Sendas cebra solo en los cruces de la avenida. Objetivo: de 663 a
≈ 120 `strip`.

## 7. Luces (`src/city/lights.ts`, `city-anim.ts`)

### Ventanas sueltas

`lights(pieces, zoning, rng)` recorre las `windows` de cada pieza y decide por
ventana: apagada, cálida o fría, según la política del barrio (porcentaje
encendido, proporción cálida). Determinista con `zoneRng(seed, "cv", 3)`.

**Oclusión por cajas:** una ventana solo se enciende si ningún sólido de la
escena queda delante de ella en pantalla (`overlaps(screenBounds)` +
`isBehind` de `src/iso/depth.ts`, con barrido por x como `sortByDepth`). Los
acentos se pintan arriba de todo; sin este filtro una ventana encendida
flotaría sobre el edificio de enfrente. Generaliza el ruling de la fila frente
a la torre.

Salida: `Accent` `poly` con `windowWarm` o `windowCool`, alpha 0.85.

### Neones

Solo los `slots` de las piezas del barrio de bares, y solo en paredes cuyo
lado del lote está en `lot.open` (frente a la avenida `y 206` o a la calle del
muelle `x 186..192`). Hasta un neón por local, ≤ 24 en total, z entre 2.4 y
3.6. Colores por rng con pesos `amber 50, magenta 30, cyan 20`. Cada neón
emite su halo y un charco en la vereda (reutiliza `puddle` con el `Bleed`
del color). Guirnaldas en las terrazas del muelle.

### Fachadas bañadas

En el cívico, un `poly` `amberBleed` alpha 0.5 sobre la banda de planta baja
de las paredes visibles: la luz de los faroles del edificio.

### Animación

`city-anim.ts` conserva parpadeo del piso encendido, papeles, antena, los
carteles del distrito y las luces del malecón de #11, y suma (con los helpers
de `neon.ts`):

- **Ventanas que cambian**: cada 300..900 ms una ventana del centro o del
  residencial se prende o se apaga (la política mantiene el porcentaje ±5).
  Solo un subconjunto de ≤ 40 ventanas es animable; el resto es estático y va
  a la Graphics estática de acentos. Capa `city.windows`.
- **Neón que titila**: un neón elegido por rng al arrancar titila (alpha 0.3
  durante un tick cada 1..3 s); los demás son estáticos. Capa `city.neon`.
- Frame 0 = todo encendido y quieto; `reducedMotion` nunca devuelve ids.

## 8. Piezas fijas rehechas (`src/city/fixed.ts`)

Sobre el kit; mismas huellas que hoy.

- **Puente de la avenida**: tablero sobre tres arcos de piedra (`stone`, arcos
  de 6 segmentos como caras bajo el tablero), pilas con tajamar, balaustrada
  de postes cada 3, cuatro obeliscos con farol en las cabeceras. Las rampas y
  el estribo quedan.
- **Puente peatonal** nuevo (§6), `stone` + baranda `steel`, guirnalda.
- **Malecón**: zócalo igual; la cara este del muro lleva fachada `arcade`
  (galería de arcos sobre el agua); pérgola de madera (`deck`) de 12 con
  guirnalda a la altura de la escalera; kiosco; bancos y faroles de props.
- **Muelle oeste**: dos galpones `vault` chicos (12×6) en `y 164..176`, grúa
  de muelle pequeña, bolardos; terrazas de bares con mesas, sillas y toldos
  sobre la vereda del muelle (`x 186..192`), guirnaldas entre postes.
- **Plaza**: baldosas y cordón iguales; fuente centrada en la franja este
  (`x 150, y 227`), dos kioscos en las esquinas norte. La torre no cambia.
- **Derrumbe**: igual, con un fragmento de cúpula caído (`dome` `h` parcial,
  `sides 8`, tumbado se simplifica a medio `dome` apoyado en el agua).

## 9. Tests y presupuesto

### Tests (vitest, sin Pixi)

- `solids.test` (suma): paredes de un `poly` cóncavo apuntan hacia afuera
  (muestra un punto a 0.1 fuera de cada pared); `dome` y `vault` emiten el
  número de caras esperado y ninguna normal apunta al suelo; `hip` tiene
  cuatro faldones; `tone` desplaza todas las caras.
- `palette-iso.test` (suma): nueve entradas por material, luminancia monótona
  creciente a lo largo de la escalera, materiales nuevos presentes;
  `palette-guard` sin cambios.
- `facade.test` (suma): `arcade` emite un arco por columna; fachada en
  `cylinder`; bandas por altura con `toneOffset` creciente.
- `kit.test`: cada receta, con 20 seeds: dentro del lote (+0.8), nada bajo
  `lot.z`, altura ≤ 18 (≤ 24 landmarks), determinista, ventanas solo en
  paredes que miran a la cámara, ningún sólido ajeno dentro del hueco de un
  `poly` cóncavo (test geométrico sobre la salida).
- `zoning.test`: toda manzana tiene barrio; las fijas están donde dice la
  tabla; el barrio de bares es exactamente el conjunto de seis manzanas; en
  un seed se usan ≥ 14 recetas distintas; el residencial no repite receta en
  adyacentes; `maxHeightFor` sigue valiendo.
- `lights.test`: porcentaje encendido por barrio dentro de ±8 del objetivo;
  proporción cálida/fría dentro de ±10; **ninguna ventana encendida tiene un
  sólido delante** (misma función de oclusión aplicada como oráculo
  independiente, por fuerza bruta); neones solo en el barrio de bares, z 2.4..3.6,
  ≤ 24, solo sobre paredes de lados `open`.
- `city-anim.test` (suma): frame 0 quieto; `reducedMotion` sin ids; las
  ventanas animadas son subconjunto de las publicadas; el porcentaje se
  mantiene ±5 en 60 s simulados.
- `city.test` (ajusta): ≥ 90 edificios con fachada; materiales de la zona
  (incluye los cuatro nuevos); autos con una sola medida; `strip` ≤ 150.
- `world.test`: sin cambios de contrato; `LANDMARKS.cv` sigue en la torre.

### Presupuesto

Medido en el mismo headless de Mundo 3 (Chrome vía CDP, sin GPU, DPR 2) sobre
`lab/world.html` y `lab/resume.html`.

Las cifras de "hoy" son las del cierre de #18 (2026-10-14), con el bloom
activo.

| Métrica | Hoy | Tope |
|---|---|---|
| Sólidos elevados de Resume (contenido) | 960 | 2 200 |
| `strip` de Resume | 663 | 150 |
| Polígonos estáticos del mundo | 32 387 | 46 000 |
| Acentos estáticos de Resume | ≈ 90 | 900 |
| Primer dibujo caliente, lab `world.html` (mediana de 10) | 173 ms | 230 ms |
| Primer dibujo caliente, sitio `/` (mediana de 5) | 214 ms | 270 ms |
| Peor redibujo en 5 s, lab | 8–18 ms | 22 ms |
| Bloom: promedio tick + render en 60 frames | 9.5–9.9 ms | ≤ 15 ms (debe seguir en `on`) |

Si el primer dibujo supera el tope o el bloom cae a `fallback`, se recorta
primero `rings` de las cúpulas (4 → 3) y `sides` de los cilindros (16 → 12),
después el porcentaje de ventanas encendidas; nunca la cantidad de recetas.
Las ventanas encendidas estáticas van a las `Graphics` estáticas de acentos
por zona (no se redibujan por tick) para que el costo caiga en el primer
dibujo y no en el presupuesto del bloom.

## 10. Orden de implementación

Cada paso deja `npm test` y `npm run typecheck` verdes y la escena visible en
el lab. Son seis entregas mergeables por separado:

1. **Motor y paleta** (§3, §4): orientación por giro, `dome`, `vault`, `hip`,
   fachada en cilindro y `arcade`, bandas por altura, `tone`, escalera de
   nueve, materiales y acentos nuevos, script de paleta. La ciudad actual se
   ve igual salvo las bandas por altura.
2. **Kit** (§5): `src/kit/` con formas, techos y props; `lab/kit.html`.
   `district.ts` migra sus cuatro tipos al kit. Nada más cambia de aspecto.
3. **Zonificación** (§6): `zoning.ts`, `city.ts` reescrito como orquestador,
   calles simplificadas, piezas fijas nuevas del mapa (estación, mercado,
   teatro, palacio, biblioteca, torre de agua, puente peatonal).
4. **Luces** (§7): `lights.ts`, oclusión, neones, fachadas bañadas,
   `city-anim` ampliado.
5. **Piezas fijas rehechas** (§8): puente, malecón, muelle, plaza, derrumbe.
6. **Cierre**: medición de presupuesto, capturas de `lab/resume.html` y
   `lab/world.html` a 1600×900, README del lab, estado de esta spec.

## 11. Fuera de alcance

- Distrito tecnológico, Portfolio, Blog y la feria sobre el kit: etapas
  siguientes, con el kit ya probado.
- Rotar luz o cámara, texturas, sprites, shaders, sonido.
- Cambios de geografía, terreno, costuras o reintegración al sitio.
