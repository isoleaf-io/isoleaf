using FluentAssertions;
using Iso8583Toolkit.Cryptography.Tlv;

namespace Iso8583Toolkit.IsoCore.Tests;

public sealed class TlvParserTests
{
    // Properly formed TLV Bit 55 data (based on real EMV chip message from Phase 2)
    private const string ValidBit55 =
        "9F2608A1B2C3D4E5F60708" +   // Application Cryptogram (8 bytes)
        "9F270180" +                  // CID (1 byte = 0x80 ARQC)
        "9F100706010A03A40000" +      // IAD (7 bytes)
        "9F3704AABBCCDD" +            // Unpredictable Number (4 bytes)
        "9F3602001E" +                // ATC (2 bytes = 30 decimal)
        "95050080000400" +            // TVR (5 bytes)
        "9A03250115" +                // Transaction Date (3 bytes YYMMDD)
        "9C0100" +                    // Transaction Type (1 byte)
        "9F0206000000001000" +        // Amount Authorized (6 bytes)
        "5F2A020986" +                // Currency Code (2 bytes)
        "82021800" +                  // AIP (2 bytes)
        "9F1A020986" +                // Terminal Country Code (2 bytes)
        "9F0306000000000000";         // Amount Other (6 bytes)

    [Fact]
    public void Parse_ValidBit55_ParsesAllTags()
    {
        var tags = TlvParser.Parse(ValidBit55);
        tags.Should().HaveCount(13);
    }

    [Fact]
    public void Parse_ValidBit55_ArqcIs8Bytes()
    {
        var tags = TlvParser.Parse(ValidBit55);
        var arqc = tags.First(t => t.Tag == "9F26");

        arqc.Length.Should().Be(8);
        arqc.Value.Should().Be("A1B2C3D4E5F60708");
        arqc.Name.Should().Be("Application Cryptogram");
    }

    [Fact]
    public void Parse_ValidBit55_CidIsArqc()
    {
        var tags = TlvParser.Parse(ValidBit55);
        var cid = tags.First(t => t.Tag == "9F27");

        cid.Value.Should().Be("80");
        EmvTagRegistry.InterpretCryptogramType("80").Should().Be("ARQC");
    }

    [Fact]
    public void Parse_ValidBit55_AtcIs30()
    {
        var tags = TlvParser.Parse(ValidBit55);
        var atc = tags.First(t => t.Tag == "9F36");

        atc.Value.Should().Be("001E");
        Convert.ToInt32(atc.Value, 16).Should().Be(30);
    }

    [Fact]
    public void Parse_ValidBit55_TvrIs5Bytes()
    {
        var tags = TlvParser.Parse(ValidBit55);
        var tvr = tags.First(t => t.Tag == "95");

        tvr.Length.Should().Be(5);
        tvr.Value.Should().Be("0080000400");
    }

    [Fact]
    public void Parse_ValidBit55_AmountIs10Reais()
    {
        var tags = TlvParser.Parse(ValidBit55);
        var amount = tags.First(t => t.Tag == "9F02");

        amount.Value.Should().Be("000000001000");
        amount.Name.Should().Be("Amount Authorized");
    }

    [Fact]
    public void Parse_ValidBit55_TransactionDate()
    {
        var tags = TlvParser.Parse(ValidBit55);
        var date = tags.First(t => t.Tag == "9A");

        date.Value.Should().Be("250115");
    }

    // ── Round-trip ──────────────────────────────────────────────────────────

    [Fact]
    public void Parse_ThenToHex_RoundTrips()
    {
        var tags = TlvParser.Parse(ValidBit55);
        var reconstructed = TlvParser.ToHex(tags);

        reconstructed.Should().Be(ValidBit55.ToUpperInvariant());
    }

    // ── Tag name resolution ─────────────────────────────────────────────────

    [Fact]
    public void Parse_AllTagsHaveNames()
    {
        var tags = TlvParser.Parse(ValidBit55);

        foreach (var tag in tags)
        {
            tag.Name.Should().NotStartWith("Unknown",
                $"tag {tag.Tag} should have a known name");
        }
    }

