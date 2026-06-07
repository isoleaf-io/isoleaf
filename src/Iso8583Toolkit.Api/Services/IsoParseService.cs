using System.Text;
using Iso8583Toolkit.Api.DTOs;
using Iso8583Toolkit.Cards.Brands;
using Iso8583Toolkit.IsoCore.Domain.Exceptions;
using Iso8583Toolkit.IsoCore.Layouts;
using Iso8583Toolkit.IsoCore.Parsing;

namespace Iso8583Toolkit.Api.Services;

public sealed class IsoParseService
{
    private readonly Dictionary<string, IsoLayout> _layouts;
    private readonly IsoParser _parser;
    private static readonly BinRangeRegistry _binRanges = new();

    public IsoParseService()
    {
        var defaultLayout = IsoLayout.Default();
        _layouts = new Dictionary<string, IsoLayout>(StringComparer.OrdinalIgnoreCase)
        {
            ["default"] = defaultLayout
        };
        _parser = new IsoParser(defaultLayout);
    }

    /// <summary>
    /// Auto-detects message format: if the input looks like a hex-encoded byte stream
    /// (binary-hex), parses with <see cref="IsoParser.ParseFromBinaryHex"/>;
    /// otherwise falls back to <see cref="IsoParser.ParseFromHex"/> (ASCII wire).
    /// </summary>
    public IsoParseResponse ParseHex(string hexMessage, string layoutName)
    {
        var layout = ResolveLayout(layoutName);

        if (IsBinaryHex(hexMessage))
        {
            // Try true binary-hex wire first (bitmap 8 raw bytes, binary fields raw).
            // Preserve the exception — when both fallbacks below also fail, we
            // surface THIS one because it carries the richest PartialMessage
            // (auto-detect picked binary-hex, so this is the most likely shape).
            IsoParseException? binaryError = null;
            try
            {
                var msg = _parser.ParseFromBinaryHex(hexMessage, layout);
                return MapSuccess(msg);
            }
            catch (IsoParseException ex) { binaryError = ex; }

            // Try ASCII wire that was hex-encoded for transport:
            // decode hex → ASCII string → ParseFromHex
            try
            {
                var asciiWire = Encoding.ASCII.GetString(Convert.FromHexString(hexMessage.Trim()));
                var msg = _parser.ParseFromHex(asciiWire, layout);
                return MapSuccess(msg);
            }
            catch { /* binary error wins */ }

            return MapError(binaryError);
        }

        try
        {
            var msg = _parser.ParseFromHex(hexMessage, layout);
            return MapSuccess(msg);
        }
        catch (IsoParseException ex)
        {
            return MapError(ex);
        }
    }

    public IsoParseResponse ParseAscii(string asciiMessage, string layoutName)
    {
        var layout = ResolveLayout(layoutName);
        try
        {
            var msg = _parser.ParseFromAscii(asciiMessage, layout);
            return MapSuccess(msg);
        }
        catch (IsoParseException ex)
        {
            return MapError(ex);
        }
    }

    public IsoParseResponse ParseBinaryHex(string hexMessage, string layoutName)
    {
        var layout = ResolveLayout(layoutName);
        // Binary-hex must be pure hex chars — strip internal whitespace
        // (textareas pick up newlines on long pastes, which would otherwise
        // throw FormatException in Convert.FromHexString).
        var clean = new string(hexMessage.Where(c => !char.IsWhiteSpace(c)).ToArray());
        try
        {
            var msg = _parser.ParseFromBinaryHex(clean, layout);
            return MapSuccess(msg);
        }
        catch (IsoParseException ex)
        {
            return MapError(ex);
        }
        catch (ArgumentException ex)
        {
            // Convert.FromHexString failures arrive here wrapped as ArgumentException.
            return new IsoParseResponse(Success: false, Error: ex.Message);
        }
    }

