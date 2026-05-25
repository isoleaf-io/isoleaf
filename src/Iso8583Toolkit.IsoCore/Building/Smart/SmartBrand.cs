namespace Iso8583Toolkit.IsoCore.Building.Smart;

/// <summary>
/// Brand enum local to the Smart builder. Maps 1:1 to
/// <c>Iso8583Toolkit.Cards.Brands.CardBrand</c> at the API layer.
/// </summary>
public enum SmartBrand
{
    Auto,
    Default,
    Visa,
    Mastercard,
    Elo,
    Amex,
    Hipercard
}
