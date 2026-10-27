import type { ZoneId } from "../map/zones";

export interface LinkItem { label: string; url: string }
export interface ContentItem { titulo: string; descripcion?: string; links: LinkItem[] }
/** Proyecto del portfolio: sin url si no hay versión pública, sin repo si es privado. */
export interface Proyecto { nombre: string; url?: string; repo?: string }
/** Artículo del blog: el título es el link. */
export interface Articulo { titulo: string; url: string }
export interface ContentSection { subtitulo: string; items: ContentItem[] }
export interface ZoneContent {
  id: ZoneId;
  titulo: string;
  descripcion?: string;
  pdf?: string;
  proyectos?: Proyecto[];
  articulos?: Articulo[];
  secciones: ContentSection[];
}
export interface FeedItem { title: string; url: string; date: string }