    /// <summary>
    /// Detects whether <paramref name="message"/> is a binary-hex encoded byte stream.
    /// Checks: all chars are hex digits, even length, and the first 8 hex chars
    /// (4 bytes) decode to a valid ISO 8583 MTI (4 decimal ASCII digits).
    /// </summary>
    private static bool IsBinaryHex(string message)
    {
        var trimmedString = message.Trim();
        var trimmed = trimmedString.AsSpan();

        // Binary-hex needs at least 8 hex chars for the MTI (4 bytes × 2).
        // The "all chars are hex" gate lives in IsoWireHelper.IsBinaryHex so
        // the agent/frontend/tests all share the same definition.
        if (trimmed.Length < 8 || !IsoWireHelper.IsBinaryHex(trimmedString))
            return false;

        // Three layouts can match binary-hex:
        //   (a) [MTI]…                    → MTI at offset 0
        //   (b) [length-prefix 2B][MTI]…  → MTI at offset 4
        //   (c) [TPDU 5B][MTI]…           → MTI at offset 10
        // Length-prefix (b) is the case the user's bug report hit — without
        // it, a TCP-framed wire was being routed to the ASCII-wire fallback
        // (which then tries to read "01FE…" as a 4-decimal-digit MTI).
        try
        {
            var mtiBytes = Convert.FromHexString(trimmed[..8]);
            var mti = Encoding.ASCII.GetString(mtiBytes);
            if (MtiParser.IsValid(mti)) return true;

            // Length-prefix heuristic. The prefix's first byte is always
            // non-printable (0x00-0x1F) — typical messages are < 256 bytes
            // so the high byte is 0x00; longer ones might reach 0x01-0x0F.
            // Three follow-up layouts can sit after the prefix:
            //   (b1) [prefix][MTI ASCII]                — MTI at hex offset 4
            //   (b2) [prefix][raw 5B TPDU][MTI ASCII]   — MTI at hex offset 14
            //   (b3) [prefix][TPDU as 10 ASCII chars]
            //        [MTI ASCII]                       — MTI at hex offset 24
            // The MTI candidate is checked as printable ASCII rather than
            // strict decimal so custom hex MTIs (e.g. "91FF") also route to
            // the binary parser. b3 is implicitly covered by b1 because the
            // TPDU's ASCII hex chars at offset 4 are themselves printable.
            if (trimmed.Length >= 12)
            {
                var firstByte = Convert.FromHexString(trimmed[..2])[0];
                if (firstByte < 0x20)
                {
                    if (IsAsciiPrintable(Convert.FromHexString(trimmed[4..12]))) return true;

                    // (b2) — raw 5-byte TPDU between the prefix and the MTI.
                    // The raw TPDU bytes are typically non-printable (e.g.
                    // 0x60 0x00 0x02 …), so the offset-4 check above fails;
                    // probe offset 14 to find the MTI past the TPDU.
                    if (trimmed.Length >= 22 &&
                        IsAsciiPrintable(Convert.FromHexString(trimmed[14..22])))
                    {
                        return true;
                    }
                }
            }

            // TPDU heuristic: 5 bytes = 10 hex chars, then MTI at offset 10..18.
            if (trimmed.Length >= 18)
            {
                var firstByte = Convert.FromHexString(trimmed[..2])[0];
                var looksLikeTpdu = (firstByte >= 0x60 && firstByte <= 0x6F)
                                    || firstByte < 0x20
                                    || firstByte >= 0x7F;
                if (looksLikeTpdu)
                {
                    var mtiAfterTpdu = Encoding.ASCII.GetString(Convert.FromHexString(trimmed[10..18]));
                    if (MtiParser.IsValid(mtiAfterTpdu)) return true;
                }
            }

            return false;
        }
        catch
        {
            return false;
        }
    }

    private static bool IsAsciiPrintable(byte[] bytes)
    {
        foreach (var b in bytes)
        {
            if (b < 0x20 || b > 0x7E) return false;
        }
        return true;
    }

    /// <summary>
    /// Parses a hex bitmap. Accepts:
    ///   • 16 hex chars  → primary only (bits 1-64)
    ///   • 32 hex chars  → primary + secondary (bits 1-128)
    /// Whitespace and case are normalized.
    /// </summary>
    public BitmapParseResponse ParseBitmap(string hexBitmap)
    {
        if (string.IsNullOrWhiteSpace(hexBitmap))
            throw new ArgumentException("Hex bitmap is required.", nameof(hexBitmap));

        var clean = new string(hexBitmap.Where(c => !char.IsWhiteSpace(c)).ToArray()).ToUpperInvariant();
        if (clean.Length != 16 && clean.Length != 32)
            throw new ArgumentException(
                $"Hex bitmap must be 16 (primary only) or 32 (primary + secondary) characters; got {clean.Length}.",
                nameof(hexBitmap));

        var primaryHex = clean[..16];
        var secondaryHex = clean.Length == 32 ? clean[16..] : null;

        var primary = BitmapEngine.ParseFromHex(primaryHex);
        var hasSecondary = BitmapEngine.IsSecondaryPresent(primary);
        var activeBits = BitmapEngine.GetActiveBits(primary).ToList();
        var binary = string.Concat(primary.Select(b => b ? '1' : '0'));

        if (secondaryHex is not null)
        {
            var secondary = BitmapEngine.ParseFromHex(secondaryHex);
            // Bits 65-128 are 1-based — index i in `secondary` is bit (i + 65).
            for (var i = 0; i < secondary.Length; i++)
                if (secondary[i]) activeBits.Add(i + 65);
            binary += string.Concat(secondary.Select(b => b ? '1' : '0'));
            hasSecondary = true; // explicit even if the caller didn't flip bit 1
        }

        return new BitmapParseResponse(activeBits, hasSecondary, binary, primaryHex, secondaryHex);
    }

