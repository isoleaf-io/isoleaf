namespace Iso8583Toolkit.IsoCore.Domain;

/// <summary>
/// Defines the length-type of an ISO 8583 field.
/// </summary>
public enum IsoFieldType
{
    /// <summary>Field has a fixed length defined in <see cref="IsoFieldDefinition.MaxLength"/>.</summary>
    Fixed,

    /// <summary>Variable-length field prefixed by a 2-digit decimal length indicator (up to 99 bytes).</summary>
    LLVAR,

    /// <summary>Variable-length field prefixed by a 3-digit decimal length indicator (up to 999 bytes).</summary>
    LLLVAR,

    /// <summary>Variable-length field prefixed by a 4-digit decimal length indicator (up to 9999 bytes).</summary>
    LLLLVAR
}
