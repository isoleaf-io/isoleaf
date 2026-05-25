using FluentAssertions;
using Iso8583Toolkit.Cryptography.Tlv;

namespace Iso8583Toolkit.IsoCore.Tests;

public sealed class TlvParserPartialTests
{
    // All hex values below are arbitrary placeholders chosen for the test scenarios.

    [Fact]
    public void ParsePartial_CompleteValidTlv_ReturnsAllTagsNoErrors()
    {
        // Tag 9F08 (Application Version Number ICC) — len 02, value 1234
        // Tag 9F0D (IAC Default) — len 05, value 0000000000
        const string hex = "9F080212349F0D050000000000";

        var result = TlvParser.ParsePartial(hex);

        result.IsComplete.Should().BeTrue();
        result.ParseError.Should().BeNull();
        result.Tags.Should().HaveCount(2);
        result.Tags[0].Tag.Should().Be("9F08");
        result.Tags[0].Value.Should().Be("1234");
        result.Tags[1].Tag.Should().Be("9F0D");
        result.Tags[1].Value.Should().Be("0000000000");
        result.Warnings.Should().BeEmpty();
        result.ParsedBytes.Should().Be(result.TotalBytes);
        result.UnparsedHex.Should().BeNull();
    }

    [Fact]
    public void ParsePartial_LengthExceedsAvailableBytes_StopsAndReportsError()
    {
        // Tag 9F08 declares length=02 (2 bytes) but only 1 byte of value follows.
        const string hex = "9F080212";

        var result = TlvParser.ParsePartial(hex);

        result.IsComplete.Should().BeFalse();
        result.ParseError.Should().NotBeNullOrEmpty();
        result.ParseError.Should().Contain("9F08");
        result.UnparsedHex.Should().NotBeNullOrEmpty();
        result.ErrorAtByte.Should().NotBeNull();
        // Error happens before any tag is committed — nothing was successfully parsed.
        result.Tags.Should().BeEmpty();
    }

    [Fact]
    public void ParsePartial_UnknownTagFollowedByKnown_ReturnsBothWithWarning()
    {
        // Tag DD — not present in the registry, len 02, value ABCD.
        // Tag 8E (CVM List) — len 02, value 00FF.
        const string hex = "DD02ABCD8E0200FF";

        var result = TlvParser.ParsePartial(hex);

        result.IsComplete.Should().BeTrue();
        result.Tags.Should().HaveCount(2);
        result.Tags[0].Tag.Should().Be("DD");
        result.Tags[0].Name.Should().StartWith("Unknown");
        result.Tags[1].Tag.Should().Be("8E");
        result.Warnings.Should().HaveCountGreaterThanOrEqualTo(1);
        result.Warnings.Should().Contain(w => w.Contains("DD"));
    }

    [Fact]
    public void ParsePartial_WithHeaderSkip_StripsHeaderAndParsesRest()
    {
        // 4-byte arbitrary header, then 9F08+9F0D as in test 1.
        const string headerHex = "AABBCCDD";
        const string body = "9F080212349F0D050000000000";

        var result = TlvParser.ParsePartial(headerHex + body, headerBytes: 4);

        result.IsComplete.Should().BeTrue();
        result.Tags.Should().HaveCount(2);
        result.HeaderHex.Should().Be(headerHex);
        result.Tags[0].Tag.Should().Be("9F08");
        result.Tags[1].Tag.Should().Be("9F0D");
    }

    [Fact]
    public void ParsePartial_EmptyInput_ThrowsArgumentException()
    {
        var act = () => TlvParser.ParsePartial("");
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void ParsePartial_NonHexCharacters_ThrowsArgumentException()
    {
        var act = () => TlvParser.ParsePartial("9F08ZZ12");
        act.Should().Throw<ArgumentException>().WithMessage("*non-hex*");
    }

    [Fact]
    public void ParsePartial_OddLength_ThrowsArgumentException()
    {
        var act = () => TlvParser.ParsePartial("9F0802123"); // 9 chars
        act.Should().Throw<ArgumentException>().WithMessage("*odd length*");
    }
}
