using FluentAssertions;
using Iso8583Toolkit.IsoCore.Building.Smart;
using Iso8583Toolkit.IsoCore.Layouts;
using Iso8583Toolkit.IsoCore.Parsing;

namespace Iso8583Toolkit.IsoCore.Tests;

/// <summary>
/// Stub card data provider for unit tests — no dependency on Iso8583Toolkit.Cards.
/// </summary>
internal sealed class StubCardDataProvider : ICardDataProvider
{
    public string GeneratePan(SmartBrand brand) => brand switch
    {
        SmartBrand.Elo => "6362970000000005",
        SmartBrand.Visa => "4111111111111111",
        SmartBrand.Mastercard => "5500000000000004",
        _ => "4111111111111111"
    };

    public SmartBrand DetectBrand(string pan) => pan[0] switch
    {
        '4' => SmartBrand.Visa,
        '5' => SmartBrand.Mastercard,
        '6' => SmartBrand.Elo,
        _ => SmartBrand.Default
    };

    public string GenerateTrack2(string pan, string expiry, string serviceCode, string cvv) =>
        $"{pan}={expiry}{serviceCode}{cvv}";

    public string GenerateCvv(string pan, string expiry, string serviceCode) => "123";

    public string GenerateExpiry() => "2912";
}

public sealed class SmartIsoBuilderTests
{
    private readonly SmartIsoBuilder _builder = new(new StubCardDataProvider());
    private readonly IsoParser _parser = new();

    // ── 0200 Débito Chip ────────────────────────────────────────────────────

    [Fact]
    public void DebitoChip_HasBit52_Bit55_PosEntry051()
    {
        var result = _builder.Build(new TransactionProfile
        {
            Mti = "0200",
            TransactionType = TransactionType.Debito,
            Channel = TransactionChannel.Chip
        });

        result.Success.Should().BeTrue(result.Error ?? "");
        result.ActiveBits.Should().Contain(52, "Débito → PIN Block");
        result.ActiveBits.Should().Contain(55, "Chip → EMV");
        result.Fields!.First(f => f.BitNumber == 22).Value.Should().Be("051");
        result.AppliedRules.Should().Contain(r => r.Contains("Bit52Added"));
        result.AppliedRules.Should().Contain(r => r.Contains("Bit55Added"));
    }

    // ── 0200 Crédito CNP ────────────────────────────────────────────────────

    [Fact]
    public void CreditoCNP_NoBit35_NoBit52()
    {
        var result = _builder.Build(new TransactionProfile
        {
            Mti = "0200",
            TransactionType = TransactionType.Credito,
            Channel = TransactionChannel.CNP
        });

        result.Success.Should().BeTrue();
        result.ActiveBits.Should().NotContain(35, "CNP → no Track 2");
        result.ActiveBits.Should().NotContain(52, "CNP → no PIN");
        result.AppliedRules.Should().Contain("CNP→Bit35Removed");
        result.AppliedRules.Should().Contain("CNP→Bit52Removed");
    }

    // ── 0100 Tarja ──────────────────────────────────────────────────────────

    [Fact]
    public void AuthTarja_HasBit35_NoBit55()
    {
        var result = _builder.Build(new TransactionProfile
        {
            Mti = "0100",
            TransactionType = TransactionType.Credito,
            Channel = TransactionChannel.Tarja
        });

        result.Success.Should().BeTrue();
        result.ActiveBits.Should().Contain(35);
        result.ActiveBits.Should().NotContain(55);
        result.Fields!.First(f => f.BitNumber == 22).Value.Should().Be("021");
    }

    // ── Elo Adquirente → TPDU + bit 19 ─────────────────────────────────────

