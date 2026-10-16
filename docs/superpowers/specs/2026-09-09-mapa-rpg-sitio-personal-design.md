# Sitio personal como mapa RPG — diseño

**Fecha:** 2026-09-09
**Estado:** aprobado en conversación, pendiente de plan de implementación

## 1. Objetivo

Un sitio personal liviano y muy visual que funciona como *hub* hacia el
portfolio, el currículum y el blog (`myxomatosis.xyz`). La portada es un mapa
estilo RPG 16-bit con tres zonas que se iluminan al pasar el mouse; al
seleccionar una, la cámara hace zoom y la vista pasa a dos columnas: el
fragmento del mapa a la izquierda, el contenido de esa zona a la derecha.

Criterios de éxito:

- Primer render del mapa en menos de 1 s sobre 4G. JS total < 200 KB gzip.
- Se ve claramente como pixel art 16-bit, con animación sutil.
- Cada zona tiene URL propia, indexable, y funciona con teclado y lector de pantalla.
- El contenido se mantiene editando JSON, sin tocar código.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Dominio | `myxomatosis.xyz/map/`: project site de GitHub Pages (repo `map`) bajo el dominio del blog, sin DNS extra |
| Hosting | GitHub Pages, repo nuevo, deploy por GitHub Actions |
| Renderer | PixiJS v8 con imports selectivos, Vite + TypeScript, sin framework de UI |
| Arte | Todo procedural en v1: terreno y landmarks como listas de rectángulos (`PixelOp[]`) pintadas con `Graphics` en un lienzo low-res escalado con nearest-neighbor. Los landmarks exponen `Texture[]` por frame, así se pueden reemplazar por PNG dibujados a mano sin tocar el resto |
| Gamificación | Mapa interactivo sin personaje: hover ilumina, click hace zoom. Sin controles de movimiento ni progresión |
| Tema | Post-apocalíptico irónico: nuestro mundo siglos después, selva sobre la ciudad, noche con luces artificiales |
| Zonas v1 | Portfolio, Resume, Blog |
| Navegación | URL propia por zona + transición sin recarga (History API) |
| Contenido | JSON estático en el repo, validado en build. Últimos posts del blog leídos del RSS en build time |
| Panel de contenido | HTML común posicionado con CSS, no `DOMContainer` (experimental en v8) |

## 3. Estructura del repo

```
mapa/
  index.html                 shell; Vite genera además /portfolio/, /cv/, /blog/
  src/
    main.ts                  arranque, resize, ruteo, loop
    map/
      canvas.ts              RenderTexture 480x270, sprite escalado nearest
      terrain.ts             pintores: agua, costa, pasto, bosque, montaña, camino
      zones.ts               definición de zonas: id, polígono, landmark, cartel
      landmarks.ts           landmarks procedurales, PixelOp[] por frame
      pixelfont.ts           fuente bitmap 3x5 como datos, texto -> PixelOp[]
      ops.ts                 tipo PixelOp y applyOps(Graphics, ops)
      seed.ts                PRNG determinístico
      palette.ts             16 colores nombrados
      ambient.ts             luciérnagas, flicker, humo
    camera.ts                tween de position/scale del contenedor raíz
    router.ts                pushState/popstate, mapea URL <-> zona
    views/
      map-view.ts            estado pantalla completa
      zone-view.ts           estado dos columnas, monta contenido
      render-content.ts      JSON -> HTML de secciones e items
    a11y.ts                  accesibilidad de zonas, reduced-motion
  content/
    portfolio.json  cv.json  blog.json
    schema.json              JSON Schema compartido
  scripts/
    validate-content.mjs     valida content/*.json contra el schema
    fetch-blog-feed.mjs      lee el RSS de myxomatosis.xyz y genera content/blog.generated.json
    prerender.mjs            genera el HTML estático de cada ruta con el contenido
  public/
    CNAME
  .github/workflows/deploy.yml
```

## 4. Mundo y atmósfera

### Tema

Nuestro mundo, siglos después de un colapso que a nadie le importó demasiado.
La selva se comió las ciudades pero la infraestructura barata sobrevivió: los
carteles LED siguen prendidos porque nadie encontró el interruptor. Es de
noche. Las únicas luces son artificiales, medio rotas, y son exactamente las
zonas del mapa. Tono irónico y rastrero (Fallout con menos épica y más kiosco):
lo que quedó de la civilización es publicidad, cables y containers.

