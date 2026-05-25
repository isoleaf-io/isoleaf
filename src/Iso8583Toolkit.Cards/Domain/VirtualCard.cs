using Iso8583Toolkit.Cards.Brands;

namespace Iso8583Toolkit.Cards.Domain;

public sealed record VirtualCard
{
    public required string Pan { get; init; }
    public string PanMasked => MaskPan(Pan);
    public required string CardholderName { get; init; }
    public required string Expiry { get; init; }
    public string ExpiryFormatted => Expiry.Length == 4
        ? $"{Expiry[2..]}/{Expiry[..2]}"
        : Expiry;
    public required string ServiceCode { get; init; }
    public required string Cvv { get; init; }
    public required string Cvv2 { get; init; }
    public required string Track1 { get; init; }
    public required string Track2 { get; init; }
    public required CardBrand Brand { get; init; }
    public string BrandName => Brand.ToString();
    public DateTime GeneratedAt { get; init; } = DateTime.UtcNow;

    public override string ToString() => $"{BrandName} {PanMasked} ({ExpiryFormatted})";

    private static string MaskPan(string pan) =>
        pan.Length >= 10
            ? $"{pan[..6]}{"".PadLeft(pan.Length - 10, '*')}{pan[^4..]}"
            : pan;
}
