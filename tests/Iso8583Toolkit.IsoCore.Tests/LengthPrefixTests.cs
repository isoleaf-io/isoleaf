using System.Text;
using FluentAssertions;
using Iso8583Toolkit.IsoCore.Domain.Exceptions;
using Iso8583Toolkit.IsoCore.Parsing;
using Xunit;

namespace Iso8583Toolkit.IsoCore.Tests;

/// <summary>
/// Tests for the optional 2-byte big-endian length prefix that may precede
/// the MTI (after the TPDU, when present) in true binary wire.
///
/// Detection is intentionally restricted to <see cref="IsoParser.ParseFromBinaryHex"/>:
/// in ASCII wire the characters "00FE" are literal ASCII bytes, not the binary
/// bytes 0x00 0xFE, so any heuristic would collide with real field data and
/// reject legitimate messages like "00FE..." as having a malformed MTI.
/// </summary>
public class LengthPrefixTests
{
    // Build a minimal ASCII-wire body, then translate it byte-by-byte into
    // the binary-hex representation (each ASCII char → its 1-byte hex value).
    // Bitmap 7230000000000000 → bits 2, 3, 4, 7, 11, 12 active.
    private const string AsciiBody =
        "02007230000000000000" +
        "163456789012345678" +
        "060000" +
        "000000000100" +
        "0605123000" +
        "000001" +
        "123000";

    private static string AsciiToBinaryHex(string ascii) =>
        Convert.ToHexString(Encoding.ASCII.GetBytes(ascii));

    [Fact]
    public void Parser_DetectsLengthPrefix_WhenValid_BinaryWire()
    {
        // Body is 78 ASCII bytes → prefix = 0x004E (= 78 decimal).
        var bodyHex = AsciiToBinaryHex(AsciiBody);
        var prefixHex = "004E";
        var wire = prefixHex + bodyHex;

        var msg = new IsoParser().ParseFromBinaryHex(wire);

        msg.LengthPrefix.Should().NotBeNull();
        msg.LengthPrefix!.Hex.Should().Be("004E");
        msg.LengthPrefix.ExpectedLength.Should().Be(78);
        msg.LengthPrefix.ActualLength.Should().Be(78);
        msg.LengthPrefix.Match.Should().BeTrue();
        msg.Mti.Should().Be("0200");
    }

    [Fact]
    public void Parser_DetectsLengthPrefix_BeforeTpdu_BinaryWire()
    {
        // Real TCP framing wraps the entire ISO message (including any TPDU)
        // with the length prefix: [prefix][TPDU][MTI][bitmap]...
        // So the declared length covers TPDU + body = 5 + 78 = 83 = 0x0053.
        var tpduHex = "6000010002";
        var bodyHex = AsciiToBinaryHex(AsciiBody);
        var prefixHex = "0053";
        var wire = prefixHex + tpduHex + bodyHex;

        var msg = new IsoParser().ParseFromBinaryHex(wire);

        msg.LengthPrefix.Should().NotBeNull();
        msg.LengthPrefix!.ExpectedLength.Should().Be(83);
        msg.LengthPrefix.Match.Should().BeTrue();
        msg.Tpdu.Should().Be("6000010002");
        msg.Mti.Should().Be("0200");
    }

    [Fact]
    public void Parser_IgnoresLengthPrefix_WhenNotPresent_BinaryWire()
    {
        // Just the body translated to binary-hex — no prefix bytes.
        var wire = AsciiToBinaryHex(AsciiBody);

        var msg = new IsoParser().ParseFromBinaryHex(wire);

        msg.LengthPrefix.Should().BeNull();
        msg.Mti.Should().Be("0200");
    }

    [Fact]
    public void Parser_NeverDetectsLengthPrefix_OnAsciiWire()
    {
        // Regression for the "00FE39313830..." crash: in ASCII wire we must
        // never try to interpret leading hex chars as a length prefix — they
        // are real ASCII characters and the parser should treat "00FE" as
        // the start of the MTI (which then fails MTI validation on its own,
        // surfacing a meaningful error instead of mis-stripping bytes).
        var asciiWithLeadingHex = "00FE" + AsciiBody.Substring(4);
        var act = () => new IsoParser().ParseFromHex(asciiWithLeadingHex);

        act.Should().Throw<Exception>()
            .WithMessage("*MTI*");
    }