    [Fact]
    public void EloAdquirente_HasTpdu_HasBit19()
    {
        var result = _builder.Build(new TransactionProfile
        {
            Mti = "0200",
            Brand = SmartBrand.Elo,
            Role = SmartRole.Adquirente,
            Channel = TransactionChannel.Chip
        });

        result.Success.Should().BeTrue();
        result.Tpdu.Should().NotBeNullOrEmpty("Elo acquirer → TPDU");
        result.Tpdu.Should().HaveLength(10);
        result.ActiveBits.Should().Contain(19);
        result.ProfileUsed.Should().Be("Elo");
    }

    // ── Elo Emissor → sem TPDU ──────────────────────────────────────────────

    [Fact]
    public void EloEmissor_NoTpdu()
    {
        var result = _builder.Build(new TransactionProfile
        {
            Mti = "0200",
            Brand = SmartBrand.Elo,
            Role = SmartRole.Emissor,
            Channel = TransactionChannel.Chip
        });

        result.Success.Should().BeTrue();
        result.Tpdu.Should().BeNull();
    }

    // ── Custom PAN → Track 2 derived ────────────────────────────────────────

    [Fact]
    public void CustomPan_Track2DerivedFromPan()
    {
        var customPan = "4222222222222222";
        var result = _builder.Build(new TransactionProfile
        {
            Mti = "0200",
            Brand = SmartBrand.Auto,
            Channel = TransactionChannel.Tarja,
            CustomFields = new() { [2] = customPan }
        });

        result.Success.Should().BeTrue();
        result.Fields!.First(f => f.BitNumber == 2).Value.Should().Be(customPan);
        result.Fields!.First(f => f.BitNumber == 2).Origin.Should().Be(SmartFieldOrigin.Custom);

        var track2 = result.Fields!.First(f => f.BitNumber == 35).Value;
        track2.Should().StartWith(customPan, "Track 2 must start with PAN");
        result.AppliedRules.Should().Contain("CustomPAN→BrandDetected");
    }

    // ── Custom PAN + Custom Track 2 → Track 2 not re-derived ────────────────

    [Fact]
    public void CustomPan_CustomTrack2_NoRederive()
    {
        var customTrack2 = "9999999999999999=29122011234";
        var result = _builder.Build(new TransactionProfile
        {
            Mti = "0200",
            Channel = TransactionChannel.Tarja,
            CustomFields = new()
            {
                [2] = "4111111111111111",
                [35] = customTrack2
            }
        });

        result.Success.Should().BeTrue();
        result.Fields!.First(f => f.BitNumber == 35).Value.Should().Be(customTrack2);
        result.Fields!.First(f => f.BitNumber == 35).Origin.Should().Be(SmartFieldOrigin.Custom);
    }

    // ── Brand Auto + Visa PAN → detects Visa ────────────────────────────────

    [Fact]
    public void BrandAuto_VisaPan_DetectsVisa()
    {
        var result = _builder.Build(new TransactionProfile
        {
            Brand = SmartBrand.Auto,
            Channel = TransactionChannel.Chip,
            CustomFields = new() { [2] = "4111111111111111" }
        });

        result.Success.Should().BeTrue();
        result.AppliedRules.Should().Contain("CustomPAN→BrandDetected");
    }

    // ── Field origins ───────────────────────────────────────────────────────

    [Fact]
    public void FieldOrigins_AreCorrect()
    {
        var result = _builder.Build(new TransactionProfile
        {
            Mti = "0200",
            Channel = TransactionChannel.Chip,
            CustomFields = new() { [4] = "000000099900" }
        });

        result.Success.Should().BeTrue();
        result.Fields!.First(f => f.BitNumber == 4).Origin.Should().Be(SmartFieldOrigin.Custom);
        result.Fields!.First(f => f.BitNumber == 11).Origin.Should().Be(SmartFieldOrigin.Generated);
    }

    // ── 0800 echo test ──────────────────────────────────────────────────────

    [Fact]
    public void EchoTest0800_HasBit70_NoTransactionalBits()
    {
        var result = _builder.Build(new TransactionProfile
        {
            Mti = "0800",
            Channel = TransactionChannel.Presencial
        });

        result.Success.Should().BeTrue();
        result.ActiveBits.Should().Contain(70);
        result.ActiveBits.Should().NotContain(2);
        result.ActiveBits.Should().NotContain(35);
        result.ActiveBits.Should().NotContain(55);
    }

