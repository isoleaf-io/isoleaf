using System.Text;
using FluentAssertions;
using Iso8583Toolkit.IsoCore.Parsing;
using Xunit;

namespace Iso8583Toolkit.IsoCore.Tests;

/// <summary>
/// Regression for the rebatedor's "Connection closed" symptom on Echo mode:
/// <see cref="IsoParser.ParseFromHex"/> called <c>Convert.FromHexString</c>
/// on Binary LL/LLL/LLLLVAR slices, which crashed with FormatException when
/// the slice had odd length or contained non-hex chars (typical for raw TLV
/// bytes in Bit 55). The parser now falls back to ASCII bytes in those
/// cases so Echo can surface the value unchanged.
/// </summary>
public class BinaryFieldParseSafetyTests
{
    [Fact]
    public void ParseFromHex_DoesNotThrow_OnOddLengthBinarySlice()
    {
        // Bit 55 LLLVAR Binary with declared length 7 — odd, so a strict
        // hex-decode would throw. Synthetic message: MTI + bitmap (bit 55
        // only) + length "007" + 7 chars.
        var bitmap = new byte[8];
        bitmap[6] |= 0x02; // bit 55 → byte 6, bit-in-byte 1 (mask 0x02)
        var bitmapHex = Convert.ToHexString(bitmap); // 16 hex chars
        var wire = "0200" + bitmapHex + "007" + "9F2608A"; // 7 chars

        var act = () => new IsoParser().ParseFromHex(wire);

        // Must not throw — fallback to ASCII bytes for the value.
        var msg = act.Should().NotThrow().Subject;
        msg.GetFieldValue(55).Should().Be("9F2608A");
    }

    [Fact]
    public void ParseFromHex_DoesNotThrow_OnNonHexCharsInBinarySlice()
    {
        // Bit 55 with 8 chars that include 'l' (0x6C, not a hex digit) —
        // mimics raw TLV bytes inlined into an ASCII wire. Strict hex
        // decode would throw on the 'l'.
        var bitmap = new byte[8];
        bitmap[6] |= 0x02;
        var bitmapHex = Convert.ToHexString(bitmap);
        var wire = "0200" + bitmapHex + "008" + "6Cl00969"; // 8 chars, 'l' = 0x6C

        var act = () => new IsoParser().ParseFromHex(wire);

        var msg = act.Should().NotThrow().Subject;
        msg.GetFieldValue(55).Should().Be("6Cl00969");
    }

    [Fact]
    public void Builder_DoesNotThrow_OnNonHexBinaryValue()
    {
        // Echo path: parser reads a Bit 55 value containing 'l' (raw TLV
        // byte), AutoResponder echoes it into the builder. Builder used to
        // crash here on Convert.FromHexString — must now round-trip.
        var msg = new Iso8583Toolkit.IsoCore.Building.IsoMessageBuilder()
            .WithMti("0210")
            .WithField(2, "4111111111111111")
            .WithField(55, "6Cl00969") // 'l' = 0x6C, not a hex digit
            .Build();

        msg.Should().NotBeNull();
        msg.GetFieldValue(55).Should().Be("6Cl00969");
    }

    [Fact]
    public void Builder_DoesNotThrow_OnOddLengthBinaryValue()
    {
        var msg = new Iso8583Toolkit.IsoCore.Building.IsoMessageBuilder()
            .WithMti("0210")
            .WithField(2, "4111111111111111")
            .WithField(55, "9F2608A") // 7 chars — odd length
            .Build();

        msg.GetFieldValue(55).Should().Be("9F2608A");
    }

    [Fact]
    public void ParseFromHex_StillDecodesValidHex_AsBytes()
    {
        // Sanity: when the slice IS clean hex, decode still produces the
        // raw bytes (the value field surfaces the original hex string).
        var bitmap = new byte[8];
        bitmap[6] |= 0x02;
        var bitmapHex = Convert.ToHexString(bitmap);
        var wire = "0200" + bitmapHex + "008" + "9F26080A"; // 8 chars, all hex

        var msg = new IsoParser().ParseFromHex(wire);

        msg.GetFieldValue(55).Should().Be("9F26080A");
    }
}
