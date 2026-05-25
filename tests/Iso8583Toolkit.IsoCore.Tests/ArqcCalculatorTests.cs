using FluentAssertions;
using Iso8583Toolkit.Cryptography.Emv;
using Iso8583Toolkit.Cryptography.Tlv;

namespace Iso8583Toolkit.IsoCore.Tests;

public sealed class ArqcCalculatorTests
{
    private const string TestImk = "0123456789ABCDEF0123456789ABCDEF";
    private const string TestPan = "4111111111111111";
    private const string TestPsn = "00";

    private static ArqcInput CreateTestInput(EmvProfile profile = EmvProfile.Visa) => new(
        IccMasterKey: TestImk,
        Pan: TestPan,
        PanSequenceNumber: TestPsn,
        Atc: "001E",
        AmountAuthorized: "000000001000",
        AmountOther: "000000000000",
        TerminalCountryCode: "0986",
        Tvr: "0080000400",
        CurrencyCode: "0986",
        TransactionDate: "250115",
        TransactionType: "00",
        UnpredictableNumber: "AABBCCDD",
        Aip: "1800",
        Iad: "06010A03A40000",
        Profile: profile);

    // ── ARQC determinism ────────────────────────────────────────────────────

    [Fact]
    public void CalculateArqc_SameInput_ProducesSameResult()
    {
        var input = CreateTestInput();
        var arqc1 = ArqcCalculator.CalculateArqc(input);
        var arqc2 = ArqcCalculator.CalculateArqc(input);

        arqc1.Should().Be(arqc2);
    }

    [Fact]
    public void CalculateArqc_Returns16HexChars()
    {
        var arqc = ArqcCalculator.CalculateArqc(CreateTestInput());
        arqc.Should().HaveLength(16);
        arqc.Should().MatchRegex("^[0-9A-F]{16}$");
    }

    [Fact]
    public void CalculateArqc_DifferentAtc_ProducesDifferentResult()
    {
        var input1 = CreateTestInput() with { Atc = "001E" };
        var input2 = CreateTestInput() with { Atc = "001F" };

        ArqcCalculator.CalculateArqc(input1).Should()
            .NotBe(ArqcCalculator.CalculateArqc(input2));
    }

    [Fact]
    public void CalculateArqc_DifferentAmount_ProducesDifferentResult()
    {
        var input1 = CreateTestInput() with { AmountAuthorized = "000000001000" };
        var input2 = CreateTestInput() with { AmountAuthorized = "000000002000" };

        ArqcCalculator.CalculateArqc(input1).Should()
            .NotBe(ArqcCalculator.CalculateArqc(input2));
    }

    // ── Session key derivation ──────────────────────────────────────────────

    [Fact]
    public void DeriveSessionKey_Visa_Returns16Bytes()
    {
        var sessionKey = ArqcCalculator.DeriveSessionKey(CreateTestInput(EmvProfile.Visa));
        sessionKey.Should().HaveCount(16);
    }

    [Fact]
    public void DeriveSessionKey_Mastercard_Returns16Bytes()
    {
        var sessionKey = ArqcCalculator.DeriveSessionKey(CreateTestInput(EmvProfile.Mastercard));
        sessionKey.Should().HaveCount(16);
    }

    [Fact]
    public void DeriveSessionKey_VisaAndMastercard_AreDifferent()
    {
        var visaSk = ArqcCalculator.DeriveSessionKey(CreateTestInput(EmvProfile.Visa));
        var mcSk = ArqcCalculator.DeriveSessionKey(CreateTestInput(EmvProfile.Mastercard));

        Convert.ToHexString(visaSk).Should().NotBe(Convert.ToHexString(mcSk));
    }

    [Fact]
    public void DeriveSessionKey_DifferentAtc_ProducesDifferentKeys()
    {
        var sk1 = ArqcCalculator.DeriveSessionKey(CreateTestInput() with { Atc = "001E" });
        var sk2 = ArqcCalculator.DeriveSessionKey(CreateTestInput() with { Atc = "001F" });

        Convert.ToHexString(sk1).Should().NotBe(Convert.ToHexString(sk2));
    }

    // ── ICC Master Key derivation ───────────────────────────────────────────

    [Fact]
    public void DeriveIccMasterKey_Returns16Bytes()
    {
        var iccMk = ArqcCalculator.DeriveIccMasterKey(CreateTestInput());
        iccMk.Should().HaveCount(16);
    }

