import { api } from "./client";
import type { PixFlowResult } from "./pixFlow";

// Backend reuses PixFlowResult / PixFlowStep for CBPR+ (both MX and MT)
// so the frontend only needs one type map. We re-export from here to
// keep the import site aligned with the CBPR+ terminology.
export type SwiftFlowResult = PixFlowResult;

export const generateSwiftFlow = (
  flowType: string,
  overrides?: Record<number, string>,
) =>
  api
    .post<SwiftFlowResult>("/swift/flow/generate", {
      flowType,
      overrides: overrides ?? null,
    })
    .then((r) => r.data);

export const listSwiftFlowTypes = () =>
  api.get<string[]>("/swift/flow/types").then((r) => r.data);
