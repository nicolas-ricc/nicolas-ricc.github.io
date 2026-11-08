/**
 * Atlas of the isometric scene: low sunset. Nine tones per material,
 * dark to light: `deep, shade, dim, lit, down, top, up, pale, glow`.
 * The usual five (`shade lit down top up`) were generated once with these
 * rules (lit = top×0.76 shifted toward orange: the wall facing the sun; shade = top×0.45
 * shifted toward violet blue; down = top×0.88 cool, the slope facing away from the light; up = top×1.12
 * warm, the glint) and pasted as literals so the color guard sees them.
 * Do not compute colors at runtime.
 * The city and coast materials (`office` onward) use another per-RGB-channel
 * rule: `lit = top × (0.82, 0.74, 0.62)`, `shade = top × (0.40, 0.42, 0.60)`,
 * `up = top × (1.16, 1.12, 1.02)`, `down = top × (0.86, 0.88, 0.94)`, generated
 * with a script and also pasted as literals.
 * Water (`shallow`, `water`, `waterDeep`, `abyss`, `hullBlue`) uses another rule:
 * `lit = top × (0.55, 0.60, 0.80)` (the trough, cool: the share of blue rises even though
 * the tone darkens), `down = top × (0.78, 0.84, 0.96)`,
 * `shade = top × (0.40, 0.42, 0.60)`, `up = top × (1.16, 1.10, 1.05) + (4, 3, 2)` (the crest facing the
 * sky: lighter and barely warmer, still water). The sun is not reflected in the face of the
 * water but in `glint` (sunset coral, city/coast rule), which only the small glints
 * of `water-anim.ts` paint. `hullBlue` follows the city/coast rule.
 * Of the terminal station: `tile` follows the rule of the factory ochres; `canopy` and `livery`, the city/coast one.
 * Late dusk: the tones above, `sky` and `shadow` are those of `palette-base.ts` × 0.7
 * per channel (`DARKEN`); the accents are not darkened, so the neons stand out against the scene.
 * Nine-step ladder (`extendLadder` in `palette-base.ts`, applied to the base before darkening):
 * `deep = shade × (0.70, 0.72, 0.80)` (darker and bluer), `dim` = mean of `shade` and `lit`,
 * `glow = up × (1.12, 1.08, 1.02)` clamped to 255, `pale` = mean of `up` and `glow` (so
 * luminance rises strictly along the ladder). `shadeTone` still returns
 * only `shade lit down top up`. The four Resume level 2 materials (`plaster`,
 * `terracotta`, `marble`, `awning`) follow the city/coast rule, and so do the #56
 * corrugated sheet and container materials (`sheetGreen` ... `boxOrange`).
 * To adjust, edit the base and run `npm run palette`, which prints the literals to paste here.
 * `sky` and `ink` are also hand-written in the `<style>` of `lab/*.html`; `palette-guard.test.ts`
 * requires every hex in those pages to be a value of this palette.
 */
