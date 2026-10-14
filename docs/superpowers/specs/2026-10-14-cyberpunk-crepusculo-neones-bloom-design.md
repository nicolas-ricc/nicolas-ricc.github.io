# Estética cyberpunk: crepúsculo tardío, neones y bloom diferido — diseño

**Fecha:** 2026-10-14
**Estado:** en curso
**Antecede:** `2026-09-15-reintegracion-mundo-iso-design.md`
**Alcance:** `src/map/palette-iso.ts` y `palette-base.ts`, `scripts/darken-palette.ts`, fondo de página (`src/style.css`, `lab/*.html`), escenas y animadores de ciudad, distrito tecnológico, mar y feria, `src/world/stage.ts` (bloom) y el arranque del sitio y del lab. Historia #11, hijos #12–#18.

## 1. Problema

La paleta actual es un atardecer bajo y el mundo se lee con poco carácter nocturno. La historia #11 lo lleva a un crepúsculo tardío más oscuro, con neones celestes y rosas animados en Resume (ciudad y distrito tecnológico), Blog (punta, faro, casa del farero y costa) y la feria, y con un bloom sobre las luces que se carga en diferido, después del primer dibujo, y que cae a un halo barato si el presupuesto de tiempo no alcanza. El primer dibujo en el sitio ya está fuera de su objetivo (223.6 ms frente a 200 ms; en el lab son 164.5 ms, dentro del objetivo); el issue citaba ≈ 260 ms, de una medición anterior (spec 2026-09-15, antes de la fusión de celdas). Esta historia no lo repara, solo no lo empeora.

## 2. Decisiones

| Tema | Decisión |
| --- | --- |
| Oscurecimiento | Factor ×0.7 por canal RGB, redondeado, sobre los cinco tonos de todos los materiales de `ISO_TONES` (incluidos agua y `glint`), sobre `sky` y sobre `shadow`. Los acentos (`cyan`, `amber`, `magenta` y sus variantes `Mid`/`Bleed`) conservan su valor. La tabla previa vive en `src/map/palette-base.ts` con `DARKEN = 0.7` y `darken()`; `npm run palette` (`scripts/darken-palette.ts`) imprime los literales que se pegan en `palette-iso.ts`. Un test verifica `ISO_TONES` contra `darken(BASE, 0.7)` (±1 por canal). Los umbrales de agua y `glint` no necesitaron reescalarse. |
| Dónde van los neones | Solo en ciudad y distrito tecnológico (Resume); punta, faro, casa del farero y costa (Blog); y la feria. La feria es Portfolio por geografía y es la excepción: sus luces se atenúan con el velo de Portfolio. Astillero, fábrica e hinterland no se tocan; los guarda `src/scenes/portfolio-accents.test.ts`, que cuenta acentos por color con valores tomados antes de cualquier cambio. Colores celestes y rosas (`cyan*` y `magenta*`); el ámbar existente puede quedarse. |
| Animación | Pulsos de intensidad y letreros que cambian de color o de estado, como una capa `kind: "accent"` nueva dentro de cada animador existente, con un helper puro de neones. Con `prefers-reduced-motion` quedan estáticos en un estado encendido fijo, como el resto de los animadores. Deterministas por seed. |
| Bloom | Composición propia con el `BlurFilter` del core de Pixi, sin `pixi-filters`: una copia aditiva de la capa de acentos desenfocada, hecha con `Graphics` que comparten el `GraphicsContext` de las `Graphics` de acentos, por lo que sigue los redibujos sin costo extra de CPU. Se activa después del primer dibujo, en una tarea diferida (idle o siguiente frame); el primer dibujo no cambia. Con reduced motion el bloom sigue activo, porque es estático. |
| Fallback | Tras activar el bloom se promedian ~60 frames de tiempo de CPU de `stage.tick` más tiempo de render (`prerender`/`postrender`). Si el promedio supera 15 ms se quita el filtro y los `dot` reciben un segundo halo translúcido más grande. `deltaMS` no sirve de medida porque el sitio limita a 30 fps. La decisión se loguea bajo `import.meta.env.DEV` en lab y sitio. |
| Lab | El lab de mundo fuerza el estado con `?bloom=on\|off\|fallback`, para revisar los tres caminos sin depender de la máquina. |
| Fondo de página | `#100e19`, igual al nuevo `sky`: `--bg` de `src/style.css` y el `background` inline de `lab/*.html`. |
| Paleta ya implementada | La implementó #12: `src/map/palette-base.ts`, `npm run palette` y `src/map/palette-iso.ts` con los literales nuevos. |
| Evidencia | Capturas antes y después en `docs/superpowers/specs/assets/2026-10-14-cyberpunk/`; esta spec la crea el primer hijo (decisiones y baseline) y la cierra el último (medidas, gzip, veredicto por criterio). |

