import { api } from "./client";
import type { HealthStatus, SavedTemplate, WorkspaceConfig } from "@/types";

export const getWorkspace = () => api.get<WorkspaceConfig>("/workspace").then((r) => r.data);
export const updateWorkspace = (cfg: WorkspaceConfig) =>
  api.put<WorkspaceConfig>("/workspace", cfg).then((r) => r.data);
export const listTemplates = () => api.get<SavedTemplate[]>("/workspace/templates").then((r) => r.data);
export const saveTemplate = (t: Omit<SavedTemplate, "templateId" | "savedAt"> & { templateId?: string }) =>
  api.post<SavedTemplate>("/workspace/templates", t).then((r) => r.data);
export const getTemplate = (id: string) => api.get<SavedTemplate>(`/workspace/templates/${id}`).then((r) => r.data);
export const deleteTemplate = (id: string) => api.delete(`/workspace/templates/${id}`).then((r) => r.data);

export const getHealth = () => api.get<HealthStatus>("/health").then((r) => r.data);
