namespace Iso8583Toolkit.Cards.Brands;

public sealed record BinRange(string Start, string End, int PanLength, CardBrand Brand);
