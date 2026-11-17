/** DOM side of the zone links over the signs (#393): placing each link and marking the current one. */
import type { ZoneId } from "./map/zones";
import { labelLayout, type LabelLayout, type ScreenBox } from "./world/signs";
import type { View } from "./world/view";

/** Sizes the link over its sign (`on-sign`) or centers it at the host edge (`on-edge`). */
export function applyLabel(a: HTMLElement, l: LabelLayout): void {
  const px = (n: number): string => `${n.toFixed(1)}px`;
  a.classList.toggle("on-sign", l.mode === "sign");
  a.classList.toggle("on-edge", l.mode === "edge");
  if (l.mode === "sign") {
    a.style.transform = `translate(${px(l.x)}, ${px(l.y)})`;
    a.style.width = px(l.w);
    a.style.height = px(l.h);
  } else {
    a.style.transform = `translate(${px(l.x)}, ${px(l.y)}) translate(-50%, -50%)`;
    a.style.width = "";
    a.style.height = "";
  }
}

/** `aria-current="page"` on the link of the active zone only. */
export function markCurrent(labels: ReadonlyMap<ZoneId, HTMLElement>, id: ZoneId | null): void {
  for (const [lid, a] of labels) {
    if (lid === id) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }
}

/**
 * Lays the link out from its sign's box. The edge clamp needs the plate's size, which the link
 * only has once it carries `on-edge`: on the pass that enters that mode, it is measured again.
 */
export function placeLabel(a: HTMLElement, box: ScreenBox, v: View, host: { w: number; h: number }, margin: number): void {
  const pad = (): { hw: number; hh: number } => ({ hw: a.offsetWidth / 2 + margin, hh: a.offsetHeight / 2 + margin });
  const wasEdge = a.classList.contains("on-edge");
  const l = labelLayout(box, v, host, pad());
  applyLabel(a, l);
  if (l.mode === "edge" && !wasEdge) applyLabel(a, labelLayout(box, v, host, pad()));
}
