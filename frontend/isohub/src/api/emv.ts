import { api } from "./client";
import type {
  ArpcInput,
  ArqcInput,
  ArqcResult,
  BuildResponseBit55Request,
  BuildResponseBit55Result,
  FullFlowRequest,
  FullFlowResult,
  GenerateArpcResult,
  GenerateArqcResult,
  ParseBit55Response,
  ValidateArqcRequest,
} from "@/types";

export const parseBit55 = (hexBit55: string, headerBytes = 0) =>
  api
    .post<ParseBit55Response>("/emv/parse-bit55", { hexBit55, headerBytes })
    .then((r) => r.data);

export const validateArqc = (req: ValidateArqcRequest) =>
  api.post<ArqcResult>("/emv/validate-arqc", req).then((r) => r.data);

export const generateArqc = (req: ArqcInput) =>
  api.post<GenerateArqcResult>("/emv/generate-arqc", req).then((r) => r.data);

export const generateArpc = (req: ArpcInput) =>
  api.post<GenerateArpcResult>("/emv/generate-arpc", req).then((r) => r.data);

export const buildBit55Response = (req: BuildResponseBit55Request) =>
  api.post<BuildResponseBit55Result>("/emv/build-response-bit55", req).then((r) => r.data);

export const fullFlow = (req: FullFlowRequest) =>
  api.post<FullFlowResult>("/emv/full-flow", req).then((r) => r.data);
