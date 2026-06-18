using FluentAssertions;
using Iso8583Toolkit.IsoCore.Domain;
using Iso8583Toolkit.IsoCore.Layouts;
using Iso8583Toolkit.IsoCore.Parsing;
using Iso8583Toolkit.IsoCore.Validation;

namespace Iso8583Toolkit.IsoCore.Tests;

public sealed class IsoMessageValidatorTests
{
    private readonly IsoMessageValidator _validator = new();
    private readonly IsoLayout _layout = IsoLayout.Default();
    private readonly IsoParser _parser = new();

    // Shared valid message: 0200 with bits 2,3,4,7,11,12
    private const string ValidHex =
        "0200" +
        "7230000000000000" +
        "16" + "3456789012345678" +
        "060000" +
        "000000000100" +
        "0605123000" +
        "000006" +
        "123000";

    // ── Valid message ────────────────────────────────────────────────────────

    [Fact]
    public void Validate_ValidMessage_IsValidTrue_NoErrors()
    {
        var msg = _parser.ParseFromHex(ValidHex);
        var result = _validator.Validate(msg, _layout);

        result.IsValid.Should().BeTrue();
        result.Errors.Should().BeEmpty();
    }

    [Fact]
    public void Validate_ValidMessage_SummaryIndicatesValid()
    {
        var msg = _parser.ParseFromHex(ValidHex);
        var result = _validator.Validate(msg, _layout);

        result.Summary.Should().Contain("Valid");
    }

    // ── Bitmap consistency: bit active but field missing ─────────────────────

    [Fact]
    public void Validate_BitActiveButFieldMissing_BitmapInconsistency()
    {
        // Build a message with bit 3 active in bitmap but remove it from Fields
        var msg = _parser.ParseFromHex(ValidHex);
        msg.Fields.Remove(3);

        var result = _validator.Validate(msg, _layout);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.Code == "BITMAP_INCONSISTENCY" && e.Field == "Bit 3");
    }

    // ── Bitmap consistency: field present but bit not active ─────────────────

    [Fact]
    public void Validate_FieldPresentButBitNotActive_BitmapInconsistency()
    {
        // Parse a message with only bit 3 active, then inject a rogue field for bit 39
        var minimal = "0200" + "2000000000000000" + "060000";
        var msg = _parser.ParseFromHex(minimal);
        msg.Fields[39] = new IsoField
        {
            BitNumber = 39,
            RawValue = "00",
            RawBytes = "00"u8.ToArray(),
            Definition = _layout.GetField(39)!
        };

        var result = _validator.Validate(msg, _layout);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.Code == "BITMAP_INCONSISTENCY" && e.Field == "Bit 39");
    }

    // ── Field too long ───────────────────────────────────────────────────────

    [Fact]
    public void Validate_FieldExceedsMaxLength_FieldTooLong()
    {
        var msg = _parser.ParseFromHex(ValidHex);
        // Overwrite bit 3 (ProcessingCode, Fixed 6, MaxLength=6) with a 10-char value
        msg.Fields[3] = new IsoField
        {
            BitNumber = 3,
            RawValue = "0600001234",
            RawBytes = "0600001234"u8.ToArray(),
            Definition = _layout.GetField(3)!
        };

        var result = _validator.Validate(msg, _layout);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.Code == "FIELD_TOO_LONG" && e.Field == "Bit 3");
    }

    // ── Invalid MTI ──────────────────────────────────────────────────────────

    [Fact]
    public void Validate_MtiWithLetters_MtiInvalid()
    {
        var msg = new IsoMessage
        {
            Mti = "ABCD",
            PrimaryBitmap = new bool[64],
            SecondaryBitmap = new bool[64]
        };

        var result = _validator.Validate(msg, _layout);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Code == "MTI_INVALID");
    }

    // ── Unknown field (warning) ──────────────────────────────────────────────

    [Fact]
    public void Validate_BitNotInLayout_WarningUnknownField()
    {
        // Use an empty layout — all fields become "unknown"
        var emptyLayout = new IsoLayout { Name = "Empty" };
        var msg = _parser.ParseFromHex(ValidHex);

        var result = _validator.Validate(msg, emptyLayout);

        // Unknown fields are warnings, not errors — message is still valid
        result.IsValid.Should().BeTrue();
        result.Warnings.Should().NotBeEmpty();
        result.Warnings.Should().Contain(w => w.Code == "UNKNOWN_FIELD");
    }

    // ── Required fields missing ──────────────────────────────────────────────

    [Fact]
    public void Validate_RequiredFieldMissing_Error()
    {
        // Message has bits 2,3,4,7,11,12 but we require bit 41 (Terminal ID)
        var msg = _parser.ParseFromHex(ValidHex);

        var result = _validator.Validate(msg, _layout, requiredBits: [2, 3, 4, 41]);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.Code == "REQUIRED_FIELD_MISSING" && e.Field == "Bit 41");
    }

    [Fact]
    public void Validate_AllRequiredFieldsPresent_NoRequiredErrors()
    {
        var msg = _parser.ParseFromHex(ValidHex);

        var result = _validator.Validate(msg, _layout, requiredBits: [2, 3, 4, 11]);

        result.Errors.Where(e => e.Code == "REQUIRED_FIELD_MISSING").Should().BeEmpty();
    }

    // ── Secondary bitmap ─────────────────────────────────────────────────────

    [Fact]
    public void Validate_MessageWithSecondaryBitmap_Valid()
    {
        // Build a message where bit 1 is set (secondary present) and bit 60 (LLLVAR) is used
        // Primary bitmap: bit 1 + bit 3 → 0xA0 0x00... = 1010 0000 → bits 1,3
        // Secondary bitmap: bit 60 relative → bit 60-64 = no, bit 60 is in primary (1-64)
        // Actually bit 60 is in the primary range. Let me use bit 3 + bit 60.
        // Bit 1 = secondary indicator, Bit 3 = active, Bit 60 = active
        // Primary: bit 1, bit 3, bit 60
        //   byte 0: bits 1,3 → 1010 0000 = 0xA0
        //   byte 7: bit 60 → need bit 60 in primary (1-indexed)
        //   bit 60 → byte index (60-1)/8 = 7, bit offset (60-1)%8 = 3 → 0x10
        //   so byte 7 = 0x10
        // Let me just build it with the builder and validate

        var msg = new IsoMessage
        {
            Mti = "0200",
            PrimaryBitmap = BuildBitmap(true, 3, 60),
            SecondaryBitmap = new bool[64],
            Fields = new Dictionary<int, IsoField>
            {
                [3] = MakeField(3, "000000"),
                [60] = MakeField(60, "HELLO")
            }
        };

        var result = _validator.Validate(msg, _layout);

        result.IsValid.Should().BeTrue();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static bool[] BuildBitmap(bool hasSecondary, params int[] bits)
    {
        var bm = new bool[64];
        if (hasSecondary) bm[0] = true;
        foreach (var b in bits.Where(b => b >= 1 && b <= 64))
            bm[b - 1] = true;
        return bm;
    }

    private IsoField MakeField(int bit, string value)
    {
        var def = _layout.GetField(bit) ?? new IsoFieldDefinition
        {
            BitNumber = bit, Name = $"Bit {bit}",
            Type = IsoFieldType.Fixed, MaxLength = value.Length,
            Encoding = IsoFieldEncoding.ASCII
        };
        return new IsoField
        {
            BitNumber = bit,
            RawValue = value,
            RawBytes = System.Text.Encoding.ASCII.GetBytes(value),
            Definition = def
        };
    }
}
