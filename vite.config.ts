import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

// Las páginas del lab (storybook, kit, mundo…) se publican junto al sitio en
// /lab/<page>.html para poder verlas sin levantar el dev server. Llevan noindex.
const lab = Object.fromEntries(
  readdirSync(resolve(import.meta.dirname, "lab"))
    .filter((f) => f.endsWith(".html"))
    .map((f) => [`lab/${f.slice(0, -5)}`, resolve(import.meta.dirname, "lab", f)]),
);

export default defineConfig({
  base: "/", // user site: la raíz de myxomatosis.xyz (el blog Hugo vive en /blog/)
  build: {
    target: "es2022",
    sourcemap: false,
    rollupOptions: { input: { main: resolve(import.meta.dirname, "index.html"), ...lab } },
  },
  server: {
    // Por defecto Vite escucha sólo en [::1] y `tailscale serve` proxea a
    // 127.0.0.1 (502). Forzar IPv4 y aceptar el Host del dominio MagicDNS.
    host: "127.0.0.1",
    allowedHosts: ["nicolasr.tail74aaf1.ts.net"],
  },
});
