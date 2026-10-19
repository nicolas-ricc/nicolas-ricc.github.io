import type { ContentItem, ContentSection, ZoneContent } from "./types";

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

/** Flecha hacia una bandeja; el color lo pone el CSS (currentColor). */
const DOWNLOAD_ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>';

function renderPdf(url: string): string {
  const u = escapeHtml(url);
  const download = `<a class="pdf-download" href="${u}" download aria-label="Descargar CV en PDF" title="Descargar CV en PDF">${DOWNLOAD_ICON}</a>`;
  // sin visor de PDF embebido (p. ej. Chrome en Android) el navegador muestra el contenido del object
  const fallback = `<p>Este navegador no muestra el PDF acá: <a href="${u}" target="_blank" rel="noopener">abrir el CV</a>.</p>`;
  return `<div class="pdf-viewer">${download}<object class="pdf-embed" data="${u}" type="application/pdf" aria-label="CV en PDF">${fallback}</object></div>`;
}

export function renderContent(zone: ZoneContent): string {
  const lead = zone.descripcion ? `<p class="lead">${escapeHtml(zone.descripcion)}</p>` : "";
  const pdf = zone.pdf ? renderPdf(zone.pdf) : "";
  return `<h1>${escapeHtml(zone.titulo)}</h1>${lead}${pdf}${zone.secciones.map(renderSection).join("")}`;
}
