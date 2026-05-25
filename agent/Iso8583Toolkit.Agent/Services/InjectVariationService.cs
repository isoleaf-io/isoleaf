using System.Text;
using Iso8583Toolkit.IsoCore.Building;
using Iso8583Toolkit.IsoCore.Domain;
using Iso8583Toolkit.IsoCore.Layouts;
using Iso8583Toolkit.IsoCore.Parsing;
using Microsoft.Extensions.Logging;

namespace Iso8583Toolkit.Agent.Services;

/// <summary>
/// Applies per-send variations to an outbound ISO 8583 message — currently
/// "vary identifiers" (refresh timestamp/STAN/RRN) and "vary amount"
/// (random Bit 4 within a range). The service is stateless except for the
/// shared STAN counter, which is incremented atomically so concurrent calls
/// in continuous mode never collide.
/// </summary>
public static class InjectVariationService
{
    private static int _stanCounter;
    private static readonly char[] RrnAlphabet =
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".ToCharArray();

    /// <summary>
    /// Parses the wire, mutates the chosen fields, and re-serialises in the
    /// original wire format. Returns the original bytes untouched when neither
    /// flag is set or the message can't be parsed (variations are best-effort —
    /// a malformed payload should still be forwarded to the remote system so
    /// the user sees the real failure, not a hidden frontend error).
    /// </summary>
    public static byte[] Apply(
        byte[] originalBytes,
        bool wasHexEncoded,
        bool varyIdentifiers,
        bool varyAmount,
        long amountMin,
        long amountMax,
        IsoLayout? layout = null,
        ILogger? logger = null)
    {
        if (!varyIdentifiers && !varyAmount) return originalBytes;

        layout ??= IsoLayout.Default();
        var parser = new IsoParser(layout);

        // Auto-detect the parse path. The `wasHexEncoded` hint from the controller
        // is just a heuristic (an ASCII wire of all-hex chars looks identical to a
        // binary-hex stream), so we try the preferred path first and fall back to
        // the other one — both throw IsoParseException on a bad guess, never crash.
        IsoMessage parsed;
        var asAscii = Encoding.Latin1.GetString(originalBytes);
        var primary = wasHexEncoded
            ? (Func<IsoMessage>)(() => parser.ParseFromBinaryHex(asAscii, layout))
            : (Func<IsoMessage>)(() => parser.ParseFromHex(asAscii, layout));
        var fallback = wasHexEncoded
            ? (Func<IsoMessage>)(() => parser.ParseFromHex(asAscii, layout))
            : (Func<IsoMessage>)(() => parser.ParseFromBinaryHex(asAscii, layout));

        try { parsed = primary(); }
        catch (Exception primaryEx)
        {
            try { parsed = fallback(); }
            catch (Exception fallbackEx)
            {
                logger?.LogWarning(
                    "InjectVariationService: parse failed in both modes (primary: {Primary}; fallback: {Fallback}); forwarding original bytes unchanged.",
                    primaryEx.Message, fallbackEx.Message);
                return originalBytes;
            }
            // Fallback succeeded — flip the "wasHexEncoded" flag so re-serialisation
            // picks the matching wire format.
            wasHexEncoded = !wasHexEncoded;
        }

        var builder = new IsoMessageBuilder()
            .WithMti(parsed.Mti)
            .WithLayout(layout);

        foreach (var f in parsed.Fields.Values)
            builder.WithField(f.BitNumber, f.RawValue);

        if (varyIdentifiers)
        {
            var now = DateTime.UtcNow;
            var stan = NextStan();
            logger?.LogInformation(
                "InjectVariationService: vary identifiers — newStan={Stan}, bit7Present={B7}, bit11Present={B11}, bit12Present={B12}, bit13Present={B13}, bit37Present={B37}",
                stan,
                parsed.Fields.ContainsKey(7),
                parsed.Fields.ContainsKey(11),
                parsed.Fields.ContainsKey(12),
                parsed.Fields.ContainsKey(13),
                parsed.Fields.ContainsKey(37));

            // Only overwrite a field if it already exists on the message — we
            // never *add* new fields here, since a "vary" flag is about refreshing
            // existing identifiers, not changing the bitmap shape.
            ApplyIfPresent(builder, parsed, 7, now.ToString("MMddHHmmss"), logger);
            ApplyIfPresent(builder, parsed, 11, stan.ToString("D6"), logger);
            ApplyIfPresent(builder, parsed, 12, now.ToString("HHmmss"), logger);
            ApplyIfPresent(builder, parsed, 13, now.ToString("MMdd"), logger);
            ApplyIfPresent(builder, parsed, 37, GenerateRrn(), logger);
        }

        if (varyAmount)
        {
            if (amountMin < 0) amountMin = 0;
            if (amountMax <= amountMin) amountMax = amountMin + 1;
            var amount = Random.Shared.NextInt64(amountMin, amountMax + 1);
            ApplyIfPresent(builder, parsed, 4, amount.ToString("D12"), logger);
        }

        var newHex = wasHexEncoded ? builder.BuildBinaryHex() : builder.BuildHex();
        return wasHexEncoded
            ? Convert.FromHexString(newHex)
            : Encoding.ASCII.GetBytes(newHex);
    }

    private static void ApplyIfPresent(IsoMessageBuilder builder, IsoMessage parsed, int bit, string value, ILogger? logger = null)
    {
        if (parsed.Fields.ContainsKey(bit))
        {
            builder.WithField(bit, value);
        }
        else
        {
            logger?.LogWarning(
                "InjectVariationService: bit {Bit} not present in message, variation skipped — add it to the message body to enable refresh.",
                bit);
        }
    }

    /// <summary>Atomic STAN counter — wraps around at 999_999 to keep the field 6 digits wide.</summary>
    private static int NextStan() => Interlocked.Increment(ref _stanCounter) % 1_000_000;

    private static string GenerateRrn()
    {
        Span<char> buf = stackalloc char[12];
        for (var i = 0; i < buf.Length; i++)
            buf[i] = RrnAlphabet[Random.Shared.Next(RrnAlphabet.Length)];
        return new string(buf);
    }
}
