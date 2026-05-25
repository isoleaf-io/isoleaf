using System.Text;

namespace Iso8583Toolkit.IsoCore.Domain;

/// <summary>
/// Represents a single ISO 8583 field with its parsed value inside a message.
/// </summary>
public sealed class IsoField
{
    /// <summary>Bit number in the ISO 8583 message (1–128).</summary>
    public int BitNumber { get; init; }

    /// <summary>The decoded string representation of the field value.</summary>
    public string RawValue { get; init; } = string.Empty;

    /// <summary>The original bytes that make up this field's value (excluding length prefix).</summary>
    public byte[] RawBytes { get; init; } = [];

    /// <summary>Schema definition describing this field's type, length and encoding.</summary>
    public IsoFieldDefinition Definition { get; init; } = null!;

    /// <summary>
    /// Returns a display-friendly representation of the value with sensitive data masked.
    ///   Bit 2  (PAN)       — first 6 + last 4 visible; middle masked. Under 10 chars: all but last 4 masked.
    ///   Bit 35 (Track 2)   — PAN before separator kept, everything after separator masked.
    ///   Bit 45 (Track 1)   — format code + PAN + separator + name visible, remainder masked.
    ///   Bit 52 (PIN Block) — fully masked as "********".
    ///   BCD / Binary       — hex dump.
    ///   Everything else    — raw value as-is.
    /// </summary>
    public string DisplayValue
    {
        get
        {
            if (Definition is null)
                return RawValue;

            return BitNumber switch
            {
                2  => MaskPan(RawValue),
                35 => MaskTrack2(RawValue),
                45 => MaskTrack1(RawValue),
                52 => "********",
                _  => Definition.Encoding switch
                {
                    IsoFieldEncoding.BCD or IsoFieldEncoding.Binary
                        => Convert.ToHexString(RawBytes),
                    _ => RawValue
                }
            };
        }
    }

    // ── Masking helpers ──────────────────────────────────────────────────────

    private static string MaskPan(string pan)
    {
        if (string.IsNullOrEmpty(pan))
            return pan;

        if (pan.Length < 10)
        {
            // Show only last 4 (or everything if <= 4 chars)
            if (pan.Length <= 4)
                return new string('*', pan.Length);

            return new string('*', pan.Length - 4) + pan[^4..];
        }

        // Standard: first 6 + last 4 visible
        var sb = new StringBuilder(pan.Length);
        sb.Append(pan[..6]);
        sb.Append(new string('*', pan.Length - 10));
        sb.Append(pan[^4..]);
        return sb.ToString();
    }

    private static string MaskTrack2(string track)
    {
        if (string.IsNullOrEmpty(track))
            return track;

        // Track 2 uses "=" or "D" as the field separator between PAN and discretionary data
        var sepIndex = track.IndexOfAny(['=', 'D']);
        if (sepIndex < 0)
            return MaskPan(track); // No separator — treat the whole thing as a PAN

        // Keep PAN portion + separator char, mask everything after
        var afterSep = track.Length - sepIndex - 1;
        return track[..(sepIndex + 1)] + new string('*', afterSep);
    }

    private static string MaskTrack1(string track)
    {
        if (string.IsNullOrEmpty(track))
            return track;

        // Track 1 format: <format code><PAN>^<name>^<expiry><service><discretionary>
        // We keep format code + PAN + first "^" + name + second "^", mask the rest.
        var firstCaret = track.IndexOf('^');
        if (firstCaret < 0)
            return MaskPan(track); // No caret — treat as plain PAN

        var secondCaret = track.IndexOf('^', firstCaret + 1);
        if (secondCaret < 0)
        {
            // Only one caret — keep everything up to and including it, mask the rest
            var afterFirst = track.Length - firstCaret - 1;
            return track[..(firstCaret + 1)] + new string('*', afterFirst);
        }

        // Keep everything through the second caret, mask the remainder
        var tail = track.Length - secondCaret - 1;
        return track[..(secondCaret + 1)] + new string('*', tail);
    }
}
