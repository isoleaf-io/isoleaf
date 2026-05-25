namespace Iso8583Toolkit.Agent.Models;

public sealed record DecodedField(
    int BitNumber,
    string Name,
    string Value,
    string MaskedValue,
    bool HasError = false,
    string? ErrorMessage = null);
