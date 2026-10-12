import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mergeBlogFeed } from "../src/content/blog-feed";
import { renderContent } from "../src/content/render";
import type { ZoneContent } from "../src/content/types";
import { ZONES } from "../src/map/zones";
import { injectZone } from "./inject";

const index = readFileSync("dist/index.html", "utf8");
const feed = JSON.parse(readFileSync("content/blog.generated.json", "utf8")) as { items: { title: string; url: string; date: string }[] };

for (const z of ZONES) {
  let content = JSON.parse(readFileSync(`content/${z.id}.json`, "utf8")) as ZoneContent;
  if (z.id === "blog") content = mergeBlogFeed(content, feed.items);
  mkdirSync(`dist/${z.path}`, { recursive: true });
  writeFileSync(`dist/${z.path}/index.html`, injectZone(index, z.id, z.name, renderContent(content)));
  console.log(`prerender: /${z.path}/`);
}
copyFileSync("dist/index.html", "dist/404.html"); // GitHub Pages: rutas desconocidas cargan el mapa
