import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AppConfigProvider } from "./contexts/AppConfigContext";
import { applyTheme, useThemeStore } from "./store/theme";
import "./i18n";
import "./styles/globals.css";

// Apply persisted theme on first load
applyTheme(useThemeStore.getState().mode);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppConfigProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AppConfigProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
