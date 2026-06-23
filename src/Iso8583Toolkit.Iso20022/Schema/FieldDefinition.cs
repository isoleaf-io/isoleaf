namespace Iso8583Toolkit.Iso20022.Schema;

/// <summary>
/// One node in the hierarchical view of an ISO 20022 message produced by
/// <see cref="XsdFieldExtractor"/>. Designed to be reused by every Sprint 6
/// service that needs to walk a message structure — the Reference service
/// surfaces this directly, the upcoming Validator uses the restrictions, and
/// the upcoming Builder uses the cardinality + enumerations to drive the
/// form. Records, not classes, because they are pure value snapshots — once
/// extracted from the XSD they never change.
/// </summary>
public record FieldDefinition
{
    /// <summary>Technical element name (e.g. <c>MsgId</c>).</summary>
    public required string Name { get; init; }

    /// <summary>Full slash-separated path from the message root (e.g. <c>FIToFICstmrCdtTrf/GrpHdr/MsgId</c>).</summary>
    public required string XPath { get; init; }

    /// <summary>Depth in the hierarchy — 0 for the message root.</summary>
    public required int Depth { get; init; }

    /// <summary>XSD type name (e.g. <c>Max35Text</c>, <c>ActiveCurrencyAndAmount</c>, <c>decimal</c>).</summary>
    public required string TypeName { get; init; }

    /// <summary>True for container types (sequences/choices). False for leaf simple types.</summary>
    public required bool IsComplex { get; init; }

    /// <summary>Minimum number of occurrences. 0 = optional, 1+ = mandatory.</summary>
    public required int MinOccurs { get; init; }

    /// <summary>Maximum number of occurrences. <c>-1</c> sentinel for <c>unbounded</c>.</summary>
    public required int MaxOccurs { get; init; }

    /// <summary>Formatted cardinality such as <c>[1..1]</c>, <c>[0..n]</c> or <c>[0..3]</c>.</summary>
    public string Cardinality => MaxOccurs == -1
        ? $"[{MinOccurs}..n]"
        : $"[{MinOccurs}..{MaxOccurs}]";

    /// <summary>True when this field MUST appear at least once.</summary>
    public bool IsMandatory => MinOccurs >= 1;

    public int? MinLength { get; init; }
    public int? MaxLength { get; init; }

    /// <summary>XSD <c>pattern</c> facet (regex). Null when not constrained.</summary>
    public string? Pattern { get; init; }

    /// <summary>Allowed values from <c>enumeration</c> facets, in document order.</summary>
    public IReadOnlyList<string> Enumerations { get; init; } = [];

    /// <summary>Text from <c>xs:annotation/xs:documentation</c>.</summary>
    public string? Documentation { get; init; }

    /// <summary>Direct children of this field. Empty for simple types.</summary>
    public IReadOnlyList<FieldDefinition> Children { get; init; } = [];
}
