import axios from "axios";

// Always use relative URLs. In production the Agent serves the SPA, so /api and /hubs
// hit the same origin. In dev (Vite on :5173) the configured proxy forwards them to
// the Agent on :8080 — keeping the browser away from cross-origin CORS handling.
export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

export const HUB_URL = "/hubs/simulator";
