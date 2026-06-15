import { api } from "./client";
import type { VirtualCard } from "@/types";

export const generateCard = (brand: string, cardholderName?: string, expiry?: string) =>
  api.post<VirtualCard>("/cards/generate", { brand, cardholderName, expiry }).then((r) => r.data);
