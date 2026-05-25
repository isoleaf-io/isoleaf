import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BuilderContext, BuilderField } from "@/store/builder";
import { useBuilderStore } from "@/store/builder";

export interface SavedTemplate {
  id: string;
  name: string;
  description?: string;
  mti: string;
  fields: BuilderField[];
  context: BuilderContext;
  savedAt: string;
  tags?: string;
}

interface TemplatesState {
  templates: SavedTemplate[];
  saveTemplate: (name: string, description?: string, tags?: string) => SavedTemplate;
  loadTemplate: (id: string) => boolean;
  deleteTemplate: (id: string) => void;
  renameTemplate: (id: string, name: string) => void;
  importTemplate: (template: SavedTemplate) => void;
}

function makeId() {
  // crypto.randomUUID is available in modern browsers + jsdom v22+.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export const useTemplatesStore = create<TemplatesState>()(
  persist(
    (set, get) => ({
      templates: [],

      saveTemplate: (name, description, tags) => {
        const builder = useBuilderStore.getState();
        const tpl: SavedTemplate = {
          id: makeId(),
          name,
          description,
          tags,
          mti: builder.context.mti,
          fields: builder.fields,
          context: builder.context,
          savedAt: new Date().toISOString(),
        };
        set((s) => ({ templates: [tpl, ...s.templates] }));
        return tpl;
      },

      loadTemplate: (id) => {
        const tpl = get().templates.find((t) => t.id === id);
        if (!tpl) return false;
        // Restore full context, then load fields via builder.loadFromParser
        // so the existing "fields became authoritative" semantics apply.
        useBuilderStore.setState((s) => ({ context: { ...s.context, ...tpl.context } }));
        useBuilderStore.getState().loadFromParser(tpl.fields, tpl.mti);
        return true;
      },

      deleteTemplate: (id) =>
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

      renameTemplate: (id, name) =>
        set((s) => ({
          templates: s.templates.map((t) => (t.id === id ? { ...t, name } : t)),
        })),

      importTemplate: (template) =>
        set((s) => ({ templates: [{ ...template, id: template.id || makeId() }, ...s.templates] })),
    }),
    {
      name: "isohub-templates",
      partialize: (s) => ({ templates: s.templates }),
    }
  )
);
