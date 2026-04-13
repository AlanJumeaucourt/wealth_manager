import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/wealth_manager/",
  build: {
    sourcemap: true,
    assetsDir: "assets",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/react/") || id.includes("/node_modules/react-dom/")) {
            return "react-vendor";
          }
        },
      },
    },
  },
});