    [Fact]
    public void DeriveIccMasterKey_DifferentPan_ProducesDifferentKeys()
    {
        var mk1 = ArqcCalculator.DeriveIccMasterKey(CreateTestInput() with { Pan = "4111111111111111" });
        var mk2 = ArqcCalculator.DeriveIccMasterKey(CreateTestInput() with { Pan = "5555555555554444" });

        Convert.ToHexString(mk1).Should().NotBe(Convert.ToHexString(mk2));
    }

    // ── ARPC Method 1 ───────────────────────────────────────────────────────

    [Fact]
    public void CalculateArpc_Method1_Returns16HexChars()
    {
        var arqc = ArqcCalculator.CalculateArqc(CreateTestInput());
        var input = new ArpcInput(
            Arqc: arqc,
            IccMasterKey: TestImk,
            Pan: TestPan,
            PanSequenceNumber: TestPsn,
            Atc: "001E",
            AuthResponseCode: "3030",
            Csu: null,
            Profile: EmvProfile.Visa,
            Method: ArpcMethod.Method1);

        var arpc = ArpcCalculator.CalculateArpc(input);

        arpc.Should().HaveLength(16);
        arpc.Should().MatchRegex("^[0-9A-F]{16}$");
    }

    [Fact]
    public void CalculateArpc_Method1_DeterministicForSameInput()
    {
        var arqc = ArqcCalculator.CalculateArqc(CreateTestInput());
        var input = new ArpcInput(arqc, TestImk, TestPan, TestPsn, "001E",
            "3030", null, EmvProfile.Visa, ArpcMethod.Method1);

        ArpcCalculator.CalculateArpc(input).Should()
            .Be(ArpcCalculator.CalculateArpc(input));
    }

    [Fact]
    public void CalculateArpc_Method1_DifferentResponseCode_ProducesDifferentResult()
    {
        var arqc = ArqcCalculator.CalculateArqc(CreateTestInput());

        var approved = new ArpcInput(arqc, TestImk, TestPan, TestPsn, "001E",
            "3030", null, EmvProfile.Visa, ArpcMethod.Method1);
        var declined = new ArpcInput(arqc, TestImk, TestPan, TestPsn, "001E",
            "3035", null, EmvProfile.Visa, ArpcMethod.Method1);

        ArpcCalculator.CalculateArpc(approved).Should()
            .NotBe(ArpcCalculator.CalculateArpc(declined));
    }

    // ── ARPC Method 2 ───────────────────────────────────────────────────────

    [Fact]
    public void CalculateArpc_Method2_WithCsu_Returns16HexChars()
    {
        var arqc = ArqcCalculator.CalculateArqc(CreateTestInput(EmvProfile.Mastercard));
        var input = new ArpcInput(
            Arqc: arqc,
            IccMasterKey: TestImk,
            Pan: TestPan,
            PanSequenceNumber: TestPsn,
            Atc: "001E",
            AuthResponseCode: "3030",
            Csu: "00000000",
            Profile: EmvProfile.Mastercard,
            Method: ArpcMethod.Method2);

        var arpc = ArpcCalculator.CalculateArpc(input);

        arpc.Should().HaveLength(16);
        arpc.Should().MatchRegex("^[0-9A-F]{16}$");
    }

    [Fact]
    public void CalculateArpc_Method2_DifferentFromMethod1()
    {
        var arqcInput = CreateTestInput();
        var arqc = ArqcCalculator.CalculateArqc(arqcInput);

        var m1 = new ArpcInput(arqc, TestImk, TestPan, TestPsn, "001E",
            "3030", null, EmvProfile.Visa, ArpcMethod.Method1);
        var m2 = new ArpcInput(arqc, TestImk, TestPan, TestPsn, "001E",
            "3030", "00000000", EmvProfile.Visa, ArpcMethod.Method2);

        ArpcCalculator.CalculateArpc(m1).Should()
            .NotBe(ArpcCalculator.CalculateArpc(m2));
    }

    // ── EmvCryptoService ────────────────────────────────────────────────────

    private readonly EmvCryptoService _service = new();

    [Fact]
    public void BuildIssuerAuthData_ArpcOnly_ReturnsArpc()
    {
        var arpc = "0123456789ABCDEF";
        _service.BuildIssuerAuthData(arpc).Should().Be(arpc);
    }

    [Fact]
    public void BuildIssuerAuthData_WithAuthCode_ConcatenatesCorrectly()
    {
        var arpc = "0123456789ABCDEF";
        var authCode = "3030";
        _service.BuildIssuerAuthData(arpc, authCode).Should().Be(arpc + authCode);
    }

