using Iso8583Toolkit.Simulator.Framing;
using FluentAssertions;
using Iso8583Toolkit.Agent.Services;
using Xunit;

namespace Iso8583Toolkit.Agent.Tests;

/// <summary>
/// Covers the un-framed mode (HeaderSize=0) added for POS terminals and
/// legacy systems that send "1 connect = 1 message" without a length prefix.
/// The framed modes (2/4 byte big-endian length) are exercised end-to-end
/// by the rebatedor integration tests.
/// </summary>
public class MessageFramerTests
{
    [Fact]
    public void Constructor_RejectsHeaderSizesOtherThan_0_2_4()
    {
        var act1 = () => new LengthPrefixMessageFramer(headerSize: 1);
        var act3 = () => new LengthPrefixMessageFramer(headerSize: 3);
        var act5 = () => new LengthPrefixMessageFramer(headerSize: 5);
        act1.Should().Throw<ArgumentException>();
        act3.Should().Throw<ArgumentException>();
        act5.Should().Throw<ArgumentException>();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(2)]
    [InlineData(4)]
    public void Constructor_AcceptsValidHeaderSizes(int size)
    {
        var act = () => new LengthPrefixMessageFramer(headerSize: size);
        act.Should().NotThrow();
    }

    [Fact]
    public async Task ReadsEntirePayload_WhenHeaderSizeIsZero()
    {
        // Un-framed mode: the message is delivered verbatim with no length
        // prefix; the reader drains until the (in-memory) stream ends.
        var payload = new byte[] { 0x30, 0x32, 0x30, 0x30, 0xF2, 0x3C, 0x24, 0x81 };
        using var stream = new MemoryStream(payload);
        var framer = new LengthPrefixMessageFramer(headerSize: 0);

        var read = await framer.ReadMessageAsync(stream);

        read.Should().NotBeNull();
        read.Should().BeEquivalentTo(payload);
    }

    [Fact]
    public async Task ReturnsNull_WhenStreamIsEmpty_HeaderSizeZero()
    {
        using var stream = new MemoryStream([]);
        var framer = new LengthPrefixMessageFramer(headerSize: 0);

        var read = await framer.ReadMessageAsync(stream);

        read.Should().BeNull("no bytes arrived before close — caller should drop the connection");
    }

    [Fact]
    public async Task WritesPayloadVerbatim_WhenHeaderSizeIsZero()
    {
        // No length prefix on the wire — only the body bytes are written.
        var payload = new byte[] { 0x9F, 0x26, 0x08, 0x11, 0x22 };
        using var stream = new MemoryStream();
        var framer = new LengthPrefixMessageFramer(headerSize: 0);

        await framer.WriteMessageAsync(stream, payload);

        stream.ToArray().Should().BeEquivalentTo(payload);
    }

    [Fact]
    public async Task ReadsLengthPrefixedPayload_WhenHeaderSizeIs2()
    {
        // Regression sanity for the legacy mode — proves the 0-byte branch
        // didn't accidentally short-circuit the framed path.
        var payload = new byte[] { 0x30, 0x32, 0x30, 0x30 }; // "0200"
        var wire = new byte[] { 0x00, 0x04, 0x30, 0x32, 0x30, 0x30 };
        using var stream = new MemoryStream(wire);
        var framer = new LengthPrefixMessageFramer(headerSize: 2);

        var read = await framer.ReadMessageAsync(stream);

        read.Should().BeEquivalentTo(payload);
    }
}
