import { writeFileSync } from "node:fs";
import { parseRss } from "../src/content/blog-feed";

const FEED_URL = "https://myxomatosis.xyz/blog/index.xml";
const OUT = "content/blog.generated.json";

async function main(): Promise<void> {
  try {
    const res = await fetch(FEED_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = parseRss(await res.text());
    writeFileSync(OUT, JSON.stringify({ items }, null, 2));
    console.log(`feed: ${items.length} posts`);
  } catch (err) {
    console.warn(`feed: no se pudo leer ${FEED_URL} (${(err as Error).message}); sigo sin 'Últimos posts'`);
    writeFileSync(OUT, JSON.stringify({ items: [] }));
  }
}
main();
