import { api } from "./client";
import type { BrandSummary, VirtualCard } from "@/types";

export const generateCard = (brand: string, cardholderName?: string, expiry?: string) =>
  api.post<VirtualCard>("/cards/generate", { brand, cardholderName, expiry }).then((r) => r.data);

export const validatePan = (pan: string) =>
  api.post<{ isValid: boolean; brand: string; length: number }>("/cards/validate", { pan }).then((r) => r.data);

export const detectBrand = (pan: string) =>
  api.post<{ brand: string; binRange: string | null }>("/cards/detect-brand", { pan }).then((r) => r.data);

export const getBrands = () => api.get<BrandSummary[]>("/cards/brands").then((r) => r.data);
