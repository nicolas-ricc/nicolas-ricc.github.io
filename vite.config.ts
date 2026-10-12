import { defineConfig } from "vite";

export default defineConfig({
  base: "/", // user site: la raíz de myxomatosis.xyz (el blog Hugo vive en /blog/)
  build: { target: "es2022", sourcemap: false },
  server: {
    // Por defecto Vite escucha sólo en [::1] y `tailscale serve` proxea a
    // 127.0.0.1 (502). Forzar IPv4 y aceptar el Host del dominio MagicDNS.
    host: "127.0.0.1",
    allowedHosts: ["nicolasr.tail74aaf1.ts.net"],
  },
});
