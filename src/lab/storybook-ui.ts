import type { Readout } from "./crop";
import { type Exhibit, type GroupId, outOfView } from "./exhibits";

const HOST_ID = "lab-host";
/** Ids que `lab/storybook.html` debe tener; un test lo comprueba contra el HTML. */
export const STORYBOOK_IDS = [HOST_ID, "exhibits", "readout"] as const;

export interface StorybookElements { host: HTMLElement; nav: HTMLElement; panel: HTMLElement }

/** Resuelve los tres elementos; si faltan, lanza nombrándolos todos (en el orden de STORYBOOK_IDS). */
export function storybookElements(doc: Document): StorybookElements {
  const found = STORYBOOK_IDS.map((id) => doc.getElementById(id));
  const [host, nav, panel] = found;
  if (!host || !nav || !panel) {
    const missing = STORYBOOK_IDS.filter((_, i) => !found[i]).map((id) => `#${id}`);
    throw new Error(`${missing.length === 1 ? "falta" : "faltan"} ${missing.join(", ")} en la página`);
  }
  return { host, nav, panel };
}

/**
 * Resuelve los elementos y corre el arranque. Cualquier error síncrono se ve
 * en la página (en #lab-host, o en body si falta) en vez de dejarla en blanco.
 */
export function mountStorybook(doc: Document, run: (els: StorybookElements) => void): void {
  try {
    run(storybookElements(doc));
  } catch (err) {
    console.error("[storybook] no se pudo iniciar", err);
    const target = doc.getElementById(HOST_ID) ?? doc.body;
    target.textContent = `No se pudo iniciar el storybook: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/** Un `<h2>` por grupo y bajo él un `<ul>` con un enlace por exhibit, en orden. */
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

/** Marca `aria-current` en la entrada `id` y se lo quita a las demás. */
export function markCurrent(nav: HTMLElement, id: string): void {
  for (const a of nav.querySelectorAll<HTMLAnchorElement>("a")) {
    if (a.dataset.id === id) {
      a.setAttribute("aria-current", "page");
      // el índice no entra entero en la columna: centrada, con vecinas legibles; si ya se ve, quieta
      if (outOfView(a.getBoundingClientRect(), nav.getBoundingClientRect())) a.scrollIntoView({ block: "center" });
    } else a.removeAttribute("aria-current");
  }
}

const n1 = (x: number): string => x.toFixed(1);

/** Pinta la lectura del recorte como un `<dl>` de nueve filas, reemplazando el anterior. */
export function renderReadout(panel: HTMLElement, r: Readout): void {
  const b = r.box;
  const rows: [string, string][] = [
    ["Sólidos", String(r.solids)],
    ["Suelo", String(r.ground)],
    ["Caras", String(r.faces)],
    ["Acentos", String(r.accents)],
    ["Caja x", b ? `${n1(b.min.x)} … ${n1(b.max.x)}` : "—"],
    ["Caja y", b ? `${n1(b.min.y)} … ${n1(b.max.y)}` : "—"],
    ["Caja z", b ? `${n1(b.min.z)} … ${n1(b.max.z)}` : "—"],
    ["Ancho × fondo × alto", b ? `${n1(b.w)} × ${n1(b.d)} × ${n1(b.h)} u` : "—"],
    ["Materiales", r.materials.join(", ") || "—"],
    ["Colores de acento", r.accentColors.join(", ") || "—"],
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
