using FluentAssertions;
using Iso8583Toolkit.Cards.Luhn;

namespace Iso8583Toolkit.Cards.Tests;

public sealed class LuhnAlgorithmTests
{
    // ── Known valid PANs ────────────────────────────────────────────────────

    [Theory]
    [InlineData("4111111111111111")]   // Visa test card
    [InlineData("5500005555555559")]   // Mastercard test card
    [InlineData("5555555555554444")]   // Mastercard test card
    [InlineData("378282246310005")]    // Amex test card
    [InlineData("371449635398431")]    // Amex test card
    [InlineData("6011111111111117")]   // Discover test card
    [InlineData("4222222222222")]      // Visa 13-digit
    [InlineData("0")]                  // Edge: single zero is not valid (< 2 chars)
    public void Validate_KnownValidPans_ReturnsTrue(string pan)
    {
        if (pan.Length < 2)
            LuhnAlgorithm.Validate(pan).Should().BeFalse();
        else
            LuhnAlgorithm.Validate(pan).Should().BeTrue();
    }

    [Theory]
    [InlineData("4111111111111112")]   // Last digit wrong
    [InlineData("5500005555555550")]   // Last digit wrong
    [InlineData("1234567890123456")]   // Random invalid
    [InlineData("0000000000000001")]   // Invalid
    public void Validate_InvalidPans_ReturnsFalse(string pan)
    {
        LuhnAlgorithm.Validate(pan).Should().BeFalse();
    }

    // ── Edge cases ──────────────────────────────────────────────────────────

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Validate_NullOrWhitespace_ReturnsFalse(string? pan)
    {
        LuhnAlgorithm.Validate(pan!).Should().BeFalse();
    }

    [Fact]
    public void Validate_SingleDigit_ReturnsFalse()
    {
        LuhnAlgorithm.Validate("5").Should().BeFalse();
    }

    [Theory]
    [InlineData("41111111111111AB")]
    [InlineData("ABCDEFGHIJKLMNOP")]
    [InlineData("4111-1111-1111-1111")]
    public void Validate_NonNumeric_ReturnsFalse(string pan)
    {
        LuhnAlgorithm.Validate(pan).Should().BeFalse();
    }

    // ── Check digit calculation ─────────────────────────────────────────────

    [Fact]
    public void GetCheckDigit_Visa_ReturnsCorrectDigit()
    {
        // 4111111111111111 → check digit is 1
        LuhnAlgorithm.GetCheckDigit("411111111111111").Should().Be(1);
    }

    [Fact]
    public void GetCheckDigit_Mastercard_ReturnsCorrectDigit()
    {
        // 5500005555555559 → check digit is 9
        LuhnAlgorithm.GetCheckDigit("550000555555555").Should().Be(9);
    }

    [Fact]
    public void GetCheckDigit_Amex_ReturnsCorrectDigit()
    {
        // 378282246310005 → check digit is 5
        LuhnAlgorithm.GetCheckDigit("37828224631000").Should().Be(5);
    }

    // ── Calculate (full PAN) ────────────────────────────────────────────────

    [Fact]
    public void Calculate_ReturnsValidPan()
    {
        var pan = LuhnAlgorithm.Calculate("411111111111111");
        pan.Should().Be("4111111111111111");
        LuhnAlgorithm.Validate(pan).Should().BeTrue();
    }

    [Fact]
    public void Calculate_Mastercard_ReturnsValidPan()
    {
        var pan = LuhnAlgorithm.Calculate("550000555555555");
        pan.Should().Be("5500005555555559");
        LuhnAlgorithm.Validate(pan).Should().BeTrue();
    }

    // ── Error handling ──────────────────────────────────────────────────────

    [Fact]
    public void GetCheckDigit_NullInput_Throws()
    {
        var act = () => LuhnAlgorithm.GetCheckDigit(null!);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void GetCheckDigit_NonNumeric_Throws()
    {
        var act = () => LuhnAlgorithm.GetCheckDigit("41111ABCDE");
        act.Should().Throw<ArgumentException>().WithMessage("*digits*");
    }

    [Fact]
    public void Calculate_EmptyInput_Throws()
    {
        var act = () => LuhnAlgorithm.Calculate("");
        act.Should().Throw<ArgumentException>();
    }
}