    // ── Registry ────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("9F26", "Application Cryptogram")]
    [InlineData("9F27", "Cryptogram Information Data")]
    [InlineData("91",   "Issuer Authentication Data")]
    [InlineData("8A",   "Authorization Response Code")]
    [InlineData("71",   "Issuer Script Template 1")]
    [InlineData("72",   "Issuer Script Template 2")]
    public void EmvTagRegistry_KnownTags_ReturnsName(string tag, string expectedName)
    {
        EmvTagRegistry.GetName(tag).Should().Be(expectedName);
    }

    [Fact]
    public void EmvTagRegistry_UnknownTag_ReturnsUnknown()
    {
        EmvTagRegistry.GetName("FF99").Should().Contain("Unknown");
    }

    // ── CryptogramType interpretation ───────────────────────────────────────

    [Theory]
    [InlineData("80", "ARQC")]
    [InlineData("40", "TC")]
    [InlineData("00", "AAC")]
    public void InterpretCryptogramType_ReturnsCorrectType(string cid, string expected)
    {
        EmvTagRegistry.InterpretCryptogramType(cid).Should().Be(expected);
    }

    // ── Simple TLV ──────────────────────────────────────────────────────────

    [Fact]
    public void Parse_SingleTag_Works()
    {
        // Tag 9C, Length 01, Value 00
        var tags = TlvParser.Parse("9C0100");
        tags.Should().HaveCount(1);
        tags[0].Tag.Should().Be("9C");
        tags[0].Value.Should().Be("00");
        tags[0].IsPrimitive.Should().BeTrue();
    }

    [Fact]
    public void Parse_MultiByteLength_Works()
    {
        // Tag 9F10, Length 0x81 0x80 (128 bytes), Value = 128 bytes of zeros
        var value = new string('0', 256); // 128 bytes = 256 hex chars
        var hex = "9F108180" + value;
        var tags = TlvParser.Parse(hex);

        tags.Should().HaveCount(1);
        tags[0].Tag.Should().Be("9F10");
        tags[0].Length.Should().Be(128);
    }

    // ── Constructed tags ────────────────────────────────────────────────────

    [Fact]
    public void Parse_ConstructedTag71_IsConstructed()
    {
        // Tag 71 is constructed (bit 6 of 0x71 = 0111 0001, bit 6 = 1)
        // 0x71 = 0111 0001 → bit 6 (0x20) = 0010 0000 → 0x71 & 0x20 = 0x20 ≠ 0 → constructed
        var scriptData = "86058400040000"; // nested: tag 86, len 05, value
        var hex = "71" + (scriptData.Length / 2).ToString("X2") + scriptData;
        var tags = TlvParser.Parse(hex);

        tags.Should().HaveCount(1);
        tags[0].IsConstructed.Should().BeTrue();
    }

    // ── Response tags ───────────────────────────────────────────────────────

    [Fact]
    public void Parse_IssuerAuthData_Tag91()
    {
        // Tag 91, 10 bytes: ARPC (8 bytes) + Auth Code (2 bytes)
        var arpc = "0123456789ABCDEF";
        var authCode = "3030";
        var hex = "910A" + arpc + authCode;

        var tags = TlvParser.Parse(hex);
        tags.Should().HaveCount(1);
        tags[0].Tag.Should().Be("91");
        tags[0].Name.Should().Be("Issuer Authentication Data");
        tags[0].Length.Should().Be(10);
        tags[0].Value.Should().Be((arpc + authCode).ToUpperInvariant());
    }

    [Fact]
    public void Parse_ResponseBit55_WithTag91And8A()
    {
        var hex = "910A0123456789ABCDEF3030" + "8A023030";
        var tags = TlvParser.Parse(hex);

        tags.Should().HaveCount(2);
        tags[0].Tag.Should().Be("91");
        tags[1].Tag.Should().Be("8A");
        tags[1].Value.Should().Be("3030");
    }

    // ── Error handling ──────────────────────────────────────────────────────

    [Fact]
    public void Parse_EmptyString_Throws()
    {
        var act = () => TlvParser.Parse("");
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Parse_TruncatedData_Throws()
    {
        // Tag 9F26, Length 08, but only 4 bytes of value
        var act = () => TlvParser.Parse("9F260801020304");
        act.Should().Throw<FormatException>().WithMessage("*remain*");
    }
}
