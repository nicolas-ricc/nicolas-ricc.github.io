import type { ZoneId } from "../map/zones";

export interface LinkItem { label: string; url: string }
export interface ContentItem { titulo: string; descripcion?: string; links: LinkItem[] }
/** Portfolio project: no url if there is no public version, no repo if it is private. */
export interface Project { nombre: string; url?: string; repo?: string }
/** Blog article: the title is the link; below it, the summary the blog shows. */
export interface Article { titulo: string; url: string; descripcion?: string }
export interface ContentSection { subtitulo: string; items: ContentItem[] }
export interface ZoneContent {
  id: ZoneId;
  titulo: string;
  descripcion?: string;
  /** Only the cv zone may declare it (enforced by `validateContent`). */
  pdf?: string;
  proyectos?: Project[];
  articulos?: Article[];
  secciones: ContentSection[];
}
export interface FeedItem { title: string; url: string; date: string; description?: string }