### Paleta (16 colores)

- **Base nocturna** (7): azul petróleo muy oscuro para el suelo, dos verdes
  profundos casi negros para vegetación, gris-violeta y gris oscuro para
  concreto, marrón óxido para metal, negro azulado para el río.
- **Acentos de luz artificial** (3 × 3 = 9): uno por zona, cada uno con tres
  tonos (núcleo, medio, sangrado sobre la vegetación cercana).
  - Portfolio: cian de tubo fluorescente.
  - CV: ámbar de lámpara de sodio.
  - Blog: magenta de neón.

La paleta vive en un único módulo (`palette.ts`) y todo el terreno y los
landmarks la referencian por nombre.

### Lienzo

Un `RenderTexture` de 480x270 donde el terreno se pinta **una sola vez** al
cargar. Se muestra como `Sprite` con `scaleMode: 'nearest'` escalado hasta
cubrir el viewport (modo *cover*). A 4x da 1920x1080 con píxel marcado. Todo lo
que se dibuja en coordenadas del lienzo usa enteros.

### Terreno (procedural, determinístico)

Generación con seed fija en `seed.ts`, así el mapa es idéntico en cada carga.
Capas, de abajo hacia arriba:

1. **Suelo**: relleno azul petróleo oscuro.
2. **Cuadrícula urbana rota**: restos de calles como líneas grises de 1-2 px
   en grilla, con tramos borrados al azar. Cimientos rectangulares como
   manchas gris-violeta.
3. **Río**: curva oscura que cruza el mapa; sobre él, reflejos de 1 px con
   el color de la zona más cercana, alternando 2 frames cada 400 ms (única
   capa de terreno que se redibuja).
4. **Autopista elevada**: banda gris con línea central, cortada en dos o tres
   puntos, que sale del mapa por el borde del lado del Blog.
5. **Vegetación**: copas de árboles como círculos apilados en los dos verdes,
   tapando parcialmente calles y cimientos. Enredaderas como líneas de 1 px
   sobre las estructuras.
6. **Rutas**: torres de alta tensión caídas; los cables son líneas punteadas
   de 1 px que conectan los tres landmarks.

### Zonas

| id | Nombre | Landmark | Luz | Idea |
|---|---|---|---|---|
| `portfolio` | Portfolio | Torre de containers apilados con grúa oxidada encima, taller con chispas, al pie del muelle de un astillero | Cian, soldadura parpadeando | "Acá se construyen cosas", con chatarra. La grúa se mueve sola |
| `cv` | Resume | Torre de oficinas hundida en la selva, un solo piso con luz, papeles volando por la ventana | Ámbar de tubo | El único que sigue yendo a la oficina. Sin carteles: el único texto del mapa son los nombres de zona y el cartel con el nombre del sitio |
| `blog` | Blog | Faro sobre un promontorio rocoso en la costa, casa del farero, haz ámbar cálido que gira | Magenta neón | Emitir al vacío. Es la "salida" del mapa: luz que guía hacia afuera |

Cada zona: polígono en coordenadas del lienzo, posición del landmark, cartel
con el nombre en fuente bitmap. **Los tres polígonos cubren el lienzo entero**
(sin huecos: Portfolio y Resume iguales a la izquierda, Blog una franja más angosta a la derecha del río) y cada uno tiene terreno
propio con carácter propio: Portfolio es un astillero leído como foto satelital
(ver abajo), Resume es la ciudad de oficinas en cuadrícula tragada por la
selva, Blog es la costa (descampado, autopista rota que muere en el mar, faro).
Cada zona es un `Container` propio que agrupa su terreno recortado al polígono,
su landmark, su glow y su cartel, para poder aplicarle `tint` por separado.
Al pasar el mouse por un tercio, ese tercio entero se enciende al 100% y los
otros dos bajan al 35%; el nombre de cada zona nunca se tiñe, para que se lea
aunque su tercio esté apagado.

#### Portfolio: astillero

