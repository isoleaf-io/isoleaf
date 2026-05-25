namespace Iso8583Toolkit.IsoCore.Domain;

/// <summary>
/// Describes the static schema of a single ISO 8583 field (bit).
/// Instances are typically held in a message specification/dictionary.
/// </summary>
public sealed class IsoFieldDefinition
{
    /// <summary>Bit number in the ISO 8583 message (1–128).</summary>
    public int BitNumber { get; init; }

    /// <summary>Human-readable name of the field (e.g. "Primary Account Number").</summary>
    public string Name { get; init; } = string.Empty;

    /// <summary>Determines whether the field is fixed-length or variable-length (LLVAR / LLLVAR / LLLLVAR).</summary>
    public IsoFieldType Type { get; init; }

    /// <summary>
    /// Maximum number of characters/bytes the field can contain.
    /// For <see cref="IsoFieldType.Fixed"/> this is also the exact length.
    /// </summary>
    public int MaxLength { get; init; }

    /// <summary>Wire encoding used for this field's value.</summary>
    public IsoFieldEncoding Encoding { get; init; }

    /// <summary>Optional free-text description of the field's purpose.</summary>
    public string? Description { get; init; }
}
