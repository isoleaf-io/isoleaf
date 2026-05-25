namespace Iso8583Toolkit.IsoCore.Domain;

/// <summary>
/// Specifies how an ISO 8583 field value is encoded on the wire.
/// </summary>
public enum IsoFieldEncoding
{
    /// <summary>Plain ASCII text encoding (each character = 1 byte).</summary>
    ASCII,

    /// <summary>IBM Extended Binary Coded Decimal Interchange Code.</summary>
    EBCDIC,

    /// <summary>Binary Coded Decimal — each decimal digit packed into 4 bits (nibble).</summary>
    BCD,

    /// <summary>Raw binary encoding.</summary>
    Binary
}
