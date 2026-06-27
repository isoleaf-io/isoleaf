import { api } from "./client";

export interface PixField {
  id: string;
  name: string;
  value: string;
  description: string | null;
  subFields: PixField[];
}

export interface PixDecodeResult {
  payload: string;
  qrType: "static" | "dynamic";
  pixKey: string | null;
  pixKeyType: string | null;
  merchantName: string | null;
  merchantCity: string | null;
  amount: string | null;
  txId: string | null;
  crcValid: boolean;
  expectedCrc: string | null;
  providedCrc: string | null;
  fields: PixField[];
  warnings: string[];
}

export interface PixGenerateRequest {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount?: number | null;
  txId?: string | null;
  description?: string | null;
  singleUse?: boolean;
}

export interface PixKeyAnalysis {
  key: string;
  keyType: "EVP" | "EMAIL" | "PHONE" | "CPF" | "CNPJ" | "UNKNOWN";
  warnings: string[];
}

export interface PixTxIdValidationResult {
  isValid: boolean;
  errors: string[];
}

export const decodePixPayload = (payload: string) =>
  api.post<PixDecodeResult>("/pix/qrcode/decode", { payload }).then((r) => r.data);

export const generatePixPayload = (req: PixGenerateRequest) =>
  api
    .post<{ payload: string }>("/pix/qrcode/generate", req)
    .then((r) => r.data.payload);

export const validatePixTxId = (txId: string) =>
  api
    .post<PixTxIdValidationResult>("/pix/txid/validate", { txId })
    .then((r) => r.data);

export const generatePixTxId = () =>
  api.get<{ txId: string }>("/pix/txid/generate").then((r) => r.data.txId);

export const analyzePixKey = (key: string) =>
  api.post<PixKeyAnalysis>("/pix/key/analyze", { key }).then((r) => r.data);
