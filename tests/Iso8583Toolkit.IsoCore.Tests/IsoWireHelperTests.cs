using FluentAssertions;
using Iso8583Toolkit.IsoCore.Parsing;
using Xunit;

namespace Iso8583Toolkit.IsoCore.Tests;

/// <summary>
/// Unit tests for the centralized length-prefix and wire-byte-count helpers.
/// These also pin the contract used by the agent's injector and the frontend
/// — if any of these change shape, both downstream consumers need updates.
/// </summary>
public class IsoWireHelperTests
{
    // ── IsBinaryHex ──────────────────────────────────────────────────────────

    [Theory]
    [InlineData("0200", true)]
    [InlineData("30323030", true)]
    [InlineData("0200F23C24", true)]   // mixed digits and A-F
    [InlineData("abcdef01", true)]      // lowercase
    [InlineData("", false)]             // empty
    [InlineData("020", false)]          // odd length
    [InlineData("02 00", false)]        // whitespace
    [InlineData("02XY", false)]         // non-hex chars
    public void IsBinaryHex_RecognizesEvenLengthHexStrings(string input, bool expected)
    {
        IsoWireHelper.IsBinaryHex(input).Should().Be(expected);
    }

    // ── CalculateWireCharCount ───────────────────────────────────────────────

    [Fact]
    public void CalculatesCorrectCharCount_ForBinaryHex()
    {
        // 8 hex chars decode to 4 wire bytes (= 4 ASCII chars after decoding).
        IsoWireHelper.CalculateWireCharCount("30323030").Should().Be(4);
    }

    [Fact]
    public void CalculatesCorrectCharCount_ForAsciiWire()
    {
        // ASCII wire: each char is a byte on the wire. A string containing a
        // non-hex char ("Z") forces the ASCII branch — a purely-numeric wire
        // like "0200" is ambiguous (also valid hex), so we use mixed text
        // here to actually exercise the else branch.
        IsoWireHelper.CalculateWireCharCount("Hello World").Should().Be(11);
    }

    [Fact]
    public void CalculatesCorrectCharCount_ForLongerBinaryHex()
    {
        // A realistic-sized binary-hex wire — proves the /2 holds at scale.
        var hex = new string('3', 100); // 100 even-length hex chars
        IsoWireHelper.CalculateWireCharCount(hex).Should().Be(50);
    }

    // ── ToLengthPrefixHex ────────────────────────────────────────────────────

    [Theory]
    [InlineData(0, "0000")]
    [InlineData(4, "0004")]
    [InlineData(369, "0171")]
    [InlineData(65535, "FFFF")]
    [InlineData(65536, "FFFF")] // clamped
    [InlineData(-1, "0000")]    // clamped
    public void ToLengthPrefixHex_EncodesUint16BigEndian(int count, string expected)
    {
        IsoWireHelper.ToLengthPrefixHex(count).Should().Be(expected);
    }

    // ── StripLengthPrefix ────────────────────────────────────────────────────

    [Fact]
    public void StripsLengthPrefix_WhenDetected()
    {
        // "0004" (=4) + "30323030" (4 wire bytes after binary-hex decode).
        var input = "0004" + "30323030";

        var (payload, prefix) = IsoWireHelper.StripLengthPrefix(input);

        payload.Should().Be("30323030");
        prefix.Should().NotBeNull();
        prefix!.Hex.Should().Be("0004");
        prefix.ExpectedLength.Should().Be(4);
        prefix.ActualLength.Should().Be(4);
        prefix.Match.Should().BeTrue();
    }

    [Fact]
    public void StripsLengthPrefix_AndReportsMismatch()
    {
        // The wire from the user's bug report shape: "0171" declares 369 but
        // the payload is only 6 wire bytes (12 hex chars). Strip happens
        // either way; Match=false flags the discrepancy for the UI.
        var input = "0171" + "303230304632"; // 12 hex chars after prefix = 6 wire bytes

        var (payload, prefix) = IsoWireHelper.StripLengthPrefix(input);

        payload.Should().Be("303230304632");
        prefix!.ExpectedLength.Should().Be(369);
        prefix.ActualLength.Should().Be(6);
        prefix.Match.Should().BeFalse();
    }

    [Fact]
    public void DoesNotStrip_WhenFirstByteIsAsciiDigit()
    {
        // First byte 0x30 ('0') is the MTI's first char — not a length prefix.
        var input = "30323030F23C2481";
        var (payload, prefix) = IsoWireHelper.StripLengthPrefix(input);

        payload.Should().Be(input);
        prefix.Should().BeNull();
    }

    [Fact]
    public void DoesNotStrip_WhenWireIsNotBinaryHex()
    {
        // ASCII wire (the "F23C" looks hex but the whole thing isn't pure hex
        // when whitespace/non-hex creeps in) — the strip helper only runs on
        // confirmed binary-hex.
        var input = "Hello World";
        var (payload, prefix) = IsoWireHelper.StripLengthPrefix(input);

        payload.Should().Be(input);
        prefix.Should().BeNull();
    }
}
