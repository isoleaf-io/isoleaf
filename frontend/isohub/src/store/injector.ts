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
  durationSeconds: 0,
  varyIdentifiers: true,
  varyAmount: false,
  amountMinReais: 1,
  amountMaxReais: 500,
  includeLengthPrefix: false,
  destination: "custom",
};

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
