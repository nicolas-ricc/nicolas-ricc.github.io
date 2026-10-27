import type { ZoneId } from "../map/zones";

export interface LinkItem { label: string; url: string }
export interface ContentItem { titulo: string; descripcion?: string; links: LinkItem[] }
/** Proyecto del portfolio: sin url si no hay versión pública, sin repo si es privado. */
export interface Proyecto { nombre: string; url?: string; repo?: string }
export interface ContentSection { subtitulo: string; items: ContentItem[] }
export interface ZoneContent {
  id: ZoneId;
  titulo: string;
  descripcion?: string;
  pdf?: string;
  proyectos?: Proyecto[];
  secciones: ContentSection[];
}
export interface FeedItem { title: string; url: string; date: string }
