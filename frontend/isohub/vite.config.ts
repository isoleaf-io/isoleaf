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
    // Vite 8 ships Rolldown as the bundler and deprecated rollupOptions
    // (the function form of manualChunks is on track for removal in v9).
    // The new home is rolldownOptions.output.codeSplitting.groups — a
    // declarative list where each entry pins a regex-matched module id to
    // a named chunk. Trailing `\/` in every test anchors to a path
    // separator so "react" doesn't accidentally swallow "react-router".
    // (Rolldown briefly called this `advancedChunks`; renamed to
    // `codeSplitting` and the old name now emits a deprecation warning.)
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // React core — rarely changes, long cache life.
            { name: "vendor-react",   test: /node_modules\/(react|react-dom|react-router)\// },
            // State + data fetching primitives.
            { name: "vendor-query",   test: /node_modules\/(@tanstack\/react-query|zustand|axios)\// },
            // Radix UI primitives (every @radix-ui/* installed today).
            { name: "vendor-radix",   test: /node_modules\/@radix-ui\// },
            // SignalR client — large, isolated for cache stability.
            { name: "vendor-signalr", test: /node_modules\/@microsoft\/signalr\// },
            // i18n stack.
            { name: "vendor-i18n",    test: /node_modules\/(i18next|react-i18next|i18next-browser-languagedetector)\// },
            // Icon set.
            { name: "vendor-icons",   test: /node_modules\/lucide-react\// },
          ],
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
