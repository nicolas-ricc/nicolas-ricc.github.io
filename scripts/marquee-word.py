"""Turns a word set in a display font into the filled-letter geometry the signs use (`src/kit/marquee.ts`).

The fonts' licenses do not let the repo distribute them, so no TTF is in the
repo: download it and pass its path. What is committed is only the composed
word, as artwork. The two words in use:

    # Neon Light (Font Bundles): https://www.1001fonts.com/neon-light-font.html
    python3 -P scripts/marquee-word.py ~/Downloads/NeonLight-Regular.ttf RESUME MARQUEE_RESUME \
      "Neon Light (Font Bundles, free for commercial use; Premium License)" > src/kit/marquee-resume.ts
    # CNRGN Builder (Brylle Conrad Co): https://justfreefonts.com/fonts/cnrgn-builder/
    python3 -P scripts/marquee-word.py ~/Downloads/CNRGN-Builder.ttf PORTFOLIO BUILDER_PORTFOLIO \
      "CNRGN Builder (Brylle Conrad Co, free for personal and commercial use)" 0.0075 > src/kit/builder-portfolio.ts

Bulbs are the small round holes of a marquee font; a font without them gives none (`bulbRadius` 0).
A letter may have more than one outer contour (the dot of an `i`): the largest is `outline`, the rest
`parts`. The cap height is the font's `sCapHeight`, or the top of its `H` when the font does not say.
An optional fifth argument erodes every face by that many cap heights per side (shapely, mitred joins), to
thin a heavy font into the legibility rules; PORTFOLIO uses 0.0075 (face 0.175 → 0.16 cap heights).
An optional sixth argument spaces the letters by the air between their faces instead of the font's advances:
each letter is moved so that its nearest distance to the one before is that many cap heights (shapely).
An optional seventh argument closes each letter: its even-odd shape (every contour) gets `buffer(+d).buffer(-d)`
(mitred joins), which must stay one polygon; the exterior is the outline, the holes the counters, and there are no
parts. It runs before the erosion. Writing uses it for LostWages, which draws double tubes (two strokes with a
slit of about 0.015-0.02 cap heights down the middle of each stem); the closing fills the slit. A negative
`thin` grows the face:

    # LostWages (Nick Curtis, 1001Fonts Free For Commercial Use): https://www.1001fonts.com/lostwages-font.html
    # download: https://www.1001fonts.com/download/lostwages.zip
    python3 -P scripts/marquee-word.py ~/Downloads/LOSTWAGE.TTF WRITING LOSTWAGES_WRITING \
      "LostWages (Nick Curtis, 1001Fonts Free For Commercial Use)" -0.0133 0.145 0.015 > src/kit/lostwages-writing.ts

Needs fontTools and, to erode, space or close, shapely (`pip install fonttools shapely`); tested with
fontTools 4.46.0 / shapely 2.0.3 and with 4.68.0 / 2.2.0.
"""
import math
import sys

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont

STEPS = 4  # segments per quadratic curve


class Flatten(BasePen):
    def __init__(self, glyphs):
        super().__init__(glyphs)
        self.contours = []

    def _moveTo(self, p):
        self.contours.append([p])

    def _lineTo(self, p):
        self.contours[-1].append(p)

    def _qCurveToOne(self, a, b):
        p0 = self.contours[-1][-1]
        for i in range(1, STEPS + 1):
            t = i / STEPS
            self.contours[-1].append(tuple((1 - t) ** 2 * p0[k] + 2 * (1 - t) * t * a[k] + t * t * b[k] for k in (0, 1)))

    def _curveToOne(self, a, b, c):
        p0 = self.contours[-1][-1]
        for i in range(1, STEPS + 1):
            t = i / STEPS
            u = 1 - t
            self.contours[-1].append(tuple(u**3 * p0[k] + 3 * u * u * t * a[k] + 3 * u * t * t * b[k] + t**3 * c[k] for k in (0, 1)))


def area(c):
    return sum(c[i][0] * c[i - 1][1] - c[i - 1][0] * c[i][1] for i in range(len(c))) / 2


def erode(body, counters, d):
    from shapely.geometry import Polygon

    g = Polygon(body, counters).buffer(-d, join_style="mitre", mitre_limit=4)
    if g.geom_type != "Polygon":
        raise SystemExit("erode: a letter split in pieces")
    ring = lambda r: list(r.coords)[:-1]
    out = ring(g.exterior)
    if area(out) < 0:
        out.reverse()
    return out, [ring(i) for i in g.interiors]


