import type { FeedItem, ZoneContent } from "./types";

const decode = (s: string): string =>
  s.replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

export function parseRss(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  for (const m of xml.matchAll(/<item>(.*?)<\/item>/gs)) {
    const body = m[1] ?? "";
    const title = /<title>(.*?)<\/title>/s.exec(body)?.[1];
    const link = /<link>(.*?)<\/link>/s.exec(body)?.[1];
    const pub = /<pubDate>(.*?)<\/pubDate>/s.exec(body)?.[1];
    if (!title || !link) continue;
    const d = pub ? new Date(pub) : null;
    const date = d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : "";
    items.push({ title: decode(title), url: decode(link), date });
  }
  return items;
}

export function mergeBlogFeed(blog: ZoneContent, items: FeedItem[]): ZoneContent {
  return { ...blog, articulos: items.slice(0, 5).map((it) => ({ titulo: it.title, url: it.url })) };
}
