import axios, { AxiosError } from "axios";

// Per-call default cap. 60s is generous enough for the slowest legitimate path
// (Injector → real external TCP system that may pause before responding) while
// still releasing the UI from a truly hung request (agent process dead, dev
// proxy stuck, network down). Individual calls can override via { timeout: N }.
const DEFAULT_TIMEOUT_MS = 60_000;

// Always use relative URLs. In production the Agent serves the SPA, so /api and /hubs
// hit the same origin. In dev (Vite on :5173) the configured proxy forwards them to
// the Agent on :8080 — keeping the browser away from cross-origin CORS handling.
export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
  timeout: DEFAULT_TIMEOUT_MS,
});

// Promote the server-provided message into the thrown Error.message. Without
// this, callers reading `(err as Error).message` get axios's generic
// "Request failed with status code 409" instead of the actionable text the
// backend already returned (e.g. "Failed to bind TCP port 9100: address
// already in use"). Backend convention is `{ error: "..." }` for 4xx/5xx
// responses; we also fall back to plain-string bodies and ProblemDetails.
//
// When there is NO response (timeout, network error, dev proxy down), axios
// gives us only `code` and a verbose default message — we rewrite those to
// something actionable so the UI banner reads cleanly.
api.interceptors.response.use(
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
      // Mutate the underlying Error's message so the existing
      // `(err as Error).message` pattern surfaces the friendly text.
      (error as Error).message = serverMessage;
    } else if (!ax.response) {
      // No response at all — timeout (ECONNABORTED) or network failure.
      if (ax.code === "ECONNABORTED" || /timeout/i.test(ax.message)) {
        (error as Error).message =
          `Request timed out after ${DEFAULT_TIMEOUT_MS / 1000}s. ` +
          `The server may be unreachable or overloaded — check that the Agent is running.`;
      } else {
        (error as Error).message =
          `Could not reach the server (${ax.code ?? "network error"}). ` +
          `Check that the Agent is running and reachable.`;
      }
    }
    return Promise.reject(error);
  }
);

export const HUB_URL = "/hubs/simulator";
