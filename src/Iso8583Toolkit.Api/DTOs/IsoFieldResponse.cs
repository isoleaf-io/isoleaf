namespace Iso8583Toolkit.Api.DTOs;

public sealed record IsoFieldResponse(
    int BitNumber,
    string Name,
    string Value,
    string DisplayValue,
    string Type,
    int Length);
