import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import blog from "../../content/blog.json";
import cv from "../../content/cv.json";
import portfolio from "../../content/portfolio.json";
import { validateContent } from "./validate";

const ok = {
  id: "portfolio",
  titulo: "Portfolio",
  secciones: [{ subtitulo: "Juegos", items: [{ titulo: "X", descripcion: "d", links: [{ label: "Repo", url: "https://x" }] }] }],
};

describe("validateContent", () => {
  it("acepta contenido válido", () => {
    expect(validateContent(ok)).toEqual([]);
  });
  it("rechaza id desconocido y campos faltantes", () => {
    const errs = validateContent({ id: "nada", secciones: [] });
    expect(errs.some((e) => e.startsWith("id"))).toBe(true);
    expect(errs.some((e) => e.startsWith("titulo"))).toBe(true);
  });
  it("señala el path del error anidado", () => {
    const bad = structuredClone(ok) as { secciones: { items: { links: { url?: string }[] }[] }[] };
    delete bad.secciones[0]!.items[0]!.links[0]!.url;
    expect(validateContent(bad)).toEqual(["secciones[0].items[0].links[0].url: falta o no es string"]);
  });
  it("valida proyectos", () => {
    expect(validateContent({ ...ok, proyectos: [{ nombre: "A", url: "https://a" }, { nombre: "B", repo: "https://b" }] })).toEqual([]);
    expect(validateContent({ ...ok, proyectos: [{ url: "https://a" }, { nombre: "B", repo: 3 }] })).toEqual([
      "proyectos[0].nombre: falta o no es string",
      "proyectos[1].repo: no es string",
    ]);
  });
  it("valida artículos", () => {
    expect(validateContent({ ...ok, articulos: [{ titulo: "A", url: "https://a" }, { titulo: "B", url: "https://b", descripcion: "d" }] })).toEqual([]);
    expect(validateContent({ ...ok, articulos: [{ titulo: "A", url: "https://a", descripcion: 1 }] })).toEqual(["articulos[0].descripcion: no es string"]);
    expect(validateContent({ ...ok, articulos: [{ url: "https://a" }, { titulo: "B" }] })).toEqual([
      "articulos[0].titulo: falta o no es string",
      "articulos[1].url: falta o no es string",
    ]);
  });
  it("rechaza lo que no es objeto", () => {
    expect(validateContent(null)).toEqual(["raíz: no es un objeto"]);
  });
  it("los JSON del repo son válidos", () => {
    for (const c of [portfolio, cv, blog]) expect(validateContent(c)).toEqual([]);
  });
});

describe("cv.json", () => {
  it("apunta a /cv.pdf y public/cv.pdf es un PDF", () => {
    expect(cv.pdf).toBe("/cv.pdf");
    const bytes = readFileSync(new URL("../../public/cv.pdf", import.meta.url));
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
  it("no trae texto fuera del PDF", () => {
    expect(cv).not.toHaveProperty("descripcion");
    expect(cv.secciones).toEqual([]);
    expect(JSON.stringify(cv)).not.toMatch(/pendiente/i);
  });
});

describe("portfolio.json", () => {
  it("es una lista de proyectos sin categorías", () => {
    expect(portfolio.secciones).toEqual([]);
    expect(portfolio).not.toHaveProperty("descripcion");
    expect(portfolio.proyectos.map((p) => p.nombre)).toEqual(["Ballotage", "Damodaran", "Hammurabi", "Map"]);
  });
});

describe("blog.json", () => {
  it("no trae título visible, copete ni secciones", () => {
    expect(blog).not.toHaveProperty("descripcion");
    expect(blog.secciones).toEqual([]);
  });
});
