using FluentAssertions;
using Iso8583Toolkit.Cards.Brands;
using Iso8583Toolkit.Cards.Luhn;
using Iso8583Toolkit.Cards.Tracks;

namespace Iso8583Toolkit.Cards.Tests;

public sealed class CardGeneratorTests
{
    private readonly CardGenerator _generator = new();

    // ── Visa ────────────────────────────────────────────────────────────────

    [Fact]
    public void Generate_Visa_PanStartsWith4()
    {
        var card = _generator.Generate(CardBrand.Visa);
        card.Pan.Should().StartWith("4");
    }

    [Fact]
    public void Generate_Visa_PanHas16Digits()
    {
        var card = _generator.Generate(CardBrand.Visa);
        card.Pan.Should().HaveLength(16);
        card.Pan.Should().MatchRegex(@"^\d{16}$");
    }

    [Fact]
    public void Generate_Visa_PanPassesLuhn()
    {
        var card = _generator.Generate(CardBrand.Visa);
        LuhnAlgorithm.Validate(card.Pan).Should().BeTrue();
    }

    [Fact]
    public void Generate_Visa_BrandIsVisa()
    {
        var card = _generator.Generate(CardBrand.Visa);
        card.Brand.Should().Be(CardBrand.Visa);
        card.BrandName.Should().Be("Visa");
    }

    // ── Mastercard ──────────────────────────────────────────────────────────

    [Fact]
    public void Generate_Mastercard_PanStartsWithValidRange()
    {
        for (var i = 0; i < 20; i++)
        {
            var card = _generator.Generate(CardBrand.Mastercard);
            var prefix2 = int.Parse(card.Pan[..2]);
            var prefix4 = int.Parse(card.Pan[..4]);

            var isClassicRange = prefix2 >= 51 && prefix2 <= 55;
            var isNewRange = prefix4 >= 2221 && prefix4 <= 2720;

            (isClassicRange || isNewRange).Should().BeTrue(
                $"Mastercard PAN {card.Pan} should start with 51-55 or 2221-2720");
        }
    }

    [Fact]
    public void Generate_Mastercard_PanHas16DigitsAndPassesLuhn()
    {
        var card = _generator.Generate(CardBrand.Mastercard);
        card.Pan.Should().HaveLength(16);
        LuhnAlgorithm.Validate(card.Pan).Should().BeTrue();
    }

    // ── Elo ─────────────────────────────────────────────────────────────────

    [Fact]
    public void Generate_Elo_PanHas16DigitsAndPassesLuhn()
    {
        var card = _generator.Generate(CardBrand.Elo);
        card.Pan.Should().HaveLength(16);
        LuhnAlgorithm.Validate(card.Pan).Should().BeTrue();
    }

    [Fact]
    public void Generate_Elo_DetectedAsElo()
    {
        var card = _generator.Generate(CardBrand.Elo);
        _generator.DetectBrand(card.Pan).Should().Be(CardBrand.Elo);
    }

    // ── Amex ────────────────────────────────────────────────────────────────

    [Fact]
    public void Generate_Amex_PanStartsWith34Or37()
    {
        var card = _generator.Generate(CardBrand.Amex);
        var prefix = card.Pan[..2];
        prefix.Should().BeOneOf("34", "37");
    }

    [Fact]
    public void Generate_Amex_PanHas15Digits()
    {
        var card = _generator.Generate(CardBrand.Amex);
        card.Pan.Should().HaveLength(15);
        LuhnAlgorithm.Validate(card.Pan).Should().BeTrue();
    }

    // ── Hipercard ───────────────────────────────────────────────────────────

    [Fact]
    public void Generate_Hipercard_PanHas16DigitsAndPassesLuhn()
    {
        var card = _generator.Generate(CardBrand.Hipercard);
        card.Pan.Should().HaveLength(16);
        LuhnAlgorithm.Validate(card.Pan).Should().BeTrue();
    }

    // ── Track 2 format ──────────────────────────────────────────────────────

    [Fact]
    public void Generate_Track2_ContainsSeparator()
    {
        var card = _generator.Generate(CardBrand.Visa);
        card.Track2.Should().Contain("=");
    }

    [Fact]
    public void Generate_Track2_StartsWithPan()
    {
        var card = _generator.Generate(CardBrand.Visa);
        card.Track2.Should().StartWith(card.Pan + "=");
    }

    [Fact]
    public void Generate_Track2_RoundTrip()
    {
        var card = _generator.Generate(CardBrand.Visa);
        var parsed = TrackGenerator.ParseTrack2(card.Track2);

        parsed["PAN"].Should().Be(card.Pan);
        parsed["Expiry"].Should().Be(card.Expiry);
        parsed["ServiceCode"].Should().Be(card.ServiceCode);
        parsed.Should().ContainKey("CVV");
    }

    // ── Track 1 format ──────────────────────────────────────────────────────

    [Fact]
    public void Generate_Track1_HasCorrectFormat()
    {
        var card = _generator.Generate(CardBrand.Visa, "SILVA/JOAO");
        card.Track1.Should().StartWith("%B");
        card.Track1.Should().EndWith("?");
        card.Track1.Should().Contain("^");
    }

