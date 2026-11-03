import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

// Safari opens AR Quick Look only when USDZ arrives with its own media type.
const usdzType: Plugin = {
  name: "usdz-type",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.split("?")[0].endsWith(".usdz")) res.setHeader("Content-Type", "model/vnd.usdz+zip");
      next();
    });
  },
};

export default defineConfig({
  plugins: [react(), usdzType],
  server: {
    port: 5173,
    fs: { allow: [".."] }, // Brand tokens and fonts live in ../brand.
    proxy: { "/api": "http://127.0.0.1:8000" },
    // Lets a phone reach the dev server through an ngrok tunnel. Dev only.
    allowedHosts: [".ngrok-free.app", ".ngrok-free.dev", ".ngrok.app"],
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: { output: { manualChunks: { three: ["three"] } } },
  },
  test: { environment: "node" },
});
