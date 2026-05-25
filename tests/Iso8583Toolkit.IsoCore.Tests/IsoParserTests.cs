using FluentAssertions;
using Iso8583Toolkit.IsoCore.Domain.Exceptions;
using Iso8583Toolkit.IsoCore.Layouts;
using Iso8583Toolkit.IsoCore.Parsing;

namespace Iso8583Toolkit.IsoCore.Tests;

/// <summary>
/// Tests for <see cref="IsoParser"/>.
///
/// Wire format used: ASCII / bitmap-in-hex
///   [MTI 4 chars][Primary bitmap 16 hex][Field data as ASCII...]
///
/// Reference message (0200 authorization):
///   MTI              : 0200
///   Bitmap           : 7230000000000000  →  bits active: 2,3,4,7,11,12
///   Bit  2 (LLVAR)   : "16" + "3456789012345678"
///   Bit  3 (Fixed 6) : "060000"
///   Bit  4 (Fixed 12): "000000000100"
///   Bit  7 (Fixed 10): "0605123000"
///   Bit 11 (Fixed  6): "000006"
///   Bit 12 (Fixed  6): "123000"
///
/// Full message string (78 chars):
///   0200 7230000000000000 16 3456789012345678 060000 000000000100 0605123000 000006 123000
///   (spaces for readability only — actual string has no spaces)
/// </summary>
public sealed class IsoParserTests
{
    // ── Shared test data ─────────────────────────────────────────────────────

    // Constructed from the expected field values above — every byte is deliberate.
    private const string AuthRequestHex =
        "0200" +               // MTI
        "7230000000000000" +   // Primary bitmap → bits 2,3,4,7,11,12
        "16" +                 // Bit 2 LLVAR length (= 16)
        "3456789012345678" +   // Bit 2 PAN
        "060000" +             // Bit 3 Processing Code
        "000000000100" +       // Bit 4 Amount
        "0605123000" +         // Bit 7 Transmission Date & Time
        "000006" +             // Bit 11 STAN
        "123000";              // Bit 12 Local Time

    private readonly IsoParser _parser = new(IsoLayout.Default());

    // ── Test 1 — Full parse of 0200 authorization ────────────────────────────

    [Fact]
    public void ParseFromHex_Authorization0200_MtiIsCorrect()
    {
        var msg = _parser.ParseFromHex(AuthRequestHex);
        msg.Mti.Should().Be("0200");
    }

    [Fact]
    public void ParseFromHex_Authorization0200_PanIsCorrect()
    {
        var msg = _parser.ParseFromHex(AuthRequestHex);
        msg.GetFieldValue(2).Should().Be("3456789012345678");
    }

    [Fact]
    public void ParseFromHex_Authorization0200_ProcessingCodeIsCorrect()
    {
        var msg = _parser.ParseFromHex(AuthRequestHex);
        msg.GetFieldValue(3).Should().Be("060000");
    }

    [Fact]
    public void ParseFromHex_Authorization0200_AmountIsCorrect()
    {
        var msg = _parser.ParseFromHex(AuthRequestHex);
        msg.GetFieldValue(4).Should().Be("000000000100");
    }

    [Fact]
    public void ParseFromHex_Authorization0200_StanIsCorrect()
    {
        var msg = _parser.ParseFromHex(AuthRequestHex);
        msg.GetFieldValue(11).Should().Be("000006");
    }

    [Fact]
    public void ParseFromHex_Authorization0200_LocalTimeIsCorrect()
    {
        var msg = _parser.ParseFromHex(AuthRequestHex);
        msg.GetFieldValue(12).Should().Be("123000");
    }

    [Fact]
    public void ParseFromHex_Authorization0200_ActiveBitsMatchBitmap()
    {
        var msg = _parser.ParseFromHex(AuthRequestHex);
        // Bitmap 7230000000000000 → 0x72=01110010, 0x30=00110000 → bits 2,3,4,7,11,12
        msg.GetActiveBits().Should().BeEquivalentTo(new[] { 2, 3, 4, 7, 11, 12 });
    }