    // ── PIN Block format ────────────────────────────────────────────────────

    [Fact]
    public void PinBlock_Has16HexChars()
    {
        var result = _builder.Build(new TransactionProfile
        {
            Mti = "0200",
            TransactionType = TransactionType.Debito,
            Channel = TransactionChannel.Chip
        });

        var pinField = result.Fields!.First(f => f.BitNumber == 52);
        pinField.Value.Should().HaveLength(16);
        pinField.Value.Should().MatchRegex("^[A-F0-9]{16}$");
    }

    // ── EMV TLV simulated ───────────────────────────────────────────────────

    [Fact]
    public void EmvTlv_ContainsTag9F26()
    {
        var result = _builder.Build(new TransactionProfile
        {
            Mti = "0200",
            Channel = TransactionChannel.Chip
        });

        var emvField = result.Fields!.First(f => f.BitNumber == 55);
        emvField.Value.Should().Contain("9F2608", "EMV must include ARQC tag 9F26 with 8 bytes");
    }

    // ── Custom amount → EMV tag 9F02 updated ────────────────────────────────

    [Fact]
    public void CustomAmount_EmvTag9F02Updated()
    {
        var customAmt = "000000050000";
        var result = _builder.Build(new TransactionProfile
        {
            Mti = "0200",
            Channel = TransactionChannel.Chip,
            CustomFields = new() { [4] = customAmt }
        });

        result.Success.Should().BeTrue();
        var emvField = result.Fields!.First(f => f.BitNumber == 55);
        // Tag 9F02 06 + 12 hex chars of amount
        emvField.Value.Should().Contain($"9F0206{customAmt}");
        result.AppliedRules.Should().Contain("Derived→EMVAmountUpdated");
    }

    // ── Round-trip: build → parse ───────────────────────────────────────────

    [Fact]
    public void RoundTrip_BuildThenParse_FieldsMatch()
    {
        var result = _builder.Build(new TransactionProfile
        {
            Mti = "0200",
            Brand = SmartBrand.Visa,
            Channel = TransactionChannel.Tarja,
            TransactionType = TransactionType.Credito
        });

        result.Success.Should().BeTrue();

        var parsed = _parser.ParseFromHex(result.Message!);
        parsed.Mti.Should().Be("0200");
        parsed.GetFieldValue(2).Should().Be(result.GeneratedPan);
        // Credit / from credit account / default destination → 003000.
        parsed.GetFieldValue(3).Should().Be("003000");
        parsed.GetFieldValue(49).Should().Be("986");
    }

    // ── AppliedRules list ───────────────────────────────────────────────────

    [Fact]
    public void AppliedRules_ListsAllRules()
    {
        var result = _builder.Build(new TransactionProfile
        {
            Mti = "0200",
            Brand = SmartBrand.Elo,
            Role = SmartRole.Adquirente,
            TransactionType = TransactionType.Debito,
            Channel = TransactionChannel.Chip
        });

        result.AppliedRules.Should().NotBeEmpty();
        result.AppliedRules.Should().Contain(r => r.Contains("Bit55Added"));
        result.AppliedRules.Should().Contain(r => r.Contains("Bit52Added"));
        result.AppliedRules.Should().Contain(r => r.Contains("TPDU→Generated"));
    }

    // ── Reversal adds bit 90 ────────────────────────────────────────────────

    [Fact]
    public void Reversal_AddsBit90()
    {
        var result = _builder.Build(new TransactionProfile
        {
            Mti = "0400",
            Channel = TransactionChannel.Tarja,
            IsReversal = true
        });

        result.Success.Should().BeTrue();
        result.ActiveBits.Should().Contain(90);
        result.AppliedRules.Should().Contain("Reversal→Bit90Added");
    }

