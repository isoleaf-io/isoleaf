using FluentAssertions;
using Iso8583Toolkit.IsoCore.Domain;

namespace Iso8583Toolkit.IsoCore.Tests;

public sealed class DisplayValueMaskingTests
{
    // ── Helpers ──────────────────────────────────────────────────────────────

    private static IsoField MakeField(int bit, string value, IsoFieldEncoding enc = IsoFieldEncoding.ASCII) =>
        new()
        {
            BitNumber = bit,
            RawValue = value,
            RawBytes = System.Text.Encoding.ASCII.GetBytes(value),
            Definition = new IsoFieldDefinition
            {
                BitNumber = bit,
                Name = $"Bit {bit}",
                Type = IsoFieldType.Fixed,
                MaxLength = value.Length,
                Encoding = enc
            }
        };

    // ── Bit 2 — PAN ─────────────────────────────────────────────────────────

    [Fact]
    public void Pan16Digits_MasksMiddle()
    {
        var field = MakeField(2, "3456789012345678");

        field.DisplayValue.Should().Be("345678******5678");
    }

    [Fact]
    public void Pan19Digits_MasksMiddle()
    {
        var field = MakeField(2, "1234567890123456789");

        // first 6 = "123456", last 4 = "6789", middle 9 = "*********"
        field.DisplayValue.Should().Be("123456*********6789");
    }

    [Fact]
    public void Pan13Digits_MasksMiddle()
    {
        var field = MakeField(2, "4111111111111");

        // first 6 = "411111", last 4 = "1111", middle 3 = "***"
        field.DisplayValue.Should().Be("411111***1111");
    }

    [Fact]
    public void PanUnder10Digits_MasksAllButLast4()
    {
        var field = MakeField(2, "12345678"); // 8 digits

        // last 4 visible = "5678", first 4 masked = "****"
        field.DisplayValue.Should().Be("****5678");
    }

    [Fact]
    public void Pan5Digits_MasksFirstDigitOnly()
    {
        var field = MakeField(2, "12345");

        field.DisplayValue.Should().Be("*2345");
    }

    [Fact]
    public void Pan4Digits_AllMasked()
    {
        var field = MakeField(2, "1234");

        field.DisplayValue.Should().Be("****");
    }

    [Fact]
    public void PanExactly10Digits_First6Last4_NoMiddleMask()
    {
        var field = MakeField(2, "1234567890");

        // first 6 = "123456", last 4 = "7890", middle 0 = ""
        field.DisplayValue.Should().Be("1234567890");
    }

    [Fact]
    public void PanEmpty_ReturnsEmpty()
    {
        var field = MakeField(2, "");

        field.DisplayValue.Should().BeEmpty();
    }

    // ── Bit 35 — Track 2 ────────────────────────────────────────────────────

    [Fact]
    public void Track2_EqualsSign_MasksAfterSeparator()
    {
        // Format: PAN=ExpiryServiceDiscretionary
        var field = MakeField(35, "4111111111111111=25011234567890");

        // Keep PAN + "=", mask everything after
        field.DisplayValue.Should().Be("4111111111111111=**************");
    }

    [Fact]
    public void Track2_DSeparator_MasksAfterSeparator()
    {
        var field = MakeField(35, "4111111111111111D2501120300001");

        field.DisplayValue.Should().Be("4111111111111111D*************");
    }

    [Fact]
    public void Track2_NoSeparator_TreatsAsPan()
    {
        var field = MakeField(35, "4111111111111111");

        // No separator → falls back to PAN masking: first6 + mask + last4
        field.DisplayValue.Should().Be("411111******1111");
    }

    [Fact]
    public void Track2_SeparatorAtEnd_NothingToMask()
    {
        var field = MakeField(35, "4111111111111111=");

        field.DisplayValue.Should().Be("4111111111111111=");
    }

    [Fact]
    public void Track2_Empty_ReturnsEmpty()
    {
        var field = MakeField(35, "");

        field.DisplayValue.Should().BeEmpty();
    }

