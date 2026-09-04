import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Sprint 12.2 P5+ — the Simulator Agent runs in a separate process from
 * the Backend and its base URL is picked by each operator (whatever host
 * / port they're running it on locally). We keep the URL in localStorage
 * because:
 *   - it's a per-user setting, not deployment state;
 *   - the Backend has no business knowing where the Agent lives;
 *   - a page reload should remember the last confirmed URL.
 *
 * <c>status</c> is deliberately UI state (not persisted): every fresh
 * page load reverts to "idle" until the user clicks "Conectar" again or
 * a health call proves the Agent is reachable. This avoids a stale
 * "connected" badge when the Agent process was killed between reloads.
 */

export type AgentStatus = "idle" | "testing" | "connected" | "error";

interface AgentConnectionState {
  /** The confirmed Agent base URL (persisted). Null until the user
   *  successfully connects for the first time. */
  agentUrl: string | null;
  status: AgentStatus;
  /** Last error surfaced by a failed /api/health call. Verbatim from the
   *  server / axios interceptor — no reformulation. */
  errorMessage: string | null;

  setAgentUrl: (url: string | null) => void;
  setStatus: (status: AgentStatus) => void;
  setError: (message: string | null) => void;
  clear: () => void;
}

/** Normalizes a user-typed URL: trim whitespace, strip trailing slashes
 *  so `${agentUrl}/api/health` never becomes `.../api/health/`. */
export function normalizeAgentUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

const STORAGE_KEY = "isoleaf.agentBaseUrl";

export const useAgentConnectionStore = create<AgentConnectionState>()(
  persist(
    (set) => ({
      agentUrl: null,
      status: "idle",
      errorMessage: null,

      setAgentUrl: (url) => {
        const normalized = url ? normalizeAgentUrl(url) : null;
        set({ agentUrl: normalized || null });
      },
      setStatus: (status) => set({ status }),
      setError: (message) => set({ errorMessage: message }),
      clear: () => set({ agentUrl: null, status: "idle", errorMessage: null }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only persist agentUrl; status + errorMessage are ephemeral UI state.
      partialize: (state) => ({ agentUrl: state.agentUrl }),
    },
  ),
);

/** Convenience selector — the base URL to feed into the Agent axios
 *  instance. Returns null while unconfigured so callers can short-circuit
 *  cleanly instead of hitting a mangled URL. */
export const selectAgentUrl = (s: AgentConnectionState) => s.agentUrl;
