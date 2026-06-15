import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * UI state for the Injector panel. Lives in its own store so the
 * SessionRow component can reactively render compatibility borders
 * based on the current Injector framing without prop-drilling.
 */
export interface InjectorState {
  targetHost: string;
  targetPort: number;
  message: string;
  includeTpdu: boolean;
  /**
   * Literal 10-hex TPDU (5 bytes: [60][NII-orig 2B][NII-dest 2B]).
   * Empty/null → backend falls back to Workspace NIIs (auto-generated).
   * Honored only when `includeTpdu` is true.
   */
  tpduOverride: string | null;
  durationSeconds: number;
  varyIdentifiers: boolean;
  varyAmount: boolean;
  amountMinReais: number;
  amountMaxReais: number;
  includeLengthPrefix: boolean;
  /**
   * Selected destination — either a specific session ("session:9100")
   * or "custom" for free-text host/port. When pointing at a session, the
   * host/port are auto-resolved and the prefix toggle follows the
   * session's HeaderSize. "custom" surfaces the legacy free-form fields.
   */
  destination: string;
}

export const DEFAULTS: InjectorState = {
  targetHost: "localhost",
  targetPort: 8583,
  message: "",
  includeTpdu: false,
  tpduOverride: null,
  durationSeconds: 0,
  varyIdentifiers: true,
  varyAmount: false,
  amountMinReais: 1,
  amountMaxReais: 500,
  includeLengthPrefix: false,
  destination: "custom",
};

/**
 * True when the user-supplied TPDU literal is acceptable. Empty/null means
 * "fall back to Workspace NIIs" — also valid. Non-empty must be exactly
 * 10 hex chars (5 bytes: identifier + origin NII + destination NII).
 */
export function isValidTpduOverride(value: string | null | undefined): boolean {
  if (value === null || value === undefined || value === "") return true;
  return /^[0-9A-Fa-f]{10}$/.test(value);
}

interface InjectorStore extends InjectorState {
  set: <K extends keyof InjectorState>(key: K, value: InjectorState[K]) => void;
  reset: () => void;
}

export const useInjectorStore = create<InjectorStore>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (key, value) => set({ [key]: value } as Partial<InjectorState>),
      reset: () => set(DEFAULTS),
    }),
    {
      // Keep the same key the panel was using so existing user settings
      // survive the refactor.
      name: "isoleaf-injector",
      partialize: (s) => {
        const { set: _set, reset: _reset, ...rest } = s as InjectorStore;
        void _set; void _reset;
        return rest;
      },
    }
  )
);
