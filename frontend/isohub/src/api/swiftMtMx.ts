import { api } from "./client";
import type { MtFieldConfidence } from "./swiftMt";

export interface MtMxMappingRow {
  tag: string;
  subId: string | null;
  rawValue: string;
  parsedValue: string | null;
  suggestedMxPath: string;
  suggestedMxValue: string | null;
  confidence: MtFieldConfidence;
  mxAlternatives: string[];
  isEditable: boolean;
}

export interface MtMxMappingTable {
  messageType: string;
  targetMxType: string;
  rows: MtMxMappingRow[];
  warnings: string[];
}

export interface MtMxConvertResult {
  originalMessageType: string;
  generatedMxType: string;
  xml: string;
  warnings: string[];
}

export type MtMxCompareStatus =
  | "match"
  | "diverge"
  | "onlyInMt"
  | "onlyInMx";

export interface MtMxCompareRow {
  mtTag: string;
  mtSubId: string | null;
  mtValue: string | null;
  mxPath: string;
  mxValue: string | null;
  status: MtMxCompareStatus;
  note: string | null;
}

export interface MtMxCompareResult {
  mtMessageType: string;
  mxMessageType: string;
  rows: MtMxCompareRow[];
  matchCount: number;
  divergenceCount: number;
  onlyInMtCount: number;
  onlyInMxCount: number;
  isCompatible: boolean;
}

export const fetchMtMapping = (rawMessage: string) =>
  api.post<MtMxMappingTable>("/swift/mt/mapping", { rawMessage }).then((r) => r.data);

export const convertMtToMx = (
  rawMessage: string,
  userOverrides: Record<string, string>,
  targetVersion?: string | null,
) =>
  api
    .post<MtMxConvertResult>("/swift/mt/convert", {
      rawMessage,
      targetVersion: targetVersion ?? null,
      userOverrides,
    })
    .then((r) => r.data);

export const compareMtMx = (rawMt: string, rawMx: string) =>
  api.post<MtMxCompareResult>("/swift/mt/compare", { rawMt, rawMx }).then((r) => r.data);

export interface MxVersionInfo {
  messageType: string; // e.g. "pacs.008.001.13"
  version: string;     // e.g. "001.13"
}

export const fetchAvailableVersions = (messageType: string) =>
  api
    .get<{ versions: MxVersionInfo[] }>("/swift/mt/versions", {
      params: { messageType },
    })
    .then((r) => r.data.versions);
