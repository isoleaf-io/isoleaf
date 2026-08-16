using System.ComponentModel;
using System.Text.Json.Serialization;

namespace Iso8583Toolkit.Application.Models.Iso20022;

public record BuildRequest(
    [property: Description("Full ISO 20022 message type (e.g. \"pacs.008.001.09\").")]
    string MessageType,
    [property: Description("Scenario id from the registry (e.g. \"pix-credit-transfer\").")]
    string ScenarioId,
    [property: Description("XPaths of optional fields/sections the editor wants emitted on top of the XSD-mandatory set.")]
    IReadOnlyList<string>? IncludeOptionalXPaths = null);

public record BuildFieldDto(
    string Name,
    // Default camelCase policy turns "XPath" into "xPath"; the frontend
    // reads `field.xpath` (all-lowercase), so without this attribute every
    // field's xpath comes back undefined and the editor state collapses
    // onto a single shared key.
    [property: JsonPropertyName("xpath")]
    string XPath,
    string? Value,
    string TypeName,
    bool IsMandatory,
    [property: Description("True when the field is required by the ecosystem on top of the XSD's own minOccurs.")]
    bool IsEcosystemMandatory,
    bool IsOptional,
    [property: Description("Contextual hint surfaced next to the editor input.")]
    string? Hint,
    IReadOnlyList<string> Enumerations,
    int? MinLength,
    int? MaxLength,
    string? Pattern);

public record BuildSectionDto(
    string Name,
    [property: JsonPropertyName("xpath")]
    string XPath,
    bool IsMandatory,
    IReadOnlyList<BuildFieldDto> Fields,
    IReadOnlyList<BuildSectionDto> Sections);

public record BuildResponse(
    string MessageType,
    string ScenarioId,
    [property: Description("Rendered XML skeleton with the scenario's overrides already substituted.")]
    string Xml,
    IReadOnlyList<BuildSectionDto> Sections);

public record AvailableFieldDto(
    string Name,
    [property: JsonPropertyName("xpath")]
    string XPath,
    string TypeName,
    IReadOnlyList<string> Enumerations);

public record AvailableFieldsResponse(IReadOnlyList<AvailableFieldDto> Fields);

public record EcosystemDto(string EcosystemId, string DisplayName, string Description);

public record ScenarioDto(
    string ScenarioId,
    string EcosystemId,
    string MessageTypePrefix,
    string DisplayName,
    string Description);
