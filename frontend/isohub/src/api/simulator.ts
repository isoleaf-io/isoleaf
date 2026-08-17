import { agentApi } from "./client";
import type { EmvResponseConfig, MessageLogEntry, SimulatorSession } from "@/types";

export const listSessions = () => agentApi.get<SimulatorSession[]>("/simulator/sessions").then((r) => r.data);

export const startSession = (config: Record<string, unknown>) =>
  agentApi.post<SimulatorSession>("/simulator/sessions", { config }).then((r) => r.data);

export const stopSession = (id: string) => agentApi.delete(`/simulator/sessions/${id}`).then((r) => r.data);

export const updateEmvConfig = (id: string, config: EmvResponseConfig) =>
  agentApi.put(`/simulator/sessions/${id}/emv-config`, config).then((r) => r.data);

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

interface InjectDirectResponseFieldDto {
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
  agentApi.post<InjectDirectResponse>("/simulator/inject-direct", req).then((r) => r.data);

export const getLog = (sessionId?: string, limit = 100) =>
  agentApi
    .get<MessageLogEntry[]>(sessionId ? `/simulator/log/${sessionId}` : "/simulator/log", { params: { limit } })
    .then((r) => r.data);

export const clearLog = () => agentApi.delete("/simulator/log").then((r) => r.data);
