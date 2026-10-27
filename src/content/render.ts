import type { Articulo, ContentItem, ContentSection, Proyecto, ZoneContent } from "./types";

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function renderItem(item: ContentItem): string {
  const links = item.links
    .map((l) => `<li><a href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.label)}</a></li>`)
    .join("");
  const desc = item.descripcion ? `<p>${escapeHtml(item.descripcion)}</p>` : "";
  return `<article><h3>${escapeHtml(item.titulo)}</h3>${desc}<ul class="links">${links}</ul></article>`;
}

function renderSection(sec: ContentSection): string {
  return `<section><h2>${escapeHtml(sec.subtitulo)}</h2>${sec.items.map(renderItem).join("")}</section>`;
}

/** Flecha hacia arriba a la derecha, la marca usual de link externo. */
const EXTERNAL_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>';

/** "Nombre ↗ (repo)": la url va como ícono, cada parte solo si existe. */
function renderProyecto(pr: Proyecto): string {
  const nombre = escapeHtml(pr.nombre);
  const url = pr.url
    ? ` <a class="externo" href="${escapeHtml(pr.url)}" target="_blank" rel="noopener" aria-label="Abrir ${nombre}" title="${escapeHtml(pr.url)}">${EXTERNAL_ICON}</a>`
    : "";
  const repo = pr.repo ? ` (<a href="${escapeHtml(pr.repo)}" target="_blank" rel="noopener">repo</a>)` : "";
  return `<li>${nombre}${url}${repo}</li>`;
}

function renderArticulo(ar: Articulo): string {
  return `<li><a href="${escapeHtml(ar.url)}" target="_blank" rel="noopener">${escapeHtml(ar.titulo)}</a></li>`;
}

/** Flecha hacia una bandeja; el color lo pone el CSS (currentColor). */
const DOWNLOAD_ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>';

function renderPdf(url: string): string {
  const u = escapeHtml(url);
  const download = `<a class="pdf-download" href="${u}" download aria-label="Descargar CV en PDF" title="Descargar CV en PDF">${DOWNLOAD_ICON}</a>`;
  // sin visor de PDF embebido (p. ej. Chrome en Android) el navegador muestra el contenido del object
  const fallback = `<p>Este navegador no muestra el PDF acá: <a href="${u}" target="_blank" rel="noopener">abrir el CV</a>.</p>`;
  return `<div class="pdf-viewer">${download}<object class="pdf-embed" data="${u}" type="application/pdf" aria-label="CV en PDF">${fallback}</object></div>`;
}

export function renderContent(zone: ZoneContent): string {
  // con PDF el panel muestra solo el visor; el h1 queda para lectores de pantalla
  if (zone.pdf) return `<h1 class="sr-only">${escapeHtml(zone.titulo)}</h1>${renderPdf(zone.pdf)}`;
  // con lista de proyectos el panel muestra solo la lista; el h1 queda para lectores de pantalla
  if (zone.proyectos) return `<h1 class="sr-only">${escapeHtml(zone.titulo)}</h1><ul class="proyectos">${zone.proyectos.map(renderProyecto).join("")}</ul>`;
  // con lista de artículos el panel muestra solo los títulos enlazados; el h1 queda para lectores de pantalla
  if (zone.articulos) return `<h1 class="sr-only">${escapeHtml(zone.titulo)}</h1><ul class="articulos">${zone.articulos.map(renderArticulo).join("")}</ul>`;
  const lead = zone.descripcion ? `<p class="lead">${escapeHtml(zone.descripcion)}</p>` : "";
  return `<h1>${escapeHtml(zone.titulo)}</h1>${lead}${zone.secciones.map(renderSection).join("")}`;
}
