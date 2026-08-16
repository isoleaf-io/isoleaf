namespace Iso8583Toolkit.Application.DTOs;

public sealed record IsoFieldResponse(
    int BitNumber,
    string Name,
    string Value,
    string DisplayValue,
    string Type,
    int Length);
