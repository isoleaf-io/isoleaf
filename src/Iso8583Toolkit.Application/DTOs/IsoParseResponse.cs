namespace Iso8583Toolkit.Application.DTOs;

public sealed record IsoParseResponse(
    bool Success,
    string? Mti = null,
    string? MessageClass = null,
    string? MessageFunction = null,
    bool HasSecondaryBitmap = false,
    List<int>? ActiveBits = null,
    List<IsoFieldResponse>? Fields = null,
    string? Error = null,
    DateTime? ParsedAt = null,
    TpduResponse? Tpdu = null,
    /// <summary>Card brand inferred from bit 2 (PAN). Null when bit 2 is absent or unmappable.</summary>
    string? DetectedBrand = null,
    /// <summary>2-byte big-endian length prefix detected after the TPDU, if any.</summary>
    LengthPrefixResponse? LengthPrefix = null,
    /// <summary>
    /// Structured error info — populated when <see cref="Success"/> is false. The string
    /// <see cref="Error"/> property keeps the formatted summary for legacy callers.
    /// </summary>
    ParseErrorResponse? ParseError = null,
    /// <summary>
    /// Fields successfully parsed before the failure point. Empty when the parse
    /// succeeded, or when the failure happened before any field was read.
    /// </summary>
    List<IsoFieldResponse>? PartialFields = null);

public sealed record ParseErrorResponse(
    string Field,
    int Position,
    string Message,
    string? Hint);

public sealed record TpduResponse(
    string Hex,
    string Id,
    string DestinationNii,
    string SourceNii);

public sealed record LengthPrefixResponse(
    string Hex,
    int ExpectedLength,
    int ActualLength,
    bool Match);

public sealed record BitmapParseResponse(
    List<int> ActiveBits,
    bool HasSecondaryBitmap,
    string BitmapBinary,
    string PrimaryHex,
    string? SecondaryHex = null);

public sealed record LayoutSummary(
    string Name,
    string Version,
    int FieldCount);

public sealed record LayoutFieldDefinition(
    int BitNumber,
    string Name,
    string Type,
    int MaxLength,
    string Encoding);
