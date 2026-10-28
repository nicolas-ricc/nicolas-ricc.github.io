/**
 * Atlas de la escena isométrica: atardecer bajo. Cinco tonos por material,
 * generados una vez (lit = top×0.76 corrido a naranja: la pared que mira al
 * sol; shade = top×0.45 corrido a azul violáceo; down = top×0.88 frío, la
 * vertiente a contraluz; up = top×1.12 cálido, el destello) y pegados como
 * literales para que el guard de colores los vea. No calcular colores en runtime.
 * Los materiales de ciudad y costa (`office` en adelante) usan otra regla por
 * canal RGB: `lit = top × (0.82, 0.74, 0.62)`, `shade = top × (0.40, 0.42, 0.60)`,
 * `up = top × (1.16, 1.12, 1.02)`, `down = top × (0.86, 0.88, 0.94)`, generados
 * con un script y pegados también como literales.
 * El agua (`shallow`, `water`, `waterDeep`, `abyss`, `hullBlue`) usa otra regla:
 * `lit = top × (0.55, 0.60, 0.80)` (el seno, frío: la proporción de azul sube aunque
 * el tono se oscurezca), `down = top × (0.78, 0.84, 0.96)`,
 * `shade = top × (0.40, 0.42, 0.60)`, `up = top × (1.16, 1.10, 1.05) + (4, 3, 2)` (la cresta que mira al
 * cielo: más clara y apenas más cálida, sigue siendo agua). El sol no se refleja en la cara del
 * agua sino en `glint` (coral del atardecer, regla de ciudad/costa), que solo pintan los destellos
 * chicos de `water-anim.ts`. `hullBlue` sigue la regla de ciudad/costa.
 * De la estación terminal: `tile` sigue la regla de los ocres de la fábrica; `canopy` y `livery`, la de ciudad/costa.
 * Crepúsculo tardío: los tonos de arriba, `sky` y `shadow` son los de `palette-base.ts` × 0.7
 * por canal (`DARKEN`); los acentos no se oscurecen, así los neones destacan sobre la escena.
 * Para ajustar, editar la base y correr `npm run palette`, que imprime los literales a pegar acá.
 * `sky` e `ink` también están escritos a mano en el `<style>` de `lab/*.html`; `palette-guard.test.ts`
 * exige que todo hex de esas páginas sea un valor de esta paleta.
 */