    // ── ARQC: real (IMK configured) vs simulated (no IMK) ───────────────────

    private sealed record TestWorkspaceKeys(string? Imk, string? Zpk = null) : IWorkspaceKeys;

    [Fact]
    public void SmartBuild_WithImk_GeneratesRealArqc()
    {
        var result = _builder.Build(new TransactionProfile
        {
            Mti = "0200",
            Brand = SmartBrand.Visa,
            TransactionType = TransactionType.Credito,
            Channel = TransactionChannel.Chip,
            WorkspaceKeys = new TestWorkspaceKeys("0123456789ABCDEF0123456789ABCDEF"),
        });

        result.Success.Should().BeTrue(result.Error ?? "");
        result.ActiveBits.Should().Contain(55);
        result.ArqcIsSimulated.Should().BeFalse("IMK configurada → ARQC derivado criptograficamente");

        // 9F26 deve estar presente, 16 chars hex.
        var bit55 = result.Fields!.First(f => f.BitNumber == 55).Value;
        var arqcStart = bit55.IndexOf("9F2608", StringComparison.OrdinalIgnoreCase);
        arqcStart.Should().BeGreaterThanOrEqualTo(0);
        var arqc = bit55.Substring(arqcStart + 6, 16);
        arqc.Should().MatchRegex("^[0-9A-Fa-f]{16}$");
    }

    [Fact]
    public void SmartBuild_WithoutImk_GeneratesSimulatedArqc()
    {
        var result = _builder.Build(new TransactionProfile
        {
            Mti = "0200",
            Brand = SmartBrand.Visa,
            TransactionType = TransactionType.Credito,
            Channel = TransactionChannel.Chip,
            // WorkspaceKeys ausente → fallback simulado
        });

        result.Success.Should().BeTrue();
        result.ActiveBits.Should().Contain(55);
        result.ArqcIsSimulated.Should().BeTrue("sem IMK → ARQC aleatório");
    }

    [Fact]
    public void SmartBuild_RealArqc_ValidatesCorrectly()
    {
        const string imk = "0123456789ABCDEF0123456789ABCDEF";
        var result = _builder.Build(new TransactionProfile
        {
            Mti = "0200",
            Brand = SmartBrand.Visa,
            TransactionType = TransactionType.Credito,
            Channel = TransactionChannel.Chip,
            WorkspaceKeys = new TestWorkspaceKeys(imk),
        });

        result.Success.Should().BeTrue();
        result.ArqcIsSimulated.Should().BeFalse();

        var bit55 = result.Fields!.First(f => f.BitNumber == 55).Value;
        var pan = result.Fields!.First(f => f.BitNumber == 2).Value;

        // Extrai os tags relevantes do TLV gerado.
        var parsed = new Iso8583Toolkit.Cryptography.Emv.EmvCryptoService().ParseBit55(bit55);
        var get = (string tag) => parsed.Tags.First(t => t.Tag.Equals(tag, StringComparison.OrdinalIgnoreCase)).Value;

        var input = new Iso8583Toolkit.Cryptography.Emv.ArqcInput(
            IccMasterKey: imk,
            Pan: pan,
            PanSequenceNumber: "00",
            Atc: get("9F36"),
            AmountAuthorized: get("9F02"),
            AmountOther: "000000000000",
            TerminalCountryCode: get("9F1A"),
            Tvr: get("95"),
            CurrencyCode: get("5F2A"),
            TransactionDate: get("9A"),
            TransactionType: get("9C"),
            UnpredictableNumber: get("9F37"),
            Aip: get("82"),
            Iad: get("9F10"),
            Profile: Iso8583Toolkit.Cryptography.Emv.EmvProfile.Visa);

        var validation = new Iso8583Toolkit.Cryptography.Emv.EmvCryptoService()
            .CalculateAndValidateArqc(bit55, input);

        validation.CalculatedArqc.Should().Be(validation.ReceivedArqc, "ARQC re-derivado deve casar o gerado");
    }
}