## 3. Medidas

### Antes (baseline, 2026-10-14)

Chrome headless vía CDP con `agent-browser`, sin GPU, DPR 2, viewport 1600×900, sobre el estado previo al cambio de paleta. Los tiempos de primer dibujo son de la segunda carga; en ambos casos `stage.staticCount` = 32 498 polígonos estáticos.

- **Primer dibujo, lab: 164.5 ms** (primera carga: 315.4 ms).
- **Primer dibujo, sitio (`/`): 223.6 ms** (primera carga: 224.8 ms).
- **Peor redibujo en 5 s, lab, cinco lecturas:** 12.00, 9.80, 10.10, 8.50 y 21.00 ms. El 21.00 ms es un valor atípico: es cerca del doble de las otras cuatro lecturas, que van de 8.5 a 12 ms.
- **Peor redibujo en 5 s, sitio (`/`), cinco lecturas:** 91.00, 8.70, 31.90, 18.60 y 12.40 ms. El 91.00 ms es la primera lectura tras la carga. Se midió con la pestaña en primer plano y moviendo el puntero cada 2 s durante unos 60 s.
- **gzip total del JS: 179 435 bytes** en 10 archivos (index 104 799, Geometry 31 406, RenderTargetSystem 21 594, browserAll 11 084, init 4 814, BufferResource 2 859, canvasUtils 2 038, CanvasPool 450, getTextureBatchBindGroup 303, webworkerAll 88).

Líneas de consola crudas:

```
[info] [lab] primer dibujo: 164.5 ms, 32498 polígonos estáticos
[info] [mapa] primer dibujo: 223.6 ms, 32498 polígonos estáticos
[info] [lab] peor redibujo en 5 s: 12.00 ms
[info] [lab] peor redibujo en 5 s: 9.80 ms
[info] [lab] peor redibujo en 5 s: 10.10 ms
[info] [lab] peor redibujo en 5 s: 8.50 ms
[info] [lab] peor redibujo en 5 s: 21.00 ms
[info] [mapa] peor redibujo en 5 s: 91.00 ms
[info] [mapa] peor redibujo en 5 s: 8.70 ms
[info] [mapa] peor redibujo en 5 s: 31.90 ms
[info] [mapa] peor redibujo en 5 s: 18.60 ms
[info] [mapa] peor redibujo en 5 s: 12.40 ms
```

Capturas del estado previo, tomadas en el lab a 1600×900 con DPR 2 (los PNG son de 3200×1800):

![mundo](assets/2026-10-14-cyberpunk/antes-mundo.png)
![portfolio](assets/2026-10-14-cyberpunk/antes-portfolio.png)
![resume](assets/2026-10-14-cyberpunk/antes-resume.png)
![blog](assets/2026-10-14-cyberpunk/antes-blog.png)

### Después

Pendiente: lo completa el último hijo (#18) con el estado final.

## 4. Criterios de aceptación

- [ ] Cada tono de `ISO_TONES`, más `sky` y `shadow`, vale el valor anterior ×0.7 por canal (±1 por redondeo); un test lo verifica contra el factor, no contra una tabla copiada.
- [ ] Los nueve `AccentColor` conservan exactamente su valor actual.
- [ ] El guard de paleta y toda la suite (`npm test`) y el typecheck (`npm run typecheck`) pasan.
- [ ] Los acentos de Portfolio (astillero, fábrica, hinterland) son los mismos que antes del cambio: mismos colores, misma cantidad (test de conteo por color, o equivalente).
- [ ] Ciudad, distrito tecnológico, mar/punta y feria tienen al menos una capa de acentos animada nueva con colores `cyan*` y/o `magenta*`; con `reducedMotion: true` su `tick` no reporta redibujos.
- [ ] Al enfocar otra zona, las luces nuevas bajan a `ACCENT_DIM` como las actuales (test sobre el `Stage` o sobre `focusAlphas`).
- [ ] El bloom no está presente en el primer dibujo; se activa después y queda medido: en el lab de mundo, con el headless de siempre (Chrome vía CDP, sin GPU, DPR 2), el log muestra la medición y la decisión (bloom activo o fallback).
- [ ] Primer dibujo en el lab de mundo y en el sitio: igual o mejor que la medición previa en la misma máquina, anotada en el PR.
- [ ] Fallback: forzado por parámetro de URL en el lab, las luces muestran halo y no hay filtro en el slot de acentos.
- [ ] Capturas antes/después del mundo completo y de cada zona enfocada (lab, mismo viewport) adjuntas al PR.
- [ ] Peso gzip del bundle del sitio anotado antes y después en el PR.
- [ ] Spec de diseño en `docs/superpowers/specs/` con fecha, siguiendo las existentes, que registre las decisiones de arriba y las medidas.