def closing(contours, d):
    from shapely.geometry import Polygon

    g = None
    for c in contours:
        p = Polygon(c).buffer(0)
        g = p if g is None else g.symmetric_difference(p)  # even-odd
    g = g.buffer(d, join_style="mitre", mitre_limit=4).buffer(-d, join_style="mitre", mitre_limit=4)
    if g.geom_type != "Polygon":
        raise SystemExit("close: a letter split in pieces")
    ring = lambda r: list(r.coords)[:-1]
    out = ring(g.exterior)
    if area(out) < 0:
        out.reverse()
    return out, [ring(i) for i in g.interiors]


def main(path, word, name, credit, thin="0", air="0", close="0"):
    font = TTFont(path)
    glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
    cap = getattr(font["OS/2"], "sCapHeight", 0)
    if not cap:
        from fontTools.pens.boundsPen import BoundsPen

        bp = BoundsPen(glyphs)
        glyphs[cmap[ord("H")]].draw(bp)
        cap = bp.bounds[3]
    n = lambda v: round(v / cap, 4)
    pts = lambda c: ", ".join(f"{n(x)}, {n(y)}" for x, y in (c[:-1] if c[0] == c[-1] else c))
    out, dx, radius = [], 0, None
    for ch in word:
        g = glyphs[cmap[ord(ch)]]
        pen = Flatten(glyphs)
        g.draw(pen)
        bodies, counters, bulbs = [], [], []
        for c in pen.contours:
            a = area(c)
            xs, ys = [p[0] for p in c], [p[1] for p in c]
            w, h = max(xs) - min(xs), max(ys) - min(ys)
            if a > 0:
                bodies.append(c)
            elif max(w, h) < 0.06 * cap and abs(abs(a) / (math.pi * w * h / 4) - 1) < 0.1:
                bulbs.append(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2))
                radius = (w + h) / 4 if radius is None else radius
            else:
                counters.append(c)
        bodies.sort(key=lambda c: -area(c))
        body, parts = bodies[0], bodies[1:]
        if float(close):
            body, counters = closing(bodies + counters, float(close) * cap)
            parts = []
        if float(thin):
            if parts:
                raise SystemExit(f"{ch}: erode does not handle letters in pieces")
            body, counters = erode(body, counters, float(thin) * cap)
        shift = lambda c: [(x + dx, y) for x, y in c]
        if float(air) and out:
            from shapely.geometry import Polygon
            from shapely.ops import unary_union

            shape = lambda b, cs, ps, x: unary_union([Polygon([(u + x, v) for u, v in b], [[(u + x, v) for u, v in c] for c in cs])] + [Polygon([(u + x, v) for u, v in q]) for q in ps])
            prev = shape(out[-1][1], out[-1][2], out[-1][5], 0)
            lo, hi = out[-1][4], dx + 2 * cap  # from the previous letter's origin rightwards the distance only grows
            for _ in range(60):
                mid = (lo + hi) / 2
                if prev.distance(shape(body, counters, parts, mid)) < float(air) * cap:
                    lo = mid
                else:
                    hi = mid
            dx = hi
        out.append((ch, shift(body), [shift(c) for c in counters], [(x + dx, y) for x, y in bulbs], dx, [shift(c) for c in parts]))
        dx += g.width
    lines = [
        f"// Generated by scripts/marquee-word.py from {credit}.",
        "// Only the composed word is committed, never the font. Do not edit by hand.",
        'import type { Vec2 } from "../iso/geometry";',
        'import type { MarqueeLetter } from "./marquee";',
        "",
        "const poly = (...c: number[]): Vec2[] => { const o: Vec2[] = []; for (let i = 0; i < c.length; i += 2) o.push({ x: c[i]!, y: c[i + 1]! }); return o; };",
        "",
        f"/** The word {word}, laid out with the font's advances: `width` and `bulbRadius` in cap-height units. */",
        f"export const {name} = {{",
        f"  text: {word!r},".replace("'", '"'),
        f"  width: {n(dx)},",
        f"  bulbRadius: {n(radius or 0)},",
        "  letters: [",
    ]
    for ch, body, counters, bulbs, _, parts in out:
        extra = f" parts: [{', '.join(f'poly({pts(c)})' for c in parts)}]," if parts else ""
        lines.append(f'    {{ char: "{ch}", outline: poly({pts(body)}),{extra}')
        lines.append(f"      counters: [{', '.join(f'poly({pts(c)})' for c in counters)}],")
        lines.append(f"      bulbs: {'poly(' + ', '.join(f'{n(x)}, {n(y)}' for x, y in bulbs) + ')' if bulbs else '[]'} }},")
    lines += ["  ] as MarqueeLetter[],", "} as const;", ""]
    sys.stdout.write("\n".join(lines))


if __name__ == "__main__":
    main(*sys.argv[1:8])
