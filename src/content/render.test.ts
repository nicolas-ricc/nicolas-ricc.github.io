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
  const html = renderContent(zone);
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
  it("va entre el lead y las secciones", () => {
    expect(html.indexOf("<h2>")).toBeGreaterThan(-1);
    expect(html.indexOf("pdf-viewer")).toBeGreaterThan(html.indexOf('class="lead"'));
    expect(html.indexOf("pdf-viewer")).toBeLessThan(html.indexOf("<h2>"));
  });
  it("escapa la URL en href y data", () => {
    const raro = renderContent({ ...zone, pdf: '/a"b&c.pdf' });
    expect(raro).toContain('href="/a&quot;b&amp;c.pdf"');
    expect(raro).toContain('data="/a&quot;b&amp;c.pdf"');
    expect(raro).not.toContain('/a"b');
  });
});
