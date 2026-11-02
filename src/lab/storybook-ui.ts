/** Ids que `lab/storybook.html` debe tener; un test lo comprueba contra el HTML. */
export const STORYBOOK_IDS = ["lab-host", "exhibits", "readout"] as const;

export interface StorybookElements { host: HTMLElement; nav: HTMLElement; panel: HTMLElement }

/** Resuelve los tres elementos; si faltan, lanza nombrándolos todos (en el orden de STORYBOOK_IDS). */
export function storybookElements(doc: Document): StorybookElements {
  const missing = STORYBOOK_IDS.filter((id) => !doc.getElementById(id)).map((id) => `#${id}`);
  if (missing.length) throw new Error(`${missing.length === 1 ? "falta" : "faltan"} ${missing.join(", ")} en la página`);
  const el = (id: (typeof STORYBOOK_IDS)[number]): HTMLElement => doc.getElementById(id) as HTMLElement;
  return { host: el("lab-host"), nav: el("exhibits"), panel: el("readout") };
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
    const target = doc.getElementById(STORYBOOK_IDS[0]) ?? doc.body;
    target.textContent = `No se pudo iniciar el storybook: ${err instanceof Error ? err.message : String(err)}`;
  }
}