Un lugar donde se construyen cosas, no donde se estacionan. Línea de
producción de oeste a este que termina en el agua: patio de material → nave de
montaje → grada → río. Todo lo largo va horizontal (eje perpendicular a la
orilla); lo único norte-sur es la calle de transferencia, la viga de la grúa
pórtico y el muelle. El río se draga del lado del astillero: la ribera
izquierda es una recta en x=200 (canal rectificado contra el río que serpentea
del otro lado, que es lo que más lee como foto aérea).

Piezas: patio de material (chapas, caños, bobinas, tanques) al NO; dique seco
con un casco en reparación al NE; dos naves de montaje con techo de claraboyas
en fila con dos gradas (una con solo quilla y cuadernas, otra con el casco casi
cerrado) y rampa sumergida; grúa pórtico N-S sobre las gradas con sombra
proyectada al SE; talleres chicos, playa de estacionamiento y vías al SO; el
landmark (taller + grúa mayor) al pie del muelle; muelle de alistamiento con
dos naves finas del lado este del río. Reglas de textura: luz desde el NO, todo
lo alto proyecta sombra al SE; losa con juntas sutiles y charcos; nada mide
menos que su escala real (camión 3×2, persona 1 px). La selva solo come la
esquina SO y el borde norte. Vive en `terrain-portfolio.ts`; los helpers de
pintura comunes en `paint.ts`.

Título del sitio en el mapa: cartel municipal roto con el nombre del sitio, tipo
"BIENVENIDO A NICOLÁS RICCOMINI" con letras caídas, en fuente bitmap, ubicado
en un margen del mapa.

### Landmarks

Composiciones procedurales de ~40x40 px definidas en `landmarks.ts` como
funciones que devuelven `PixelOp[]` por frame (2-3 frames: chispas de
soldadura, letra del cartel que titila, estática del LED). Al cargar se
renderizan a texturas con `renderer.generateTexture` y se muestran con
`AnimatedSprite` a 8 fps solo mientras la zona está en hover/foco o activa; en
reposo quedan en el frame 0 (luz en "modo ahorro"). Reemplazables por PNG
dibujados a mano: la interfaz es `Texture[]`.

### Ambiente animado

Barato, pocos frames, todo pausable:

- Luciérnagas: `ParticleContainer` con ~30 partículas de 1 px alrededor de
  cada luz, movimiento lento, parpadeo por alpha.
- Flicker aleatorio de los carteles en reposo (1 frame apagado cada 5-15 s).
- Humo de una chimenea sin dueño: 3 frames en loop.
- Estática del LED del blog: 2 frames alternados.

## 5. Interacción

### Estados de zona

| Estado | Visual |
|---|---|
| Reposo | Luz en "modo ahorro": `tint` al ~60% de brillo, landmark en frame 0, glow apenas visible, flicker ocasional |
| Hover / foco teclado | El cartel "se prende": 2-3 parpadeos de arranque de tubo fluorescente en ~250 ms y luego `tint` fijo al 100%; glow (sprite radial con el acento de la zona, blend `add`) a plena intensidad; landmark animado; luciérnagas se acercan |
| Activa | Cámara a ~2.5x centrada en el landmark; resto de zonas al 35% de brillo, sus luces apagadas |

Eventos: `eventMode: 'static'`, `hitArea` con el polígono de la zona,
`cursor: 'pointer'`. Accesibilidad con el `AccessibilitySystem` de Pixi:
`accessible: true`, `accessibleTitle`, `accessibleHint`, `tabIndex` en orden
portfolio, cv, blog. Enter/Espacio activan.

### Cámara

`camera.ts` interpola `position` y `scale` de un `Container` raíz con un tween
propio (ease-out cúbico, 500 ms), sin librería. Expone `focus(zone)` y
`reset()`, ambos devuelven una promesa que resuelve al terminar. Con
`prefers-reduced-motion: reduce` la duración es 0.

### Vistas

**Vista mapa** (`/`): canvas a pantalla completa.

**Vista zona** (`/portfolio/`, `/cv/`, `/blog/`): grilla de dos columnas.

- Izquierda (~40%): el mismo canvas encogido, cámara sobre la zona, título de
  la zona como cartel pixel art, link "Volver al mapa".
