using FluentAssertions;
using Iso8583Toolkit.IsoCore.Parsing;

namespace Iso8583Toolkit.IsoCore.Tests;

public sealed class BitmapEngineTests
{
    // ── ParseFromHex ─────────────────────────────────────────────────────────

    [Fact]
    public void ParseFromHex_KnownBitmap_ReturnsCorrectActiveBits()
    {
        // Hex: 7230000000000000
        // Binary: 0111 0010  0011 0000  0000 0000 ... (64 bits total)
        // Bit positions (1-based, MSB first):
        //   Byte 0 (0x72 = 0111 0010): bits 1-8  → bits 2,3,4,7 active
        //   Byte 1 (0x30 = 0011 0000): bits 9-16 → bits 11,12 active
        //   Bytes 2-7 (0x00): no active bits
        // Active: 2, 3, 4, 7, 11, 12
        var bitmap = BitmapEngine.ParseFromHex("7230000000000000");

        var activeBits = BitmapEngine.GetActiveBits(bitmap).ToList();

        activeBits.Should().BeEquivalentTo(new[] { 2, 3, 4, 7, 11, 12 });
    }

    [Fact]
    public void ParseFromHex_AllZeroes_ReturnsNoBits()
    {
        var bitmap = BitmapEngine.ParseFromHex("0000000000000000");

        BitmapEngine.GetActiveBits(bitmap).Should().BeEmpty();
    }

    [Fact]
    public void ParseFromHex_AllOnes_Returns64Bits()
    {
        var bitmap = BitmapEngine.ParseFromHex("FFFFFFFFFFFFFFFF");

        BitmapEngine.GetActiveBits(bitmap).Should()
            .HaveCount(64)
            .And.ContainInOrder(Enumerable.Range(1, 64));
    }

    [Fact]
    public void ParseFromHex_FirstByteFF_ReturnsFirst8Bits()
    {
        var bitmap = BitmapEngine.ParseFromHex("FF00000000000000");

        BitmapEngine.GetActiveBits(bitmap).Should()
            .BeEquivalentTo(new[] { 1, 2, 3, 4, 5, 6, 7, 8 });
    }

    [Fact]
    public void ParseFromHex_InvalidLength_Throws()
    {
        var act = () => BitmapEngine.ParseFromHex("7230");

        act.Should().Throw<ArgumentException>()
            .WithMessage("*16 characters*");
    }

    [Fact]
    public void ParseFromHex_Null_Throws()
    {
        var act = () => BitmapEngine.ParseFromHex(null!);

        act.Should().Throw<ArgumentNullException>();
    }

    // ── ParseFromBytes ───────────────────────────────────────────────────────

    [Fact]
    public void ParseFromBytes_KnownBytes_ReturnsExpectedBools()
    {
        // 0x80 = 1000 0000 → only bit 1 of byte 0 is set → global bit 1
        var bytes = new byte[] { 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };

        var bitmap = BitmapEngine.ParseFromBytes(bytes);

        bitmap[0].Should().BeTrue();
        bitmap.Skip(1).Should().AllSatisfy(b => b.Should().BeFalse());
    }

    [Fact]
    public void ParseFromBytes_WrongLength_Throws()
    {
        var act = () => BitmapEngine.ParseFromBytes(new byte[4]);

        act.Should().Throw<ArgumentException>()
            .WithMessage("*8 bytes*");
    }

    // ── ToHex / round-trip ───────────────────────────────────────────────────

    [Theory]
    [InlineData("7230000000000000")]
    [InlineData("FFFFFFFFFFFFFFFF")]
    [InlineData("0000000000000000")]
    [InlineData("8000000000000000")]
    [InlineData("F020000000000000")]
    public void ToHex_RoundTrip_ReturnsOriginalHex(string originalHex)
    {
        var bitmap = BitmapEngine.ParseFromHex(originalHex);
        var result = BitmapEngine.ToHex(bitmap);

        result.Should().Be(originalHex.ToUpperInvariant());
    }

    [Fact]
    public void ToBytes_RoundTrip_ReturnsSameBytes()
    {
        var original = new byte[] { 0x72, 0x30, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };

        var bitmap = BitmapEngine.ParseFromBytes(original);
        var result = BitmapEngine.ToBytes(bitmap);

        result.Should().Equal(original);
    }

    [Fact]
    public void ToBytes_WrongLength_Throws()
    {
        var act = () => BitmapEngine.ToBytes(new bool[10]);

        act.Should().Throw<ArgumentException>()
            .WithMessage("*64 elements*");
    }

    // ── IsSecondaryPresent ───────────────────────────────────────────────────

    [Fact]
    public void IsSecondaryPresent_Bit1Active_ReturnsTrue()
    {
        // 0x80 = 1000 0000 → bit 1 is set
        var bitmap = BitmapEngine.ParseFromBytes(
            new byte[] { 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 });

        BitmapEngine.IsSecondaryPresent(bitmap).Should().BeTrue();
    }

    [Fact]
    public void IsSecondaryPresent_Bit1Inactive_ReturnsFalse()
    {
        // 0x72 = 0111 0010 → bit 1 is NOT set
        var bitmap = BitmapEngine.ParseFromHex("7230000000000000");

        BitmapEngine.IsSecondaryPresent(bitmap).Should().BeFalse();
    }

    [Fact]
    public void IsSecondaryPresent_AllBitsActive_ReturnsTrue()
    {
        var bitmap = BitmapEngine.ParseFromHex("FFFFFFFFFFFFFFFF");

        BitmapEngine.IsSecondaryPresent(bitmap).Should().BeTrue();
    }

    [Fact]
    public void IsSecondaryPresent_EmptyArray_ReturnsFalse()
    {
        BitmapEngine.IsSecondaryPresent(Array.Empty<bool>()).Should().BeFalse();
    }

    [Fact]
    public void IsSecondaryPresent_Null_Throws()
    {
        var act = () => BitmapEngine.IsSecondaryPresent(null!);

        act.Should().Throw<ArgumentNullException>();
    }

    // ── GetActiveBits ────────────────────────────────────────────────────────

    [Fact]
    public void GetActiveBits_SingleBitSet_ReturnsThatBit()
    {
        // Bit 64 = LSB of last byte = 0x01 in byte 7
        var bytes = new byte[] { 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01 };
        var bitmap = BitmapEngine.ParseFromBytes(bytes);

        BitmapEngine.GetActiveBits(bitmap).Should().ContainSingle()
            .Which.Should().Be(64);
    }

    [Fact]
    public void GetActiveBits_Null_Throws()
    {
        var act = () => BitmapEngine.GetActiveBits(null!).ToList();

        act.Should().Throw<ArgumentNullException>();
    }
}
