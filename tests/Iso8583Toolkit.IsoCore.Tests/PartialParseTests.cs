using System.Text;
using FluentAssertions;
using Iso8583Toolkit.IsoCore.Domain.Exceptions;
using Iso8583Toolkit.IsoCore.Parsing;
using Xunit;

namespace Iso8583Toolkit.IsoCore.Tests;

/// <summary>
/// When the parser fails partway through the field loop, the thrown
/// <see cref="IsoParseException"/> must carry an <c>PartialMessage</c>
/// snapshot of everything parsed so far (MTI, bitmaps, fields up to N-1).
/// The API layer turns this into a partial result the UI can render.
/// </summary>
public class PartialParseTests
{
    [Fact]
    public void Parser_ReturnsPartialFields_WhenParseFailsMidway()
    {
        // Build a synthetic message where bits 2, 3, 4 parse fine but bit 11
        // is malformed. We do this with a LLVAR (bit 2 PAN) whose declared
        // length is well-formed, fixed-length bits 3 and 4 with valid digits,
        // and then truncate the wire before bit 11's required 6 bytes.
        var bitmap = new byte[8];
        SetBit(bitmap, 2);
        SetBit(bitmap, 3);
        SetBit(bitmap, 4);
        SetBit(bitmap, 11);
        var bitmapHex = Convert.ToHexString(bitmap);

        const string pan = "4111111111111111";
        const string processingCode = "000000";  // n6
        const string amount = "000000010000";    // n12
        // Bit 11 is n6 — we provide only 3 digits, so EnsureBytesAvailable trips.
        const string truncatedStan = "123";

        var body = Encoding.ASCII.GetBytes(
            $"0200{bitmapHex}{pan.Length:D2}{pan}{processingCode}{amount}{truncatedStan}");
        var hex = Convert.ToHexString(body);

        var act = () => new IsoParser().ParseFromBinaryHex(hex);
        var ex = act.Should().Throw<IsoParseException>().Which;

        ex.PartialMessage.Should().NotBeNull("the failure happened inside the field loop");
        ex.PartialMessage!.Mti.Should().Be("0200");
        ex.PartialMessage.Fields.Keys.Should().Contain(new[] { 2, 3, 4 },
            "bits 2/3/4 were parsed successfully before bit 11 broke");
        ex.PartialMessage.Fields.Should().NotContainKey(11);
        ex.PartialMessage.Fields[2].RawValue.Should().Be(pan);
        ex.PartialMessage.Fields[3].RawValue.Should().Be(processingCode);
        ex.PartialMessage.Fields[4].RawValue.Should().Be(amount);
        ex.Field.Should().StartWith("Bit");
    }

    [Fact]
    public void Parser_LeavesPartialMessageNull_WhenFailureIsBeforeFields()
    {
        // Invalid MTI — failure happens before the field loop even begins,
        // so there's no useful partial state to surface.
        const string wire = "XXXX"; // 4 chars but non-decimal MTI
        var hex = Convert.ToHexString(Encoding.ASCII.GetBytes(wire));

        var act = () => new IsoParser().ParseFromBinaryHex(hex);
        var ex = act.Should().Throw<IsoParseException>().Which;

        ex.PartialMessage.Should().BeNull(
            "the parser never reached the field loop, so there's nothing to attach");
        ex.Field.Should().Be("MTI");
    }

    private static void SetBit(byte[] bitmap, int bitNumber)
    {
        var byteIndex = (bitNumber - 1) / 8;
        var bitInByte = 7 - ((bitNumber - 1) % 8);
        bitmap[byteIndex] |= (byte)(1 << bitInByte);
    }
}
