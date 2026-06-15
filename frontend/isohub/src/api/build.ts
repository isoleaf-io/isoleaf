import { api } from "./client";
import type { SmartBuildResult } from "@/types";

export interface SmartBuildRequest {
  mti: string;
  role: string;
  brand: string;
  transactionType: string;
  channel: string;
  approvalMode?: string;
  installments?: number;
  isReversal?: boolean;
  customFields?: Record<string, string>;
  /** Backend computes the TPDU when true; suppresses when false. */
  includeTpdu?: boolean;
  /** Literal 10-hex TPDU. Honored only when includeTpdu is true. */
  tpduOverride?: string | null;
  /** Legacy: "NONE" suppresses, literal hex forces. */
  overrideTpdu?: string | null;
}

export const smartBuild = (req: SmartBuildRequest) =>
  api.post<SmartBuildResult>("/build/smart", req).then((r) => r.data);

export const buildMessage = (mti: string, fields: { bitNumber: number; value: string }[], layoutName = "default") =>
  api.post("/build/message", { mti, fields, layoutName }).then((r) => r.data);