    public List<LayoutSummary> GetLayouts() =>
        _layouts.Values
            .Select(l => new LayoutSummary(l.Name, l.Version, l.Fields.Count))
            .ToList();

    /// <summary>Lists every field defined in the requested layout — used by the Builder's
    /// Add Field modal to populate the picker dynamically.</summary>
    public List<LayoutFieldDefinition> GetLayoutFields(string layoutName)
    {
        var layout = ResolveLayout(layoutName);
        return layout.Fields
            .Values
            .OrderBy(f => f.BitNumber)
            .Select(f => new LayoutFieldDefinition(
                f.BitNumber, f.Name, f.Type.ToString(), f.MaxLength, f.Encoding.ToString()))
            .ToList();
    }

    private IsoLayout ResolveLayout(string layoutName) =>
        _layouts.TryGetValue(layoutName, out var layout)
            ? layout
            : throw new KeyNotFoundException($"Layout '{layoutName}' not found. Available: {string.Join(", ", _layouts.Keys)}");

    private static IsoParseResponse MapSuccess(IsoCore.Domain.IsoMessage msg)
    {
        var fields = msg.Fields.Values
            .OrderBy(f => f.BitNumber)
            .Select(f => new IsoFieldResponse(
                f.BitNumber,
                f.Definition.Name,
                f.RawValue,
                f.DisplayValue,
                f.Definition.Type.ToString(),
                f.RawValue.Length))
            .ToList();

        TpduResponse? tpdu = null;
        if (msg.TpduInfo is { } t)
            tpdu = new TpduResponse(t.Hex, $"0x{t.Id:X2}", t.DestinationNii, t.SourceNii);

        LengthPrefixResponse? lengthPrefix = null;
        if (msg.LengthPrefix is { } lp)
            lengthPrefix = new LengthPrefixResponse(lp.Hex, lp.ExpectedLength, lp.ActualLength, lp.Match);

        // Detect card brand from PAN (bit 2). Brand resolution is best-effort —
        // anything not matching a known BIN range falls back to null so callers know.
        string? detectedBrand = null;
        if (msg.Fields.TryGetValue(2, out var panField) && !string.IsNullOrWhiteSpace(panField.RawValue))
        {
            try
            {
                var brand = _binRanges.Detect(panField.RawValue);
                if (brand != CardBrand.Custom)
                    detectedBrand = brand.ToString();
            }
            catch (ArgumentException) { /* malformed PAN — leave brand null */ }
        }

        return new IsoParseResponse(
            Success: true,
            Mti: msg.Mti,
            MessageClass: MtiParser.GetMessageClass(msg.Mti),
            MessageFunction: MtiParser.GetMessageFunction(msg.Mti),
            HasSecondaryBitmap: msg.HasSecondaryBitmap,
            ActiveBits: msg.GetActiveBits().ToList(),
            Fields: fields,
            ParsedAt: msg.ParsedAt,
            Tpdu: tpdu,
            DetectedBrand: detectedBrand,
            LengthPrefix: lengthPrefix);
    }

    private static IsoParseResponse MapError(IsoParseException ex)
    {
        List<IsoFieldResponse>? partialFields = null;
        if (ex.PartialMessage is { } partial && partial.Fields.Count > 0)
        {
            partialFields = partial.Fields.Values
                .OrderBy(f => f.BitNumber)
                .Select(f => new IsoFieldResponse(
                    f.BitNumber,
                    f.Definition.Name,
                    f.RawValue,
                    f.DisplayValue,
                    f.Definition.Type.ToString(),
                    f.RawValue.Length))
                .ToList();
        }

        return new IsoParseResponse(
            Success: false,
            Error: $"[{ex.Field} @ pos {ex.Position}] {ex.Message}",
            ParseError: new ParseErrorResponse(
                Field: ex.Field,
                Position: ex.Position,
                Message: ex.Message,
                Hint: BuildHint(ex)),
            PartialFields: partialFields);
    }

    /// <summary>
    /// Returns a debug hint when the failure is inside the field-parsing loop —
    /// the most common cause is a previous LL/LLL/LLLL field with a malformed
    /// length that pushed the parser offset off, surfacing as a downstream bit's
    /// error. The hint text is API-consumer-facing; the frontend may replace it
    /// with a localized version via the <c>parser.parseErrorHint</c> i18n key.
    /// </summary>
    private static string? BuildHint(IsoParseException ex)
    {
        if (!ex.Field.StartsWith("Bit ", StringComparison.Ordinal)) return null;
        return $"The error surfaced while reading {ex.Field}. The actual cause is " +
               "often an earlier LL/LLL/LLLL field with the wrong declared length, " +
               "which shifted the parser offset onto the bytes shown above.";
    }
}
