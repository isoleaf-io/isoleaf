using Iso8583Toolkit.Cards.Brands;
using Iso8583Toolkit.Cards.Cvv;
using Iso8583Toolkit.Cards.Domain;
using Iso8583Toolkit.Cards.Luhn;
using Iso8583Toolkit.Cards.Tracks;

namespace Iso8583Toolkit.Cards;

public sealed class CardGenerator
{
    // Default test keys (for demonstration/testing only — NOT production keys)
    private const string DefaultKey1 = "0123456789ABCDEF";
    private const string DefaultKey2 = "FEDCBA9876543210";
    private const string DefaultServiceCode = "201";
    private const string DefaultPvki = "1";

    private readonly BinRangeRegistry _registry = new();

    /// <summary>
    /// Generates a complete virtual card for the specified brand.
    /// </summary>
    public VirtualCard Generate(CardBrand brand, string? cardholderName = null, string? expiry = null)
    {
        var pan = _registry.GeneratePan(brand);
        var name = NormalizeName(cardholderName);
        var exp = expiry ?? GenerateDefaultExpiry();

        return BuildCard(pan, name, exp, brand);
    }

    /// <summary>
    /// Generates a card with a custom BIN prefix and PAN length.
    /// </summary>
    public VirtualCard GenerateCustom(string binPrefix, int panLength, string? cardholderName = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(binPrefix);
        if (panLength < binPrefix.Length + 1 || panLength > 19)
            throw new ArgumentOutOfRangeException(nameof(panLength),
                $"PAN length must be between {binPrefix.Length + 1} and 19.");

        var range = new BinRange(binPrefix, binPrefix, panLength, CardBrand.Custom);
        var pan = BinRangeRegistry.GeneratePanFromRange(range);
        var name = NormalizeName(cardholderName);
        var expiry = GenerateDefaultExpiry();
        var brand = _registry.Detect(pan);

        return BuildCard(pan, name, expiry, brand);
    }

    /// <summary>
    /// Detects the card brand from a PAN.
    /// </summary>
    public CardBrand DetectBrand(string pan) => _registry.Detect(pan);

    /// <summary>
    /// Validates a PAN using the Luhn algorithm.
    /// </summary>
    public static bool ValidatePan(string pan) => LuhnAlgorithm.Validate(pan);

    private VirtualCard BuildCard(string pan, string name, string expiry, CardBrand brand)
    {
        var cvv = CvvGenerator.GenerateCvv(pan, expiry, DefaultServiceCode, DefaultKey1, DefaultKey2);
        var cvv2 = CvvGenerator.GenerateCvv2(pan, expiry, "000", DefaultKey1, DefaultKey2);
        var pvv = CvvGenerator.GenerateCvv(pan, expiry, DefaultServiceCode, DefaultKey1, DefaultKey2);

        var track1 = TrackGenerator.GenerateTrack1(pan, name, expiry, DefaultServiceCode, DefaultPvki, pvv);
        var track2 = TrackGenerator.GenerateTrack2(pan, expiry, DefaultServiceCode, cvv);

        return new VirtualCard
        {
            Pan = pan,
            CardholderName = name,
            Expiry = expiry,
            ServiceCode = DefaultServiceCode,
            Cvv = cvv,
            Cvv2 = cvv2,
            Track1 = track1,
            Track2 = track2,
            Brand = brand
        };
    }

    private static string NormalizeName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return "CARDHOLDER/TEST";

        return name.ToUpperInvariant().Trim();
    }

    private static string GenerateDefaultExpiry()
    {
        // 3 years from now, YYMM format
        var future = DateTime.UtcNow.AddYears(3);
        return future.ToString("yy") + future.ToString("MM");
    }
}