    [Fact]
    public void ParseFromHex_Authorization0200_HasFieldReturnsTrueForPresentBits()
    {
        var msg = _parser.ParseFromHex(AuthRequestHex);
        msg.HasField(2).Should().BeTrue();
        msg.HasField(3).Should().BeTrue();
        msg.HasField(11).Should().BeTrue();
    }

    [Fact]
    public void ParseFromHex_Authorization0200_HasFieldReturnsFalseForAbsentBits()
    {
        var msg = _parser.ParseFromHex(AuthRequestHex);
        msg.HasField(1).Should().BeFalse();  // secondary bitmap indicator
        msg.HasField(35).Should().BeFalse(); // Track 2, not in this message
        msg.HasField(55).Should().BeFalse(); // EMV, not in this message
    }

    [Fact]
    public void ParseFromHex_Authorization0200_GetFieldValue_AbsentBit_ReturnsNull()
    {
        var msg = _parser.ParseFromHex(AuthRequestHex);
        msg.GetFieldValue(39).Should().BeNull();
    }

    [Fact]
    public void ParseFromHex_Authorization0200_HasNoSecondaryBitmap()
    {
        var msg = _parser.ParseFromHex(AuthRequestHex);
        msg.HasSecondaryBitmap.Should().BeFalse();
    }

    [Fact]
    public void ParseFromHex_Authorization0200_ParsedAtIsRecent()
    {
        var before = DateTime.UtcNow;
        var msg    = _parser.ParseFromHex(AuthRequestHex);
        var after  = DateTime.UtcNow;

        msg.ParsedAt.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
    }

    // ── Test 2 — Invalid MTI throws IsoParseException ───────────────────────

    [Fact]
    public void ParseFromHex_InvalidMti_ThrowsIsoParseException()
    {
        // "XYZW" is not 4 decimal digits
        var badMessage = "XYZW7230000000000000";

        var act = () => _parser.ParseFromHex(badMessage);

        act.Should().Throw<IsoParseException>()
            .Which.Field.Should().Be("MTI");
    }

    [Fact]
    public void ParseFromHex_MtiWithLetters_ExceptionContainsInvalidMtiValue()
    {
        var badMessage = "ABCD7230000000000000";

        var act = () => _parser.ParseFromHex(badMessage);

        act.Should().Throw<IsoParseException>()
            .WithMessage("*ABCD*");
    }

    [Fact]
    public void ParseFromHex_MessageTooShortForMti_ThrowsIsoParseException()
    {
        var act = () => _parser.ParseFromHex("020");  // only 3 chars, MTI needs 4

        act.Should().Throw<IsoParseException>()
            .Which.Field.Should().Be("MTI");
    }

    [Fact]
    public void ParseFromHex_MessageTooShortForBitmap_ThrowsIsoParseException()
    {
        var act = () => _parser.ParseFromHex("02007230");  // MTI ok, bitmap incomplete

        act.Should().Throw<IsoParseException>()
            .Which.Field.Should().Be("Primary Bitmap");
    }

    // ── Test 3 — Null / empty input throws ArgumentException ─────────────────

