using System.Text;
using FluentAssertions;
using Iso8583Toolkit.IsoCore.Parsing;
using Xunit;

namespace Iso8583Toolkit.IsoCore.Tests;

/// <summary>
/// Regression tests for the Bit 55 LLLVAR binary-wire bug.
///
/// Before the fix, <c>ParseVarFieldFromBytes</c> branched on whether the
/// next <c>len</c> bytes were all ASCII hex characters. When they weren't
/// (real-world TLV bytes like 0x9F, 0x6C, 0x82, …) it set
/// <c>bytesNeeded = len / 2</c>, which misaligned every subsequent field by
/// half of Bit 55's length — surfacing as a bogus error on a downstream
/// bit (typically Bit 61 or whichever LLVAR/LLLVAR field came next).
///
/// Both tests build the wire **synthetically** — no real PANs, real ARQCs
/// or real network captures are involved.
/// </summary>
public class Bit55RawBinaryTests
{
    /// <summary>
    /// Builds a minimal binary-hex wire with bits 2 and 55 active:
    ///   [MTI 0200][bitmap 4200…][PAN LLVAR][Bit 55 LLLVAR raw bytes]
    /// </summary>
    [Fact]
    public void Parser_ParsesBit55WithRawTlvBytes()
    {
        // Bitmap: only bits 2 and 55 active (no secondary). 1-based:
        //   bit 2  → byte 0 (B23A range), pos 0bit = bit 1's neighbour.
        //   bit 55 → byte 6, bit position 7.
        // Build the bitmap as raw 8 bytes then hex-encode it for the ASCII wire.
        var bitmapBytes = new byte[8];
        SetBit(bitmapBytes, 2);
        SetBit(bitmapBytes, 55);
        var bitmapHexAscii = Convert.ToHexString(bitmapBytes); // 16 ASCII hex chars

        // Bit 2: PAN, LLVAR n max 19 — synthetic 16-digit test PAN.
        const string pan = "4111111111111111";
        var bit2 = $"{pan.Length:D2}{pan}"; // "164111111111111111" — 18 chars

        // Bit 55: LLLVAR binary. Build a synthetic TLV blob with bytes that
        // are NOT all ASCII hex chars, so the parser must take the raw-bytes
        // path. The blob includes the 9F26 ARQC tag (3 header bytes + 8
        // value bytes) and one extra padding byte to exercise an odd length.
        var tlv = new byte[]
        {
            0x9F, 0x26, 0x08,                                  // ARQC tag + length 8
            0x11, 0x22, 0x33, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE,    // 8 fake ARQC bytes (mix hex/non-hex chars)
            0x6C,                                              // padding byte ('l' — NOT a hex digit)
        };
        var bit55Length = tlv.Length; // 12
        var bit55Prefix = bit55Length.ToString("D3");

        // Assemble the message as raw bytes, then hex-encode for ParseFromBinaryHex.
        using var ms = new MemoryStream();
        ms.Write(Encoding.ASCII.GetBytes("0200"));                       // MTI
        ms.Write(Encoding.ASCII.GetBytes(bitmapHexAscii));               // primary bitmap (16 ASCII hex chars)
        ms.Write(Encoding.ASCII.GetBytes(bit2));                         // PAN
        ms.Write(Encoding.ASCII.GetBytes(bit55Prefix));                  // "012"
        ms.Write(tlv);                                                   // raw TLV bytes
        var wire = Convert.ToHexString(ms.ToArray());

        var msg = new IsoParser().ParseFromBinaryHex(wire);

        msg.Mti.Should().Be("0200");
        msg.GetActiveBits().Should().BeEquivalentTo(new[] { 2, 55 });

        var bit55 = msg.Fields[55];
        bit55.RawValue.Length.Should().Be(bit55Length * 2,
            "binary fields surface their value as the hex-encoded byte sequence");
        bit55.RawValue.Should().Be(Convert.ToHexString(tlv));
    }

    /// <summary>
    /// Sanity: the Builder convention (Bit 55 value is ASCII bytes of its
    /// hex chars) must still parse correctly — same length count, different
    /// interpretation of the bytes that follow.
    /// </summary>
    [Fact]
    public void Parser_ParsesBit55WithBuilderHexAsciiConvention()
    {
        var bitmapBytes = new byte[8];
        SetBit(bitmapBytes, 2);
        SetBit(bitmapBytes, 55);
        var bitmapHexAscii = Convert.ToHexString(bitmapBytes);

        const string pan = "4111111111111111";
        var bit2 = $"{pan.Length:D2}{pan}";

        // Builder convention: write the TLV as ASCII hex chars in the wire.
        // Length declared = number of ASCII hex chars (== number of bytes
        // they occupy in the wire), NOT half of it.
        var tlvHexAscii = "9F26 08 1122 33AA BBCC DDEE".Replace(" ", "");  // 22 chars
        var bit55Prefix = tlvHexAscii.Length.ToString("D3");

        using var ms = new MemoryStream();
        ms.Write(Encoding.ASCII.GetBytes("0200"));
        ms.Write(Encoding.ASCII.GetBytes(bitmapHexAscii));
        ms.Write(Encoding.ASCII.GetBytes(bit2));
        ms.Write(Encoding.ASCII.GetBytes(bit55Prefix));
        ms.Write(Encoding.ASCII.GetBytes(tlvHexAscii));
        var wire = Convert.ToHexString(ms.ToArray());

        var msg = new IsoParser().ParseFromBinaryHex(wire);

        msg.GetActiveBits().Should().BeEquivalentTo(new[] { 2, 55 });
        // Builder convention surfaces the raw hex string the wire carried.
        msg.Fields[55].RawValue.Should().Be(tlvHexAscii);
    }

    /// <summary>Sets the bit numbered <paramref name="bitNumber"/> (1-based) in an 8-byte bitmap.</summary>
    private static void SetBit(byte[] bitmap, int bitNumber)
    {
        var byteIndex = (bitNumber - 1) / 8;
        var bitInByte = 7 - ((bitNumber - 1) % 8);
        bitmap[byteIndex] |= (byte)(1 << bitInByte);
    }
}
