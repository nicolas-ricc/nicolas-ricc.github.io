import { describe, expect, it } from "vitest";
import { mergeBlogFeed, parseRss } from "./blog-feed";
import type { ZoneContent } from "./types";

const rss = `<?xml version="1.0"?><rss><channel><title>Myxomatosis</title>
<item><title>Rawls como puente</title><link>https://myxomatosis.xyz/blog/rawls/</link><pubDate>Tue, 08 Sep 2026 23:41:00 +0000</pubDate><description>&lt;p&gt;&lt;em&gt;¿Puede un &amp;quot;velo&amp;quot;
 dar cuenta del mundo?&lt;/em&gt;&lt;/p&gt;</description></item>
<item><title>A palabras &amp; necias</title><link>https://myxomatosis.xyz/blog/necias/</link><pubDate>Mon, 01 Jun 2026 10:00:00 +0000</pubDate></item>
</channel></rss>`;

describe("parseRss", () => {
  it("extracts items with an ISO date and decoded entities", () => {
    expect(parseRss(rss)).toEqual([
      { title: "Rawls como puente", url: "https://myxomatosis.xyz/blog/rawls/", date: "2026-09-08", description: '¿Puede un "velo" dar cuenta del mundo?' },
      { title: "A palabras & necias", url: "https://myxomatosis.xyz/blog/necias/", date: "2026-06-01" },
    ]);
  });
  it("returns empty when there are no items", () => {
    expect(parseRss("<rss></rss>")).toEqual([]);
  });
});

describe("mergeBlogFeed", () => {
  const blog: ZoneContent = { id: "blog", titulo: "Blog", secciones: [] };
  it("builds the article list, title and link, at most 5", () => {
    const items = Array.from({ length: 7 }, (_, i) => ({ title: `P${i}`, url: `https://x/${i}`, date: "2026-01-01" }));
    const out = mergeBlogFeed(blog, items);
    expect(out.secciones).toEqual([]);
    expect(out.articulos).toHaveLength(5);
    expect(out.articulos![0]).toEqual({ titulo: "P0", url: "https://x/0" });
  });
  it("passes the feed description through when there is one", () => {
    const out = mergeBlogFeed(blog, [{ title: "A", url: "https://a", date: "", description: "Resumen." }, { title: "B", url: "https://b", date: "" }]);
    expect(out.articulos).toEqual([{ titulo: "A", url: "https://a", descripcion: "Resumen." }, { titulo: "B", url: "https://b" }]);
  });
  it("with no items the list is empty", () => {
    expect(mergeBlogFeed(blog, []).articulos).toEqual([]);
  });
});
