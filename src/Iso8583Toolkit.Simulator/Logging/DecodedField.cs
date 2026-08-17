namespace Iso8583Toolkit.Simulator.Logging;

/// <summary>
/// A single decoded ISO 8583 field as surfaced in <see cref="MessageLogEntry.DecodedFields"/>.
/// <c>MaskedValue</c> is what the UI shows in "safe" mode; <c>RawValue</c>
/// stays available for the local operator who explicitly asks for it.
/// </summary>
public sealed record DecodedField(
    int BitNumber,
    string Name,
    string Value,
    string MaskedValue,
    bool HasError = false,
    string? ErrorMessage = null);
