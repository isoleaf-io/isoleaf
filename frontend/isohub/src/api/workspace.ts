import { api } from "./client";
import type { AppConfig, WorkspaceConfig } from "@/types";

export const getAppConfig = () => api.get<AppConfig>("/config").then((r) => r.data);

export const getWorkspace = () => api.get<WorkspaceConfig>("/workspace").then((r) => r.data);
export const updateWorkspace = (cfg: WorkspaceConfig) =>
  api.put<WorkspaceConfig>("/workspace", cfg).then((r) => r.data);

// Sprint 9.5 — ISO 20022 schemas managed via Workspace.
export interface SchemaEntry {
  messageType: string;
  family: string;
  version: string;
  namespace: string;
  fileName: string;
}

export interface SchemaUploadResponse {
  messageType: string;
  namespace: string;
  fileName: string;
}

export const listWorkspaceSchemas = () =>
  api.get<SchemaEntry[]>("/workspace/schemas").then((r) => r.data);

export const uploadWorkspaceSchema = (file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return api
    .post<SchemaUploadResponse>("/workspace/schemas/upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};
