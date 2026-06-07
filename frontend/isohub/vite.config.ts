import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  build: {
    outDir: path.resolve(__dirname, "../../agent/Iso8583Toolkit.Agent/wwwroot"),
    emptyOutDir: true,
    sourcemap: false,
    // Warn early — caps any single chunk at ~400 KB raw before we ship it.
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — rarely changes, long cache life.
          "vendor-react": ["react", "react-dom", "react-router"],
          // State + data fetching primitives.
          "vendor-query": ["@tanstack/react-query", "zustand", "axios"],
          // Radix UI primitives (every @radix-ui/* listed in package.json).
          "vendor-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-select",
            "@radix-ui/react-switch",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
          ],
          // SignalR client — large, isolated for cache stability.
          "vendor-signalr": ["@microsoft/signalr"],
          // i18n stack.
          "vendor-i18n": ["i18next", "react-i18next", "i18next-browser-languagedetector"],
          // Icon set.
          "vendor-icons": ["lucide-react"],
        },
      },
    },
  },
  server: {
    port: 5173,
    // Use the explicit IPv4 loopback so Node's DNS resolver doesn't pick `::1`
    // when the Agent is bound to IPv4 only (kestrel default with 127.0.0.1 URLs).
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
      "/hubs": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