    // ── BuildBit55Response ──────────────────────────────────────────────────

    [Fact]
    public void BuildBit55Response_ContainsTag91And8A()
    {
        var hex = _service.BuildBit55Response("0123456789ABCDEF", "3030");
        var tags = TlvParser.Parse(hex);

        tags.Should().Contain(t => t.Tag == "91");
        tags.Should().Contain(t => t.Tag == "8A");
    }

    [Fact]
    public void BuildBit55Response_Tag91_ContainsArpc()
    {
        var arpc = "0123456789ABCDEF";
        var hex = _service.BuildBit55Response(arpc, "3030");
        var tags = TlvParser.Parse(hex);
        var tag91 = tags.First(t => t.Tag == "91");

        tag91.Value.Should().StartWith(arpc.ToUpperInvariant());
    }

    [Fact]
    public void BuildBit55Response_Tag8A_ContainsResponseCode()
    {
        var hex = _service.BuildBit55Response("0123456789ABCDEF", "3030");
        var tags = TlvParser.Parse(hex);
        var tag8a = tags.First(t => t.Tag == "8A");

        tag8a.Value.Should().Be("3030");
    }

    [Fact]
    public void BuildBit55Response_WithScript72_IncludesTag72()
    {
        var script = "86058400040000";
        var hex = _service.BuildBit55Response("0123456789ABCDEF", "3030",
            issuerScript72: script);
        var tags = TlvParser.Parse(hex);

        tags.Should().Contain(t => t.Tag == "72");
        var tag72 = tags.First(t => t.Tag == "72");
        tag72.Value.Should().Be(script.ToUpperInvariant());
    }

    [Fact]
    public void BuildBit55Response_WithScript71_IncludesTag71()
    {
        var script = "86058400040000";
        var hex = _service.BuildBit55Response("0123456789ABCDEF", "3030",
            issuerScript71: script);
        var tags = TlvParser.Parse(hex);

        tags.Should().Contain(t => t.Tag == "71");
    }

    [Fact]
    public void BuildBit55Response_RoundTrip_ParseRecognizesAllTags()
    {
        var hex = _service.BuildBit55Response("0123456789ABCDEF", "3030",
            issuerScript71: "86058400040000",
            issuerScript72: "860386FF00");
        var parsed = _service.ParseBit55(hex);

        parsed.HasIssuerAuthData.Should().BeTrue();
        parsed.AuthResponseCode.Should().Be("3030");
        parsed.Tags.Count.Should().BeGreaterThanOrEqualTo(4);
    }

    // ── Transaction data building ───────────────────────────────────────────

    [Fact]
    public void BuildTransactionData_ProducesCorrectLength()
    {
        var input = CreateTestInput();
        var data = ArqcCalculator.BuildTransactionData(input);

        // 6 + 6 + 2 + 5 + 2 + 3 + 1 + 4 + 2 + 2 + IAD length
        var iadLen = input.Iad.Length / 2; // 7 bytes
        var expectedLen = 6 + 6 + 2 + 5 + 2 + 3 + 1 + 4 + 2 + 2 + iadLen;
        data.Should().HaveCount(expectedLen);
    }

    // ── Padding ─────────────────────────────────────────────────────────────

    [Theory]
    [InlineData(7, 8)]    // 7 + 0x80 = 8 (exact multiple)
    [InlineData(8, 16)]   // 8 + 0x80 + 7 zeros = 16
    [InlineData(15, 16)]  // 15 + 0x80 = 16
    [InlineData(16, 24)]  // 16 + 0x80 + 7 zeros = 24
    public void ApplyPadding_ProducesCorrectLength(int inputLen, int expectedLen)
    {
        var data = new byte[inputLen];
        var padded = ArqcCalculator.ApplyPadding(data);

        padded.Should().HaveCount(expectedLen);
        padded[inputLen].Should().Be(0x80);
    }

    // ── Elo uses Mastercard derivation ──────────────────────────────────────

    [Fact]
    public void DeriveSessionKey_Elo_UsesMastercardDerivation()
    {
        var eloSk = ArqcCalculator.DeriveSessionKey(CreateTestInput(EmvProfile.Elo));
        var mcSk = ArqcCalculator.DeriveSessionKey(CreateTestInput(EmvProfile.Mastercard));

        Convert.ToHexString(eloSk).Should().Be(Convert.ToHexString(mcSk),
            "Elo uses Mastercard CSKD derivation");
    }
}
