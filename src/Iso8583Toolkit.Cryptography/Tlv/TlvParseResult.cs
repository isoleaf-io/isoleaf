namespace Iso8583Toolkit.Cryptography.Tlv;

/// <summary>
/// Outcome of a tolerant BER-TLV parse. Unlike the strict <see cref="TlvParser.Parse(string)"/>
/// (which throws on truncated data), <see cref="TlvParser.ParsePartial(string, int)"/> never
/// throws on structural problems — it returns whatever could be parsed plus diagnostics so
/// the UI can show partial results and the user can adjust (e.g. tweak the header-skip).
/// </summary>
public sealed record TlvParseResult
{
    /// <summary>Tags successfully decoded before parsing stopped.</summary>
    public List<TlvTag> Tags { get; init; } = new();

    /// <summary><c>true</c> when the input was consumed end-to-end with no structural errors.</summary>
    public bool IsComplete { get; init; }

    /// <summary>Human-readable message describing why parsing stopped. <c>null</c> when complete.</summary>
    public string? ParseError { get; init; }

    /// <summary>Bytes consumed before stop (includes the skipped header).</summary>
    public int ParsedBytes { get; init; }

    /// <summary>Total bytes in the input (= hex.Length / 2).</summary>
    public int TotalBytes { get; init; }

    /// <summary>Hex of the trailing bytes that couldn't be interpreted. <c>null</c> on success.</summary>
    public string? UnparsedHex { get; init; }

    /// <summary>Zero-based byte offset where parsing stopped. <c>null</c> on success.</summary>
    public int? ErrorAtByte { get; init; }

    /// <summary>Non-fatal observations — e.g. unknown tag identifiers.</summary>
    public List<string> Warnings { get; init; } = new();

    /// <summary>The proprietary-header bytes that were skipped before parsing began. <c>null</c> when no skip.</summary>
    public string? HeaderHex { get; init; }
}
