namespace Iso8583Toolkit.IsoCore.Domain;

/// <summary>
/// Represents a fully-parsed ISO 8583 financial transaction message.
/// </summary>
public sealed class IsoMessage
{
    /// <summary>
    /// Message Type Indicator — a 4-digit numeric string (e.g. "0200" for a financial request).
    /// </summary>
    public string Mti { get; init; } = string.Empty;

    /// <summary>
    /// Primary bitmap: 64 boolean flags indicating which fields (bits 1–64) are present.
    /// Index 0 = bit 1, index 63 = bit 64.
    /// </summary>
    public bool[] PrimaryBitmap { get; init; } = new bool[64];

    /// <summary>
    /// Secondary bitmap: 64 boolean flags for bits 65–128.
    /// Only meaningful when <see cref="HasSecondaryBitmap"/> is <c>true</c>.
    /// Index 0 = bit 65, index 63 = bit 128.
    /// </summary>
    public bool[] SecondaryBitmap { get; init; } = new bool[64];

    /// <summary>
    /// <c>true</c> when bit 1 of the primary bitmap is set, signalling that a secondary
    /// bitmap follows the primary one.
    /// </summary>
    public bool HasSecondaryBitmap => PrimaryBitmap.Length > 0 && PrimaryBitmap[0];

    /// <summary>
    /// All parsed fields keyed by their bit number (1–128).
    /// Bit 1 (secondary bitmap indicator) is never stored here as a data field.
    /// </summary>
    public Dictionary<int, IsoField> Fields { get; init; } = new();

    /// <summary>
    /// The original hex-encoded byte string that was parsed to produce this message.
    /// Useful for logging and auditing.
    /// </summary>
    public string RawHex { get; init; } = string.Empty;

    /// <summary>
    /// TPDU (5-byte transport header) detected before the MTI, as a 10-char hex
    /// string. <c>null</c> when the message did not contain a TPDU.
    /// </summary>
    public string? Tpdu { get; init; }

    /// <summary>Parsed TPDU parts when <see cref="Tpdu"/> is present.</summary>
    public TpduInfo? TpduInfo { get; init; }

    /// <summary>
    /// Optional 2-byte big-endian length prefix detected after the TPDU.
    /// <c>null</c> when no plausible prefix was present.
    /// </summary>
    public LengthPrefixInfo? LengthPrefix { get; init; }

    /// <summary>UTC timestamp at which this message was parsed.</summary>
    public DateTime ParsedAt { get; init; } = DateTime.UtcNow;

    // ── Query helpers ────────────────────────────────────────────────────────

    /// <summary>
    /// Returns the bit numbers (1-based) of every active bit across both bitmaps.
    /// </summary>
    public IEnumerable<int> GetActiveBits()
    {
        for (var i = 0; i < PrimaryBitmap.Length; i++)
            if (PrimaryBitmap[i]) yield return i + 1;

        if (!HasSecondaryBitmap) yield break;

        for (var i = 0; i < SecondaryBitmap.Length; i++)
            if (SecondaryBitmap[i]) yield return i + 65;
    }

    /// <summary>Returns <c>true</c> if the field for <paramref name="bitNumber"/> was parsed and is present.</summary>
    public bool HasField(int bitNumber) => Fields.ContainsKey(bitNumber);

    /// <summary>
    /// Returns the <see cref="IsoField.RawValue"/> for <paramref name="bitNumber"/>,
    /// or <c>null</c> if the field is not present in this message.
    /// </summary>
    public string? GetFieldValue(int bitNumber) =>
        Fields.TryGetValue(bitNumber, out var field) ? field.RawValue : null;
}
