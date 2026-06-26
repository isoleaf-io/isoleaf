import { api } from "./client";

export interface EcosystemDto {
  ecosystemId: string;
  displayName: string;
  description: string;
}

export interface ScenarioDto {
  scenarioId: string;
  ecosystemId: string;
  messageTypePrefix: string;
  displayName: string;
  description: string;
}

export interface BuildFieldDto {
  name: string;
  xpath: string;
  value: string | null;
  typeName: string;
  isMandatory: boolean;
  isEcosystemMandatory: boolean;
  isOptional: boolean;
  hint: string | null;
  enumerations: string[];
  minLength: number | null;
  maxLength: number | null;
  pattern: string | null;
}

export interface BuildSectionDto {
  name: string;
  xpath: string;
  isMandatory: boolean;
  fields: BuildFieldDto[];
  sections: BuildSectionDto[];
}

export interface BuildResponse {
  messageType: string;
  scenarioId: string;
  xml: string;
  sections: BuildSectionDto[];
}

export const listEcosystems = () =>
  api.get<EcosystemDto[]>("/iso20022/builder/ecosystems").then((r) => r.data);

/**
 * Lists scenarios for an ecosystem. When `messageTypePrefix` is omitted,
 * every scenario of the ecosystem is returned — that's how the new
 * Ecosystem → Scenario cascade fetches the menu before the user has
 * settled on a message family.
 */
export const listScenarios = (ecosystemId: string, messageTypePrefix?: string) =>
  api
    .get<ScenarioDto[]>("/iso20022/builder/scenarios", {
      params: { ecosystemId, messageTypePrefix },
    })
    .then((r) => r.data);

export const buildIso20022 = (
  messageType: string,
  scenarioId: string,
  includeOptionalXPaths?: string[],
) =>
  api
    .post<BuildResponse>("/iso20022/builder/build", {
      messageType,
      scenarioId,
      includeOptionalXPaths,
    })
    .then((r) => r.data);

/**
 * Optional leaves that aren't in the structural build response — the user
 * can promote any of these into the form via the search bar. Returned by
 * the backend's available-fields endpoint, walked across the whole XSD tree.
 */
export interface AvailableField {
  name: string;
  xpath: string;
  typeName: string;
  enumerations: string[];
}

interface AvailableFieldsResponse {
  fields: AvailableField[];
}

export const listAvailableFields = (
  messageType: string,
  scenarioId: string,
) =>
  api
    .get<AvailableFieldsResponse>("/iso20022/builder/available-fields", {
      params: { messageType, scenarioId },
    })
    .then((r) => r.data.fields ?? []);
