import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getAppConfig } from "@/api/workspace";
import type { AppConfig } from "@/types";

/**
 * Default = local Docker deployment with everything on. We seed the context
 * with this so the very first render (before the /api/config response lands)
 * doesn't flash hidden features in/out — a wrong default of `online` would
 * cause the Simulator menu to disappear and then reappear, which looks
 * broken. If the backend ever returns mode=online, we then hide the
 * features once the fetch resolves.
 */
const DEFAULT_CONFIG: AppConfig = {
  mode: "standalone",
  simulatorEnabled: true,
  emvCryptoEnabled: true,
  workspaceKeysEnabled: true,
  schemaUploadEnabled: true,
};

const AppConfigContext = createContext<AppConfig>(DEFAULT_CONFIG);

interface ProviderProps {
  children: ReactNode;
  /** Test-only escape hatch: skip the fetch and use this config directly. */
  initialConfig?: AppConfig;
}

export function AppConfigProvider({ children, initialConfig }: ProviderProps) {
  const [config, setConfig] = useState<AppConfig>(initialConfig ?? DEFAULT_CONFIG);

  useEffect(() => {
    if (initialConfig) return;
    let cancelled = false;
    getAppConfig()
      .then((c) => { if (!cancelled) setConfig(c); })
      .catch(() => { /* keep defaults — better than crashing on a flaky network */ });
    return () => { cancelled = true; };
  }, [initialConfig]);

  return <AppConfigContext.Provider value={config}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig(): AppConfig {
  return useContext(AppConfigContext);
}
