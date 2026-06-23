import { api } from "./client";

export interface FieldDefinitionDto {
  name: string;
  xpath: string;
  depth: number;
  typeName: string;
  isComplex: boolean;
  cardinality: string;
  isMandatory: boolean;
  minLength: number | null;
  maxLength: number | null;
  pattern: string | null;
  enumerations: string[];
  documentation: string | null;
  children: FieldDefinitionDto[];
}

export interface MessageTypeListResponse {
  messageTypes: string[];
}

export interface MessageReferenceResponse {
  messageType: string;
  totalFields: number;
  fields: FieldDefinitionDto[];
}

export interface FieldOccurrenceDto {
  messageType: string;
  xpath: string;
  cardinality: string;
  isMandatory: boolean;
  typeName: string;
}

export interface FieldDifferenceDto {
  messageTypeA: string;
  messageTypeB: string;
  differentProperties: string[];
}

export interface FieldSearchResultDto {
  fieldName: string;
  isConsistent: boolean;
  occurrences: FieldOccurrenceDto[];
  differences: FieldDifferenceDto[];
}

export interface SearchResponse {
  term: string;
  totalResults: number;
  results: FieldSearchResultDto[];
}

export interface FieldExampleResponse {
  messageType: string;
  xmlNamespace: string;
  xpath: string;
  xmlExample: string;
}

export const listMessageTypes = () =>
  api.get<MessageTypeListResponse>("/iso20022/reference").then((r) => r.data);

export const getMessageReference = (messageType: string) =>
  api
    .get<MessageReferenceResponse>(`/iso20022/reference/${encodeURIComponent(messageType)}`)
    .then((r) => r.data);

export const searchFields = (term: string) =>
  api
    .get<SearchResponse>("/iso20022/reference/search", { params: { term } })
    .then((r) => r.data);

export const getFieldDetail = (fieldName: string) =>
  api
    .get<FieldSearchResultDto>(`/iso20022/reference/field/${encodeURIComponent(fieldName)}`)
    .then((r) => r.data);

// Note: xpath segments are passed unescaped because the controller binds the
// catch-all `{*xpath}` and ASP.NET expects raw slashes.
export const getFieldExample = (messageType: string, xpath: string) =>
  api
    .get<FieldExampleResponse>(
      `/iso20022/reference/${encodeURIComponent(messageType)}/example/${xpath}`,
    )
    .then((r) => r.data);
