import { api } from "./client";
import type {
  BitmapParseResponse,
  IsoParseResponse,
  LayoutFieldDefinition,
  LayoutSummary,
} from "@/types";

export const parseHex = (hexMessage: string, layoutName = "default") =>
  api.post<IsoParseResponse>("/parse/hex", { hexMessage, layoutName }).then((r) => r.data);

export const parseBitmap = (hexBitmap: string) =>
  api.post<BitmapParseResponse>("/parse/bitmap", { hexBitmap }).then((r) => r.data);

export const getLayouts = () =>
  api.get<LayoutSummary[]>("/parse/layouts").then((r) => r.data);

export const getLayoutFields = (name = "default") =>
  api.get<LayoutFieldDefinition[]>(`/parse/layouts/${name}/fields`).then((r) => r.data);
