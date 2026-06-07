using System.Text;
using Iso8583Toolkit.IsoCore.Domain;
using Iso8583Toolkit.IsoCore.Domain.Exceptions;
using Iso8583Toolkit.IsoCore.Layouts;

namespace Iso8583Toolkit.IsoCore.Parsing;

/// <summary>
/// Parses raw ISO 8583 message strings into <see cref="IsoMessage"/> instances.
///
/// Two wire formats are supported:
///
/// <b>ASCII wire</b> (<see cref="ParseFromAscii"/>/<see cref="ParseFromHex"/>):
///   [MTI 4 chars][Primary bitmap 16 hex chars][Secondary bitmap 16 hex chars?][Field data...]
///   All field data is plain text; Binary fields are already represented as hex character pairs.
///
/// <b>Binary-hex wire</b> (<see cref="ParseFromBinaryHex"/>):
///   The entire message is a hex-encoded byte stream (2 hex chars per byte).
///   ASCII fields occupy 1 byte per character; Binary fields occupy raw bytes.
///   Length prefixes (LLVAR/LLLVAR/LLLLVAR) are ASCII digits giving the display-char count
///   (= byte count for ASCII, = hex-char count for Binary, i.e. 2× byte count).
/// </summary>
public sealed class IsoParser
{
    private readonly IsoLayout _defaultLayout;

