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
        // Vite 8 removed the object form of manualChunks. The function form is
        // still accepted (deprecated). We match by id substring — substring
        // matches under node_modules are stable across pnpm/npm hoisting.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router/")
          ) return "vendor-react";
          if (
            id.includes("node_modules/@tanstack/react-query/") ||
            id.includes("node_modules/zustand/") ||
            id.includes("node_modules/axios/")
          ) return "vendor-query";
          if (
            id.includes("node_modules/@radix-ui/react-dialog/") ||
            id.includes("node_modules/@radix-ui/react-tabs/")
          ) return "vendor-radix";
          if (id.includes("node_modules/@microsoft/signalr/")) return "vendor-signalr";
          if (
            id.includes("node_modules/i18next/") ||
            id.includes("node_modules/react-i18next/") ||
            id.includes("node_modules/i18next-browser-languagedetector/")
          ) return "vendor-i18n";
          if (id.includes("node_modules/lucide-react/")) return "vendor-icons";
          return undefined;
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
      // Forward the OpenAPI document too — Scalar UI mounted at /api/docs/v1
      // fetches it from /openapi/v1.json. Without this rule the dev server
      // returns the SPA index.html and Scalar shows
      // "Document 'v1' could not be loaded".
      "/openapi": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
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
