import { devtools } from "@tanstack/devtools-vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite-plus";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
  plugins: [
    react(),
    devtools(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["vite.svg", "logo.webp"],
      devOptions: {
        enabled: true,
      },
      manifest: {
        name: "WealthManager",
        short_name: "Wealth",
        description: "Personal wealth management progressive web app",
        theme_color: "#0ea5e9",
        background_color: "#0b1220",
        display: "standalone",
        orientation: "portrait-primary",
        scope: "/",
        start_url: "/",
        categories: ["finance", "productivity", "utilities"],
        lang: "en",
        dir: "ltr",
        icons: [
          {
            src: "/vite.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/logo.webp",
            sizes: "72x72",
            type: "image/webp",
            purpose: "any",
          },
          {
            src: "/logo.webp",
            sizes: "96x96",
            type: "image/webp",
            purpose: "any",
          },
          {
            src: "/logo.webp",
            sizes: "128x128",
            type: "image/webp",
            purpose: "any",
          },
          {
            src: "/logo.webp",
            sizes: "144x144",
            type: "image/webp",
            purpose: "any",
          },
          {
            src: "/logo.webp",
            sizes: "152x152",
            type: "image/webp",
            purpose: "any",
          },
          {
            src: "/logo.webp",
            sizes: "192x192",
            type: "image/webp",
            purpose: "any maskable",
          },
          {
            src: "/logo.webp",
            sizes: "384x384",
            type: "image/webp",
            purpose: "any maskable",
          },
          {
            src: "/logo.webp",
            sizes: "512x512",
            type: "image/webp",
            purpose: "any maskable",
          },
        ],
        screenshots: [
          {
            src: "/logo.webp",
            sizes: "1280x720",
            type: "image/webp",
            form_factor: "wide",
            label: "WealthManager Dashboard",
          },
          {
            src: "/logo.webp",
            sizes: "750x1334",
            type: "image/webp",
            form_factor: "narrow",
            label: "WealthManager Mobile",
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
        runtimeCaching: [
          {
            urlPattern: /\/api\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "image-cache",
              expiration: { maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/react/") || id.includes("/node_modules/react-dom/")) {
            return "vendor";
          }
          if (id.includes("/node_modules/@tanstack/react-router")) {
            return "router";
          }
          if (id.includes("/node_modules/@tanstack/react-query")) {
            return "query";
          }
          if (
            id.includes("/node_modules/@radix-ui/react-dialog") ||
            id.includes("/node_modules/@radix-ui/react-dropdown-menu") ||
            id.includes("/node_modules/@radix-ui/react-select")
          ) {
            return "ui";
          }
          if (id.includes("/node_modules/recharts")) {
            return "charts";
          }
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://backend:5000/",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
