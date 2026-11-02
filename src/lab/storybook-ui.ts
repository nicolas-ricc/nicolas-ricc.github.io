import type { Readout } from "./crop";
import { type Exhibit, type GroupId, outOfView } from "./exhibits";

const HOST_ID = "lab-host";
/** Ids that `lab/storybook.html` must have; a test checks them against the HTML. */
export const STORYBOOK_IDS = [HOST_ID, "exhibits", "readout"] as const;

export interface StorybookElements { host: HTMLElement; nav: HTMLElement; panel: HTMLElement }

/** Resolves the three elements; if any are missing, throws naming them all (in STORYBOOK_IDS order). */
export function storybookElements(doc: Document): StorybookElements {
  const found = STORYBOOK_IDS.map((id) => doc.getElementById(id));
  const [host, nav, panel] = found;
  if (!host || !nav || !panel) {
    const missing = STORYBOOK_IDS.filter((_, i) => !found[i]).map((id) => `#${id}`);
    throw new Error(`${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} missing from the page`);
  }
  return { host, nav, panel };
}

/**
 * Resolves the elements and runs the boot. Any synchronous error shows
 * on the page (in #lab-host, or in body if it is missing) instead of leaving it blank.
 */
export function mountStorybook(doc: Document, run: (els: StorybookElements) => void): void {
  try {
    run(storybookElements(doc));
  } catch (err) {
    console.error("[storybook] could not start", err);
    const target = doc.getElementById(HOST_ID) ?? doc.body;
    target.textContent = `Could not start the storybook: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/** One `<h2>` per group and under it a `<ul>` with one link per exhibit, in order. */
export function buildIndex(
  nav: HTMLElement,
  groups: readonly { id: GroupId; title: string }[],
  exhibits: readonly Pick<Exhibit, "id" | "title" | "group">[],
): void {
  const doc = nav.ownerDocument;
  for (const g of groups) {
    const h = doc.createElement("h2");
    h.textContent = g.title;
    const ul = doc.createElement("ul");
    for (const e of exhibits.filter((x) => x.group === g.id)) {
      const a = doc.createElement("a");
      a.href = `#${e.id}`; a.textContent = e.title; a.dataset.id = e.id;
      const li = doc.createElement("li"); li.appendChild(a); ul.appendChild(li);
    }
    nav.append(h, ul);
  }
}

/** Sets `aria-current` on the `id` entry and removes it from the others. */
export function markCurrent(nav: HTMLElement, id: string): void {
  for (const a of nav.querySelectorAll<HTMLAnchorElement>("a")) {
    if (a.dataset.id === id) {
      a.setAttribute("aria-current", "page");
      // the index does not fit whole in the column: centered, with readable neighbors; if already in view, leave it
      if (outOfView(a.getBoundingClientRect(), nav.getBoundingClientRect())) a.scrollIntoView({ block: "center" });
    } else a.removeAttribute("aria-current");
  }
}

const n1 = (x: number): string => x.toFixed(1);

/** Paints the crop's readout as a `<dl>` of nine rows, replacing the previous one. */
export function renderReadout(panel: HTMLElement, r: Readout): void {
  const b = r.box;
  const rows: [string, string][] = [
    ["Solids", String(r.solids)],
    ["Ground", String(r.ground)],
    ["Faces", String(r.faces)],
    ["Accents", String(r.accents)],
    ["Box x", b ? `${n1(b.min.x)} … ${n1(b.max.x)}` : "—"],
    ["Box y", b ? `${n1(b.min.y)} … ${n1(b.max.y)}` : "—"],
    ["Box z", b ? `${n1(b.min.z)} … ${n1(b.max.z)}` : "—"],
    ["Width × depth × height", b ? `${n1(b.w)} × ${n1(b.d)} × ${n1(b.h)} u` : "—"],
    ["Materials", r.materials.join(", ") || "—"],
    ["Accent colors", r.accentColors.join(", ") || "—"],
  ];
  const doc = panel.ownerDocument;
  const dl = doc.createElement("dl");
  for (const [k, v] of rows) {
    const dt = doc.createElement("dt"), dd = doc.createElement("dd");
    dt.textContent = k; dd.textContent = v;
    dl.append(dt, dd);
  }
  panel.replaceChildren(dl);
}
