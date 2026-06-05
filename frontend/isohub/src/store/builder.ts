import { create } from "zustand";
import { persist } from "zustand/middleware";
import { dependsOn, getAffectedFields } from "@/pages/Builder/fieldDependencies";

export type FieldOrigin = "generated" | "auto" | "workspace" | "manual" | "derived";
export type FieldStatus = "ok" | "stale" | "editing";

export interface BuilderField {
  bitNumber: number;
  name: string;
  value: string;
  displayValue: string;
  origin: FieldOrigin;
  status: FieldStatus;
  fieldType: string;
  length: number;
  /** True when the user explicitly edited the value — preserved across regenerations. */
  locked: boolean;
  dependsOn: number[];
  dependents: number[];
}

export interface BuilderContext {
  mti: string;
  role: string;
  brand: string;
  channel: string;
  txType: string;
  approvalMode: string;
  installments: number;
  /** When true, the built message gets a TPDU prefix. */
  includeTpdu: boolean;
  /** Optional 10-hex literal TPDU; null means AUTO (Workspace NIIs or random). */
  tpduOverride: string | null;
}

export interface BuiltMessage {
  ascii: string;
  binaryHex: string;
  bitmap: string;
  activeBits: number[];
  appliedRules: string[];
  profileUsed: string;
  tpdu?: string | null;
  /** true → random ARQC (no IMK). false → derived from workspace IMK. */
  arqcIsSimulated?: boolean;
}

const DEFAULT_CONTEXT: BuilderContext = {
  mti: "0200",
  role: "Adquirente",
  brand: "Visa",
  channel: "Chip",
  txType: "Credito",
  approvalMode: "Online",
  installments: 1,
  includeTpdu: false,
  tpduOverride: null,
};

interface BuilderState {
  context: BuilderContext;
  fields: BuilderField[];
  built: BuiltMessage | null;
  /** Flag set when context changes after a build — surfaces the change banner. */
  contextChanged: boolean;

  setContext: (partial: Partial<BuilderContext>) => void;
  resetContext: () => void;

  /** Replace all fields (used after `/api/build/smart` returns). */
  setBuiltResult: (built: BuiltMessage, fields: BuilderField[]) => void;
  /** Hydrate context.mti + fields from a parsed message (e.g. Parser → Builder). */
  loadFromParser: (fields: BuilderField[], mti: string) => void;
  /** Clear the built message but keep context (lets user tweak and rebuild). */
  clearBuilt: () => void;
  clearAll: () => void;

  /** User typed a new value — marks field manual+locked, dependents stale. */
  updateField: (bitNumber: number, value: string) => void;
  /** Field is replaced by a freshly regenerated version — preserves locked manual edits. */
  replaceField: (bitNumber: number, next: BuilderField) => void;
  /** User dismisses the stale badge without changing the value. */
  keepField: (bitNumber: number) => void;
  setFieldStatus: (bitNumber: number, status: FieldStatus) => void;

  addField: (field: BuilderField) => void;
  removeField: (bitNumber: number) => void;

  /** Marks Bit-2 / Track-2 / PIN / EMV stale so user can regenerate the card data. */
  markCardStale: () => void;
  /** Recomputes dirty flags after the user runs build with a new context. */
  acknowledgeContextChange: () => void;
}

export const useBuilderStore = create<BuilderState>()(
  persist(
    (set) => ({
      context: DEFAULT_CONTEXT,
      fields: [],
      built: null,
      contextChanged: false,

      setContext: (partial) =>
        set((s) => ({
          context: { ...s.context, ...partial },
          // Only flag dirty when there's already a built message to invalidate.
          contextChanged: s.built !== null,
        })),

      resetContext: () => set({ context: DEFAULT_CONTEXT, contextChanged: false }),

      setBuiltResult: (built, fields) => set({ built, fields, contextChanged: false }),
      clearBuilt: () => set({ built: null, contextChanged: false }),
      loadFromParser: (fields, mti) =>
        set((s) => ({
          context: { ...s.context, mti },
          fields,
          built: null,
          contextChanged: false,
        })),
      clearAll: () =>
        set({ context: DEFAULT_CONTEXT, fields: [], built: null, contextChanged: false }),

      updateField: (bitNumber, value) =>
        set((s) => {
          const idx = s.fields.findIndex((f) => f.bitNumber === bitNumber);
          if (idx < 0) return s;
          const present = s.fields.map((f) => f.bitNumber);
          const stalesByEdit = new Set(getAffectedFields(bitNumber, present));
          const fields = s.fields.map((f, i) => {
            if (i === idx) {
              return { ...f, value, displayValue: value, origin: "manual" as FieldOrigin, locked: true, status: "ok" as FieldStatus };
            }
            if (stalesByEdit.has(f.bitNumber) && !f.locked) {
              return { ...f, status: "stale" as FieldStatus };
            }
            return f;
          });
          return { fields };
        }),

      replaceField: (bitNumber, next) =>
        set((s) => {
          const idx = s.fields.findIndex((f) => f.bitNumber === bitNumber);
          if (idx < 0) return s;
          const fields = s.fields.slice();
          // Keep locked manual edits even on regenerate — user explicitly chose them.
          fields[idx] = s.fields[idx].locked ? { ...s.fields[idx], status: "ok" } : next;
          return { fields };
        }),

      keepField: (bitNumber) =>
        set((s) => ({
          fields: s.fields.map((f) =>
            f.bitNumber === bitNumber ? { ...f, status: "ok" } : f
          ),
        })),

      setFieldStatus: (bitNumber, status) =>
        set((s) => ({
          fields: s.fields.map((f) =>
            f.bitNumber === bitNumber ? { ...f, status } : f
          ),
        })),

      addField: (field) =>
        set((s) => {
          if (s.fields.some((f) => f.bitNumber === field.bitNumber)) return s;
          return { fields: [...s.fields, field].sort((a, b) => a.bitNumber - b.bitNumber) };
        }),

      removeField: (bitNumber) =>
        set((s) => ({ fields: s.fields.filter((f) => f.bitNumber !== bitNumber) })),

      markCardStale: () =>
        set((s) => ({
          fields: s.fields.map((f) =>
            [2, 14, 35, 52, 55].includes(f.bitNumber) && !f.locked
              ? { ...f, status: "stale" }
              : f
          ),
        })),

      acknowledgeContextChange: () => set({ contextChanged: false }),
    }),
    {
      name: "isoleaf-builder",
      partialize: (s) => ({ context: s.context, fields: s.fields, built: s.built }),
    }
  )
);

/** Convert backend SmartFieldInfo into the UI's BuilderField shape. */
export function toBuilderField(info: {
  bitNumber: number;
  name: string;
  value: string;
  maskedValue: string;
  origin: string;
}): BuilderField {
  return {
    bitNumber: info.bitNumber,
    name: info.name,
    value: info.value,
    displayValue: info.maskedValue || info.value,
    origin: (info.origin === "custom"
      ? "manual"
      : info.origin === "derived"
        ? "derived"
        : "generated") as FieldOrigin,
    status: "ok",
    fieldType: "",
    length: info.value.length,
    locked: info.origin === "custom",
    dependsOn: dependsOn(info.bitNumber),
    dependents: [],
  };
}
