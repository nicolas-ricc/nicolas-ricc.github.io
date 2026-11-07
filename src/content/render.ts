import type { Article, ContentItem, ContentSection, Project, ZoneContent } from "./types";

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

/** Up-and-right arrow, the usual mark of an external link. */
const EXTERNAL_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>';

/** "Name ↗ (repo)": the url goes as an icon, each part only if it exists. */
function renderProject(pr: Project): string {
  const name = escapeHtml(pr.nombre);
  const url = pr.url
    ? ` <a class="externo" href="${escapeHtml(pr.url)}" target="_blank" rel="noopener" aria-label="Abrir ${name}" title="${escapeHtml(pr.url)}">${EXTERNAL_ICON}</a>`
    : "";
  const repo = pr.repo ? ` (<a href="${escapeHtml(pr.repo)}" target="_blank" rel="noopener">repo</a>)` : "";
  return `<li>${name}${url}${repo}</li>`;
}

function renderArticle(ar: Article): string {
  const desc = ar.descripcion ? `<p>${escapeHtml(ar.descripcion)}</p>` : "";
  return `<li><a href="${escapeHtml(ar.url)}" target="_blank" rel="noopener">${escapeHtml(ar.titulo)}</a>${desc}</li>`;
}

/** Arrow into a tray; the color comes from the CSS (currentColor). */
const DOWNLOAD_ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>';

/** The labels name the CV because validateContent only allows `pdf` on the cv zone. */
function renderPdf(url: string): string {
  const u = escapeHtml(url);
  const download = `<a class="pdf-download" href="${u}" download aria-label="Descargar CV en PDF" title="Descargar CV en PDF">${DOWNLOAD_ICON}</a>`;
  // without an embedded PDF viewer (e.g. Chrome on Android) the browser shows the object's content
  const fallback = `<p>Este navegador no muestra el PDF acá: <a href="${u}" target="_blank" rel="noopener">abrir el CV</a>.</p>`;
  return `<div class="pdf-viewer">${download}<object class="pdf-embed" data="${u}" type="application/pdf" aria-label="CV en PDF">${fallback}</object></div>`;
}

export function renderContent(zone: ZoneContent): string {
  // with a PDF the panel shows only the viewer; the h1 stays for screen readers
  if (zone.pdf) return `<h1 class="sr-only">${escapeHtml(zone.titulo)}</h1>${renderPdf(zone.pdf)}`;
  // with a project list the panel shows only the list; the h1 stays for screen readers
  if (zone.proyectos) return `<h1 class="sr-only">${escapeHtml(zone.titulo)}</h1><ul class="proyectos">${zone.proyectos.map(renderProject).join("")}</ul>`;
  // with an article list the panel shows only the linked titles; the h1 stays for screen readers
  if (zone.articulos) return `<h1 class="sr-only">${escapeHtml(zone.titulo)}</h1><ul class="articulos">${zone.articulos.map(renderArticle).join("")}</ul>`;
  const lead = zone.descripcion ? `<p class="lead">${escapeHtml(zone.descripcion)}</p>` : "";
  return `<h1>${escapeHtml(zone.titulo)}</h1>${lead}${zone.secciones.map(renderSection).join("")}`;
}
