import { api } from "./client";
import type { PixFlowResult } from "./pixFlow";

// Sprint 9.4 — backend reuses PixFlowResult / PixFlowStep for the ISO
// 8583 flows too. Step.xml carries the raw ISO 8583 wire string when
// step.contentType === "iso8583".
export type Iso8583FlowResult = PixFlowResult;

export const generateIso8583Flow = (
  flowType: string,
  overrides?: Record<number, string>,
) =>
  api
    .post<Iso8583FlowResult>("/iso8583/flow/generate", {
      flowType,
      overrides: overrides ?? null,
    })
    .then((r) => r.data);

export const listIso8583FlowTypes = () =>
  api.get<string[]>("/iso8583/flow/types").then((r) => r.data);
