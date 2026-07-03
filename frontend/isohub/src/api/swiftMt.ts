import { api } from "./client";

// Backend serialises enums via JsonStringEnumConverter with the
// camelCase naming policy (see Program.cs), so MtFieldConfidence.Automatic
// arrives as "automatic" — match those literals here, not PascalCase.
export type MtFieldConfidence = "automatic" | "ambiguous" | "noMapping";

export interface MtSubField {
  subId: string | null;
  rawValue: string;
  parsedValue: string | null;
  mxPath: string | null;
  mxValue: string | null;
  confidence: MtFieldConfidence;
  mxAlternatives: string[];
}

export interface MtField {
  tag: string;
  name: string;
  description: string;
  format: string;
  rawValue: string;
  confidence: MtFieldConfidence;
  subFields: MtSubField[];
  mxPath: string | null;
  mxAlternatives: string[];
}

export interface MtBlock {
  blockId: string;
  name: string;
  rawContent: string;
  fields: MtField[];
}

export interface MtParseResult {
  messageType: string;
  sender: string | null;
  receiver: string | null;
  uetr: string | null;
  blocks: MtBlock[];
  warnings: string[];
}

export const parseMtMessage = (rawMessage: string) =>
  api
    .post<MtParseResult>("/swift/mt/parse", { rawMessage })
    .then((r) => r.data);