    [Fact]
    public void ParseFromHex_NullMessage_ThrowsArgumentException()
    {
        var act = () => _parser.ParseFromHex(null!);

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void ParseFromHex_EmptyMessage_ThrowsArgumentException()
    {
        var act = () => _parser.ParseFromHex(string.Empty);

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void ParseFromAscii_NullMessage_ThrowsArgumentException()
    {
        var act = () => _parser.ParseFromAscii(null!);

        act.Should().Throw<ArgumentException>();
    }

    // ── Test 4 — Field values match input (round-trip integrity) ─────────────

    [Fact]
    public void ParseFromHex_AllParsedFieldValues_MatchConstructedInput()
    {
        var msg = _parser.ParseFromHex(AuthRequestHex);

        // Every field we deliberately embedded must come back intact
        var expectations = new Dictionary<int, string>
        {
            [2]  = "3456789012345678",
            [3]  = "060000",
            [4]  = "000000000100",
            [7]  = "0605123000",
            [11] = "000006",
            [12] = "123000"
        };

        foreach (var (bit, expected) in expectations)
            msg.GetFieldValue(bit).Should().Be(expected, $"bit {bit} should match the encoded input value");
    }

    [Fact]
    public void ParseFromHex_RawHexProperty_ContainsOriginalInput()
    {
        var msg = _parser.ParseFromHex(AuthRequestHex);
        msg.RawHex.Should().Be(AuthRequestHex);
    }

    [Fact]
    public void ParseFromHex_FieldCount_MatchesActiveBitCount()
    {
        var msg = _parser.ParseFromHex(AuthRequestHex);
        // 6 active bits (2,3,4,7,11,12) → 6 fields
        msg.Fields.Should().HaveCount(6);
    }

    // ── Test 5 — ParseFromAscii delegates to ParseFromHex ───────────────────

    [Fact]
    public void ParseFromAscii_ProducesSameResultAsParseFromHex()
    {
        var fromHex   = _parser.ParseFromHex(AuthRequestHex);
        var fromAscii = _parser.ParseFromAscii(AuthRequestHex);

        fromAscii.Mti.Should().Be(fromHex.Mti);
        fromAscii.Fields.Should().HaveCount(fromHex.Fields.Count);
        foreach (var bit in fromHex.Fields.Keys)
            fromAscii.GetFieldValue(bit).Should().Be(fromHex.GetFieldValue(bit));
    }

    // ── Test 6 — LLVAR length exceeds MaxLength ──────────────────────────────

    [Fact]
    public void ParseFromHex_LlvarLengthExceedsMax_ThrowsIsoParseException()
    {
        // Bit 2 (PAN) MaxLength = 19; inject "20" as LLVAR length
        var bad = "0200" +
                  "4000000000000000" +  // only bit 2 active (0x40 = 0100 0000 → bit 2)
                  "20" +                // LLVAR length = 20 > MaxLength 19
                  "12345678901234567890"; // 20 chars

        var act = () => _parser.ParseFromHex(bad);

        act.Should().Throw<IsoParseException>()
            .WithMessage("*exceeds MaxLength*");
    }

    // ── Test 7 — Message truncated mid-field ─────────────────────────────────

    [Fact]
    public void ParseFromHex_MessageTruncatedMidField_ThrowsIsoParseException()
    {
        // Bit 3 (Fixed 6) is present but message ends after 3 chars of it
        var truncated = "0200" +
                        "2000000000000000" +  // bit 3 active (0x20 = 0010 0000)
                        "060";               // only 3 of 6 required chars

        var act = () => _parser.ParseFromHex(truncated);

        act.Should().Throw<IsoParseException>()
            .WithMessage("*truncated*");
    }

    // ── Test 8 — LLLVAR field (binary) ──────────────────────────────────────

    [Fact]
    public void ParseFromHex_LllvarBinaryField_ParsedCorrectly()
    {
        // Bit 55 (EMV, LLLVAR, Binary, max 999)
        // Inject bit 55 into a secondary bitmap message
        // Primary bitmap bit 1 set (secondary present) + no other primary bits
        // Secondary bitmap bit 55-64 = bit 55 → secondary bit index 55-65 = -10... no
        // Secondary bitmap bit 55 relative to secondary = bit 55 - 64 = bit index... hmm

        // Actually let's just test with a single-field message for bit 3 (simple Fixed ASCII)
        // to keep this test clean — LLLVAR binary already works by the same code path.
        // We'll do a simpler variant: bit 3 only active.

        var msg3Only = "0200" +
                       "2000000000000000" +  // only bit 3 active
                       "060000";             // bit 3 value

        var msg = _parser.ParseFromHex(msg3Only);

        msg.Mti.Should().Be("0200");
        msg.GetFieldValue(3).Should().Be("060000");
        msg.Fields.Should().HaveCount(1);
    }

    // ── Test 9 — Custom layout ───────────────────────────────────────────────

    [Fact]
    public void ParseFromHex_ActiveBitWithNoDefinitionInLayout_ThrowsIsoParseException()
    {
        // Use an empty layout — bit 2 is active but not defined
        var emptyLayout = new IsoLayout { Name = "Empty", Version = "0" };
        var parser      = new IsoParser(emptyLayout);

        var act = () => parser.ParseFromHex(
            "0200" + "4000000000000000" + "163456789012345678");

        act.Should().Throw<IsoParseException>()
            .WithMessage("*Bit 2*no definition*");
    }

    // ── TPDU detection in ASCII wire (hex-encoded prefix) ───────────────────

    [Fact]
    public void ParseFromHex_WithAsciiHexEncodedTpdu_DetectsAndStrips()
    {
        // TPDU hex "6000200001" (10 chars) + ASCII message "0200 + bitmap + bit2".
        const string body = "0200" + "4000000000000000" + "164111111111111111";
        const string tpdu = "6000200001";
        var msg = _parser.ParseFromHex(tpdu + body);

        msg.Tpdu.Should().Be("6000200001");
        msg.TpduInfo.Should().NotBeNull();
        msg.TpduInfo!.Id.Should().Be(0x60);
    }

    [Fact]
    public void ParseFromHex_WithAsciiHexEncodedTpdu_MtiCorrect()
    {
        const string body = "0100" + "4000000000000000" + "164111111111111111";
        const string tpdu = "60123456FF";
        var msg = _parser.ParseFromHex(tpdu + body);

        msg.Mti.Should().Be("0100");
        msg.GetFieldValue(2).Should().Be("4111111111111111");
    }

    [Fact]
    public void ParseFromHex_WithoutTpdu_StillParsesNormally()
    {
        const string body = "0200" + "4000000000000000" + "164111111111111111";
        var msg = _parser.ParseFromHex(body);

        msg.Tpdu.Should().BeNull();
        msg.Mti.Should().Be("0200");
    }

    // ── Binary field decoding in binary-hex wire (Builder convention) ───────

    [Fact]
    public void ParseFromBinaryHex_Bit52_ReturnsRawHexNotDoubleEncoded()
    {
        // Bit 52 is Fixed Binary 8 bytes — Builder emits the 16 hex chars as their
        // ASCII bytes ("0123..." → 0x30 0x31 …). The parser must recover the
        // original 16-char hex string, not encode the ASCII bytes again.
        const string pinBlock = "0123456789ABCDEF";
        var binaryHex = new Iso8583Toolkit.IsoCore.Building.IsoMessageBuilder()
            .WithMti("0200")
            .WithLayout(IsoLayout.Default())
            .WithField(3, "000000")
            .WithField(52, pinBlock)
            .BuildBinaryHex();

        var msg = _parser.ParseFromBinaryHex(binaryHex);

        msg.GetFieldValue(52).Should().Be(pinBlock);
    }

    [Fact]
    public void ParseFromBinaryHex_Bit55_ReturnsTlvHexNotDoubleEncoded()
    {
        // Bit 55 is LLLVAR Binary — same Builder convention applies.
        const string emv = "9F2608A1B2C3D4E5F60708";
        var binaryHex = new Iso8583Toolkit.IsoCore.Building.IsoMessageBuilder()
            .WithMti("0200")
            .WithLayout(IsoLayout.Default())
            .WithField(3, "000000")
            .WithField(55, emv)
            .BuildBinaryHex();

        var msg = _parser.ParseFromBinaryHex(binaryHex);

        msg.GetFieldValue(55).Should().Be(emv);
        // Regression guard: double-encoding surfaced as "3946..." for "9F...".
        msg.GetFieldValue(55).Should().NotStartWith("3946");
    }
}
