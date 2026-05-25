using System.Text.RegularExpressions;

namespace Iso8583Toolkit.IsoCore.Parsing;

/// <summary>
/// Provides static methods for parsing and interpreting ISO 8583 Message Type Indicators (MTI).
///
/// The MTI is a 4-digit numeric code positioned at the start of every ISO 8583 message:
///   digit 1 — ISO version  (0 = ISO 8583-1:1987, 1 = ISO 8583-2:1993, ...)
///   digit 2 — Message class (1=Authorization, 2=Financial, 4=Reversal, 6=Admin, ...)
///   digit 3 — Message function (0=Request, 1=Request response, 2=Advice, ...)
///   digit 4 — Message origin  (0=Acquirer, 1=Acquirer repeat, 2=Issuer, ...)
/// </summary>
public static partial class MtiParser
{
    private static readonly Regex MtiPattern = MtiRegex();

    // ── Parse ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Parses an MTI from a 4-character hex string where each hex pair encodes one ASCII digit.
    /// For example, "30323030" → "0200".
    /// If the input is already 4 printable ASCII digits it is returned as-is after validation.
    /// </summary>
    public static string ParseFromHex(string hex)
    {
        if (hex is null)
            throw new ArgumentNullException(nameof(hex));

        var clean = hex.Trim();

        // Already in plain ASCII digit form (e.g. "0200")
        if (clean.Length == 4 && IsValid(clean))
            return clean;

        // Hex-encoded ASCII: "30323030" → 4 bytes → "0200"
        if (clean.Length == 8)
        {
            var bytes = Convert.FromHexString(clean);
            var decoded = System.Text.Encoding.ASCII.GetString(bytes);
            if (IsValid(decoded))
                return decoded;
        }

        throw new FormatException(
            $"Cannot parse MTI from hex input '{hex}'. Expected 4 ASCII digits or 8 hex chars encoding them.");
    }

    /// <summary>
    /// Validates and normalises an MTI supplied as a plain ASCII string.
    /// </summary>
    /// <param name="ascii">A 4-character string of decimal digits, e.g. "0200".</param>
    /// <exception cref="FormatException">Thrown when the string is not a valid MTI.</exception>
    public static string ParseFromAscii(string ascii)
    {
        if (ascii is null)
            throw new ArgumentNullException(nameof(ascii));

        var clean = ascii.Trim();
        if (!IsValid(clean))
            throw new FormatException(
                $"'{ascii}' is not a valid MTI. Expected exactly 4 decimal digits.");

        return clean;
    }

    // ── Validate ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Returns <c>true</c> if <paramref name="mti"/> is exactly 4 decimal digits.
    /// </summary>
    public static bool IsValid(string mti) =>
        mti is { Length: 4 } && MtiPattern.IsMatch(mti);

    // ── Classify ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Returns the human-readable message class derived from the second digit of the MTI.
    /// </summary>
    /// <param name="mti">A valid 4-digit MTI string.</param>
    public static string GetMessageClass(string mti)
    {
        EnsureValid(mti);
        return mti[1] switch
        {
            '1' => "Authorization",
            '2' => "Financial",
            '3' => "File Action",
            '4' => "Reversal / Chargeback",
            '5' => "Reconciliation",
            '6' => "Administrative",
            '7' => "Fee Collection",
            '8' => "Network Management",
            '9' => "Reserved",
            _   => "Unknown"
        };
    }

    /// <summary>
    /// Returns the human-readable message function derived from the third digit of the MTI.
    /// </summary>
    /// <param name="mti">A valid 4-digit MTI string.</param>
    public static string GetMessageFunction(string mti)
    {
        EnsureValid(mti);
        return mti[2] switch
        {
            '0' => "Request",
            '1' => "Request Response",
            '2' => "Advice",
            '3' => "Advice Response",
            '4' => "Notification",
            '5' => "Notification Acknowledgement",
            '6' => "Instruction",
            '7' => "Instruction Acknowledgement",
            '8' => "Reserved",
            '9' => "Reserved",
            _   => "Unknown"
        };
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static void EnsureValid(string mti)
    {
        if (!IsValid(mti))
            throw new FormatException($"'{mti}' is not a valid MTI.");
    }

    [GeneratedRegex(@"^\d{4}$")]
    private static partial Regex MtiRegex();
}
