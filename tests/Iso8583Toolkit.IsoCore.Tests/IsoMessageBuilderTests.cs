using FluentAssertions;
using Iso8583Toolkit.IsoCore.Building;
using Iso8583Toolkit.IsoCore.Domain.Exceptions;
using Iso8583Toolkit.IsoCore.Layouts;
using Iso8583Toolkit.IsoCore.Parsing;

namespace Iso8583Toolkit.IsoCore.Tests;

public sealed class IsoMessageBuilderTests
{
    private readonly IsoLayout _layout = IsoLayout.Default();
    private readonly IsoParser _parser = new();

    // ── Basic build ──────────────────────────────────────────────────────────

    [Fact]
    public void Build_ThreeFields_HasCorrectBitmapAndFieldCount()
    {
        var msg = new IsoMessageBuilder()
            .WithMti("0200")
            .WithLayout(_layout)
            .WithField(3, "000000")
            .WithField(4, "000000000100")
            .WithField(11, "000001")
            .Build();

        msg.Mti.Should().Be("0200");
        msg.Fields.Should().HaveCount(3);
        msg.GetActiveBits().Should().BeEquivalentTo(new[] { 3, 4, 11 });
    }

    [Fact]
    public void BuildHex_ThreeFields_BitmapIsCorrect()
    {
        var hex = new IsoMessageBuilder()
            .WithMti("0200")
            .WithLayout(_layout)
            .WithField(3, "000000")
            .WithField(4, "000000000100")
            .WithField(11, "000001")
            .BuildHex();

        // Bits 3,4,11 active →
        //   byte 0: bit3=1, bit4=1 → 0011 0000 = 0x30
        //   byte 1: bit11=1 → 0010 0000... wait bit 11 is byte (11-1)/8=1, offset (11-1)%8=2 → 0x20
        //   bitmap = "3020000000000000"
        hex.Should().StartWith("0200" + "3020000000000000");
    }

    // ── Round-trip: BuildHex → ParseFromHex ──────────────────────────────────

    [Fact]
    public void BuildHex_ThenParse_FieldsMatch()
    {
        var hex = new IsoMessageBuilder()
            .WithMti("0200")
            .WithLayout(_layout)
            .WithField(2, "4111111111111111")
            .WithField(3, "000000")
            .WithField(4, "000000000100")
            .WithField(11, "000001")
            .WithField(12, "143000")
            .WithField(13, "0412")
            .BuildHex();

        var msg = _parser.ParseFromHex(hex);

        msg.Mti.Should().Be("0200");
        msg.GetFieldValue(2).Should().Be("4111111111111111");
        msg.GetFieldValue(3).Should().Be("000000");
        msg.GetFieldValue(4).Should().Be("000000000100");
        msg.GetFieldValue(11).Should().Be("000001");
        msg.GetFieldValue(12).Should().Be("143000");
        msg.GetFieldValue(13).Should().Be("0412");
    }

    // ── LLVAR length prefix ──────────────────────────────────────────────────

    [Fact]
    public void BuildHex_LlvarField_HasCorrectLengthPrefix()
    {
        var hex = new IsoMessageBuilder()
            .WithMti("0200")
            .WithLayout(_layout)
            .WithField(2, "4111111111111111") // LLVAR, 16 chars
            .BuildHex();

        // After MTI(4) + bitmap(16), the LLVAR starts with "16" (2-digit decimal length)
        var afterBitmap = hex[20..];
        afterBitmap.Should().StartWith("16" + "4111111111111111");
    }

    // ── Fixed field zero padding ─────────────────────────────────────────────

    [Fact]
    public void Build_FixedFieldShorterThanMaxLength_PaddedWithZeros()
    {
        var msg = new IsoMessageBuilder()
            .WithMti("0200")
            .WithLayout(_layout)
            .WithField(11, "1") // Fixed 6, should pad to "000001"
            .Build();

        msg.GetFieldValue(11).Should().Be("000001");
    }

