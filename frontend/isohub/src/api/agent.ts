import axios from "axios";
import { installErrorInterceptor } from "./client";
import type { HealthStatus } from "@/types";

/**
 * Probes an arbitrary Agent base URL for the /api/health endpoint. Used by
 * two flows:
 *   - the Workspace "Conectar" button, which validates a URL BEFORE
 *     committing it to localStorage;
 *   - the Simulator page's connectivity gate on mount, which checks that
 *     a previously-saved URL still points at a live Agent.
 *
 * The persisted <c>agentApi</c> instance in <c>client.ts</c> can't cover
 * these because its baseURL is read from the store — the URL may not be
 * in the store yet (Workspace flow) or may be stale (gate flow).
 *
 * Reuses <c>installErrorInterceptor</c> so failures surface with the
 * same friendly, localized messages as the rest of the app instead of
 * axios's raw "Network Error" default.
 *
 * Short 8s timeout — the health call is trivial and a slow response is
 * indistinguishable from an unreachable host from the user's perspective.
 */
export async function probeAgentHealth(baseUrl: string): Promise<HealthStatus> {
  const client = axios.create({
    baseURL: `${baseUrl.replace(/\/+$/, "")}/api`,
    timeout: 8_000,
    headers: { "Content-Type": "application/json" },
  });
  installErrorInterceptor(client, "Agent");
  const response = await client.get<HealthStatus>("/health");
  return response.data;
}
