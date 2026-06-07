using Iso8583Toolkit.IsoCore.Domain;

namespace Iso8583Toolkit.IsoCore.Parsing;

/// <summary>
/// Cross-layer helpers for length-prefix detection and wire-byte counting.
/// Centralizes logic that would otherwise be duplicated in the API service,
/// the agent's injector and the frontend — keeping them all in sync about
/// what "binary-hex" means and how a length prefix is sized/encoded.
/// </summary>
public static class IsoWireHelper
{
    /// <summary>
    /// True when the wire string is a plausible hex-encoded byte stream:
    /// non-empty, even length, every char is a hex digit (0-9, A-F, a-f).
    /// This is the lightweight gate used for length-prefix arithmetic — the
    /// full parser-routing heuristic lives in <c>IsoParseService.IsBinaryHex</c>.
    /// </summary>
    public static bool IsBinaryHex(string wire)
    {
        if (string.IsNullOrEmpty(wire)) return false;
        if (wire.Length % 2 != 0) return false;
        foreach (var c in wire)
        {
            if (!Uri.IsHexDigit(c)) return false;
        }
        return true;
    }

    /// <summary>
    /// Counts how many bytes the wire will occupy on the TCP socket — which
    /// is also the value that should be written into the 2-byte length
    /// prefix. For binary-hex wires this is <c>wire.Length / 2</c> (each pair
    /// of hex chars decodes to one byte); for ASCII wires each char is one
    /// byte on the wire so the answer is <c>wire.Length</c>.
    /// </summary>
    public static int CalculateWireCharCount(string wire)
    {
        if (string.IsNullOrEmpty(wire)) return 0;
        return IsBinaryHex(wire) ? wire.Length / 2 : wire.Length;
    }

    /// <summary>
    /// Encodes a wire byte count as the 4-char big-endian uint16 hex string
    /// that goes on the wire as the length prefix. Clamps to <c>0xFFFF</c>.
    /// </summary>
    public static string ToLengthPrefixHex(int charCount)
    {
        var v = Math.Min(Math.Max(charCount, 0), 0xFFFF);
        return v.ToString("X4");
    }

    /// <summary>
    /// Detects a 2-byte length prefix at the start of a binary-hex wire and
    /// returns the payload without it. Heuristic matches the parser's
    /// <c>DetectLengthPrefixBytes</c>: first prefix byte must be non-printable
    /// (0x00–0x1F) and the 4 bytes that follow must look like a printable
    /// ASCII MTI candidate (either at offset 4..12 in the string, or at
    /// 14..22 when a 5-byte raw TPDU sits between prefix and MTI).
    /// </summary>
    public static (string Payload, LengthPrefixInfo? Prefix) StripLengthPrefix(string wire)
    {
        if (string.IsNullOrEmpty(wire) || !IsBinaryHex(wire) || wire.Length < 12)
            return (wire, null);

        var firstByte = Convert.ToByte(wire.Substring(0, 2), 16);
        if (firstByte >= 0x20) return (wire, null);

        // Two layouts: [prefix][MTI...] and [prefix][raw 5B TPDU][MTI...].
        if (!LooksLikePrintable(wire, charOffset: 4, byteCount: 4) &&
            (wire.Length < 22 || !LooksLikePrintable(wire, charOffset: 14, byteCount: 4)))
        {
            return (wire, null);
        }

        var secondByte = Convert.ToByte(wire.Substring(2, 2), 16);
        var declared = (firstByte << 8) | secondByte;
        var payload = wire.Substring(4);
        var actual = CalculateWireCharCount(payload);
        var prefix = new LengthPrefixInfo(
            Hex: wire.Substring(0, 4).ToUpperInvariant(),
            ExpectedLength: declared,
            ActualLength: actual,
            Match: declared == actual);
        return (payload, prefix);
    }

    private static bool LooksLikePrintable(string hexWire, int charOffset, int byteCount)
    {
        if (charOffset + byteCount * 2 > hexWire.Length) return false;
        for (var i = 0; i < byteCount; i++)
        {
            var b = Convert.ToByte(hexWire.Substring(charOffset + i * 2, 2), 16);
            if (b < 0x20 || b > 0x7E) return false;
        }
        return true;
    }
}
