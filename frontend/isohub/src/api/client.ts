import axios, { AxiosError } from "axios";

// Always use relative URLs. In production the Agent serves the SPA, so /api and /hubs
// hit the same origin. In dev (Vite on :5173) the configured proxy forwards them to
// the Agent on :8080 — keeping the browser away from cross-origin CORS handling.
export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Promote the server-provided message into the thrown Error.message. Without
// this, callers reading `(err as Error).message` get axios's generic
// "Request failed with status code 409" instead of the actionable text the
// backend already returned (e.g. "Failed to bind TCP port 9100: address
// already in use"). Backend convention is `{ error: "..." }` for 4xx/5xx
// responses; we also fall back to plain-string bodies and ProblemDetails.
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
    }
    return Promise.reject(error);
  }
);

export const HUB_URL = "/hubs/simulator";
