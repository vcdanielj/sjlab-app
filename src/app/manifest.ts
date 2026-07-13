import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SJ Lab — Sistema de Gestión",
    short_name: "SJ Lab",
    description:
      "Sistema de gestión integral para laboratorio dental protésico. Producción, finanzas y portal de clientes.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FBFBFB",
    theme_color: "#111111",
    lang: "es",
    categories: ["business", "productivity", "medical"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
