namespace Iso8583Toolkit.Simulator.Protocol;

/// <summary>
/// Builds and parses TPDU (Transport Protocol Data Unit) 5-byte headers:
/// [ID (1B)] [Destination NII (2B BCD)] [Source NII (2B BCD)].
/// </summary>
public static class TpduBuilder
{
    public const byte DefaultId = 0x60;

    /// <summary>
    /// Builds a TPDU from id + dest/source NII (4-digit decimal strings).
    /// Returns a 10-char hex string (5 bytes).
    /// </summary>
    public static string Build(byte id, string destinationNii, string sourceNii)
    {
        if (!IsFourDigit(destinationNii))
            throw new ArgumentException("Destination NII must be 4 decimal digits.", nameof(destinationNii));
        if (!IsFourDigit(sourceNii))
            throw new ArgumentException("Source NII must be 4 decimal digits.", nameof(sourceNii));

        Span<byte> buf = stackalloc byte[5];
        buf[0] = id;
        PackBcd(destinationNii, buf.Slice(1, 2));
        PackBcd(sourceNii, buf.Slice(3, 2));
        return Convert.ToHexString(buf);
    }

    /// <summary>
    /// Generates a TPDU with default id 0x60 and random 4-digit NII values.
    /// </summary>
    public static string GenerateAuto()
    {
        var dest = Random.Shared.Next(1, 10000).ToString("D4");
        var src = Random.Shared.Next(1, 10000).ToString("D4");
        return Build(DefaultId, dest, src);
    }

    public static TpduParts Parse(string hex)
    {
        var bytes = Convert.FromHexString(hex);
        if (bytes.Length != 5)
            throw new ArgumentException("TPDU must be exactly 5 bytes (10 hex chars).", nameof(hex));

        return new TpduParts(
            bytes[0],
            UnpackBcd(bytes.AsSpan(1, 2)),
            UnpackBcd(bytes.AsSpan(3, 2)));
    }

    /// <summary>
    /// Heuristic detector: returns true when the first 5 bytes look like a TPDU
    /// (ID in the 0x60-0x6F range) AND bytes 5..8 form a valid 4-digit ASCII MTI.
    /// </summary>
    public static bool HasTpdu(ReadOnlySpan<byte> rawBytes)
    {
        if (rawBytes.Length < 9) return false;
        var id = rawBytes[0];
        if (id < 0x60 || id > 0x6F) return false;
        for (var i = 5; i < 9; i++)
        {
            var b = rawBytes[i];
            if (b < (byte)'0' || b > (byte)'9') return false;
        }
        return true;
    }

    /// <summary>
    /// Inverts source/destination NII for a response TPDU. ID byte is preserved.
    /// </summary>
    public static string InvertTpdu(string tpduHex)
    {
        var bytes = Convert.FromHexString(tpduHex);
        if (bytes.Length != 5)
            throw new ArgumentException("TPDU must be exactly 5 bytes (10 hex chars).", nameof(tpduHex));

        Span<byte> inv = stackalloc byte[5];
        inv[0] = bytes[0];
        inv[1] = bytes[3]; // src high → dest high
        inv[2] = bytes[4]; // src low  → dest low
        inv[3] = bytes[1]; // dest high → src high
        inv[4] = bytes[2]; // dest low  → src low
        return Convert.ToHexString(inv);
    }

    private static bool IsFourDigit(string s) =>
        s.Length == 4 && s.All(char.IsDigit);

    private static void PackBcd(string digits, Span<byte> dest)
    {
        dest[0] = (byte)(((digits[0] - '0') << 4) | (digits[1] - '0'));
        dest[1] = (byte)(((digits[2] - '0') << 4) | (digits[3] - '0'));
    }

    private static string UnpackBcd(ReadOnlySpan<byte> bytes) =>
        $"{bytes[0] >> 4}{bytes[0] & 0x0F}{bytes[1] >> 4}{bytes[1] & 0x0F}";
}

public sealed record TpduParts(byte Id, string DestinationNii, string SourceNii);