    // ── Bit 45 — Track 1 ────────────────────────────────────────────────────

    [Fact]
    public void Track1_FullFormat_MasksAfterSecondCaret()
    {
        // Format: B<PAN>^<Name>^<Expiry><Service><Discretionary>
        var field = MakeField(45, "B4111111111111111^DOE/JOHN^25011011234567890");

        // Keep through second "^", mask everything after
        field.DisplayValue.Should().Be("B4111111111111111^DOE/JOHN^*****************");
    }

    [Fact]
    public void Track1_SingleCaret_MasksAfterFirstCaret()
    {
        var field = MakeField(45, "B4111111111111111^RESTOFDATA");

        // Only one caret — keep through it, mask the rest
        field.DisplayValue.Should().Be("B4111111111111111^**********");
    }

    [Fact]
    public void Track1_NoCaret_TreatsAsPan()
    {
        var field = MakeField(45, "4111111111111111");

        field.DisplayValue.Should().Be("411111******1111");
    }

    [Fact]
    public void Track1_Empty_ReturnsEmpty()
    {
        var field = MakeField(45, "");

        field.DisplayValue.Should().BeEmpty();
    }

    // ── Bit 52 — PIN Block ───────────────────────────────────────────────────

    [Fact]
    public void PinBlock_AlwaysFullyMasked()
    {
        var field = MakeField(52, "0612076010182420");

        field.DisplayValue.Should().Be("********");
    }

    [Fact]
    public void PinBlock_ShortValue_StillFullyMasked()
    {
        var field = MakeField(52, "ABCD");

        field.DisplayValue.Should().Be("********");
    }

    [Fact]
    public void PinBlock_Empty_StillFullyMasked()
    {
        var field = MakeField(52, "");

        field.DisplayValue.Should().Be("********");
    }

    // ── Non-sensitive fields ─────────────────────────────────────────────────

    [Fact]
    public void ProcessingCode_NotMasked()
    {
        var field = MakeField(3, "003000");

        field.DisplayValue.Should().Be("003000");
    }

    [Fact]
    public void ResponseCode_NotMasked()
    {
        var field = MakeField(39, "00");

        field.DisplayValue.Should().Be("00");
    }

    [Fact]
    public void TerminalId_NotMasked()
    {
        var field = MakeField(41, "TERMID01");

        field.DisplayValue.Should().Be("TERMID01");
    }

    [Fact]
    public void Amount_NotMasked()
    {
        var field = MakeField(4, "000000001500");

        field.DisplayValue.Should().Be("000000001500");
    }

    // ── BCD / Binary fields — hex dump ───────────────────────────────────────

    [Fact]
    public void BinaryField_ShowsHexDump()
    {
        var field = new IsoField
        {
            BitNumber = 55,
            RawValue = "A1B2C3",
            RawBytes = [0xA1, 0xB2, 0xC3],
            Definition = new IsoFieldDefinition
            {
                BitNumber = 55,
                Name = "ICC Data",
                Type = IsoFieldType.LLLVAR,
                MaxLength = 999,
                Encoding = IsoFieldEncoding.Binary
            }
        };

        field.DisplayValue.Should().Be("A1B2C3");
    }

    [Fact]
    public void BcdField_ShowsHexDump()
    {
        var field = new IsoField
        {
            BitNumber = 99,
            RawValue = "12345",
            RawBytes = [0x01, 0x23, 0x45],
            Definition = new IsoFieldDefinition
            {
                BitNumber = 99,
                Name = "BCD Test",
                Type = IsoFieldType.Fixed,
                MaxLength = 6,
                Encoding = IsoFieldEncoding.BCD
            }
        };

        field.DisplayValue.Should().Be("012345");
    }

    // ── Null definition fallback ─────────────────────────────────────────────

    [Fact]
    public void NullDefinition_ReturnsRawValue()
    {
        var field = new IsoField
        {
            BitNumber = 2,
            RawValue = "4111111111111111",
            RawBytes = [],
            Definition = null!
        };

        field.DisplayValue.Should().Be("4111111111111111");
    }
}
