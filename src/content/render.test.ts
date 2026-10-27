import { describe, expect, it } from "vitest";
import { escapeHtml, renderContent } from "./render";
import type { ZoneContent } from "./types";

const zone: ZoneContent = {
  id: "cv",
  titulo: "Resume",
  descripcion: "Quién soy & qué hago",
  pdf: "/cv.pdf",
  secciones: [{ subtitulo: "Experiencia", items: [{ titulo: "Illustrate <dev>", descripcion: "Backend", links: [{ label: "Sitio", url: "https://illustrate.example" }] }] }],
};

describe("renderContent", () => {
  const html = renderContent({ ...zone, pdf: undefined });
  it("estructura semántica", () => {
    expect(html).toContain("<h1>Resume</h1>");
    expect(html).toContain('<p class="lead">Quién soy &amp; qué hago</p>');
    expect(html).toContain("<h2>Experiencia</h2>");
    expect(html).toContain("<h3>Illustrate &lt;dev&gt;</h3>");
    expect(html).toContain('<a href="https://illustrate.example"');
    expect(html).toContain('rel="noopener"');
  });
  it("omite lead y pdf si no están", () => {
    const min = renderContent({ id: "blog", titulo: "Blog", secciones: [] });
    expect(min).not.toContain("lead");
    expect(min).not.toContain("pdf");
    expect(min).not.toContain("<object");
  });
  it("escapeHtml escapa los cinco caracteres", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});

describe("renderContent con pdf", () => {
  const html = renderContent(zone);
  const boton = html.match(/<a class="pdf-download"[^>]*>([\s\S]*?)<\/a>/);
  it("botón de descarga de solo ícono", () => {
    expect(boton).not.toBeNull();
    const tag = boton![0];
    expect(tag).toContain('href="/cv.pdf"');
    expect(tag).toMatch(/\sdownload[\s>]/);
    expect(tag).toContain('aria-label="Descargar CV en PDF"');
    expect(tag).toContain('title="Descargar CV en PDF"');
    const inner = boton![1]!;
    expect(inner).toMatch(/^<svg[\s\S]*<\/svg>$/);
    expect(inner.replace(/<[^>]*>/g, "").trim()).toBe("");
    expect(inner).toContain('aria-hidden="true"');
    expect(inner).toContain("currentColor");
  });
  it("embebe el PDF con respaldo para navegadores sin visor", () => {
    expect(html).toContain('<object class="pdf-embed" data="/cv.pdf" type="application/pdf"');
    const obj = html.match(/<object[\s\S]*?<\/object>/)![0];
    expect(obj).toMatch(/<a href="\/cv.pdf"[^>]*>/);
  });
  it("fuera del visor no hay texto visible: ni lead ni secciones", () => {
    expect(html).toContain('<h1 class="sr-only">Resume</h1>');
    expect(html).not.toContain("lead");
    expect(html).not.toContain("<h2>");
    const fuera = html.replace(/<h1 class="sr-only">[^<]*<\/h1>/, "").replace(/<div class="pdf-viewer">[\s\S]*<\/div>$/, "");
    expect(fuera).toBe("");
  });
  it("escapa la URL en href y data", () => {
    const raro = renderContent({ ...zone, pdf: '/a"b&c.pdf' });
    expect(raro).toContain('href="/a&quot;b&amp;c.pdf"');
    expect(raro).toContain('data="/a&quot;b&amp;c.pdf"');
    expect(raro).not.toContain('/a"b');
  });
});

describe("renderContent con proyectos", () => {
  const html = renderContent({
    id: "portfolio",
    titulo: "Portfolio",
    secciones: [],
    proyectos: [
      { nombre: "Ambos", url: "https://ambos.example/", repo: "https://github.com/x/ambos" },
      { nombre: "Privado", url: "http://privado.example" },
      { nombre: "Sin <url>", repo: "https://github.com/x/sin" },
    ],
  });
  const items = [...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1]!.replace(/<[^>]*>/g, ""));
  it("Nombre ↗ (repo): la url es solo un ícono, cada parte solo si existe", () => {
    expect(items.map((t) => t.trim())).toEqual(["Ambos  (repo)", "Privado", "Sin &lt;url&gt; (repo)"]);
    expect(html).not.toContain(">ambos.example<");
  });
  it("el ícono enlaza la url en pestaña nueva, con nombre accesible", () => {
    const a = html.match(/<a class="externo" href="https:\/\/ambos.example\/"[^>]*>([\s\S]*?)<\/a>/);
    expect(a).not.toBeNull();
    expect(a![0]).toContain('target="_blank" rel="noopener"');
    expect(a![0]).toContain('aria-label="Abrir Ambos"');
    expect(a![1]).toMatch(/^<svg[\s\S]*aria-hidden="true"[\s\S]*<\/svg>$/);
    expect(html).toContain('<a href="https://github.com/x/ambos" target="_blank" rel="noopener">repo</a>');
  });
  it("sin categorías, título ni copete visibles", () => {
    expect(html).toContain('<h1 class="sr-only">Portfolio</h1>');
    expect(html).not.toContain("<h2>");
    expect(renderContent({ id: "portfolio", titulo: "P", descripcion: "copete", secciones: [], proyectos: [] })).not.toContain("copete");
  });
});

describe("renderContent con artículos", () => {
  const html = renderContent({
    id: "blog",
    titulo: "Blog",
    descripcion: "copete",
    secciones: [{ subtitulo: "Secciones", items: [] }],
    articulos: [{ titulo: "Rawls & <puente>", url: "https://x/rawls/" }, { titulo: "Necias", url: "https://x/necias/" }],
  });
  it("solo la lista: cada título enlaza su artículo", () => {
    expect(html).toBe(
      '<h1 class="sr-only">Blog</h1><ul class="articulos">' +
        '<li><a href="https://x/rawls/" target="_blank" rel="noopener">Rawls &amp; &lt;puente&gt;</a></li>' +
        '<li><a href="https://x/necias/" target="_blank" rel="noopener">Necias</a></li></ul>',
    );
  });
});