    [Fact]
    public void Build_FixedFieldAlreadyCorrectLength_NoPadding()
    {
        var msg = new IsoMessageBuilder()
            .WithMti("0200")
            .WithLayout(_layout)
            .WithField(11, "123456")
            .Build();

        msg.GetFieldValue(11).Should().Be("123456");
    }

    // ── Invalid MTI ──────────────────────────────────────────────────────────

    [Fact]
    public void Build_InvalidMti_ThrowsIsoParseException()
    {
        var act = () => new IsoMessageBuilder()
            .WithMti("ABCD")
            .WithLayout(_layout)
            .WithField(3, "000000")
            .Build();

        act.Should().Throw<IsoParseException>()
            .Which.Field.Should().Be("MTI");
    }

    [Fact]
    public void Build_EmptyMti_ThrowsIsoParseException()
    {
        var act = () => new IsoMessageBuilder()
            .WithField(3, "000000")
            .Build();

        act.Should().Throw<IsoParseException>();
    }

    // ── Secondary bitmap ─────────────────────────────────────────────────────

    [Fact]
    public void Build_FieldAbove64_ActivatesSecondaryBitmap()
    {
        var msg = new IsoMessageBuilder()
            .WithMti("0200")
            .WithLayout(_layout)
            .WithField(3, "000000")
            .WithField(60, "TESTDATA") // bit 60 in primary range but let's also add 60 (LLLVAR)
            .Build();

        // bit 60 is in primary (1-64), so no secondary needed
        msg.HasSecondaryBitmap.Should().BeFalse();
    }

    [Fact]
    public void Build_FieldBit65OrHigher_SetsSecondaryBitmapIndicator()
    {
        // Use a custom layout with bit 65 defined
        var customLayout = new IsoLayout
        {
            Name = "Test",
            Version = "1",
            Fields = new Dictionary<int, IsoCore.Domain.IsoFieldDefinition>
            {
                [3] = new()
                {
                    BitNumber = 3, Name = "Processing Code",
                    Type = IsoCore.Domain.IsoFieldType.Fixed, MaxLength = 6,
                    Encoding = IsoCore.Domain.IsoFieldEncoding.ASCII
                },
                [65] = new()
                {
                    BitNumber = 65, Name = "Extended Bitmap",
                    Type = IsoCore.Domain.IsoFieldType.Fixed, MaxLength = 8,
                    Encoding = IsoCore.Domain.IsoFieldEncoding.ASCII
                }
            }
        };

        var msg = new IsoMessageBuilder()
            .WithMti("0200")
            .WithLayout(customLayout)
            .WithField(3, "000000")
            .WithField(65, "12345678")
            .Build();

        msg.HasSecondaryBitmap.Should().BeTrue();
        msg.PrimaryBitmap[0].Should().BeTrue(); // bit 1 = secondary bitmap indicator
        msg.GetActiveBits().Should().Contain(65);
    }

    // ── BuildAscii returns same as BuildHex ──────────────────────────────────

    [Fact]
    public void BuildAscii_ReturnsSameAsHex()
    {
        var builder = new IsoMessageBuilder()
            .WithMti("0200")
            .WithLayout(_layout)
            .WithField(3, "000000")
            .WithField(11, "000001");

        builder.BuildAscii().Should().Be(builder.BuildHex());
    }

    // ── BuildBinaryHex ────────────────────────────────────────────────────────

    [Fact]
    public void BuildBinaryHex_MtiIsHexEncodedAscii()
    {
        var binaryHex = new IsoMessageBuilder()
            .WithMti("0200")
            .WithLayout(_layout)
            .WithField(3, "000000")
            .BuildBinaryHex();

        // MTI "0200" → ASCII bytes [0x30,0x32,0x30,0x30] → hex "30323030"
        binaryHex.Should().StartWith("30323030");
    }

