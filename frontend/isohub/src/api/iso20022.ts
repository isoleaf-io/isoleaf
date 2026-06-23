import { api } from "./client";

export interface ParsedNode {
  name: string;
  value?: string | null;
  namespace?: string | null;
  children: ParsedNode[];
}

/**
 * Structured body returned by the backend when the XML's namespace was
 * recognised in shape (ISO 20022 URN prefix present) but no matching XSD is
 * registered. <c>compatibleVersions</c> lists every namespace of the same
 * message family that the agent does support, so the UI can guide the user
 * toward an accepted version.
 */
export interface IncompatibleVersionError {
  title: string;
  detail: string;
  detectedNamespace: string;
  compatibleVersions: string[];
}

export interface SummaryField {
  label: string;
  value: string | null;
  found: boolean;
}

export interface StatementEntry {
  amount: string | null;
  currency: string | null;
  creditDebitIndicator: string | null; // "CRDT" | "DBIT"
  bookingDate: string | null;
  valueDate: string | null;
  status: string | null;
  endToEndId: string | null;
  remittanceInfo: string | null;
}

export interface MessageSummary {
  operation: string;
  confidence: "full" | "partial" | "unknown";
  fields: SummaryField[];
  /** Statement entries — only present for camt.053. */
  entries?: StatementEntry[];
}

export interface ParseResponse {
  messageType: string;
  namespace: string;
  summary: MessageSummary;
  root: ParsedNode;
}

export const parseIso20022 = (xmlContent: string) =>
  api.post<ParseResponse>("/iso20022/parse", { xmlContent }).then((r) => r.data);

export interface ValidationErrorDto {
  message: string;
  severity: "error" | "warning";
  lineNumber: number | null;
  linePosition: number | null;
  xpath: string | null;
}

export interface ValidateResponse {
  messageType: string;
  isValid: boolean;
  errorCount: number;
  warningCount: number;
  errors: ValidationErrorDto[];
}

export const validateIso20022 = (xmlContent: string, messageType?: string) =>
  api
    .post<ValidateResponse>("/iso20022/validate", { xmlContent, messageType })
    .then((r) => r.data);
