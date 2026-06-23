import { api } from "./client";

export interface FieldChangeDto {
  propertyName: string;
  oldValue: string;
  newValue: string;
}

export interface AddedFieldDto {
  name: string;
  xpath: string;
  typeName: string;
  cardinality: string;
  isMandatory: boolean;
}

export interface RemovedFieldDto {
  name: string;
  xpath: string;
  typeName: string;
  cardinality: string;
}

export interface ChangedFieldDto {
  name: string;
  xpath: string;
  changes: FieldChangeDto[];
}

export interface CompareResponse {
  fromVersion: string;
  toVersion: string;
  family: string;
  addedCount: number;
  removedCount: number;
  changedCount: number;
  added: AddedFieldDto[];
  removed: RemovedFieldDto[];
  changed: ChangedFieldDto[];
}

export const compareIso20022Versions = (from: string, to: string) =>
  api
    .get<CompareResponse>("/iso20022/reference/compare", { params: { from, to } })
    .then((r) => r.data);
