using System.ComponentModel;
using System.Text.Json.Serialization;

namespace Iso8583Toolkit.Application.Models.Iso20022;

public record MessageTypeListResponse(
    [property: Description("Every ISO 20022 message type whose XSD has been successfully extracted.")]
    IReadOnlyList<string> MessageTypes);

public record FieldDefinitionDto(
    string Name,
    // System.Text.Json's CamelCase policy only lowercases the first letter,
    // so XPath would serialize as "xPath". Lock it to the all-lowercase
    // form the TypeScript types already use.
    [property: JsonPropertyName("xpath")]
    [property: Description("Slash-separated path from the message root.")]
    string XPath,
    int Depth,
    string TypeName,
    bool IsComplex,
    [property: Description("Formatted cardinality such as [1..1] or [0..n].")]
    string Cardinality,
    bool IsMandatory,
    int? MinLength,
    int? MaxLength,
    string? Pattern,
    IReadOnlyList<string> Enumerations,
    string? Documentation,
    IReadOnlyList<FieldDefinitionDto> Children);

public record MessageReferenceResponse(
    string MessageType,
    [property: Description("Total field count including nested children.")]
    int TotalFields,
    IReadOnlyList<FieldDefinitionDto> Fields);

public record FieldOccurrenceDto(
    string MessageType,
    [property: JsonPropertyName("xpath")]
    string XPath,
    string Cardinality,
    bool IsMandatory,
    string TypeName);

public record FieldDifferenceDto(
    string MessageTypeA,
    string MessageTypeB,
    [property: Description("Names of FieldDefinition properties that differ between the two message types.")]
    IReadOnlyList<string> DifferentProperties);

public record FieldSearchResultDto(
    string FieldName,
    [property: Description("True when every occurrence has identical type and cardinality.")]
    bool IsConsistent,
    IReadOnlyList<FieldOccurrenceDto> Occurrences,
    IReadOnlyList<FieldDifferenceDto> Differences);

public record SearchResponse(
    string Term,
    int TotalResults,
    IReadOnlyList<FieldSearchResultDto> Results);

public record FieldExampleResponse(
    string MessageType,
    [property: Description("Target namespace of the message's XSD.")]
    string XmlNamespace,
    [property: JsonPropertyName("xpath")]
    [property: Description("Slash-separated path identifying the highlighted field.")]
    string XPath,
    [property: Description("Minimal XML document for the message with the target field wrapped in <!-- ▶ Name --> / <!-- ◀ --> markers.")]
    string XmlExample);
