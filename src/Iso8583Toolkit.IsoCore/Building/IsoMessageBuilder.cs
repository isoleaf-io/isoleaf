using System.Text;
using Iso8583Toolkit.IsoCore.Domain;
using Iso8583Toolkit.IsoCore.Domain.Exceptions;
using Iso8583Toolkit.IsoCore.Layouts;
using Iso8583Toolkit.IsoCore.Parsing;

namespace Iso8583Toolkit.IsoCore.Building;

/// <summary>
/// Fluent builder that assembles an <see cref="IsoMessage"/> from individual field values,
/// automatically computing bitmaps and generating the wire-format string.
/// </summary>
public sealed class IsoMessageBuilder
{
    private string _mti = string.Empty;
    private IsoLayout _layout = IsoLayout.Default();
    private readonly SortedDictionary<int, string> _fieldValues = new();

    public IsoMessageBuilder WithMti(string mti)
    {
        _mti = mti;
        return this;
    }

    public IsoMessageBuilder WithField(int bitNumber, string value)
    {
        if (bitNumber < 2 || bitNumber > 128)
            throw new ArgumentOutOfRangeException(nameof(bitNumber),
                "Bit number must be between 2 and 128 (bit 1 is reserved for the secondary bitmap indicator).");

        _fieldValues[bitNumber] = value;
        return this;
    }

    public IsoMessageBuilder WithLayout(IsoLayout layout)
    {
        _layout = layout ?? throw new ArgumentNullException(nameof(layout));
        return this;
    }

