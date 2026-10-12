import { describe, expect, it } from "vitest";
import { mergeBlogFeed, parseRss } from "./blog-feed";
import type { ZoneContent } from "./types";

const rss = `<?xml version="1.0"?><rss><channel><title>Myxomatosis</title>
<item><title>Rawls como puente</title><link>https://myxomatosis.xyz/blog/rawls/</link><pubDate>Tue, 08 Sep 2026 23:41:00 +0000</pubDate></item>
<item><title>A palabras &amp; necias</title><link>https://myxomatosis.xyz/blog/necias/</link><pubDate>Mon, 01 Jun 2026 10:00:00 +0000</pubDate></item>
</channel></rss>`;

describe("parseRss", () => {
  it("extrae items con fecha ISO y entidades decodificadas", () => {
    expect(parseRss(rss)).toEqual([
      { title: "Rawls como puente", url: "https://myxomatosis.xyz/blog/rawls/", date: "2026-09-08" },
      { title: "A palabras & necias", url: "https://myxomatosis.xyz/blog/necias/", date: "2026-06-01" },
    ]);
  });
  it("devuelve vacío si no hay items", () => {
    expect(parseRss("<rss></rss>")).toEqual([]);
  });
});

describe("mergeBlogFeed", () => {
  const blog: ZoneContent = { id: "blog", titulo: "Blog", secciones: [{ subtitulo: "Secciones", items: [] }] };
  it("agrega 'Últimos posts' con máximo 5", () => {
    const items = Array.from({ length: 7 }, (_, i) => ({ title: `P${i}`, url: `https://x/${i}`, date: "2026-01-01" }));
    const out = mergeBlogFeed(blog, items);
    expect(out.secciones).toHaveLength(2);
    expect(out.secciones[1]!.subtitulo).toBe("Últimos posts");
    expect(out.secciones[1]!.items).toHaveLength(5);
    expect(out.secciones[1]!.items[0]).toEqual({ titulo: "P0", descripcion: "2026-01-01", links: [{ label: "Leer", url: "https://x/0" }] });
  });
  it("sin items devuelve el mismo contenido", () => {
    expect(mergeBlogFeed(blog, [])).toEqual(blog);
  });
});
