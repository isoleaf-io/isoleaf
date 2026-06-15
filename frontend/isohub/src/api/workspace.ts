import { api } from "./client";
import type { AppConfig, HealthStatus, WorkspaceConfig } from "@/types";

export const getAppConfig = () => api.get<AppConfig>("/config").then((r) => r.data);

export const getWorkspace = () => api.get<WorkspaceConfig>("/workspace").then((r) => r.data);
export const updateWorkspace = (cfg: WorkspaceConfig) =>
  api.put<WorkspaceConfig>("/workspace", cfg).then((r) => r.data);

export const getHealth = () => api.get<HealthStatus>("/health").then((r) => r.data);