    public IsoParser(IsoLayout? defaultLayout = null)
    {
        _defaultLayout = defaultLayout ?? IsoLayout.Default();
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /// <summary>
    /// Parses a message in ASCII/hex-bitmap format.
    /// The MTI is the first 4 characters (plain decimal digits).
    /// The bitmap follows as 16 hex characters (8 bytes).
    /// Field values are ASCII; Binary fields are represented as hex strings.
    /// </summary>
    /// <param name="hexMessage">The raw message string.</param>
    /// <param name="layout">Optional layout override; falls back to the default layout.</param>
    public IsoMessage ParseFromHex(string hexMessage, IsoLayout? layout = null)
    {
        if (string.IsNullOrEmpty(hexMessage))
            throw new ArgumentException("Message cannot be null or empty.", nameof(hexMessage));

        var layout_ = layout ?? _defaultLayout;
        var raw     = hexMessage.Trim();
        var pos     = 0;

        // ── Optional TPDU before the MTI ─────────────────────────────────────
        // Two encodings coexist in real-world ASCII-wire captures:
        //
        //   (A) Raw 5-byte TPDU: chars[0..5) are literal bytes (e.g. 0x60 0x00 …).
        //       Heuristic: chars[0] in 0x60..0x6F (or non-printable) AND chars[5..9)
        //       form a valid MTI. Skip 5 chars.
        //
        //   (B) Hex-encoded TPDU: the 5 bytes are written as 10 hex chars before
        //       the ASCII MTI (this is what `BuildHex` + UI surface). Heuristic:
        //       chars[0..10) are all hex digits, chars[0..2) parses to 0x60..0x6F,
        //       and chars[10..14) form a valid MTI. Skip 10 chars.
        TpduInfo? tpdu = null;
        if (raw.Length >= 14
            && IsHex(raw, 0, 10)
            && IsHexInRange(raw, 0, 2, 0x60, 0x6F)
            && MtiParser.IsValid(raw.Substring(10, 4)))
        {
            // (B) Hex-encoded TPDU.
            var tpduBytes = Convert.FromHexString(raw.Substring(0, 10));
            tpdu = BuildTpduInfo(tpduBytes);
            pos = 10;
        }
        else if (raw.Length >= 9 && LooksLikeTpduFirstByte(raw[0]) && MtiParser.IsValid(raw.Substring(5, 4)))
        {
            // (A) Raw 5-byte TPDU.
            var tpduBytes = Encoding.Latin1.GetBytes(raw.Substring(0, 5));
            tpdu = BuildTpduInfo(tpduBytes);
            pos = 5;
        }

        // Length prefix detection is intentionally NOT applied to ASCII wire.
        // In ASCII wire "00FE" is 4 literal ASCII characters, not bytes
        // 0x00 0xFE, so what looks like a length prefix is indistinguishable
        // from real field data (e.g. an MTI starting with "00"). Length
        // prefixes only show up in true binary wire — see DetectLengthPrefixBytes.
        LengthPrefixInfo? lengthPrefix = null;

        // ── MTI ─────────────────────────────────────────────────────────────
        const int mtiLen = 4;
        if (raw.Length < pos + mtiLen)
            throw new IsoParseException("MTI", pos, raw, "Message too short to contain a 4-character MTI.");

        var mti = raw.Substring(pos, mtiLen);
        if (!MtiParser.IsValid(mti))
            throw new IsoParseException("MTI", pos, mti,
                $"Invalid MTI '{mti}': expected exactly 4 decimal digits.");
        pos += mtiLen;

        // ── Primary bitmap ───────────────────────────────────────────────────
        const int bitmapHexLen = 16;
        if (raw.Length < pos + bitmapHexLen)
            throw new IsoParseException("Primary Bitmap", pos, raw[pos..],
                "Message too short to read the 16-character primary bitmap.");

        bool[] primaryBitmap;
        try
        {
            primaryBitmap = BitmapEngine.ParseFromHex(raw.Substring(pos, bitmapHexLen));
        }
        catch (Exception ex)
        {
            throw new IsoParseException("Primary Bitmap", pos,
                raw.Substring(pos, bitmapHexLen), "Failed to parse primary bitmap.", ex);
        }
        pos += bitmapHexLen;

        // ── Secondary bitmap (present when bit 1 of primary is set) ─────────
        var secondaryBitmap = new bool[64];
        if (BitmapEngine.IsSecondaryPresent(primaryBitmap))
        {
            if (raw.Length < pos + bitmapHexLen)
                throw new IsoParseException("Secondary Bitmap", pos, raw[pos..],
                    "Bit 1 is set but message is too short to read the secondary bitmap.");

            try
            {
                secondaryBitmap = BitmapEngine.ParseFromHex(raw.Substring(pos, bitmapHexLen));
            }
            catch (Exception ex)
            {
                throw new IsoParseException("Secondary Bitmap", pos,
                    raw.Substring(pos, bitmapHexLen), "Failed to parse secondary bitmap.", ex);
            }
            pos += bitmapHexLen;
        }

        // ── Field data ───────────────────────────────────────────────────────
        var fields = new Dictionary<int, IsoField>();

        IsoMessage BuildPartial() => new()
        {
            Mti             = mti,
            PrimaryBitmap   = primaryBitmap,
            SecondaryBitmap = secondaryBitmap,
            Fields          = fields,
            RawHex          = hexMessage,
            Tpdu            = tpdu?.Hex,
            TpduInfo        = tpdu,
            LengthPrefix    = lengthPrefix,
            ParsedAt        = DateTime.UtcNow
        };

        try
        {
            // Primary bitmap: bits 2–64 (bit 1 = secondary bitmap indicator, skip as data field)
            for (var i = 1; i < 64; i++)
            {
                if (!primaryBitmap[i]) continue;
                pos = ParseField(raw, pos, bitNumber: i + 1, layout_, fields);
            }

            // Secondary bitmap: bits 65–128
            if (BitmapEngine.IsSecondaryPresent(primaryBitmap))
            {
                for (var i = 0; i < 64; i++)
                {
                    if (!secondaryBitmap[i]) continue;
                    pos = ParseField(raw, pos, bitNumber: i + 65, layout_, fields);
                }
            }
        }
        catch (IsoParseException ex) when (ex.PartialMessage is null)
        {
            ex.PartialMessage = BuildPartial();
            throw;
        }

        return BuildPartial();
    }

    private static bool LooksLikeTpduFirstByte(char c)
    {
        // Standard TPDU IDs: 0x60 (NAC), 0x61 (continuation), plus the 0x60-0x6F
        // range reserved for variants. Also accept any non-printable byte (< 0x20
        // or >= 0x7F) since those never appear as the first char of a valid MTI.
        var b = (byte)c;
        return (b >= 0x60 && b <= 0x6F) || b < 0x20 || b >= 0x7F;
    }

    /// <summary>True when chars[start..start+len) are all hex digits.</summary>
    private static bool IsHex(string s, int start, int len)
    {
        if (start + len > s.Length) return false;
        for (var i = start; i < start + len; i++)
        {
            var c = s[i];
            var isHex = (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F') || (c >= 'a' && c <= 'f');
            if (!isHex) return false;
        }
        return true;
    }

    /// <summary>Parses a slice of hex chars as a single byte and checks the inclusive range.</summary>
    private static bool IsHexInRange(string s, int start, int len, byte min, byte max)
    {
        if (!IsHex(s, start, len)) return false;
        if (!byte.TryParse(s.AsSpan(start, len), System.Globalization.NumberStyles.HexNumber, null, out var value))
            return false;
        return value >= min && value <= max;
    }

    private static TpduInfo BuildTpduInfo(byte[] bytes)
    {
        var hex = Convert.ToHexString(bytes);
        var dest = $"{bytes[1] >> 4}{bytes[1] & 0x0F}{bytes[2] >> 4}{bytes[2] & 0x0F}";
        var src  = $"{bytes[3] >> 4}{bytes[3] & 0x0F}{bytes[4] >> 4}{bytes[4] & 0x0F}";
        return new TpduInfo(hex, bytes[0], dest, src);
    }

    /// <summary>
    /// Alias for <see cref="ParseFromHex"/> — both use the same ASCII/bitmap-in-hex wire format.
    /// Provided for callers that prefer the "ASCII" name when the message was captured as ASCII text.
    /// </summary>
    public IsoMessage ParseFromAscii(string asciiMessage, IsoLayout? layout = null) =>
        ParseFromHex(asciiMessage, layout);

    /// <summary>
    /// Parses a message in binary-hex format — the entire message is a hex-encoded byte stream.
    /// ASCII-encoded fields are stored as their ASCII bytes; Binary-encoded fields are stored
    /// as raw bytes (not double-hex-encoded).
    /// <para>
    /// For example, MTI "0100" occupies 4 bytes → 8 hex chars "30313030".
    /// A Binary field like PIN Block (8 bytes) occupies 8 bytes → 16 hex chars "4F2A6B1C9D3E8A71".
    /// </para>
    /// </summary>
    /// <param name="hexMessage">The complete message as a hex string (2 hex chars per byte).</param>
    /// <param name="layout">Optional layout override; falls back to the default layout.</param>
    public IsoMessage ParseFromBinaryHex(string hexMessage, IsoLayout? layout = null)
    {
        if (string.IsNullOrEmpty(hexMessage))
            throw new ArgumentException("Message cannot be null or empty.", nameof(hexMessage));

        var layout_ = layout ?? _defaultLayout;
        byte[] data;
        try
        {
            data = Convert.FromHexString(hexMessage.Trim());
        }
        catch (FormatException ex)
        {
            throw new ArgumentException("Message is not a valid hex string.", nameof(hexMessage), ex);
        }

        var pos = 0;

        // ── Optional 2-byte big-endian length prefix (TCP framing) ──────────
        // OUTERMOST framing layer — probed first so a prefix starting with
        // 0x00 doesn't get mistaken for a TPDU first byte. The length prefix
        // is purely INFORMATIVE: when detected we always strip the 2 bytes
        // and continue parsing the ENTIRE remaining payload, regardless of
        // whether the declared length matches. The Match flag is just for
        // the UI to surface the discrepancy.
        var lengthPrefix = DetectLengthPrefixBytes(data, pos);
        if (lengthPrefix is not null)
        {
            pos += 2;
        }

        // ── Optional TPDU before MTI ─────────────────────────────────────────
        // Two encodings coexist in real wires:
        //   (A) Raw 5-byte TPDU — first byte 0x60..0x6F (or non-printable),
        //       followed directly by the 4-byte ASCII MTI.
        //   (B) Builder-style 10-char ASCII-hex TPDU — the 5 TPDU bytes are
        //       each written out as two ASCII hex chars (so it looks like
        //       "6000020001" on the wire), followed by the 4-byte ASCII MTI.
        // We try (A) first because it's cheaper to confirm; if it doesn't
        // match, we fall through to (B).
        TpduInfo? tpdu = null;
        if (data.Length >= pos + 9 && LooksLikeTpduFirstByte((char)data[pos]) &&
            MtiParser.IsValid(Encoding.ASCII.GetString(data, pos + 5, 4)))
        {
            tpdu = BuildTpduInfo(data[pos..(pos + 5)]);
            pos += 5;
        }
        else if (data.Length >= pos + 14 &&
                 AllBytesAreHexChars(data, pos, 10) &&
                 MtiParser.IsValid(Encoding.ASCII.GetString(data, pos + 10, 4)))
        {
            // Decode the 10 ASCII hex chars to 5 binary TPDU bytes — and only
            // accept the detection if the first byte is in the usual TPDU ID
            // range (0x60-0x6F). This second guard is what stops a real MTI
            // like "0200" from being misread as a TPDU when followed by what
            // happens to look like another MTI further on.
            var tpduBytes = Convert.FromHexString(Encoding.ASCII.GetString(data, pos, 10));
            if (tpduBytes[0] >= 0x60 && tpduBytes[0] <= 0x6F)
            {
                tpdu = BuildTpduInfo(tpduBytes);
                pos += 10;
            }
        }

        // ── MTI (4 ASCII bytes) ─────────────────────────────────────────────
        EnsureBytesAvailable(data, pos, 4, "MTI");
        var mti = Encoding.ASCII.GetString(data, pos, 4);
        if (!MtiParser.IsValid(mti))
            throw new IsoParseException("MTI", pos, mti,
                $"Invalid MTI '{mti}': expected exactly 4 decimal digits.");
        pos += 4;

        // ── Primary bitmap (16 ASCII hex chars = 16 bytes) ──────────────────
        EnsureBytesAvailable(data, pos, 16, "Primary Bitmap");
        bool[] primaryBitmap;
        try
        {
            var bitmapHex = Encoding.ASCII.GetString(data, pos, 16);
            primaryBitmap = BitmapEngine.ParseFromHex(bitmapHex);
        }
        catch (IsoParseException) { throw; }
        catch (Exception ex)
        {
            throw new IsoParseException("Primary Bitmap", pos,
                Encoding.ASCII.GetString(data, pos, 16), "Failed to parse primary bitmap.", ex);
        }
        pos += 16;

        // ── Secondary bitmap ────────────────────────────────────────────────
        var secondaryBitmap = new bool[64];
        if (BitmapEngine.IsSecondaryPresent(primaryBitmap))
        {
            EnsureBytesAvailable(data, pos, 16, "Secondary Bitmap");
            try
            {
                var secBitmapHex = Encoding.ASCII.GetString(data, pos, 16);
                secondaryBitmap = BitmapEngine.ParseFromHex(secBitmapHex);
            }
            catch (IsoParseException) { throw; }
            catch (Exception ex)
            {
                throw new IsoParseException("Secondary Bitmap", pos,
                    Encoding.ASCII.GetString(data, pos, 16), "Failed to parse secondary bitmap.", ex);
            }
            pos += 16;
        }

        // ── Field data ──────────────────────────────────────────────────────
        // `fields` is captured by reference into BuildPartial below — if any
        // ParseFieldFromBytes call throws, we attach the so-far-parsed fields
        // to the exception so the API can surface them as a partial result.
        var fields = new Dictionary<int, IsoField>();

        IsoMessage BuildPartial() => new()
        {
            Mti             = mti,
            PrimaryBitmap   = primaryBitmap,
            SecondaryBitmap = secondaryBitmap,
            Fields          = fields,
            RawHex          = hexMessage,
            Tpdu            = tpdu?.Hex,
            TpduInfo        = tpdu,
            LengthPrefix    = lengthPrefix,
            ParsedAt        = DateTime.UtcNow
        };

        try
        {
            for (var i = 1; i < 64; i++)
            {
                if (!primaryBitmap[i]) continue;
                pos = ParseFieldFromBytes(data, pos, i + 1, layout_, fields);
            }

            if (BitmapEngine.IsSecondaryPresent(primaryBitmap))
            {
                for (var i = 0; i < 64; i++)
                {
                    if (!secondaryBitmap[i]) continue;
                    pos = ParseFieldFromBytes(data, pos, i + 65, layout_, fields);
                }
            }
        }
        catch (IsoParseException ex) when (ex.PartialMessage is null)
        {
            ex.PartialMessage = BuildPartial();
            throw;
        }

        return BuildPartial();
    }

    /// <summary>
    /// Binary-hex counterpart of <see cref="DetectLengthPrefix"/>. Looks at
    /// 2 bytes (big-endian uint16) starting at <paramref name="pos"/> in the
    /// decoded byte array.
    /// </summary>
    private static LengthPrefixInfo? DetectLengthPrefixBytes(byte[] data, int pos)
    {
        // Need 2 prefix bytes + at least 4 more (MTI minimum).
        if (data.Length < pos + 6) return null;

        // A real length-prefix byte is non-printable (0x00-0x1F): typical
        // messages are < 256 bytes so the high byte is 0x00, very long ones
        // might reach 0x01-0x0F. This single check excludes both MTI digits
        // (0x30-0x39) AND TPDU IDs (0x60-0x6F) — without it, a wire that
        // starts with a TPDU would be misidentified as carrying a length
        // prefix and silently lose the first 2 TPDU bytes.
        if (data[pos] >= 0x20) return null;

        // The 4 bytes following the candidate prefix must look like an MTI.
        // Two layouts are valid:
        //   [prefix(2)][MTI(4)]...                — MTI candidate at pos+2
        //   [prefix(2)][TPDU(5)][MTI(4)]...       — MTI candidate at pos+7
        // Printable-ASCII is the loosest sane gate: it accepts decimal MTIs
        // ("0200"), custom hex MTIs ("91FF"), AND any future weirdness
        // without requiring this code to evolve in lockstep with MtiParser.
        if (!LooksLikePrintableAscii(data, pos + 2, 4) &&
            !LooksLikePrintableAscii(data, pos + 7, 4))
        {
            return null;
        }

        var declared = (data[pos] << 8) | data[pos + 1];
        var actual   = data.Length - pos - 2;
        var hex      = Convert.ToHexString(data, pos, 2);

        // Always return — including the Match=false case. The length prefix
        // is INFORMATIVE only: the caller strips the 2 bytes and parses the
        // entire remaining payload regardless. The UI uses Match to colour
        // the badge (green when sizes line up, amber when they diverge).
        return new LengthPrefixInfo(hex, declared, actual, declared == actual);
    }

    private static bool LooksLikePrintableAscii(byte[] data, int offset, int count)
    {
        if (offset + count > data.Length) return false;
        for (var i = offset; i < offset + count; i++)
        {
            var b = data[i];
            if (b < 0x20 || b > 0x7E) return false;
        }
        return true;
    }

    // ── Internal — ASCII wire ────────────────────────────────────────────────

    private static int ParseField(
        string raw, int pos, int bitNumber,
        IsoLayout layout, Dictionary<int, IsoField> fields)
    {
        var def = layout.GetField(bitNumber)
            ?? throw new IsoParseException(
                $"Bit {bitNumber}", pos, string.Empty,
                $"Bit {bitNumber} is active in the bitmap but has no definition in layout '{layout.Name}'.");

        var fieldLabel = $"Bit {bitNumber}";
        string value;
        byte[] rawBytes;

        switch (def.Type)
        {
            case IsoFieldType.Fixed:
            {
                var charsNeeded = def.Encoding == IsoFieldEncoding.Binary
                    ? def.MaxLength * 2   // N bytes = 2N hex chars
                    : def.MaxLength;

                EnsureAvailable(raw, pos, charsNeeded, fieldLabel);
                var slice = raw.Substring(pos, charsNeeded);

                value    = def.Encoding == IsoFieldEncoding.Binary ? slice : slice;
                rawBytes = ToBytesSafe(slice, def.Encoding);
                pos += charsNeeded;
                break;
            }

            case IsoFieldType.LLVAR:
            {
                EnsureAvailable(raw, pos, 2, fieldLabel);
                var lenStr = raw.Substring(pos, 2);
                if (!int.TryParse(lenStr, out var len))
                    throw new IsoParseException(fieldLabel, pos, lenStr,
                        $"Non-numeric LLVAR length prefix '{lenStr}' for bit {bitNumber}.");
                var maxChars = def.Encoding == IsoFieldEncoding.Binary ? def.MaxLength * 2 : def.MaxLength;
                if (len > maxChars)
                    throw new IsoParseException(fieldLabel, pos, lenStr,
                        $"LLVAR declared length {len} exceeds MaxLength {def.MaxLength} for bit {bitNumber}.");
                pos += 2;

                var charsNeeded = len;
                EnsureAvailable(raw, pos, charsNeeded, fieldLabel);
                var slice = raw.Substring(pos, charsNeeded);

                value    = slice;
                rawBytes = ToBytesSafe(slice, def.Encoding);
                pos += charsNeeded;
                break;
            }

            case IsoFieldType.LLLVAR:
            {
                EnsureAvailable(raw, pos, 3, fieldLabel);
                var lenStr = raw.Substring(pos, 3);
                if (!int.TryParse(lenStr, out var len))
                    throw new IsoParseException(fieldLabel, pos, lenStr,
                        $"Non-numeric LLLVAR length prefix '{lenStr}' for bit {bitNumber}.");
                var maxChars = def.Encoding == IsoFieldEncoding.Binary ? def.MaxLength * 2 : def.MaxLength;
                if (len > maxChars)
                    throw new IsoParseException(fieldLabel, pos, lenStr,
                        $"LLLVAR declared length {len} exceeds MaxLength {def.MaxLength} for bit {bitNumber}.");
                pos += 3;

                var charsNeeded = len;
                EnsureAvailable(raw, pos, charsNeeded, fieldLabel);
                var slice = raw.Substring(pos, charsNeeded);

                value    = slice;
                rawBytes = ToBytesSafe(slice, def.Encoding);
                pos += charsNeeded;
                break;
            }

            case IsoFieldType.LLLLVAR:
            {
                EnsureAvailable(raw, pos, 4, fieldLabel);
                var lenStr = raw.Substring(pos, 4);
                if (!int.TryParse(lenStr, out var len))
                    throw new IsoParseException(fieldLabel, pos, lenStr,
                        $"Non-numeric LLLLVAR length prefix '{lenStr}' for bit {bitNumber}.");
                var maxChars = def.Encoding == IsoFieldEncoding.Binary ? def.MaxLength * 2 : def.MaxLength;
                if (len > maxChars)
                    throw new IsoParseException(fieldLabel, pos, lenStr,
                        $"LLLLVAR declared length {len} exceeds MaxLength {def.MaxLength} for bit {bitNumber}.");
                pos += 4;

                var charsNeeded = len;
                EnsureAvailable(raw, pos, charsNeeded, fieldLabel);
                var slice = raw.Substring(pos, charsNeeded);

                value    = slice;
                rawBytes = ToBytesSafe(slice, def.Encoding);
                pos += charsNeeded;
                break;
            }

            default:
                throw new IsoParseException(fieldLabel, pos, string.Empty,
                    $"Unknown field type '{def.Type}' for bit {bitNumber}.");
        }

        fields[bitNumber] = new IsoField
        {
            BitNumber  = bitNumber,
            RawValue   = value,
            RawBytes   = rawBytes,
            Definition = def
        };

        return pos;
    }

    private static void EnsureAvailable(string raw, int pos, int needed, string field)
    {
        if (pos + needed > raw.Length)
            throw new IsoParseException(field, pos,
                raw.Length > pos ? raw[pos..] : string.Empty,
                $"Message truncated at position {pos} while reading '{field}': " +
                $"needed {needed} chars but only {raw.Length - pos} available.");
    }

    // ── Internal — Binary-hex wire ───────────────────────────────────────────

    private static int ParseFieldFromBytes(
        byte[] data, int pos, int bitNumber,
        IsoLayout layout, Dictionary<int, IsoField> fields)
    {
        var def = layout.GetField(bitNumber)
            ?? throw new IsoParseException(
                $"Bit {bitNumber}", pos, string.Empty,
                $"Bit {bitNumber} is active in the bitmap but has no definition in layout '{layout.Name}'.");

        var fieldLabel = $"Bit {bitNumber}";
        var isBinary   = def.Encoding == IsoFieldEncoding.Binary;
        string value;
        byte[] rawBytes;

        switch (def.Type)
        {
            case IsoFieldType.Fixed:
            {
                // Binary fields on the wire come in two conventions:
                //   (1) Raw bytes — N bytes (real-world POS/host captures).
                //   (2) ASCII bytes of the hex chars — 2N bytes ("01234567" as 8 ASCII bytes
                //       for a 4-byte field). This is what IsoMessageBuilder.BuildBinaryHex emits.
                // Peek 2N bytes: if all are ASCII hex digits, use convention (2); else (1).
                if (isBinary && pos + def.MaxLength * 2 <= data.Length
                    && AllBytesAreHexChars(data, pos, def.MaxLength * 2))
                {
                    var doubled = def.MaxLength * 2;
                    rawBytes = data[pos..(pos + doubled)];
                    value    = Encoding.ASCII.GetString(data, pos, doubled);
                    pos += doubled;
                }
                else
                {
                    var bytesNeeded = def.MaxLength;
                    EnsureBytesAvailable(data, pos, bytesNeeded, fieldLabel);

                    rawBytes = data[pos..(pos + bytesNeeded)];
                    value    = ExtractFieldValue(data, pos, bytesNeeded, isBinary);
                    pos += bytesNeeded;
                }
                break;
            }

            case IsoFieldType.LLVAR:
            {
                (value, rawBytes, pos) = ParseVarFieldFromBytes(data, pos, 2, def, fieldLabel, bitNumber);
                break;
            }

            case IsoFieldType.LLLVAR:
            {
                (value, rawBytes, pos) = ParseVarFieldFromBytes(data, pos, 3, def, fieldLabel, bitNumber);
                break;
            }

            case IsoFieldType.LLLLVAR:
            {
                (value, rawBytes, pos) = ParseVarFieldFromBytes(data, pos, 4, def, fieldLabel, bitNumber);
                break;
            }

            default:
                throw new IsoParseException(fieldLabel, pos, string.Empty,
                    $"Unknown field type '{def.Type}' for bit {bitNumber}.");
        }

        fields[bitNumber] = new IsoField
        {
            BitNumber  = bitNumber,
            RawValue   = value,
            RawBytes   = rawBytes,
            Definition = def
        };

        return pos;
    }

    /// <summary>
    /// Reads a variable-length field from a byte stream.
    /// The length prefix is always ASCII digits (prefixLen bytes).
    /// For ASCII fields the prefix value = byte count.
    /// For Binary fields the prefix value = hex-char count (2× byte count).
    /// </summary>
    private static (string value, byte[] rawBytes, int newPos) ParseVarFieldFromBytes(
        byte[] data, int pos, int prefixLen,
        IsoFieldDefinition def, string fieldLabel, int bitNumber)
    {
        var isBinary = def.Encoding == IsoFieldEncoding.Binary;
        var varType  = prefixLen switch { 2 => "LLVAR", 3 => "LLLVAR", _ => "LLLLVAR" };

        EnsureBytesAvailable(data, pos, prefixLen, fieldLabel);
        var lenStr = Encoding.ASCII.GetString(data, pos, prefixLen);
        if (!int.TryParse(lenStr, out var len))
            throw new IsoParseException(fieldLabel, pos, lenStr,
                $"Non-numeric {varType} length prefix '{lenStr}' for bit {bitNumber}.");

        var maxChars = isBinary ? def.MaxLength * 2 : def.MaxLength;
        if (len > maxChars)
            throw new IsoParseException(fieldLabel, pos, lenStr,
                $"{varType} declared length {len} exceeds MaxLength {def.MaxLength} for bit {bitNumber}.");
        pos += prefixLen;

        // In both wire conventions the LLVAR/LLLVAR prefix declares the
        // BYTE COUNT of the value that follows:
        //   • Raw binary wire (real TCP capture): `len` raw bytes of TLV.
        //   • Builder hex-ASCII convention: `len` ASCII bytes, each holding
        //     one hex character (so the textual value happens to also be
        //     `len` chars long — same count, different interpretation).
        // The earlier `len / 2` for the raw branch was wrong: it would only
        // be correct if the wire declared "hex char count" instead of bytes,
        // which doesn't happen in real wire.
        EnsureBytesAvailable(data, pos, len, fieldLabel);
        var rawBytes = data[pos..(pos + len)];
        var value    = isBinary && AllBytesAreHexChars(data, pos, len)
            ? Encoding.ASCII.GetString(data, pos, len)  // Builder convention: preserve the hex string
            : ExtractFieldValue(data, pos, len, isBinary);
        pos += len;

        return (value, rawBytes, pos);
    }

    /// <summary>
    /// Resolves the textual representation of a field given the raw bytes from the
    /// binary-hex wire and whether the layout marks it as Binary encoding.
    /// <para>
    /// Three cases are handled:
    /// <list type="bullet">
    /// <item><description>Binary field, bytes are ASCII hex chars (Builder convention)
    /// → decode as ASCII string to recover the original hex value (e.g. PIN block "0123…").</description></item>
    /// <item><description>Binary field, bytes are raw (real-world capture) → hex-encode.</description></item>
    /// <item><description>ASCII field with non-printable bytes → hex-encode (safety fallback).</description></item>
    /// <item><description>ASCII field with printable bytes → decode as ASCII string.</description></item>
    /// </list></para>
    /// </summary>
    private static string ExtractFieldValue(byte[] data, int offset, int length, bool isBinary)
    {
        if (isBinary)
        {
            // Builder writes Binary fields as ASCII bytes of their hex chars.
            // If the bytes look like hex chars, decode back to the hex string.
            if (AllBytesAreHexChars(data, offset, length))
                return Encoding.ASCII.GetString(data, offset, length);
            // Otherwise the bytes are raw — hex-encode them.
            return Convert.ToHexString(data, offset, length);
        }
        if (HasNonAsciiBytes(data, offset, length))
            return Convert.ToHexString(data, offset, length);
        return Encoding.ASCII.GetString(data, offset, length);
    }

    /// <summary>
    /// Returns <c>true</c> when any byte in the range is outside the printable ASCII range (> 0x7F).
    /// Used to auto-detect binary data in fields that the layout marks as ASCII,
    /// preventing silent corruption via <see cref="Encoding.ASCII"/> replacement chars.
    /// </summary>
    private static bool HasNonAsciiBytes(byte[] data, int offset, int length)
    {
        for (var i = offset; i < offset + length; i++)
        {
            if (data[i] > 0x7F) return true;
        }
        return false;
    }

    /// <summary>
    /// Returns <c>true</c> when every byte in the range is the ASCII representation
    /// of a hex digit (0-9, A-F, a-f). This matches what <see cref="IsoMessageBuilder.BuildBinaryHex"/>
    /// produces for Binary fields — the bytes are the ASCII codes of the hex chars,
    /// not the raw bytes themselves.
    /// </summary>
    /// <summary>
    /// Converts an ASCII-wire slice into the byte[] representation that
    /// downstream code expects. For Binary fields the slice is typically a
    /// hex string (Builder convention) — but real-world wires may inline
    /// raw bytes that surface here as a string containing non-hex chars
    /// or having odd length. Both cases would crash <c>Convert.FromHexString</c>,
    /// so we fall back to the raw ASCII bytes in that case rather than
    /// killing the whole parse over a Bit 55 oddity.
    /// </summary>
    private static byte[] ToBytesSafe(string slice, IsoFieldEncoding encoding)
    {
        if (encoding != IsoFieldEncoding.Binary)
            return Encoding.ASCII.GetBytes(slice);

        // Binary field: try hex decode first, fall back to ASCII bytes.
        // Odd length OR any non-hex char → can't decode; preserve the
        // bytes as-is and let the consumer inspect the raw value.
        if ((slice.Length & 1) != 0) return Encoding.ASCII.GetBytes(slice);
        foreach (var c in slice)
        {
            var isHex = (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F') || (c >= 'a' && c <= 'f');
            if (!isHex) return Encoding.ASCII.GetBytes(slice);
        }
        return Convert.FromHexString(slice);
    }

    private static bool AllBytesAreHexChars(byte[] data, int offset, int length)
    {
        if (length == 0) return false;
        for (var i = offset; i < offset + length; i++)
        {
            var b = data[i];
            var isHex = (b >= (byte)'0' && b <= (byte)'9')
                     || (b >= (byte)'A' && b <= (byte)'F')
                     || (b >= (byte)'a' && b <= (byte)'f');
            if (!isHex) return false;
        }
        return true;
    }

    private static void EnsureBytesAvailable(byte[] data, int pos, int needed, string field)
    {
        if (pos + needed > data.Length)
            throw new IsoParseException(field, pos,
                string.Empty,
                $"Message truncated at byte {pos} while reading '{field}': " +
                $"needed {needed} bytes but only {data.Length - pos} available.");
    }
}
