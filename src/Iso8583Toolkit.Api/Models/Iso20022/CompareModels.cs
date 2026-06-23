using System.ComponentModel;

namespace Iso8583Toolkit.Api.Models.Iso20022;

public record FieldChangeDto(string PropertyName, string OldValue, string NewValue);

public record AddedFieldDto(
    string Name,
    string XPath,
    string TypeName,
    string Cardinality,
    bool IsMandatory);

public record RemovedFieldDto(
    string Name,
    string XPath,
    string TypeName,
    string Cardinality);

public record ChangedFieldDto(
    string Name,
    string XPath,
    IReadOnlyList<FieldChangeDto> Changes);

public record CompareResponse(
    string FromVersion,
    string ToVersion,
    [property: Description("Shared message family prefix (e.g. \"pacs\", \"camt\").")]
    string Family,
    int AddedCount,
    int RemovedCount,
    int ChangedCount,
    IReadOnlyList<AddedFieldDto> Added,
    IReadOnlyList<RemovedFieldDto> Removed,
    IReadOnlyList<ChangedFieldDto> Changed);
