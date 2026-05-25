namespace Iso8583Toolkit.Cards.Tracks;

public static class TrackGenerator
{
    /// <summary>
    /// Generates ISO 7813 Track 1 data.
    /// Format: %B{PAN}^{NAME}^{EXPIRY}{SERVICE_CODE}{PVV}?
    /// </summary>
    public static string GenerateTrack1(string pan, string name, string expiry, string serviceCode, string pvki, string pvv)
    {
        // Name is padded/truncated to 26 chars (ISO 7813 max)
        var formattedName = name.Length > 26 ? name[..26] : name;
        return $"%B{pan}^{formattedName}^{expiry}{serviceCode}{pvki}{pvv}?";
    }

    /// <summary>
    /// Generates ISO 7813 Track 2 data.
    /// Format: {PAN}={EXPIRY}{SERVICE_CODE}{CVV}
    /// </summary>
    public static string GenerateTrack2(string pan, string expiry, string serviceCode, string cvv)
    {
        return $"{pan}={expiry}{serviceCode}{cvv}";
    }

    /// <summary>
    /// Parses Track 1 into its component fields.
    /// Expected format: %B{PAN}^{NAME}^{EXPIRY}{SERVICE_CODE}{PVKI}{PVV}?
    /// </summary>
    public static Dictionary<string, string> ParseTrack1(string track1)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(track1);

        var result = new Dictionary<string, string>();
        var data = track1.Trim();

        // Remove start sentinel %B and end sentinel ?
        if (data.StartsWith("%B", StringComparison.Ordinal))
            data = data[2..];
        if (data.EndsWith('?'))
            data = data[..^1];

        var parts = data.Split('^');
        if (parts.Length < 3)
            throw new FormatException("Invalid Track 1 format: expected at least 3 segments separated by '^'.");

        result["PAN"] = parts[0];
        result["Name"] = parts[1];

        var tail = parts[2];
        if (tail.Length >= 4)
        {
            result["Expiry"] = tail[..4];
            tail = tail[4..];
        }
        if (tail.Length >= 3)
        {
            result["ServiceCode"] = tail[..3];
            tail = tail[3..];
        }
        if (tail.Length >= 1)
        {
            result["PVKI"] = tail[..1];
            tail = tail[1..];
        }
        if (tail.Length >= 4)
        {
            result["PVV"] = tail[..4];
        }

        return result;
    }

    /// <summary>
    /// Parses Track 2 into its component fields.
    /// Expected format: {PAN}={EXPIRY}{SERVICE_CODE}{CVV}
    /// </summary>
    public static Dictionary<string, string> ParseTrack2(string track2)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(track2);

        var result = new Dictionary<string, string>();
        var separatorIndex = track2.IndexOf('=');

        if (separatorIndex < 0)
            throw new FormatException("Invalid Track 2 format: missing '=' separator.");

        result["PAN"] = track2[..separatorIndex];

        var tail = track2[(separatorIndex + 1)..];
        if (tail.Length >= 4)
        {
            result["Expiry"] = tail[..4];
            tail = tail[4..];
        }
        if (tail.Length >= 3)
        {
            result["ServiceCode"] = tail[..3];
            tail = tail[3..];
        }
        if (tail.Length > 0)
        {
            result["CVV"] = tail;
        }

        return result;
    }
}