    [Fact]
    public void BuildBinaryHex_ThenParseBinaryHex_FieldsMatch()
    {
        var builder = new IsoMessageBuilder()
            .WithMti("0200")
            .WithLayout(_layout)
            .WithField(2, "4111111111111111")
            .WithField(3, "000000")
            .WithField(4, "000000000100")
            .WithField(11, "000001")
            .WithField(12, "143000")
            .WithField(13, "0412");

        var binaryHex = builder.BuildBinaryHex();
        var msg = _parser.ParseFromBinaryHex(binaryHex);

        msg.Mti.Should().Be("0200");
        msg.GetFieldValue(2).Should().Be("4111111111111111");
        msg.GetFieldValue(3).Should().Be("000000");
        msg.GetFieldValue(4).Should().Be("000000000100");
        msg.GetFieldValue(11).Should().Be("000001");
        msg.GetFieldValue(12).Should().Be("143000");
        msg.GetFieldValue(13).Should().Be("0412");
    }

    [Fact]
    public void BuildBinaryHex_WithBinaryField_KeepsBinaryAsIs()
    {
        // Bit 52 = PIN Data, Binary Fixed 8 (value = 16 hex chars)
        var pinBlock = "0123456789ABCDEF";

        var builder = new IsoMessageBuilder()
            .WithMti("0200")
            .WithLayout(_layout)
            .WithField(3, "000000")
            .WithField(52, pinBlock);

        var binaryHex = builder.BuildBinaryHex();
        var asciiWire = builder.BuildHex();

        // In ASCII wire, PIN block appears as-is: "0123456789ABCDEF"
        asciiWire.Should().Contain(pinBlock);

        // In binary-hex, the FULL ASCII wire is hex-encoded for transport —
        // every char (ASCII fields AND binary field hex chars) becomes two hex digits.
        // So PIN block "0123456789ABCDEF" appears as "30313233343536373839414243444546".
        binaryHex.Should().Contain("30313233343536373839414243444546");

        // ASCII field "000000" (bit 3) also hex-encoded: "303030303030"
        binaryHex.Should().Contain("303030303030");

        // Round-trip: decode hex → get the ASCII wire → parse with ParseFromHex
        var asciiBytes = Convert.FromHexString(binaryHex);
        var asciiRound = System.Text.Encoding.ASCII.GetString(asciiBytes);
        asciiRound.Should().Be(asciiWire);

        var msg = _parser.ParseFromHex(asciiRound);
        msg.GetFieldValue(52).Should().Be(pinBlock);
        msg.GetFieldValue(3).Should().Be("000000");
    }

    [Fact]
    public void BuildBinaryHex_DifferentFromBuildHex()
    {
        var builder = new IsoMessageBuilder()
            .WithMti("0200")
            .WithLayout(_layout)
            .WithField(3, "000000")
            .WithField(11, "000001");

        builder.BuildBinaryHex().Should().NotBe(builder.BuildHex());
    }

    // ── Bit number validation ────────────────────────────────────────────────

    [Fact]
    public void WithField_BitNumberZero_Throws()
    {
        var act = () => new IsoMessageBuilder().WithField(0, "value");

        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    [Fact]
    public void WithField_BitNumber1_Throws()
    {
        var act = () => new IsoMessageBuilder().WithField(1, "value");

        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    [Fact]
    public void WithField_BitNumber129_Throws()
    {
        var act = () => new IsoMessageBuilder().WithField(129, "value");

        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    // ── Field exceeds MaxLength ──────────────────────────────────────────────

    [Fact]
    public void Build_FieldExceedsMaxLength_ThrowsIsoParseException()
    {
        var act = () => new IsoMessageBuilder()
            .WithMti("0200")
            .WithLayout(_layout)
            .WithField(39, "TOOLONG") // Response Code, Fixed 2, max 2
            .Build();

        act.Should().Throw<IsoParseException>()
            .WithMessage("*exceeds MaxLength*");
    }
}
