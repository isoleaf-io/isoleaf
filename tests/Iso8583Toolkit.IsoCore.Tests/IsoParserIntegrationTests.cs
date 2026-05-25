using System.Text;
using FluentAssertions;
using Iso8583Toolkit.IsoCore.Parsing;

namespace Iso8583Toolkit.IsoCore.Tests;

/// <summary>
/// Integration tests that parse real-world ISO 8583 messages in both
/// ASCII wire format and binary-hex wire format.
/// </summary>
public sealed class IsoParserIntegrationTests
{
    private readonly IsoParser _parser = new();

    // Full EMV chip authorization (0100) with secondary bitmap (bit 127)
    private const string EmvChipMessage =
        "0100F23C650128E19250000000000000000216651680093265489000300000000000200004121936002365411936000412360502300760511000600002334" +
        "6516800932654890=2712201123456789023654100300023562233236556232323300SUPERMERCADO CENTRAL   SAO PAULO    SPBR" +
        "042CNP=01403229508000154*CDT=002T0*PRD=003070" +
        "9864F2A6B1C9D3E8A71" +
        "1669F2608A1B2C3D4E5F6079F2701809F100706010A03A400009F3704AABBCCDD9F3602001E950500800004009A032501159C01009F02060000000010005F2A020986820218009F1A0209869F0306000000000000" +
        "034                      078581000086" +
        "030POS00011CHIPCLSSY123456021.4.7" +
        "00512261";

