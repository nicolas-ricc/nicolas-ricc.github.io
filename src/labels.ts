/** DOM side of the zone links over the signs (#393): placing each link and marking the current one. */
import type { ZoneId } from "./map/zones";
import type { LabelLayout } from "./world/signs";

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