    [Fact]
    public void Parser_StripsPrefixAndParsesFullMessage_OnSizeMismatch()
    {
        // Length prefix is informative-only: even when the declared length
        // disagrees with the actual payload, the parser must still strip the
        // 2 bytes and parse the FULL remaining payload (never truncate).
        // The UI surfaces the discrepancy via the Match=false flag.
        var bodyHex = AsciiToBinaryHex(AsciiBody);
        var wrongPrefix = "03E7"; // 999 decimal — body is only 78 ASCII chars
        var wire = wrongPrefix + bodyHex;

        var msg = new IsoParser().ParseFromBinaryHex(wire);

        msg.LengthPrefix.Should().NotBeNull();
        msg.LengthPrefix!.Hex.Should().Be("03E7");
        msg.LengthPrefix.ExpectedLength.Should().Be(999);
        msg.LengthPrefix.ActualLength.Should().Be(78);
        msg.LengthPrefix.Match.Should().BeFalse();
        msg.Mti.Should().Be("0200"); // parser proceeded past the divergent prefix
    }

    [Fact]
    public void LengthPrefix_DetectsCustomHexMti()
    {
        // Custom hex-character MTIs ("91FF", "A1B2") are used by proprietary
        // networks. The length-prefix detector must accept them — earlier
        // versions required strict 4-decimal-digits and would reject the
        // prefix outright, leaving the parser to crash on garbage bytes.
        //
        // Build a minimal wire: [prefix][MTI 91FF][rest...]. The downstream
        // MTI parser still rejects "91FF" (decimal-only), so the parse
        // ultimately fails AT MTI VALIDATION — proving the length prefix
        // got past its own check and stripped the 2 bytes cleanly.
        var content = Encoding.ASCII.GetBytes("91FF" + new string('0', 34)); // 38 bytes
        var wire = new byte[2 + content.Length];
        wire[0] = 0x00;
        wire[1] = 0x26; // 0x0026 = 38 → matches content.Length
        Array.Copy(content, 0, wire, 2, content.Length);
        var hex = Convert.ToHexString(wire);

        // Capture the exception to verify the prefix WAS stripped before the
        // MTI parser tripped on the non-decimal chars.
        var act = () => new IsoParser().ParseFromBinaryHex(hex);
        act.Should()
            .Throw<IsoParseException>()
            .Where(e => e.Field == "MTI" && e.Position == 2 && e.RawInput == "91FF");
    }

    [Fact]
    public void LengthPrefix_ParsesFullMessage_EvenWhenMismatch()
    {
        // Build a synthetic 38-byte ASCII-wire message:
        //   MTI "0200" (4) + bitmap with bit 2 active (16) + PAN LLVAR (18) = 38 bytes
        // Prefix declares 16, actual is 38 — clear mismatch. Parser must
        // still consume the full 38 bytes and surface bit 2.
        var bitmap = new byte[8];
        bitmap[0] = 0x40; // bit 2
        var bitmapHex = Convert.ToHexString(bitmap); // 16 ASCII hex chars

        const string pan = "4111111111111111";
        var body = $"0200{bitmapHex}{pan.Length:D2}{pan}";
        body.Length.Should().Be(38);

        var bodyBytes = Encoding.ASCII.GetBytes(body);
        var wire = new byte[2 + bodyBytes.Length];
        wire[0] = 0x00;
        wire[1] = 0x10; // 0x0010 = 16 — intentionally < 38
        Array.Copy(bodyBytes, 0, wire, 2, bodyBytes.Length);

        var msg = new IsoParser().ParseFromBinaryHex(Convert.ToHexString(wire));

        // Length prefix reported as mismatch — but parse succeeded fully.
        msg.LengthPrefix.Should().NotBeNull();
        msg.LengthPrefix!.ExpectedLength.Should().Be(16);
        msg.LengthPrefix.ActualLength.Should().Be(38);
        msg.LengthPrefix.Match.Should().BeFalse();
        msg.Mti.Should().Be("0200");
        msg.Fields[2].RawValue.Should().Be(pan);
    }