- Derecha (~60%): contenido HTML con scroll propio.
- Móvil (< 768 px): columnas apiladas, mapa arriba con alto fijo (~40vh),
  contenido abajo.

El canvas usa `resizeTo` sobre su contenedor DOM, así sigue al layout.

### Transición mapa → zona

1. Click/Enter en zona → `history.pushState` a la URL de la zona.
2. En paralelo, 500 ms: tween de cámara y transición CSS del contenedor del
   canvas hacia la columna izquierda.
3. Al terminar, la columna derecha hace fade-in (200 ms) con el contenido.

"Volver al mapa", Esc y el botón atrás del browser (`popstate`) hacen el
camino inverso.

### Carga directa de una URL de zona

El HTML prerenderizado ya trae la grilla y el contenido de la derecha. El
canvas arranca en la columna izquierda con la cámara ya en la zona, sin
animación. Si el JS falla, el contenido queda legible igual.

### Móvil

Mapa en modo *cover*; si queda recortado se puede arrastrar con un dedo. Sin
pinch-zoom. Tap equivale a click.

## 6. Contenido

Un archivo por zona en `content/`, esquema común:

```json
{
  "id": "portfolio",
  "titulo": "Portfolio",
  "descripcion": "Una línea opcional bajo el título",
  "secciones": [
    {
      "subtitulo": "Juegos",
      "items": [
        {
          "titulo": "politik_tcg",
          "descripcion": "Qué es, en una o dos líneas",
          "links": [{ "label": "Repo", "url": "https://..." }]
        }
      ]
    }
  ]
}
```

Extras por zona:

- `cv.json` admite `"pdf": "/cv.pdf"` a nivel raíz → botón de descarga.
- `blog.json` tiene las secciones fijas escritas a mano. En build,
  `fetch-blog-feed.mjs` lee el RSS de `myxomatosis.xyz` y genera una sección
  "Últimos posts" (los 5 más recientes). Si el feed falla, el build sigue sin
  esa sección y avisa en el log.

`validate-content.mjs` corre antes de `vite build` y falla el build si algún
JSON no cumple el schema.

`render-content.ts` convierte el JSON a HTML semántico: `<h1>` título de zona,
`<section>` por sección con `<h2>`, `<article>` por item con `<h3>`, `<p>` y
lista de links. El mismo módulo lo usan el prerender (Node) y el cliente
(cuando se navega sin recarga).

## 7. Performance

| Recurso | Presupuesto |
|---|---|
| JS total | < 200 KB gzip (Pixi selectivo ~130-150) |
| Sprites y glows | 0 KB de binarios; se generan en runtime |
| Fuente bitmap | 0 KB, glifos 3x5 en código |
| Web fonts | ninguna; el contenido usa fuentes del sistema |
| Primer render del mapa | < 1 s en 4G |

El loop de Pixi está casi ocioso: el terreno es una textura estática y solo se
animan los reflejos del río, las luciérnagas y los landmarks activos. `ticker.maxFPS = 30` alcanza. Se
pausa el ticker con `visibilitychange` cuando la pestaña no está visible.

## 8. Deploy

- GitHub Actions en push a `main`: `npm ci`, `npm run build` (validate →
  fetch-feed → vite build → prerender), publica `dist/` a Pages.
- `public/CNAME` con el subdominio. El registro CNAME en GoDaddy lo agrega
  Nicolás a mano apuntando a `nicolas-ricc.github.io`.

## 9. Testing

- **Unit (Vitest):** `seed.ts` determinístico; `camera.ts` llega al destino y
  respeta reduced-motion; `router.ts` mapea URL ↔ zona en ambos sentidos;
  `render-content.ts` produce el HTML esperado desde un JSON de ejemplo;
  `validate-content` rechaza JSON inválido.
- **Build:** el prerender genera los cuatro HTML y cada uno contiene el título
  de su zona.
- **Manual:** checklist visual en desktop y móvil, navegación con teclado,
  lector de pantalla recorre las tres zonas, Lighthouse con performance > 95.

## 10. Fuera de alcance (v1)

- Personaje que camina, progresión, zonas bloqueadas.
- Zona de contacto/redes (posible v2, entra como cuarta zona sin cambiar la arquitectura).
- Editor visual del mapa; el terreno se ajusta en código.
- i18n: todo en español.