export const ISO_TONES = {
  slab:      { top: 0x6c5945, lit: 0x5a442b, shade: 0x2b282e, up: 0x816649, down: 0x5b4e42 },
  concrete:  { top: 0x7b6450, lit: 0x664c35, shade: 0x322d33, up: 0x927355, down: 0x68584c },
  rust:      { top: 0x62341b, lit: 0x53270c, shade: 0x27171b, up: 0x763d1a, down: 0x522e1d },
  steel:     { top: 0x4e505a, lit: 0x433d3b, shade: 0x1d2438, up: 0x5f5c60, down: 0x404655 },
  road:      { top: 0x373439, lit: 0x322723, shade: 0x141729, up: 0x463d3c, down: 0x2d2e38 },
  rail:      { top: 0x817462, lit: 0x6a5842, shade: 0x35353b, up: 0x99856a, down: 0x6d665c },
  shallow:   { top: 0x21595e, lit: 0x12354b, shade: 0x0d2538, up: 0x296464, down: 0x1a4b5a }, // orillas, bajíos, ríos: turquesa sobre arena
  water:     { top: 0x18434c, lit: 0x0d283c, shade: 0x0a1c2e, up: 0x1e4c51, down: 0x133849 }, // bahía, estuario, mar cerca de la costa
  waterDeep: { top: 0x112c3c, lit: 0x091b30, shade: 0x071224, up: 0x163240, down: 0x0d253a }, // mar abierto
  hullBlue:  { top: 0x21344d, lit: 0x1b2730, shade: 0x0d162e, up: 0x273a4e, down: 0x1c2e48 }, // obra muerta de los barcos
  leaf:      { top: 0x2c4a24, lit: 0x2a3913, shade: 0x0e221f, up: 0x3a5624, down: 0x224125 },
  leafDark:  { top: 0x1d341b, lit: 0x1f270d, shade: 0x08171c, up: 0x293d1b, down: 0x162e1d },
  rock:      { top: 0x4b433b, lit: 0x413225, shade: 0x1c1e2a, up: 0x5c4d3e, down: 0x3e3b3a },
  sand:      { top: 0x76644a, lit: 0x624c30, shade: 0x302d31, up: 0x8c734f, down: 0x635847 },
  hull:      { top: 0x4d2419, lit: 0x431b0b, shade: 0x1d101b, up: 0x5f2b17, down: 0x401f1b },
  deck:      { top: 0x6d593f, lit: 0x5c4427, shade: 0x2b282c, up: 0x836643, down: 0x5c4e3d },
  brick:     { top: 0x613429, lit: 0x4f2719, shade: 0x271619, up: 0x703a29, down: 0x532e27 }, // fábrica: ladrillo cálido
  // Resume: ciudad de oficinas (gris violeta frío contra el ocre cálido del astillero)
  office:    { top: 0x615b69, lit: 0x4f4341, shade: 0x27273f, up: 0x70666b, down: 0x535063 },
  officeDark:{ top: 0x423e4c, lit: 0x362e2f, shade: 0x1b1a2e, up: 0x4c454d, down: 0x393647 },
  glass:     { top: 0x202937, lit: 0x1b1e22, shade: 0x0d1121, up: 0x252e38, down: 0x1c2433 },
  asphalt:   { top: 0x302f36, lit: 0x282322, shade: 0x141420, up: 0x383537, down: 0x292932 },
  paving:    { top: 0x64615c, lit: 0x524739, shade: 0x282937, up: 0x746d5f, down: 0x565557 },
  plaza:     { top: 0x575358, lit: 0x473d37, shade: 0x232335, up: 0x655c5a, down: 0x4b4953 },
  // Resume, distrito moderno: muro cortina, piedra clásica, cobre de cubierta
  curtain:   { top: 0x2b4b55, lit: 0x233735, shade: 0x111f33, up: 0x325457, down: 0x244251 },
  stone:     { top: 0x7f7361, lit: 0x68553c, shade: 0x32303a, up: 0x938163, down: 0x6d655b },
  copper:    { top: 0x376154, lit: 0x2e4734, shade: 0x162932, up: 0x406d55, down: 0x30554f },
  // Blog: faro y espuma
  whitewash: { top: 0x969186, lit: 0x7a6b53, shade: 0x3c3d51, up: 0xaea289, down: 0x817f7e },
  foam:      { top: 0x899496, lit: 0x716d5d, shade: 0x373e5a, up: 0x9fa599, down: 0x76828d },
  abyss:     { top: 0x0b1b2d, lit: 0x061024, shade: 0x040b1b, up: 0x0f2030, down: 0x08172b }, // fosa
  glint:     { top: 0xac623f, lit: 0x8d4927, shade: 0x452926, up: 0xb38969, down: 0x94563b }, // destellos del sol en el agua: coral del atardecer, solo en formas chicas
  // fábrica detallada (#207)
  signal:    { top: 0x86281e, lit: 0x6e1d13, shade: 0x361112, up: 0x9c2d1f, down: 0x73231c },
  stockbrick:{ top: 0x8d764a, lit: 0x73572e, shade: 0x38322d, up: 0xa3844c, down: 0x796846 },
  safety:    { top: 0x987420, lit: 0x7d5614, shade: 0x3d3114, up: 0xb08221, down: 0x83661e },
  // estación terminal (#239)
  tile:      { top: 0x7f432a, lit: 0x693318, shade: 0x331e22, up: 0x974e2b, down: 0x6b3b2b }, // estación: teja terracota de los techos
  canopy:    { top: 0x2c4b34, lit: 0x243720, shade: 0x121f1f, up: 0x335435, down: 0x264231 }, // estación: chapa verde de las marquesinas
  livery:    { top: 0x193d81, lit: 0x152d50, shade: 0x0a1a4d, up: 0x1d4484, down: 0x163679 }, // tren: azul cobalto de la librea
} as const;

export const ISO_COLORS = {
  shadow: 0x1d1229,
  sky: 0x100e19,
  cyan: 0x7cf5ff,
  cyanMid: 0x27b3c9,
  cyanBleed: 0x134a52,
  amber: 0xffc457,
  amberMid: 0xd08a1e,
  amberBleed: 0x5a3d14,
  magenta: 0xff5ee0,
  magentaMid: 0xc42a9d,
  magentaBleed: 0x54173f,
  ink: 0xd8d4e8, // texto de las páginas del lab (lab/*.html); no se oscurece
} as const;

export type Material = keyof typeof ISO_TONES;
export type Tone = "shade" | "lit" | "down" | "top" | "up";
export type AccentColor = Exclude<keyof typeof ISO_COLORS, "shadow" | "sky" | "ink">;
export const ACCENT_COLORS: readonly AccentColor[] = ["cyan", "cyanMid", "cyanBleed", "amber", "amberMid", "amberBleed", "magenta", "magentaMid", "magentaBleed"];

/** De oscuro a claro. `stepTone` se mueve por acá. */
export const TONE_LADDER: readonly Tone[] = ["shade", "lit", "down", "top", "up"];

export function stepTone(tone: Tone, offset: number): Tone {
  const i = Math.max(0, Math.min(TONE_LADDER.length - 1, TONE_LADDER.indexOf(tone) + offset));
  return TONE_LADDER[i]!;
}

export function toneColor(mat: Material, tone: Tone): number {
  return ISO_TONES[mat][tone];
}

export function allIsoColors(): Set<number> {
  const out = new Set<number>(Object.values(ISO_COLORS));
  for (const tones of Object.values(ISO_TONES)) for (const c of Object.values(tones)) out.add(c);
  return out;
}
