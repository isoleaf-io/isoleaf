namespace Iso8583Toolkit.Cryptography.Tlv;

public static class TlvParser
{
    /// <summary>
    /// Parses a hex string containing BER-TLV encoded data into a list of TLV tags.
    /// Throws <see cref="FormatException"/> on structural errors (truncated, bad length, etc.).
    /// Use <see cref="ParsePartial(string, int)"/> when you need diagnostics instead of exceptions.
    /// </summary>
    public static List<TlvTag> Parse(string hexData)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(hexData);
        var data = Convert.FromHexString(hexData.Trim());
        return Parse(data);
    }

    /// <summary>
    /// Tolerant BER-TLV parser. Returns whatever could be decoded plus diagnostics
    /// (UnparsedHex / ErrorAtByte / ParseError / Warnings) when the stream is truncated,
    /// has unknown tags or carries a proprietary header that needs skipping.
    /// </summary>
    /// <param name="hex">BER-TLV payload as a hex string.</param>
    /// <param name="headerBytes">Bytes to skip from the beginning (proprietary header). 0 = parse from offset 0.</param>
    /// <exception cref="ArgumentException">Thrown for null/empty input, non-hex chars or odd length.</exception>
    public static TlvParseResult ParsePartial(string hex, int headerBytes = 0)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(hex);
        if (headerBytes < 0)
            throw new ArgumentOutOfRangeException(nameof(headerBytes), "Header byte count must be ≥ 0.");

        var trimmed = hex.Trim();
        // Validate hex chars + length BEFORE FromHexString so the message is friendly.
        for (var i = 0; i < trimmed.Length; i++)
        {
            var c = trimmed[i];
            if (!char.IsAsciiHexDigit(c))
                throw new ArgumentException($"Input contains non-hex character at position {i}: '{c}'.", nameof(hex));
        }
        if ((trimmed.Length & 1) != 0)
            throw new ArgumentException("Input has odd length — each byte requires 2 hex chars.", nameof(hex));

        var data = Convert.FromHexString(trimmed);
        var totalBytes = data.Length;

        if (headerBytes > totalBytes)
        {
            return new TlvParseResult
            {
                IsComplete = false,
                ParseError = $"Header skip of {headerBytes} bytes exceeds payload length of {totalBytes}.",
                ParsedBytes = 0,
                TotalBytes = totalBytes,
                UnparsedHex = trimmed,
                ErrorAtByte = 0,
            };
        }

        var headerHex = headerBytes > 0 ? trimmed[..(headerBytes * 2)] : null;
        var startPos = headerBytes;

        var tags = new List<TlvTag>();
        var warnings = new List<string>();
        var pos = startPos;
        string? parseError = null;
        int? errorAt = null;

        while (pos < data.Length)
        {
            // Skip padding bytes (00 or FF) at the top level — same as the strict parser.
            if (data[pos] == 0x00 || data[pos] == 0xFF)
            {
                pos++;
                continue;
            }

            var tagStart = pos;

            // ── Tag ──────────────────────────────────────────────────────────
            if (!TryReadTag(data, ref pos, out var tag))
            {
                parseError = $"Unexpected end of data while reading tag at byte {tagStart}.";
                errorAt = tagStart;
                pos = tagStart; // rewind so UnparsedHex begins at the failed tag
                break;
            }

            // ── Length ───────────────────────────────────────────────────────
            var lengthStart = pos;
            if (!TryReadLength(data, ref pos, out var length, out var lengthErr))
            {
                parseError = $"Tag 0x{tag} at byte {tagStart}: {lengthErr}";
                errorAt = lengthStart;
                pos = tagStart;
                break;
            }

            // ── Value ────────────────────────────────────────────────────────
            if (pos + length > data.Length)
            {
                parseError =
                    $"Tag 0x{tag} at byte {tagStart}: declared length {length} bytes " +
                    $"but only {data.Length - pos} bytes available.";
                errorAt = tagStart;
                pos = tagStart;
                break;
            }

            var valueBytes = data[pos..(pos + length)];
            var valueHex = Convert.ToHexString(valueBytes);
            pos += length;

            var isConstructed = IsConstructedTag(tag);
            var info = EmvTagRegistry.GetInfo(tag);

            if (info is null)
                warnings.Add($"Unknown tag 0x{tag} at byte {tagStart}");

            tags.Add(new TlvTag(
                Tag: tag,
                Name: info?.Name ?? $"Unknown ({tag})",
                Length: length,
                Value: valueHex,
                Description: info?.Description ?? "",
                IsPrimitive: !isConstructed,
                IsConstructed: isConstructed)
            {
                Children = isConstructed ? TryParseChildren(valueBytes) : null
            });
        }

        var isComplete = parseError is null;
        var unparsedHex = isComplete || pos >= data.Length
            ? null
            : Convert.ToHexString(data[pos..]);

        return new TlvParseResult
        {
            Tags = tags,
            IsComplete = isComplete,
            ParseError = parseError,
            ParsedBytes = pos,
            TotalBytes = totalBytes,
            UnparsedHex = unparsedHex,
            ErrorAtByte = errorAt,
            Warnings = warnings,
            HeaderHex = headerHex,
        };
    }

    /// <summary>
    /// Parses a byte array containing BER-TLV encoded data into a list of TLV tags.
    /// </summary>
    public static List<TlvTag> Parse(byte[] data)
    {
        var tags = new List<TlvTag>();
        var pos = 0;

        while (pos < data.Length)
        {
            // Skip padding bytes (00 or FF)
            if (data[pos] == 0x00 || data[pos] == 0xFF)
            {
                pos++;
                continue;
            }

            var tag = ReadTag(data, ref pos);
            var length = ReadLength(data, ref pos);

            if (pos + length > data.Length)
                throw new FormatException(
                    $"TLV tag {tag} declares length {length} but only {data.Length - pos} bytes remain at position {pos}.");

            var valueBytes = data[pos..(pos + length)];
            var valueHex = Convert.ToHexString(valueBytes);
            pos += length;

            var isConstructed = IsConstructedTag(tag);
            var info = EmvTagRegistry.GetInfo(tag);

            var tlvTag = new TlvTag(
                Tag: tag,
                Name: info?.Name ?? $"Unknown ({tag})",
                Length: length,
                Value: valueHex,
                Description: info?.Description ?? "",
                IsPrimitive: !isConstructed,
                IsConstructed: isConstructed)
            {
                Children = isConstructed ? TryParseChildren(valueBytes) : null
            };

            tags.Add(tlvTag);
        }

        return tags;
    }

    /// <summary>
    /// Serializes a list of TLV tags back to a hex string.
    /// </summary>
    public static string ToHex(List<TlvTag> tags)
    {
        using var ms = new MemoryStream();

        foreach (var tag in tags)
        {
            var tagBytes = Convert.FromHexString(tag.Tag);
            ms.Write(tagBytes);

            WriteLength(ms, tag.Length);

            var valueBytes = Convert.FromHexString(tag.Value);
            ms.Write(valueBytes);
        }

        return Convert.ToHexString(ms.ToArray());
    }

    /// <summary>Non-throwing version of <see cref="ReadTag"/> for the partial parser.</summary>
    private static bool TryReadTag(byte[] data, ref int pos, out string tag)
    {
        tag = string.Empty;
        if (pos >= data.Length) return false;

        var firstByte = data[pos++];
        if ((firstByte & 0x1F) != 0x1F)
        {
            tag = firstByte.ToString("X2");
            return true;
        }

        var tagBytes = new List<byte> { firstByte };
        while (pos < data.Length)
        {
            var nextByte = data[pos++];
            tagBytes.Add(nextByte);
            if ((nextByte & 0x80) == 0)
            {
                tag = Convert.ToHexString(tagBytes.ToArray());
                return true;
            }
        }
        // Ran out of bytes while expecting a continuation byte.
        return false;
    }

    /// <summary>Non-throwing version of <see cref="ReadLength"/>.</summary>
    private static bool TryReadLength(byte[] data, ref int pos, out int length, out string error)
    {
        length = 0;
        error = string.Empty;
        if (pos >= data.Length)
        {
            error = "unexpected end of data while reading length.";
            return false;
        }

        var firstByte = data[pos++];
        if (firstByte < 0x80)
        {
            length = firstByte;
            return true;
        }

        var numBytes = firstByte & 0x7F;
        if (numBytes == 0 || numBytes > 4)
        {
            error = $"invalid BER-TLV length encoding ({numBytes} length bytes).";
            return false;
        }
        if (pos + numBytes > data.Length)
        {
            error = "unexpected end of data while reading multi-byte length.";
            return false;
        }

        for (var i = 0; i < numBytes; i++)
            length = (length << 8) | data[pos++];
        return true;
    }

    /// <summary>
    /// Reads a BER-TLV tag (1, 2, or 3 bytes).
    /// </summary>
    private static string ReadTag(byte[] data, ref int pos)
    {
        if (pos >= data.Length)
            throw new FormatException("Unexpected end of data while reading tag.");

        var firstByte = data[pos++];

        // Single-byte tag: low 5 bits != 0x1F
        if ((firstByte & 0x1F) != 0x1F)
            return firstByte.ToString("X2");

        // Multi-byte tag
        var tagBytes = new List<byte> { firstByte };

        while (pos < data.Length)
        {
            var nextByte = data[pos++];
            tagBytes.Add(nextByte);

            // Continue if bit 8 is set
            if ((nextByte & 0x80) == 0)
                break;
        }

        return Convert.ToHexString(tagBytes.ToArray());
    }

    /// <summary>
    /// Reads a BER-TLV length (1 to 4 bytes).
    /// </summary>
    private static int ReadLength(byte[] data, ref int pos)
    {
        if (pos >= data.Length)
            throw new FormatException("Unexpected end of data while reading length.");

        var firstByte = data[pos++];

        // Short form: length < 0x80
        if (firstByte < 0x80)
            return firstByte;

        // Long form: first byte indicates number of subsequent length bytes
        var numBytes = firstByte & 0x7F;
        if (numBytes == 0 || numBytes > 4)
            throw new FormatException($"Invalid BER-TLV length encoding: {numBytes} length bytes.");

        if (pos + numBytes > data.Length)
            throw new FormatException("Unexpected end of data while reading multi-byte length.");

        var length = 0;
        for (var i = 0; i < numBytes; i++)
        {
            length = (length << 8) | data[pos++];
        }

        return length;
    }

    /// <summary>
    /// Writes a BER-TLV length to the stream.
    /// </summary>
    private static void WriteLength(MemoryStream ms, int length)
    {
        if (length < 0x80)
        {
            ms.WriteByte((byte)length);
        }
        else if (length <= 0xFF)
        {
            ms.WriteByte(0x81);
            ms.WriteByte((byte)length);
        }
        else if (length <= 0xFFFF)
        {
            ms.WriteByte(0x82);
            ms.WriteByte((byte)(length >> 8));
            ms.WriteByte((byte)(length & 0xFF));
        }
        else
        {
            ms.WriteByte(0x83);
            ms.WriteByte((byte)(length >> 16));
            ms.WriteByte((byte)((length >> 8) & 0xFF));
            ms.WriteByte((byte)(length & 0xFF));
        }
    }

    /// <summary>
    /// Checks if a tag is constructed (bit 6 of first byte is 1).
    /// </summary>
    private static bool IsConstructedTag(string tagHex)
    {
        var firstByte = Convert.FromHexString(tagHex[..2])[0];
        return (firstByte & 0x20) != 0;
    }

    /// <summary>
    /// Attempts to parse children from a constructed tag's value.
    /// Returns null if parsing fails (some constructed tags may contain non-TLV data).
    /// </summary>
    private static List<TlvTag>? TryParseChildren(byte[] data)
    {
        try
        {
            var children = Parse(data);
            return children.Count > 0 ? children : null;
        }
        catch
        {
            return null;
        }
    }
}
