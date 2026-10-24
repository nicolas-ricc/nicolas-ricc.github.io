/** Atlas antes del oscurecimiento a crepúsculo tardío. Solo lo leen scripts/darken-palette.ts y el test: el runtime usa los literales de palette-iso.ts. */
export const DARKEN = 0.7;

export const BASE_TONES = {
  slab:      { top: 0x9a7f62, lit: 0x81613e, shade: 0x3d3942, up: 0xb89268, down: 0x82705e },
  concrete:  { top: 0xb08f72, lit: 0x926d4b, shade: 0x474049, up: 0xd1a47a, down: 0x957e6c },
  rust:      { top: 0x8c4a26, lit: 0x763811, shade: 0x372127, up: 0xa95725, down: 0x754129 },
  steel:     { top: 0x6f7280, lit: 0x605755, shade: 0x2a3350, up: 0x888489, down: 0x5c6479 },
  road:      { top: 0x4f4a52, lit: 0x483832, shade: 0x1c213b, up: 0x645756, down: 0x404150 },
  rail:      { top: 0xb8a68c, lit: 0x987e5e, shade: 0x4b4b55, up: 0xdabe97, down: 0x9c9283 },
  shallow:   { top: 0x2f7f86, lit: 0x1a4c6b, shade: 0x133550, up: 0x3b8f8f, down: 0x256b81 },
  water:     { top: 0x225f6c, lit: 0x133956, shade: 0x0e2841, up: 0x2b6c73, down: 0x1b5068 },
  waterDeep: { top: 0x183f56, lit: 0x0d2645, shade: 0x0a1a34, up: 0x20485c, down: 0x133553 },
  hullBlue:  { top: 0x2f4a6e, lit: 0x273744, shade: 0x131f42, up: 0x375370, down: 0x284167 },
  leaf:      { top: 0x3f6a33, lit: 0x3c511b, shade: 0x14302d, up: 0x537b33, down: 0x315d35 },
  leafDark:  { top: 0x2a4a27, lit: 0x2c3812, shade: 0x0b2128, up: 0x3b5726, down: 0x1f412a },
  rock:      { top: 0x6b5f55, lit: 0x5d4835, shade: 0x282b3c, up: 0x846e59, down: 0x585453 },
  sand:      { top: 0xa88f6a, lit: 0x8c6d45, shade: 0x444046, up: 0xc8a471, down: 0x8e7e65 },
  hull:      { top: 0x6e3323, lit: 0x60270f, shade: 0x2a1726, up: 0x873d21, down: 0x5b2d27 },
  deck:      { top: 0x9c7f5a, lit: 0x836138, shade: 0x3e393f, up: 0xbb925f, down: 0x837057 },
  brick:     { top: 0x8a4a3a, lit: 0x713724, shade: 0x371f23, up: 0xa0533b, down: 0x774137 },
  office:    { top: 0x8a8296, lit: 0x71605d, shade: 0x37375a, up: 0xa09299, down: 0x77728d },
  officeDark:{ top: 0x5e586c, lit: 0x4d4143, shade: 0x262541, up: 0x6d636e, down: 0x514d66 },
  glass:     { top: 0x2e3a4e, lit: 0x262b30, shade: 0x12182f, up: 0x354150, down: 0x283349 },
  asphalt:   { top: 0x45434d, lit: 0x393230, shade: 0x1c1c2e, up: 0x504b4f, down: 0x3b3b48 },
  paving:    { top: 0x8f8a84, lit: 0x756652, shade: 0x393a4f, up: 0xa69b87, down: 0x7b797c },
  plaza:     { top: 0x7c767e, lit: 0x66574e, shade: 0x32324c, up: 0x908481, down: 0x6b6876 },
  curtain:   { top: 0x3d6b7a, lit: 0x324f4c, shade: 0x182d49, up: 0x47787c, down: 0x345e73 },
  stone:     { top: 0xb5a48a, lit: 0x947956, shade: 0x484553, up: 0xd2b88d, down: 0x9c9082 },
  copper:    { top: 0x4f8a78, lit: 0x41664a, shade: 0x203a48, up: 0x5c9b7a, down: 0x447971 },
  whitewash: { top: 0xd6cfbf, lit: 0xaf9976, shade: 0x565773, up: 0xf8e8c3, down: 0xb8b6b4 },
  foam:      { top: 0xc4d3d6, lit: 0xa19c85, shade: 0x4e5980, up: 0xe3ecda, down: 0xa9bac9 },
  abyss:     { top: 0x0f2740, lit: 0x081733, shade: 0x061026, up: 0x152e45, down: 0x0c213d },
  glint:     { top: 0xf58c5a, lit: 0xc96838, shade: 0x623b36, up: 0xffc496, down: 0xd37b55 },
  signal:    { top: 0xc0392b, lit: 0x9d2a1b, shade: 0x4d181a, up: 0xdf402c, down: 0xa53228 },
  stockbrick:{ top: 0xc9a86a, lit: 0xa57c42, shade: 0x504740, up: 0xe9bc6c, down: 0xad9464 },
  safety:    { top: 0xd9a62e, lit: 0xb27b1d, shade: 0x57461c, up: 0xfcba2f, down: 0xbb922b },
} as const;

export const BASE_SHADOW = 0x2a1a3a;
export const BASE_SKY = 0x171423;

/** Cada canal RGB × factor, redondeado. */
export function darken(color: number, factor: number): number {
  const ch = (shift: number) => Math.round(((color >> shift) & 255) * factor);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