    [Fact]
    public void Generate_Track1_RoundTrip()
    {
        var card = _generator.Generate(CardBrand.Visa, "SILVA/JOAO");
        var parsed = TrackGenerator.ParseTrack1(card.Track1);

        parsed["PAN"].Should().Be(card.Pan);
        parsed["Name"].Should().Be("SILVA/JOAO");
        parsed["Expiry"].Should().Be(card.Expiry);
        parsed["ServiceCode"].Should().Be(card.ServiceCode);
    }

    // ── CVV ─────────────────────────────────────────────────────────────────

    [Fact]
    public void Generate_Cvv_Has3Digits()
    {
        var card = _generator.Generate(CardBrand.Visa);
        card.Cvv.Should().HaveLength(3);
        card.Cvv.Should().MatchRegex(@"^\d{3}$");
    }

    [Fact]
    public void Generate_Cvv2_Has3Digits()
    {
        var card = _generator.Generate(CardBrand.Visa);
        card.Cvv2.Should().HaveLength(3);
        card.Cvv2.Should().MatchRegex(@"^\d{3}$");
    }

    // ── PAN masking ─────────────────────────────────────────────────────────

    [Fact]
    public void Generate_PanMasked_ShowsFirst6AndLast4()
    {
        var card = _generator.Generate(CardBrand.Visa);

        // 16-digit PAN: first 6 + 6 stars + last 4
        card.PanMasked.Should().HaveLength(16);
        card.PanMasked[..6].Should().Be(card.Pan[..6]);
        card.PanMasked[^4..].Should().Be(card.Pan[^4..]);
        card.PanMasked[6..^4].Should().MatchRegex(@"^\*+$");
    }

    [Fact]
    public void Generate_Amex_PanMasked_ShowsFirst6AndLast4()
    {
        var card = _generator.Generate(CardBrand.Amex);

        // 15-digit PAN: first 6 + 5 stars + last 4
        card.PanMasked.Should().HaveLength(15);
        card.PanMasked[..6].Should().Be(card.Pan[..6]);
        card.PanMasked[^4..].Should().Be(card.Pan[^4..]);
    }

    // ── Expiry formatting ───────────────────────────────────────────────────

    [Fact]
    public void Generate_ExpiryFormatted_IsMmSlashYy()
    {
        var card = _generator.Generate(CardBrand.Visa, expiry: "2812");
        card.Expiry.Should().Be("2812");
        card.ExpiryFormatted.Should().Be("12/28");
    }

    // ── Custom cardholder name ──────────────────────────────────────────────

    [Fact]
    public void Generate_WithName_NameIsUppercase()
    {
        var card = _generator.Generate(CardBrand.Visa, "Joao Silva");
        card.CardholderName.Should().Be("JOAO SILVA");
    }

    [Fact]
    public void Generate_WithoutName_DefaultName()
    {
        var card = _generator.Generate(CardBrand.Visa);
        card.CardholderName.Should().Be("CARDHOLDER/TEST");
    }

    // ── Brand detection ─────────────────────────────────────────────────────

    [Theory]
    [InlineData("4111111111111111", CardBrand.Visa)]
    [InlineData("5555555555554444", CardBrand.Mastercard)]
    [InlineData("378282246310005",  CardBrand.Amex)]
    public void DetectBrand_KnownPans_ReturnsCorrectBrand(string pan, CardBrand expected)
    {
        _generator.DetectBrand(pan).Should().Be(expected);
    }

    // ── ValidatePan ─────────────────────────────────────────────────────────

    [Fact]
    public void ValidatePan_ValidPan_ReturnsTrue()
    {
        CardGenerator.ValidatePan("4111111111111111").Should().BeTrue();
    }

    [Fact]
    public void ValidatePan_InvalidPan_ReturnsFalse()
    {
        CardGenerator.ValidatePan("4111111111111112").Should().BeFalse();
    }

    // ── Multiple generations produce different PANs ─────────────────────────

    [Fact]
    public void Generate_MultipleTimes_ProducesDifferentPans()
    {
        var pans = Enumerable.Range(0, 10)
            .Select(_ => _generator.Generate(CardBrand.Visa).Pan)
            .Distinct()
            .ToList();

        pans.Count.Should().BeGreaterThan(1, "generating 10 cards should produce at least 2 unique PANs");
    }

    // ── GenerateCustom ──────────────────────────────────────────────────────

    [Fact]
    public void GenerateCustom_WithBinPrefix_PanStartsWithPrefix()
    {
        var card = _generator.GenerateCustom("999999", 16, "TEST USER");
        card.Pan.Should().StartWith("999999");
        card.Pan.Should().HaveLength(16);
        LuhnAlgorithm.Validate(card.Pan).Should().BeTrue();
    }

    [Fact]
    public void GenerateCustom_InvalidPanLength_Throws()
    {
        var act = () => _generator.GenerateCustom("999999", 5);
        act.Should().Throw<ArgumentOutOfRangeException>();
    }
}