    [Fact]
    public void LengthPrefix_DoesNotMistakeTpduFirstByteAsLengthPrefix()
    {
        // Regression: an earlier version's discriminator was "first byte is
        // NOT a decimal digit", which incorrectly accepted TPDU IDs (0x60-0x6F)
        // as length-prefix candidates. A 5-byte TPDU + MTI wire would then
        // have its first 2 bytes silently stripped as a phantom length prefix.
        // Build a TPDU+MTI+bitmap+PAN wire and verify the TPDU is preserved.
        var bitmap = new byte[8];
        bitmap[0] = 0x40; // bit 2
        var bitmapHex = Convert.ToHexString(bitmap);
        const string pan = "4111111111111111";
        var body = Encoding.ASCII.GetBytes($"0200{bitmapHex}{pan.Length:D2}{pan}");
        var tpdu = new byte[] { 0x60, 0x00, 0x01, 0x00, 0x02 };
        var wire = new byte[tpdu.Length + body.Length];
        Array.Copy(tpdu, 0, wire, 0, tpdu.Length);
        Array.Copy(body, 0, wire, tpdu.Length, body.Length);

        var msg = new IsoParser().ParseFromBinaryHex(Convert.ToHexString(wire));

        msg.LengthPrefix.Should().BeNull("TPDU IDs must not match the length-prefix discriminator");
        msg.Tpdu.Should().Be("6000010002");
        msg.Mti.Should().Be("0200");
        msg.Fields[2].RawValue.Should().Be(pan);
    }

    [Fact]
    public void LengthPrefix_DetectedCorrectly_AsciiWireWithoutTpdu()
    {
        // Wire = [0x01 0xFE] + ASCII("0200" + bitmap-bit2 + LLVAR PAN).
        // Length prefix declares 510 (mismatch — body is 38 bytes) but the
        // parser must still strip the 2 bytes and parse the FULL payload.
        var bitmap = new byte[8];
        bitmap[0] = 0x40; // bit 2
        var bitmapHex = Convert.ToHexString(bitmap);
        const string pan = "4111111111111111";
        var body = Encoding.ASCII.GetBytes($"0200{bitmapHex}{pan.Length:D2}{pan}");
        var wire = new byte[2 + body.Length];
        wire[0] = 0x01;
        wire[1] = 0xFE;
        Array.Copy(body, 0, wire, 2, body.Length);

        var msg = new IsoParser().ParseFromBinaryHex(Convert.ToHexString(wire));

        msg.LengthPrefix.Should().NotBeNull();
        msg.LengthPrefix!.Hex.Should().Be("01FE");
        msg.Mti.Should().Be("0200");
        msg.Tpdu.Should().BeNull("no TPDU between prefix and MTI");
        msg.Fields[2].RawValue.Should().Be(pan);
    }

    [Fact]
    public void LengthPrefix_DetectedCorrectly_AsciiWireWithTpdu()
    {
        // Builder convention: TPDU is written as 10 ASCII hex chars on the
        // wire (not 5 raw binary bytes). The full layout is:
        //   [prefix 2B][TPDU 10 ASCII hex chars]["0200"][bitmap][PAN LLVAR]
        // Total payload after the prefix = 10 + 4 + 16 + 18 = 48 bytes; the
        // prefix declares 0x0030 = 48 → Match=true.
        var bitmap = new byte[8];
        bitmap[0] = 0x40; // bit 2
        var bitmapHex = Convert.ToHexString(bitmap);
        const string pan = "4111111111111111";
        const string tpduAsciiHex = "6000020001"; // 10 ASCII chars
        var body = Encoding.ASCII.GetBytes($"{tpduAsciiHex}0200{bitmapHex}{pan.Length:D2}{pan}");
        var wire = new byte[2 + body.Length];
        wire[0] = 0x00;
        wire[1] = (byte)body.Length; // 48
        Array.Copy(body, 0, wire, 2, body.Length);

        var msg = new IsoParser().ParseFromBinaryHex(Convert.ToHexString(wire));

        msg.LengthPrefix.Should().NotBeNull();
        msg.LengthPrefix!.Match.Should().BeTrue();
        msg.Tpdu.Should().Be("6000020001",
            "the parser must recognise the Builder-style 10-ASCII-hex-char TPDU");
        msg.Mti.Should().Be("0200");
        msg.Fields[2].RawValue.Should().Be(pan);
    }

