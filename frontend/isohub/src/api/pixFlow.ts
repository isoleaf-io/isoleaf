import { api } from "./client";

export interface PixFlowStep {
  stepId: number;
  messageType: string;
  label: string;
  fromActor: string;
  toActor: string;
  xml: string;
  /** When set, the message hops through this actor before reaching toActor
   *  (BCB/SPI "repasse" rendered as a dashed arrow). */
  viaActor?: string | null;
  /** True when this step is the SPI-to-PSP relay leg of a message — the
   *  diagram renders such arrows with a dashed stroke. */
  isRelay?: boolean;
}

export interface PixFlowAlert {
  stepId: number;
  field: string;
  expected: string | null;
  found: string | null;
  /** "error" | "warning" */
  severity: string;
}

export interface PixFlowResult {
  flowType: string;
  steps: PixFlowStep[];
  alerts: PixFlowAlert[];
}

export const generatePixFlow = (
  flowType: string,
  overrides?: Record<number, string>,
) =>
  api
    .post<PixFlowResult>("/pix/flow/generate", {
      flowType,
      overrides: overrides ?? null,
    })
    .then((r) => r.data);

export const listPixFlowTypes = () =>
  api.get<string[]>("/pix/flow/types").then((r) => r.data);
