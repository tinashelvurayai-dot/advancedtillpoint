import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: {
      host: "0.0.0.0",
      strictPort: false,
    },
    preview: {
      host: "0.0.0.0",
      strictPort: false,
    },
    plugins: [
      VitePWA({
        registerType: "prompt",
        injectRegister: null,
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        outDir: "dist/client",
        manifest: false,
        devOptions: { enabled: false },
        includeAssets: [
          "favicon.ico",
          "offline.html",
          "manifest.webmanifest",
          "icons/icon-192.png",
          "icons/icon-512.png",
          "icons/apple-touch-icon.png",
        ],
        injectManifest: {
          globPatterns: ["**/*.{js,mjs,css,html,ico,png,svg,woff,woff2,webmanifest,json}"],
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          additionalManifestEntries: [{ url: "/", revision: `${Date.now()}` }],
        },
      }),
    ],

  },
});