    [Fact]
    public void LengthPrefix_DetectedCorrectly_BinaryHexWithTpdu()
    {
        // Layout: [prefix 2B][raw TPDU 5B][MTI 4B ASCII][bitmap][PAN LLVAR]
        // This is the failing case the user reported as "00AA6000020001…".
        // The TPDU bytes here are RAW (0x60 0x00 0x02 0x00 0x01) — not the
        // Builder-style ASCII-hex form — so IsBinaryHex must probe MTI at
        // hex-offset 14 to find it past the raw TPDU.
        var bitmap = new byte[8];
        bitmap[0] = 0x40; // bit 2
        var bitmapHex = Convert.ToHexString(bitmap);
        const string pan = "4111111111111111";
        var ascii = Encoding.ASCII.GetBytes($"0200{bitmapHex}{pan.Length:D2}{pan}");
        var tpdu  = new byte[] { 0x60, 0x00, 0x02, 0x00, 0x01 };
        var wire  = new byte[2 + tpdu.Length + ascii.Length];
        wire[0] = 0x00;
        wire[1] = 0xAA; // 0x00AA = 170 — deliberately mismatches actual
        Array.Copy(tpdu,  0, wire, 2,                  tpdu.Length);
        Array.Copy(ascii, 0, wire, 2 + tpdu.Length,    ascii.Length);

        var msg = new IsoParser().ParseFromBinaryHex(Convert.ToHexString(wire));

        msg.LengthPrefix.Should().NotBeNull();
        msg.LengthPrefix!.Hex.Should().Be("00AA");
        msg.LengthPrefix.ExpectedLength.Should().Be(170);
        msg.LengthPrefix.Match.Should().BeFalse();
        msg.Tpdu.Should().Be("6000020001",
            "the raw 5-byte TPDU between the prefix and MTI must still be detected");
        msg.Mti.Should().Be("0200");
        msg.Fields[2].RawValue.Should().Be(pan);
    }

    [Fact]
    public void LengthPrefix_AutoDetectRoutesLengthPrefixedWireToBinaryParser()
    {
        // Reproduces the user-reported "01-FE-39-31-..." bug: IsBinaryHex's
        // auto-detect only knew the [MTI] and [TPDU][MTI] layouts; messages
        // shaped as [length-prefix][MTI]... were routed to the ASCII-wire
        // fallback and failed at "Invalid MTI '01FE'". This test builds a
        // synthetic wire of the same shape and verifies the auto-detect now
        // recognizes it as binary-hex and the binary parser handles it.
        var bitmap = new byte[8];
        bitmap[0] = 0x40; // bit 2
        var bitmapHex = Convert.ToHexString(bitmap);
        const string pan = "4111111111111111";
        var body = Encoding.ASCII.GetBytes($"9180{bitmapHex}{pan.Length:D2}{pan}");
        var wire = new byte[2 + body.Length];
        wire[0] = 0x01;
        wire[1] = 0xFE; // declared = 510, actual = body.Length (clear mismatch)
        Array.Copy(body, 0, wire, 2, body.Length);
        var hexWire = Convert.ToHexString(wire);

        var msg = new IsoParser().ParseFromBinaryHex(hexWire);

        msg.LengthPrefix.Should().NotBeNull();
        msg.LengthPrefix!.Hex.Should().Be("01FE");
        msg.LengthPrefix.ExpectedLength.Should().Be(510);
        msg.LengthPrefix.Match.Should().BeFalse();
        msg.Mti.Should().Be("9180", "the parser must read MTI from after the stripped prefix");
        msg.Fields[2].RawValue.Should().Be(pan);
    }
}
