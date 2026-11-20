import type { ZoneId } from "./map/zones";

const body = document.body;
const content = (): HTMLElement => document.getElementById("content")!;
const hud = (): HTMLElement => document.getElementById("hud")!;

export function showMap(): void {
  body.dataset.zone = "";
  body.classList.remove("zone");
  content().hidden = true;
  hud().hidden = true;
  document.title = "Nicolás Riccomini";
}

export function showZone(id: ZoneId, name: string, html: string | null): void {
  body.dataset.zone = id;
  body.classList.add("zone");
  if (html !== null) content().innerHTML = html;
  content().hidden = false;
  hud().hidden = false;
  document.title = `${name} · Nicolás Riccomini`;
}