    [Fact]
    public void ParseEmvChipMessage_AllFieldsMatchExpected()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);

        msg.Mti.Should().Be("0100");
        msg.HasSecondaryBitmap.Should().BeTrue();
    }

    [Fact]
    public void ParseEmvChipMessage_Bit2_Pan()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);
        msg.GetFieldValue(2).Should().Be("6516800932654890");
    }

    [Fact]
    public void ParseEmvChipMessage_Bit3_ProcessingCode()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);
        msg.GetFieldValue(3).Should().Be("003000");
    }

    [Fact]
    public void ParseEmvChipMessage_Bit4_Amount()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);
        msg.GetFieldValue(4).Should().Be("000000002000");
    }

    [Fact]
    public void ParseEmvChipMessage_Bit7_TransmissionDateTime()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);
        msg.GetFieldValue(7).Should().Be("0412193600");
    }

    [Fact]
    public void ParseEmvChipMessage_Bit11_Stan()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);
        msg.GetFieldValue(11).Should().Be("236541");
    }

    [Fact]
    public void ParseEmvChipMessage_Bit12_LocalTime()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);
        msg.GetFieldValue(12).Should().Be("193600");
    }

    [Fact]
    public void ParseEmvChipMessage_Bit13_LocalDate()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);
        msg.GetFieldValue(13).Should().Be("0412");
    }

    [Fact]
    public void ParseEmvChipMessage_Bit14_ExpirationDate()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);
        msg.GetFieldValue(14).Should().Be("3605");
    }

    [Fact]
    public void ParseEmvChipMessage_Bit18_MerchantType()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);
        msg.GetFieldValue(18).Should().Be("0230");
    }

    [Fact]
    public void ParseEmvChipMessage_Bit19_AcquiringCountryCode()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);
        msg.GetFieldValue(19).Should().Be("076");
    }

    [Fact]
    public void ParseEmvChipMessage_Bit22_PosEntryMode()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);
        msg.GetFieldValue(22).Should().Be("051");
    }

    [Fact]
    public void ParseEmvChipMessage_Bit24_Nii()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);
        msg.GetFieldValue(24).Should().Be("100");
    }

    [Fact]
    public void ParseEmvChipMessage_Bit32_AcquiringInstitutionId()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);
        msg.GetFieldValue(32).Should().Be("000023");
    }

    [Fact]
    public void ParseEmvChipMessage_Bit35_Track2()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);
        msg.GetFieldValue(35).Should().Be("6516800932654890=27122011234567890");
    }

    [Fact]
    public void ParseEmvChipMessage_Bit37_RetrievalReference()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);
        msg.GetFieldValue(37).Should().Be("236541003000");
    }

    [Fact]
    public void ParseEmvChipMessage_Bit41_TerminalId()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);
        msg.GetFieldValue(41).Should().Be("23562233");
    }

    [Fact]
    public void ParseEmvChipMessage_Bit42_MerchantId()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);
        msg.GetFieldValue(42).Should().Be("236556232323300");
    }

    [Fact]
    public void ParseEmvChipMessage_Bit43_CardAcceptorName()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);
        msg.GetFieldValue(43).Should().Be("SUPERMERCADO CENTRAL   SAO PAULO    SPBR");
    }

    [Fact]
    public void ParseEmvChipMessage_Bit48_AdditionalPrivateData()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);
        msg.GetFieldValue(48).Should().Be("CNP=01403229508000154*CDT=002T0*PRD=003070");
    }

    [Fact]
    public void ParseEmvChipMessage_Bit49_CurrencyCode()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);
        msg.GetFieldValue(49).Should().Be("986");
    }

    [Fact]
    public void ParseEmvChipMessage_Bit52_PinBlock()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);
        msg.GetFieldValue(52).Should().Be("4F2A6B1C9D3E8A71");
    }

    [Fact]
    public void ParseEmvChipMessage_Bit55_EmvData()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);

        var emv = msg.GetFieldValue(55);
        emv.Should().StartWith("9F2608A1B2C3D4E5F607");
        emv.Should().EndWith("9F0306000000000000");
        emv.Should().HaveLength(166);
    }

    [Fact]
    public void ParseEmvChipMessage_Bit58_ReservedNational()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);
        msg.GetFieldValue(58).Should().Be("                      078581000086");
    }

    [Fact]
    public void ParseEmvChipMessage_Bit60_ReservedPrivate()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);
        msg.GetFieldValue(60).Should().Be("POS00011CHIPCLSSY123456021.4.7");
    }

    [Fact]
    public void ParseEmvChipMessage_Bit127_ReservedPrivate()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);
        msg.GetFieldValue(127).Should().Be("12261");
    }

    [Fact]
    public void ParseEmvChipMessage_ActiveBitsCount()
    {
        var msg = _parser.ParseFromAscii(EmvChipMessage);

        // Bit 1 = secondary bitmap indicator, included by GetActiveBits()
        var expectedBits = new[] { 1, 2, 3, 4, 7, 11, 12, 13, 14, 18, 19, 22, 24, 32, 35, 37, 41, 42, 43, 48, 49, 52, 55, 58, 60, 127 };
        msg.GetActiveBits().Should().BeEquivalentTo(expectedBits);
    }

    // ── Binary-hex wire format ───────────────────────────────────────────────
    //
    // In binary-hex, the entire message is a hex-encoded byte stream:
    //   - ASCII fields: each character is 1 byte → 2 hex chars
    //   - Binary fields (PIN, EMV, MAC): raw bytes → 2 hex chars per byte
    //   - LLVAR/LLLVAR prefixes are ASCII digits → also hex-encoded
    //
    // The same EMV chip message re-encoded as binary-hex:
    //   Part 1: ASCII chars up to end of bit 49 → hex-encoded
    //   Part 2: bit 52 PIN Block (8 raw bytes) → stays hex
    //   Part 3: bit 55 LLLVAR prefix "166" → hex-encoded ASCII
    //   Part 4: bit 55 EMV value (83 raw bytes) → stays hex
    //   Part 5: remaining ASCII fields (bits 58, 60, 127) → hex-encoded

    private static string BuildBinaryHexMessage()
    {
        static string AsciiToHex(string ascii) => Convert.ToHexString(Encoding.ASCII.GetBytes(ascii));

        // Part 1: MTI + bitmaps + ASCII fields (bits 2..49) all as ASCII bytes
        var part1Ascii =
            "0100F23C650128E192500000000000000002" +  // MTI + primary + secondary bitmaps
            "166516800932654890" +                     // bit 2 LLVAR
            "003000" +                                 // bit 3
            "000000002000" +                           // bit 4
            "0412193600" +                             // bit 7
            "236541" +                                 // bit 11
            "193600" +                                 // bit 12
            "0412" +                                   // bit 13
            "3605" +                                   // bit 14
            "0230" +                                   // bit 18
            "076" +                                    // bit 19
            "051" +                                    // bit 22
            "100" +                                    // bit 24
            "06000023" +                               // bit 32 LLVAR
            "346516800932654890=27122011234567890" +   // bit 35 LLVAR
            "236541003000" +                           // bit 37
            "23562233" +                               // bit 41
            "236556232323300" +                        // bit 42
            "SUPERMERCADO CENTRAL   SAO PAULO    SPBR" + // bit 43
            "042CNP=01403229508000154*CDT=002T0*PRD=003070" + // bit 48 LLLVAR
            "986";                                     // bit 49

        // Part 2: bit 52 PIN Block — 8 raw bytes, already hex
        var part2PinBlock = "4F2A6B1C9D3E8A71";

        // Part 3: bit 55 LLLVAR prefix "166" as ASCII bytes
        var part3Prefix = AsciiToHex("166");

        // Part 4: bit 55 EMV value — 83 raw bytes, already hex
        var part4Emv =
            "9F2608A1B2C3D4E5F6079F2701809F100706010A03A400009F3704AABBCCDD" +
            "9F3602001E950500800004009A032501159C01009F02060000000010005F2A02" +
            "0986820218009F1A0209869F0306000000000000";

        // Part 5: remaining ASCII fields (bits 58, 60, 127) as ASCII bytes
        var part5Ascii =
            "034                      078581000086" +  // bit 58 LLLVAR
            "030POS00011CHIPCLSSY123456021.4.7" +      // bit 60 LLLVAR
            "00512261";                                // bit 127 LLLVAR

        return AsciiToHex(part1Ascii) + part2PinBlock + part3Prefix + part4Emv + AsciiToHex(part5Ascii);
    }

    [Fact]
    public void ParseBinaryHex_AllFieldsMatchExpected()
    {
        var hex = BuildBinaryHexMessage();
        var msg = _parser.ParseFromBinaryHex(hex);

        msg.Mti.Should().Be("0100");
        msg.HasSecondaryBitmap.Should().BeTrue();
    }

    [Fact]
    public void ParseBinaryHex_Bit2_Pan()
    {
        var msg = _parser.ParseFromBinaryHex(BuildBinaryHexMessage());
        msg.GetFieldValue(2).Should().Be("6516800932654890");
    }

    [Fact]
    public void ParseBinaryHex_Bit3_ProcessingCode()
    {
        var msg = _parser.ParseFromBinaryHex(BuildBinaryHexMessage());
        msg.GetFieldValue(3).Should().Be("003000");
    }

    [Fact]
    public void ParseBinaryHex_Bit4_Amount()
    {
        var msg = _parser.ParseFromBinaryHex(BuildBinaryHexMessage());
        msg.GetFieldValue(4).Should().Be("000000002000");
    }

    [Fact]
    public void ParseBinaryHex_Bit32_AcquiringInstitutionId()
    {
        var msg = _parser.ParseFromBinaryHex(BuildBinaryHexMessage());
        msg.GetFieldValue(32).Should().Be("000023");
    }

    [Fact]
    public void ParseBinaryHex_Bit35_Track2()
    {
        var msg = _parser.ParseFromBinaryHex(BuildBinaryHexMessage());
        msg.GetFieldValue(35).Should().Be("6516800932654890=27122011234567890");
    }

    [Fact]
    public void ParseBinaryHex_Bit43_CardAcceptorName()
    {
        var msg = _parser.ParseFromBinaryHex(BuildBinaryHexMessage());
        msg.GetFieldValue(43).Should().Be("SUPERMERCADO CENTRAL   SAO PAULO    SPBR");
    }

    [Fact]
    public void ParseBinaryHex_Bit48_AdditionalPrivateData()
    {
        var msg = _parser.ParseFromBinaryHex(BuildBinaryHexMessage());
        msg.GetFieldValue(48).Should().Be("CNP=01403229508000154*CDT=002T0*PRD=003070");
    }

    [Fact]
    public void ParseBinaryHex_Bit49_CurrencyCode()
    {
        var msg = _parser.ParseFromBinaryHex(BuildBinaryHexMessage());
        msg.GetFieldValue(49).Should().Be("986");
    }

    [Fact]
    public void ParseBinaryHex_Bit52_PinBlock()
    {
        var msg = _parser.ParseFromBinaryHex(BuildBinaryHexMessage());
        msg.GetFieldValue(52).Should().Be("4F2A6B1C9D3E8A71");
    }

    [Fact]
    public void ParseBinaryHex_Bit55_EmvData()
    {
        var msg = _parser.ParseFromBinaryHex(BuildBinaryHexMessage());

        var emv = msg.GetFieldValue(55);
        emv.Should().StartWith("9F2608A1B2C3D4E5F607");
        emv.Should().EndWith("9F0306000000000000");
        emv.Should().HaveLength(166);
    }

    [Fact]
    public void ParseBinaryHex_Bit58_ReservedNational()
    {
        var msg = _parser.ParseFromBinaryHex(BuildBinaryHexMessage());
        msg.GetFieldValue(58).Should().Be("                      078581000086");
    }

    [Fact]
    public void ParseBinaryHex_Bit60_ReservedPrivate()
    {
        var msg = _parser.ParseFromBinaryHex(BuildBinaryHexMessage());
        msg.GetFieldValue(60).Should().Be("POS00011CHIPCLSSY123456021.4.7");
    }

    [Fact]
    public void ParseBinaryHex_Bit127_ReservedPrivate()
    {
        var msg = _parser.ParseFromBinaryHex(BuildBinaryHexMessage());
        msg.GetFieldValue(127).Should().Be("12261");
    }

    [Fact]
    public void ParseBinaryHex_ActiveBitsMatchAsciiParse()
    {
        var asciiMsg = _parser.ParseFromAscii(EmvChipMessage);
        var binMsg   = _parser.ParseFromBinaryHex(BuildBinaryHexMessage());

        binMsg.GetActiveBits().Should().BeEquivalentTo(asciiMsg.GetActiveBits());
    }

    [Fact]
    public void ParseBinaryHex_AllFieldValuesMatchAsciiParse()
    {
        var asciiMsg = _parser.ParseFromAscii(EmvChipMessage);
        var binMsg   = _parser.ParseFromBinaryHex(BuildBinaryHexMessage());

        foreach (var bit in asciiMsg.GetActiveBits().Where(b => b > 1))
        {
            binMsg.GetFieldValue(bit).Should().Be(asciiMsg.GetFieldValue(bit),
                because: $"bit {bit} should match between ASCII and binary-hex parse");
        }
    }

    // ── Binary fields: explicit Binary-encoding tests ────────────────────────
    // All ISO 8583-1:1987 binary ("b") fields: 52, 55, 64, 65, 96, 128
    // These must NEVER be decoded as ASCII in binary-hex parse.

    [Fact]
    public void ParseBinaryHex_Bit64Mac_OutputsHexNotAscii()
    {
        // Minimal message: MTI + bitmap(bit 3 + bit 64 active) + bit3 + bit64(MAC)
        // Bitmap: bits 3,64 → byte0: bit3=1→0010_0000=0x20  byte7: bit64=1→0000_0001=0x01
        //   → "2000000000000001"
        static string A(string s) => Convert.ToHexString(Encoding.ASCII.GetBytes(s));

        var hex = A("0200")                       // MTI
                + A("2000000000000001")            // primary bitmap (ASCII hex)
                + A("003000")                      // bit 3 Fixed 6 ASCII
                + "AABBCCDD11223344";              // bit 64 MAC: 8 raw bytes

        var msg = _parser.ParseFromBinaryHex(hex);

        msg.GetFieldValue(64).Should().Be("AABBCCDD11223344");
    }

    [Fact]
    public void ParseBinaryHex_Bit96SecurityCode_OutputsHexNotAscii()
    {
        // Bitmap: bits 1(secondary),3 primary + bit 96 secondary
        // Primary: bit1=1,bit3=1 → 1010_0000 0000... = A000000000000000
        // Secondary: bit96 → bit (96-64)=32 → byte3: 0000_0001 = 00000001 00000000...
        //   → "0000000100000000"
        static string A(string s) => Convert.ToHexString(Encoding.ASCII.GetBytes(s));

        var hex = A("0200")                        // MTI
                + A("A000000000000000")             // primary bitmap
                + A("0000000100000000")             // secondary bitmap
                + A("003000")                       // bit 3
                + "FF00EE11DD22CC33";               // bit 96: 8 raw bytes

        var msg = _parser.ParseFromBinaryHex(hex);

        msg.GetFieldValue(96).Should().Be("FF00EE11DD22CC33");
    }

    [Fact]
    public void ParseBinaryHex_Bit128Mac_OutputsHexNotAscii()
    {
        // Primary: bit1=1,bit3=1 → A000000000000000
        // Secondary: bit128 → bit (128-64)=64 → last bit → 00000000 00000001
        //   → "0000000000000001"
        static string A(string s) => Convert.ToHexString(Encoding.ASCII.GetBytes(s));

        var hex = A("0200")
                + A("A000000000000000")
                + A("0000000000000001")
                + A("003000")
                + "1122334455667788";               // bit 128 MAC: 8 raw bytes

        var msg = _parser.ParseFromBinaryHex(hex);

        msg.GetFieldValue(128).Should().Be("1122334455667788");
    }

    // ── Auto-detection: non-ASCII bytes in ASCII-marked field ────────────────

    [Fact]
    public void ParseBinaryHex_AsciiFieldWithNonAsciiBytes_FallsBackToHex()
    {
        // Craft a message where bit 39 (Response Code, Fixed 2, ASCII) contains
        // bytes > 0x7F which cannot be valid ASCII.
        static string A(string s) => Convert.ToHexString(Encoding.ASCII.GetBytes(s));

        // Bitmap: bits 3,39 active
        //   byte0: bit3→0x20, byte4: bit39→0x02  →  "2000000002000000"
        var hex = A("0200")
                + A("2000000002000000")
                + A("003000")                       // bit 3
                + "FF80";                           // bit 39: 2 bytes with values > 0x7F

        var msg = _parser.ParseFromBinaryHex(hex);

        // Should output hex representation instead of corrupted ASCII ('?')
        msg.GetFieldValue(39).Should().Be("FF80");
        msg.GetFieldValue(39).Should().NotContain("?");
    }
}
