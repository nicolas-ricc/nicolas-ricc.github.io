# Capturas de la balsa de tablones (#451, #455)

Storybook `npm run dev -- --host --port 5173`, agent-browser 1600×900 @2 (PNG 3200×1800), bloom on. Método: `CLAUDE.md`.

- `pieza-real.png`: `/lab/storybook.html?bloom=on&speed=0#plataforma`, escala real (sin `setCoverScale`). Mirar la balsa de cerca: tablones con juntas, extremos desparejos, travesaños que asoman, canto con banda mojada, anillo de espuma segmentado y sombra de contacto; vetas y clavos sobre la madera, `WRITING` en azul marino cortado por las juntas.
- `pieza-083.png`: la misma URL con `__lab.setCoverScale(0.83)`. Mirar la textura a la escala del teléfono: juntas y espuma siguen legibles.
- `escena-ancho-117.png`: `#plataforma-escena` con `__lab.setCoverScale(1.17)`. Mirar la balsa en el sitio ancho: entera sobre el agua, con sus anillos.
- `escena-angosto-117.png`: `#plataforma-escena-angosta` con `__lab.setCoverScale(1.17)`. Lo mismo en el sitio angosto (sombra en `waterDeep`).

La subcarpeta `balanceo/` la escribe #456.
