import { api } from "./client";
import type { EmvResponseConfig, MessageLogEntry, SimulatorSession } from "@/types";

export const listSessions = () => api.get<SimulatorSession[]>("/simulator/sessions").then((r) => r.data);

export const startSession = (config: Record<string, unknown>) =>
  api.post<SimulatorSession>("/simulator/sessions", { config }).then((r) => r.data);

export const stopSession = (id: string) => api.delete(`/simulator/sessions/${id}`).then((r) => r.data);

export const injectMessage = (id: string, hexMessage: string) =>
  api.post(`/simulator/sessions/${id}/inject`, { hexMessage }).then((r) => r.data);

export const updateEmvConfig = (id: string, config: EmvResponseConfig) =>
  api.put(`/simulator/sessions/${id}/emv-config`, config).then((r) => r.data);

export interface InjectDirectRequest {
  targetHost: string;
  targetPort: number;
  message: string;
  includeTpdu?: boolean;
  tpduOverride?: string | null;
  /** Refresh STAN, timestamps and RRN on every send. */
  varyIdentifiers?: boolean;
  /** Pick a random Bit 4 amount within [amountMin, amountMax]. */
  varyAmount?: boolean;
  /** Bounds for Bit 4 randomisation, in cents. */
  amountMin?: number;
  amountMax?: number;
  /**
   * Prepend the 2-byte big-endian length prefix when writing to the socket.
   * Defaults true server-side (the framing most rebatedores use).
   */
  includeLengthPrefix?: boolean;
}

export interface InjectDirectResponseFieldDto {
  bitNumber: number;
  name: string;
  value: string;
}

export interface InjectDirectResponse {
  success: boolean;
  responseHex?: string | null;
  mti?: string | null;
  responseCode?: string | null;
  processingMs?: number;
  fields?: InjectDirectResponseFieldDto[];
  error?: string | null;
  /** Hex bytes actually sent (after any variations were applied). */
  requestHex?: string | null;
  /** Decoded fields of the bytes actually sent — diagnostic for the vary flag. */
  requestFields?: InjectDirectResponseFieldDto[];
  /** MTI of the request after variations. */
  requestMti?: string | null;
}

export const injectDirect = (req: InjectDirectRequest) =>
  api.post<InjectDirectResponse>("/simulator/inject-direct", req).then((r) => r.data);

export const getLog = (sessionId?: string, limit = 100) =>
  api
    .get<MessageLogEntry[]>(sessionId ? `/simulator/log/${sessionId}` : "/simulator/log", { params: { limit } })
    .then((r) => r.data);

export const clearLog = () => api.delete("/simulator/log").then((r) => r.data);
