import axios, { AxiosError, AxiosInstance } from "axios";
import { useAgentConnectionStore } from "@/store/agentConnection";

// Per-call default cap. 60s is generous enough for the slowest legitimate path
// (Injector → real external TCP system that may pause before responding) while
// still releasing the UI from a truly hung request (agent process dead, dev
// proxy stuck, network down). Individual calls can override via { timeout: N }.
const DEFAULT_TIMEOUT_MS = 60_000;

// Backend origin is single-origin — the Backend serves the SPA, so /api is
// always same-origin in prod, and Vite's dev proxy forwards /api → :8080.
export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
  timeout: DEFAULT_TIMEOUT_MS,
});

/**
 * Sprint 12.2 P5+ — the Simulator Agent is a separate host, at a URL each
 * operator configures on the Workspace page. baseURL is resolved dynamically
 * from the agentConnection store (localStorage) at request time; when the
 * user hasn't set a URL yet, every request rejects with a clear
 * <c>AGENT_NOT_CONFIGURED</c> message the UI can catch and render as an
 * empty state instead of a generic network error.
 */
export const agentApi = axios.create({
  headers: { "Content-Type": "application/json" },
  timeout: DEFAULT_TIMEOUT_MS,
});

agentApi.interceptors.request.use((config) => {
  const agentUrl = useAgentConnectionStore.getState().agentUrl;
  if (!agentUrl) {
    // Predictable failure the UI can special-case (see Simulator page's
    // "Configure a URL do Agent" empty state). Throwing here short-circuits
    // the request before axios attempts a mangled URL like "/api/simulator/...".
    return Promise.reject(
      Object.assign(new Error("AGENT_NOT_CONFIGURED"), { code: "AGENT_NOT_CONFIGURED" }),
    );
  }
  config.baseURL = `${agentUrl}/api`;
  return config;
});

/**
 * SignalR hub URL for the Simulator Agent. Dynamic — built from the current
 * configured Agent base URL. Null when unconfigured, which useSimulatorHub
 * treats as "don't connect yet".
 */
export function getSimulatorHubUrl(): string | null {
  const agentUrl = useAgentConnectionStore.getState().agentUrl;
  return agentUrl ? `${agentUrl}/hubs/simulator` : null;
}

/**
 * Rewrites axios errors into human-readable Error.message values. Extracted
 * as a named function so ad-hoc axios instances (e.g. <see cref="probeAgentHealth"/>,
 * which needs a URL BEFORE the store gets written) can reuse the same
 * treatment — otherwise a bare `axios.create({...})` would surface raw
 * "Network Error" strings to the UI. Idempotent: attach once per instance.
 *
 * Behaviour:
 *   - Backend structured errors (`{ error, title, detail }`) → verbatim.
 *   - Plain-string bodies → verbatim.
 *   - Timeouts / network failures / DNS → localized "host is unreachable"
 *     message parameterised by <paramref name="hostLabel"/>.
 */
export function installErrorInterceptor(instance: AxiosInstance, hostLabel: string) {
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      const ax = error as AxiosError<unknown>;
      const data = ax.response?.data;
      let serverMessage: string | null = null;
      if (typeof data === "string" && data.length > 0) {
        serverMessage = data;
      } else if (data && typeof data === "object") {
        const d = data as { error?: string; title?: string; detail?: string };
        serverMessage = d.error ?? d.detail ?? d.title ?? null;
      }
      if (serverMessage) {
        (error as Error).message = serverMessage;
      } else if (!ax.response) {
        // No response at all — timeout, DNS failure, connection refused,
        // dev proxy down. Axios reports these as generic "Network Error" /
        // ECONNABORTED, both of which are user-hostile. Rewrite to a
        // one-liner that names the host + hints at the fix.
        if (ax.code === "ECONNABORTED" || /timeout/i.test(ax.message)) {
          (error as Error).message =
            `A requisição excedeu o tempo limite. ` +
            `Verifique se o ${hostLabel} foi iniciado e está acessível na rede.`;
        } else {
          (error as Error).message =
            `Não foi possível alcançar o ${hostLabel}. ` +
            `Verifique se ele foi iniciado e está acessível na rede.`;
        }
      }
      return Promise.reject(error);
    },
  );
}

installErrorInterceptor(api, "Backend");
installErrorInterceptor(agentApi, "Agent");
