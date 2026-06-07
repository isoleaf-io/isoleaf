using FluentAssertions;
using Iso8583Toolkit.Agent.Controllers;
using Iso8583Toolkit.Agent.Services;
using Xunit;

namespace Iso8583Toolkit.Agent.Tests;

/// <summary>
/// Unit-level coverage for the two fallbacks introduced after the
/// "Connection closed before reading full frame" investigation:
///   • IsoSessionHandler.BuildMinimalErrorResponseHex — what the rebatedor
///     emits when AutoResponder.BuildResponseHex throws.
///   • SimulatorController.BuildFramingMismatchError — friendly diagnostic
///     for an empty/closed response on the injetor side.
/// </summary>
public class ErrorResponseTests
{
    // ── BuildMinimalErrorResponseHex ─────────────────────────────────────────

    [Fact]
    public void MinimalErrorResponse_HasMtiBitmapAndRc()
    {
        // 0200 request → 0210 response (function digit incremented), bit 39 only,
        // RC = "96". Expected wire: "0210" + bitmap(bit 39) + "96".
        var wire = IsoSessionHandler.BuildMinimalErrorResponseHex("0210", "96");

        wire.Should().Be("02100000000002000000" + "96");
        wire.Length.Should().Be(22); // 4 MTI + 16 bitmap + 2 RC
    }

    [Fact]
    public void MinimalErrorResponse_FallsBackToSafeMti_WhenInvalid()
    {
        // An empty/weird responseMti shouldn't crash the helper — the whole
        // point of this method is to be the last resort.
        var wire = IsoSessionHandler.BuildMinimalErrorResponseHex("", "96");
        wire.Should().StartWith("9999");
    }

    [Fact]
    public void MinimalErrorResponse_FallsBackTo96_WhenRcInvalid()
    {
        var wire = IsoSessionHandler.BuildMinimalErrorResponseHex("0210", "");
        wire.Should().EndWith("96");
    }

    [Fact]
    public void MinimalErrorResponse_BitmapHasOnlyBit39()
    {
        // Sanity: the bitmap portion (chars 4..20) decodes to a byte array
        // with exactly bit 39 set. Bit 39 is in byte 4 (0-indexed), bit-mask
        // 0x02 (MSB-first 1-based: byte index 4, bit-in-byte 7-(39-1)%8 = 1).
        var wire = IsoSessionHandler.BuildMinimalErrorResponseHex("0210", "96");
        var bitmapHex = wire.Substring(4, 16);
        var bytes = Convert.FromHexString(bitmapHex);

        bytes.Should().HaveCount(8);
        bytes[4].Should().Be(0x02);
        // Every other byte zero — no stray bits.
        for (var i = 0; i < 8; i++)
        {
            if (i != 4) bytes[i].Should().Be(0x00);
        }
    }

    // ── BuildFramingMismatchError ───────────────────────────────────────────

    [Fact]
    public void FramingMismatchError_IncludesInjetorAndListenerHints_WhenPrefixOn()
    {
        var msg = SimulatorController.BuildFramingMismatchError(injectorIncludeLengthPrefix: true);

        msg.Should().Contain("Empty response");
        msg.Should().Contain("Injetor: IncludeLengthPrefix=ON");
        msg.Should().Contain("HeaderSize=2");
        msg.Should().Contain("Expect length prefix ON");
    }

    [Fact]
    public void FramingMismatchError_IncludesInjetorAndListenerHints_WhenPrefixOff()
    {
        var msg = SimulatorController.BuildFramingMismatchError(injectorIncludeLengthPrefix: false);

        msg.Should().Contain("Injetor: IncludeLengthPrefix=OFF");
        msg.Should().Contain("HeaderSize=0");
        msg.Should().Contain("Expect length prefix OFF");
    }
}
