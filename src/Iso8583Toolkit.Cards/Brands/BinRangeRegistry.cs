using System.Text;
using Iso8583Toolkit.Cards.Luhn;

namespace Iso8583Toolkit.Cards.Brands;

public sealed class BinRangeRegistry
{
    private static readonly List<BinRange> Ranges =
    [
        // Elo (must be checked before Visa/Mastercard — more specific prefixes)
        new("636368", "636368", 16, CardBrand.Elo),
        new("438935", "438935", 16, CardBrand.Elo),
        new("504175", "504175", 16, CardBrand.Elo),
        new("636297", "636297", 16, CardBrand.Elo),
        new("5067",   "5067",   16, CardBrand.Elo),
        new("4576",   "4576",   16, CardBrand.Elo),
        new("4011",   "4011",   16, CardBrand.Elo),

        // Hipercard (before Visa — 3841 prefix overlaps nothing, 606282 is specific)
        new("606282", "606282", 16, CardBrand.Hipercard),
        new("3841",   "3841",   16, CardBrand.Hipercard),

        // Amex
        new("34", "34", 15, CardBrand.Amex),
        new("37", "37", 15, CardBrand.Amex),

        // Mastercard
        new("51",   "55",   16, CardBrand.Mastercard),
        new("2221", "2720", 16, CardBrand.Mastercard),

        // Visa (broadest — must be last)
        new("4", "4", 16, CardBrand.Visa),
    ];

    /// <summary>
    /// Detects the card brand from a PAN by matching BIN ranges.
    /// Ranges are ordered from most specific to least specific.
    /// </summary>
    public CardBrand Detect(string pan)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(pan);

        foreach (var range in Ranges)
        {
            if (pan.Length != range.PanLength)
                continue;

            var prefix = pan[..range.Start.Length];

            if (range.Start == range.End)
            {
                if (prefix == range.Start)
                    return range.Brand;
            }
            else
            {
                // Numeric range comparison
                if (long.TryParse(prefix, out var prefixNum) &&
                    long.TryParse(range.Start, out var startNum) &&
                    long.TryParse(range.End, out var endNum) &&
                    prefixNum >= startNum && prefixNum <= endNum)
                {
                    return range.Brand;
                }
            }
        }

        return CardBrand.Custom;
    }

    /// <summary>
    /// Returns the first BIN range registered for a brand.
    /// </summary>
    public BinRange? GetRange(CardBrand brand) =>
        Ranges.FirstOrDefault(r => r.Brand == brand);

    /// <summary>
    /// Generates a random valid PAN for the given brand using Luhn algorithm.
    /// </summary>
    public string GeneratePan(CardBrand brand)
    {
        var range = GetRange(brand)
            ?? throw new ArgumentException($"No BIN range registered for brand '{brand}'.", nameof(brand));

        return GeneratePanFromRange(range);
    }

    /// <summary>
    /// Generates a random valid PAN from a specific BIN range.
    /// </summary>
    public static string GeneratePanFromRange(BinRange range)
    {
        var rng = Random.Shared;
        var prefix = range.Start;

        // For numeric ranges (Start != End), pick a random prefix in range
        if (range.Start != range.End &&
            long.TryParse(range.Start, out var startNum) &&
            long.TryParse(range.End, out var endNum))
        {
            var randomPrefix = rng.NextInt64(startNum, endNum + 1);
            prefix = randomPrefix.ToString().PadLeft(range.Start.Length, '0');
        }

        // Fill remaining digits (minus 1 for check digit) with random digits.
        // StringBuilder avoids the O(n²) realloc cost CodeQL flags for `+=`
        // in a loop — PanLength tops out at 19 today but the analyzer is
        // right that the pattern doesn't scale.
        var remaining = range.PanLength - prefix.Length - 1;
        var sb = new StringBuilder(prefix, range.PanLength);
        for (var i = 0; i < remaining; i++)
            sb.Append(rng.Next(0, 10));

        return LuhnAlgorithm.Calculate(sb.ToString());
    }

    /// <summary>
    /// Lists all registered BIN ranges.
    /// </summary>
    public IEnumerable<BinRange> GetAll() => Ranges.AsReadOnly();
}
