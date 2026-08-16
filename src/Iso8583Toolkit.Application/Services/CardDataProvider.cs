using Iso8583Toolkit.Cards;
using Iso8583Toolkit.Cards.Brands;
using Iso8583Toolkit.Cards.Cvv;
using Iso8583Toolkit.Cards.Tracks;
using Iso8583Toolkit.IsoCore.Building.Smart;

namespace Iso8583Toolkit.Application.Services;

/// <summary>
/// Bridges SmartIsoBuilder (IsoCore) to CardGenerator (Cards) via the
/// <see cref="ICardDataProvider"/> abstraction.
/// </summary>
public sealed class CardDataProvider : ICardDataProvider
{
    private const string Key1 = "0123456789ABCDEF";
    private const string Key2 = "FEDCBA9876543210";

    private readonly CardGenerator _gen = new();

    public string GeneratePan(SmartBrand brand)
    {
        var cardBrand = MapBrand(brand);
        return _gen.Generate(cardBrand).Pan;
    }

    public SmartBrand DetectBrand(string pan)
    {
        var detected = _gen.DetectBrand(pan);
        return detected switch
        {
            CardBrand.Visa => SmartBrand.Visa,
            CardBrand.Mastercard => SmartBrand.Mastercard,
            CardBrand.Elo => SmartBrand.Elo,
            CardBrand.Amex => SmartBrand.Amex,
            CardBrand.Hipercard => SmartBrand.Hipercard,
            _ => SmartBrand.Default
        };
    }

    public string GenerateTrack2(string pan, string expiry, string serviceCode, string cvv) =>
        TrackGenerator.GenerateTrack2(pan, expiry, serviceCode, cvv);

    public string GenerateCvv(string pan, string expiry, string serviceCode) =>
        CvvGenerator.GenerateCvv(pan, expiry, serviceCode, Key1, Key2);

    public string GenerateExpiry()
    {
        var future = DateTime.UtcNow.AddYears(3);
        return future.ToString("yy") + future.ToString("MM");
    }

    private static CardBrand MapBrand(SmartBrand brand) =>
        brand switch
        {
            SmartBrand.Visa => CardBrand.Visa,
            SmartBrand.Mastercard => CardBrand.Mastercard,
            SmartBrand.Elo => CardBrand.Elo,
            SmartBrand.Amex => CardBrand.Amex,
            SmartBrand.Hipercard => CardBrand.Hipercard,
            _ => CardBrand.Visa // Default generates Visa
        };
}