    // ── Build ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Builds the <see cref="IsoMessage"/> object. Bitmaps are computed automatically.
    /// </summary>
    /// <exception cref="IsoParseException">Thrown when the MTI is invalid or a field violates its definition.</exception>
    public IsoMessage Build()
    {
        // Validate MTI
        if (!MtiParser.IsValid(_mti))
            throw new IsoParseException("MTI", 0, _mti,
                $"Invalid MTI '{_mti}': expected exactly 4 decimal digits.");

        var hasSecondary = _fieldValues.Keys.Any(b => b > 64);

        // Build bitmaps
        var primary   = new bool[64];
        var secondary = new bool[64];

        if (hasSecondary)
            primary[0] = true; // bit 1 = secondary bitmap indicator

        foreach (var bit in _fieldValues.Keys)
        {
            if (bit <= 64)
                primary[bit - 1] = true;
            else
                secondary[bit - 65] = true;
        }

        // Build fields dictionary
        var fields = new Dictionary<int, IsoField>();
        foreach (var (bit, rawValue) in _fieldValues)
        {
            var def = _layout.GetField(bit);
            string value;

            if (def is not null && def.Type == IsoFieldType.Fixed)
            {
                var maxChars = def.Encoding == IsoFieldEncoding.Binary
                    ? def.MaxLength * 2
                    : def.MaxLength;

                value = rawValue.Length < maxChars
                    ? rawValue.PadLeft(maxChars, '0')
                    : rawValue;
            }
            else
            {
                value = rawValue;
            }

            // Validate against definition if available
            if (def is not null)
            {
                var maxChars = def.Encoding == IsoFieldEncoding.Binary
                    ? def.MaxLength * 2
                    : def.MaxLength;

                if (value.Length > maxChars)
                    throw new IsoParseException($"Bit {bit}", 0, value,
                        $"Bit {bit} value length {value.Length} exceeds MaxLength {def.MaxLength}.");
            }

            fields[bit] = new IsoField
            {
                BitNumber  = bit,
                RawValue   = value,
                // Binary fields are typically stored as hex strings, but real
                // wires sometimes carry raw TLV bytes inlined as ASCII (chars
                // like 'l' = 0x6C, or odd-length slices). Convert.FromHexString
                // would crash on those — fall back to ASCII bytes so the Echo
                // path can round-trip the value unchanged.
                RawBytes   = BinaryValueToBytes(value, def?.Encoding),
                Definition = def ?? FallbackDefinition(bit, value)
            };
        }

        return new IsoMessage
        {
            Mti             = _mti,
            PrimaryBitmap   = primary,
            SecondaryBitmap = secondary,
            Fields          = fields,
            RawHex          = string.Empty,
            ParsedAt        = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Builds the message and serialises it to the ASCII/hex-bitmap wire format.
    /// </summary>
    public string BuildHex()
    {
        var msg = Build();
        return Serialise(msg);
    }

    /// <summary>
    /// Alias for <see cref="BuildHex"/> — same wire format.
    /// </summary>
    public string BuildAscii() => BuildHex();

    /// <summary>
    /// Builds the message and serialises it to the binary-hex wire format
    /// (every byte represented as two hex characters).
    /// ASCII fields are converted to their hex byte representation;
    /// Binary fields (like bit 55) are kept as-is since they are already hex.
    /// </summary>
    public string BuildBinaryHex()
    {
        var msg = Build();
        return SerialiseBinaryHex(msg);
    }

    // ── Serialisation ────────────────────────────────────────────────────────

    private string Serialise(IsoMessage msg)
    {
        var sb = new StringBuilder(256);

        // MTI
        sb.Append(msg.Mti);

        // Primary bitmap
        sb.Append(BitmapEngine.ToHex(msg.PrimaryBitmap));

        // Secondary bitmap (if present)
        if (msg.HasSecondaryBitmap)
            sb.Append(BitmapEngine.ToHex(msg.SecondaryBitmap));

        // Fields in bit-number order
        foreach (var bit in msg.Fields.Keys.Order())
        {
            var field = msg.Fields[bit];
            var def   = _layout.GetField(bit);

            if (def is not null)
            {
                switch (def.Type)
                {
                    case IsoFieldType.LLVAR:
                        sb.Append(field.RawValue.Length.ToString("D2"));
                        break;
                    case IsoFieldType.LLLVAR:
                        sb.Append(field.RawValue.Length.ToString("D3"));
                        break;
                    case IsoFieldType.LLLLVAR:
                        sb.Append(field.RawValue.Length.ToString("D4"));
                        break;
                }
            }

            sb.Append(field.RawValue);
        }

        return sb.ToString();
    }

    private string SerialiseBinaryHex(IsoMessage msg)
    {
        var sb = new StringBuilder(512);

        // MTI — ASCII text → hex bytes (e.g. "0100" → "30313030")
        sb.Append(AsciiToHex(msg.Mti));

        // Primary bitmap — hex string → ASCII bytes → hex
        // Parser reads 16 ASCII bytes and interprets as hex chars
        sb.Append(AsciiToHex(BitmapEngine.ToHex(msg.PrimaryBitmap)));

        // Secondary bitmap
        if (msg.HasSecondaryBitmap)
            sb.Append(AsciiToHex(BitmapEngine.ToHex(msg.SecondaryBitmap)));

        // Fields in bit-number order
        foreach (var bit in msg.Fields.Keys.Order())
        {
            var field = msg.Fields[bit];
            var def   = _layout.GetField(bit);

            // Variable-length prefix — always ASCII digits → hex bytes
            if (def is not null)
            {
                switch (def.Type)
                {
                    case IsoFieldType.LLVAR:
                        sb.Append(AsciiToHex(field.RawValue.Length.ToString("D2")));
                        break;
                    case IsoFieldType.LLLVAR:
                        sb.Append(AsciiToHex(field.RawValue.Length.ToString("D3")));
                        break;
                    case IsoFieldType.LLLLVAR:
                        sb.Append(AsciiToHex(field.RawValue.Length.ToString("D4")));
                        break;
                }
            }

            // All fields go through AsciiToHex so every character of the ASCII
            // wire (including the hex chars of Binary fields like bit 55) is
            // emitted as its ASCII byte representation. This keeps the wire
            // consistent with ParseFromHex, which expects the full stream to be
            // an ASCII-encoded message.
            sb.Append(AsciiToHex(field.RawValue));
        }

        return sb.ToString();
    }

    /// <summary>
    /// Converts an ASCII string to its hex byte representation.
    /// E.g. "0100" → "30313030", "123" → "313233".
    /// </summary>
    private static string AsciiToHex(string ascii) =>
        Convert.ToHexString(Encoding.ASCII.GetBytes(ascii));

    private static IsoFieldDefinition FallbackDefinition(int bit, string value) =>
        new()
        {
            BitNumber = bit,
            Name      = $"Bit {bit}",
            Type      = IsoFieldType.Fixed,
            MaxLength = value.Length,
            Encoding  = IsoFieldEncoding.ASCII
        };

    /// <summary>
    /// Hex-decodes a Binary-field value when the string is a clean hex
    /// sequence; falls back to ASCII bytes when it has odd length or
    /// non-hex chars (typical for raw TLV inlined in the wire). Mirrors
    /// <c>IsoParser.ToBytesSafe</c> so a parsed message can round-trip
    /// back through the builder without crashing on edge-case payloads.
    /// </summary>
    private static byte[] BinaryValueToBytes(string value, IsoFieldEncoding? encoding)
    {
        if (encoding != IsoFieldEncoding.Binary)
            return Encoding.ASCII.GetBytes(value);

        if ((value.Length & 1) != 0) return Encoding.ASCII.GetBytes(value);
        if (!value.All(char.IsAsciiHexDigit)) return Encoding.ASCII.GetBytes(value);
        return Convert.FromHexString(value);
    }
}