export const ISO_TONES = {
  slab:      { deep: 0x1e1d25, shade: 0x2b282e, dim: 0x43362d, lit: 0x5a442b, down: 0x5b4e42, top: 0x6c5945, up: 0x816649, pale: 0x896a4a, glow: 0x906f4a },
  concrete:  { deep: 0x232029, shade: 0x322d33, dim: 0x4c3d34, lit: 0x664c35, down: 0x68584c, top: 0x7b6450, up: 0x927355, pale: 0x9b7856, glow: 0xa47c57 },
  rust:      { deep: 0x1b1116, shade: 0x27171b, dim: 0x3d1f14, lit: 0x53270c, down: 0x522e1d, top: 0x62341b, up: 0x763d1a, pale: 0x7d401b, glow: 0x84421b },
  steel:     { deep: 0x141a2d, shade: 0x1d2438, dim: 0x30303a, lit: 0x433d3b, down: 0x404655, top: 0x4e505a, up: 0x5f5c60, pale: 0x656161, glow: 0x6a6462 },
  road:      { deep: 0x0e1121, shade: 0x141729, dim: 0x231f27, lit: 0x322723, down: 0x2d2e38, top: 0x373439, up: 0x463d3c, pale: 0x4a403d, glow: 0x4e423e },
  rail:      { deep: 0x252630, shade: 0x35353b, dim: 0x50473f, lit: 0x6a5842, down: 0x6d665c, top: 0x817462, up: 0x99856a, pale: 0xa28b6b, glow: 0xab906c },
  shallow:   { deep: 0x091b2d, shade: 0x0d2538, dim: 0x102e42, lit: 0x12354b, down: 0x1a4b5a, top: 0x21595e, up: 0x296464, pale: 0x2c6866, glow: 0x2e6c66 }, // shores, shallows, rivers: turquoise over sand
  water:     { deep: 0x071424, shade: 0x0a1c2e, dim: 0x0c2235, lit: 0x0d283c, down: 0x133849, top: 0x18434c, up: 0x1e4c51, pale: 0x204f51, glow: 0x225252 }, // bay, estuary, sea near the coast
  waterDeep: { deep: 0x050d1d, shade: 0x071224, dim: 0x08162b, lit: 0x091b30, down: 0x0d253a, top: 0x112c3c, up: 0x163240, pale: 0x183541, glow: 0x193742 }, // open sea
  hullBlue:  { deep: 0x090f25, shade: 0x0d162e, dim: 0x141e2f, lit: 0x1b2730, down: 0x1c2e48, top: 0x21344d, up: 0x273a4e, pale: 0x293d4f, glow: 0x2b3f50 }, // topsides of the ships
  leaf:      { deep: 0x0a1919, shade: 0x0e221f, dim: 0x1c2e19, lit: 0x2a3913, down: 0x224125, top: 0x2c4a24, up: 0x3a5624, pale: 0x3e5a24, glow: 0x415d24 },
  leafDark:  { deep: 0x061116, shade: 0x08171c, dim: 0x141f14, lit: 0x1f270d, down: 0x162e1d, top: 0x1d341b, up: 0x293d1b, pale: 0x2c401b, glow: 0x2e421b },
  rock:      { deep: 0x141622, shade: 0x1c1e2a, dim: 0x2f2928, lit: 0x413225, down: 0x3e3b3a, top: 0x4b433b, up: 0x5c4d3e, pale: 0x62513f, glow: 0x685340 },
  sand:      { deep: 0x222027, shade: 0x302d31, dim: 0x493d31, lit: 0x624c30, down: 0x635847, top: 0x76644a, up: 0x8c734f, pale: 0x947850, glow: 0x9d7c51 },
  hull:      { deep: 0x140c15, shade: 0x1d101b, dim: 0x301613, lit: 0x431b0b, down: 0x401f1b, top: 0x4d2419, up: 0x5f2b17, pale: 0x642d18, glow: 0x6a2e18 },
  deck:      { deep: 0x1e1d23, shade: 0x2b282c, dim: 0x44362a, lit: 0x5c4427, down: 0x5c4e3d, top: 0x6d593f, up: 0x836643, pale: 0x8b6a43, glow: 0x926f44 },
  brick:     { deep: 0x1b0f14, shade: 0x271619, dim: 0x3b1e19, lit: 0x4f2719, down: 0x532e27, top: 0x613429, up: 0x703a29, pale: 0x773d2a, glow: 0x7d3f2a }, // factory: warm brick
  // Resume: office city (cool violet gray against the warm ochre of the shipyard)
  office:    { deep: 0x1b1c32, shade: 0x27273f, dim: 0x3b3540, lit: 0x4f4341, down: 0x535063, top: 0x615b69, up: 0x70666b, pale: 0x776a6d, glow: 0x7d6f6d },
  officeDark:{ deep: 0x131324, shade: 0x1b1a2e, dim: 0x29242e, lit: 0x362e2f, down: 0x393647, top: 0x423e4c, up: 0x4c454d, pale: 0x51484e, glow: 0x554b4e },
  glass:     { deep: 0x090c1b, shade: 0x0d1121, dim: 0x141822, lit: 0x1b1e22, down: 0x1c2433, top: 0x202937, up: 0x252e38, pale: 0x273039, glow: 0x293139 },
  asphalt:   { deep: 0x0e0e1a, shade: 0x141420, dim: 0x1e1b21, lit: 0x282322, down: 0x292932, top: 0x302f36, up: 0x383537, pale: 0x3b3738, glow: 0x3f3939 },
  paving:    { deep: 0x1c1d2c, shade: 0x282937, dim: 0x3d3839, lit: 0x524739, down: 0x565557, top: 0x64615c, up: 0x746d5f, pale: 0x7b7160, glow: 0x827561 },
  plaza:     { deep: 0x19192b, shade: 0x232335, dim: 0x353036, lit: 0x473d37, down: 0x4b4953, top: 0x575358, up: 0x655c5a, pale: 0x6b615c, glow: 0x71645c },
  // Resume, modern district: curtain wall, classic stone, roof copper
  curtain:   { deep: 0x0c1629, shade: 0x111f33, dim: 0x1a2b35, lit: 0x233735, down: 0x244251, top: 0x2b4b55, up: 0x325457, pale: 0x355858, glow: 0x385b58 },
  stone:     { deep: 0x23232e, shade: 0x32303a, dim: 0x4d433b, lit: 0x68553c, down: 0x6d655b, top: 0x7f7361, up: 0x938163, pale: 0x9c8664, glow: 0xa58b65 },
  copper:    { deep: 0x0f1d29, shade: 0x162932, dim: 0x223833, lit: 0x2e4734, down: 0x30554f, top: 0x376154, up: 0x406d55, pale: 0x457156, glow: 0x487557 },
  // Blog: lighthouse and foam
  whitewash: { deep: 0x2a2c40, shade: 0x3c3d51, dim: 0x5c5452, lit: 0x7a6b53, down: 0x817f7e, top: 0x969186, up: 0xaea289, pale: 0xb0a98a, glow: 0xb3b08b },
  foam:      { deep: 0x272d47, shade: 0x373e5a, dim: 0x54565c, lit: 0x716d5d, down: 0x76828d, top: 0x899496, up: 0x9fa599, pale: 0xa9ac9a, glow: 0xb2b39b },
  abyss:     { deep: 0x030815, shade: 0x040b1b, dim: 0x050e1f, lit: 0x061024, down: 0x08172b, top: 0x0b1b2d, up: 0x0f2030, pale: 0x102231, glow: 0x112331 }, // trench
  glint:     { deep: 0x301d1e, shade: 0x452926, dim: 0x693927, lit: 0x8d4927, down: 0x94563b, top: 0xac623f, up: 0xb38969, pale: 0xb38f6a, glow: 0xb3946b }, // sun glints on the water: sunset coral, only in small shapes
  // Resume level 2: residential, roofs, civic, awnings
  plaster:   { deep: 0x24212d, shade: 0x342e38, dim: 0x4f3f39, lit: 0x6a503a, down: 0x6f5f58, top: 0x816c5e, up: 0x957860, pale: 0x9e7d61, glow: 0xa78262 },
  terracotta:{ deep: 0x1e1314, shade: 0x2b1b19, dim: 0x42251a, lit: 0x582f1a, down: 0x5c3727, top: 0x6c3f2a, up: 0x7d472b, pale: 0x854a2b, glow: 0x8c4c2b },
  marble:    { deep: 0x29293b, shade: 0x3a394a, dim: 0x59504c, lit: 0x77664c, down: 0x7d7873, top: 0x91897b, up: 0xa89a7e, pale: 0xaea07f, glow: 0xb3a781 },
  awning:    { deep: 0x0b1319, shade: 0x101b1f, dim: 0x19251f, lit: 0x222f20, down: 0x233731, top: 0x293f34, up: 0x2f4735, pale: 0x324a35, glow: 0x354c36 },
  // detailed factory (#207)
  signal:    { deep: 0x260c0f, shade: 0x361112, dim: 0x521713, lit: 0x6e1d13, down: 0x73231c, top: 0x86281e, up: 0x9c2d1f, pale: 0xa62f1f, glow: 0xaf301f },
  stockbrick:{ deep: 0x272424, shade: 0x38322d, dim: 0x56452e, lit: 0x73572e, down: 0x796846, top: 0x8d764a, up: 0xa3844c, pale: 0xab894c, glow: 0xb38e4d },
  safety:    { deep: 0x2b230f, shade: 0x3d3114, dim: 0x5d4414, lit: 0x7d5614, down: 0x83661e, top: 0x987420, up: 0xb08221, pale: 0xb28822, glow: 0xb38d22 },
  // terminal station (#239)
  canopy:    { deep: 0x0d1619, shade: 0x121f1f, dim: 0x1b2b1f, lit: 0x243720, down: 0x264231, top: 0x2c4b34, up: 0x335435, pale: 0x375835, glow: 0x395b36 }, // station: green sheet metal of the canopies
  livery:    { deep: 0x07133e, shade: 0x0a1a4d, dim: 0x0f244e, lit: 0x152d50, down: 0x163679, top: 0x193d81, up: 0x1d4484, pale: 0x1f4785, glow: 0x214a86 }, // train: cobalt blue of the livery
  // coastal neighborhood (#240) and station (#239): tile
  tile:      { deep: 0x221414, shade: 0x311c19, dim: 0x4b271a, lit: 0x65321a, down: 0x6a3b27, top: 0x7b432a, up: 0x8f4c2b, pale: 0x974f2b, glow: 0xa0522b },
  // #56: corrugated sheet and containers
  sheetGreen:{ deep: 0x141a25, shade: 0x1d242e, dim: 0x2e322f, lit: 0x3d3f30, down: 0x404b48, top: 0x4a554d, up: 0x56604e, pale: 0x5c644f, glow: 0x616850 },
  sheetTeal: { deep: 0x0f1628, shade: 0x151f32, dim: 0x202b32, lit: 0x2b3733, down: 0x2d414e, top: 0x344a53, up: 0x3c5354, pale: 0x405755, glow: 0x435a55 },
  boxRust:   { deep: 0x1b0f11, shade: 0x271615, dim: 0x3b1e16, lit: 0x4f2716, down: 0x532e21, top: 0x613423, up: 0x703a24, pale: 0x773d24, glow: 0x7d3f24 },
  boxBlue:   { deep: 0x0d142b, shade: 0x121b36, dim: 0x1b2637, lit: 0x243037, down: 0x253954, top: 0x2b405a, up: 0x32485c, pale: 0x364b5d, glow: 0x394e5e },
  boxGreen:  { deep: 0x0f1719, shade: 0x16201f, dim: 0x222d1f, lit: 0x2d3920, down: 0x2f4431, top: 0x374d34, up: 0x3f5635, pale: 0x435a35, glow: 0x475d36 },
  boxGrey:   { deep: 0x161826, shade: 0x1f212f, dim: 0x302e30, lit: 0x403a30, down: 0x43454a, top: 0x4e4e4e, up: 0x5b5850, pale: 0x615b51, glow: 0x665f51 },
  boxOrange: { deep: 0x221814, shade: 0x312119, dim: 0x4b2e19, lit: 0x653a19, down: 0x6a4527, top: 0x7b4e29, up: 0x8f5829, pale: 0x975b2a, glow: 0xa05f2a },
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
  // Resume level 2: per-window lights (warm and cool)
  windowWarm: 0xffd9a0,
  windowCool: 0xa8d8ff,
  spark: 0xffb347, // welding sparks (animated only); not darkened
  ink: 0xd8d4e8, // text of the lab pages (lab/*.html); not darkened
} as const;

export type Material = keyof typeof ISO_TONES;
export type Tone = "deep" | "shade" | "dim" | "lit" | "down" | "top" | "up" | "pale" | "glow";
export type AccentColor = Exclude<keyof typeof ISO_COLORS, "shadow" | "sky" | "ink">;
export const ACCENT_COLORS: readonly AccentColor[] = ["cyan", "cyanMid", "cyanBleed", "amber", "amberMid", "amberBleed", "magenta", "magentaMid", "magentaBleed", "windowWarm", "windowCool", "spark"];

/** Dark to light. `stepTone` moves along this. */
export const TONE_LADDER: readonly Tone[] = ["deep", "shade", "dim", "lit", "down", "top", "up", "pale", "glow"];

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
