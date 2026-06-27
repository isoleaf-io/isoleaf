using FluentAssertions;
using Iso8583Toolkit.Iso20022.Pix;

namespace Iso8583Toolkit.Iso20022.Tests;

public class PixQrCodeServiceTests
{
    private static readonly PixQrCodeService Service = new();

    // Generate the canonical static payload at suite scope so the test
    // doesn't pin a CRC that would drift if the generator ever reorders
    // fields. Roundtrips Generate → Decode exactly the same way the UI does.
    private static readonly string ValidStaticPayload = Service.Generate(new PixGenerateRequest(
        PixKey: "+5511999998888",
        MerchantName: "Fulano de Tal",
        MerchantCity: "Brasilia",
        Amount: 100.00m));

    [Fact]
    public void Decode_ValidStaticPayload_ExtractsKeyAndCrcMatches()
    {
        var result = Service.Decode(ValidStaticPayload);

        result.QrType.Should().Be("static");
        result.PixKey.Should().Be("+5511999998888");
        result.PixKeyType.Should().Be("PHONE");
        result.MerchantName.Should().Be("FULANO DE TAL");
        result.MerchantCity.Should().Be("BRASILIA");
        result.Amount.Should().Be("100.00");
        result.TxId.Should().Be("***");
        result.CrcValid.Should().BeTrue();
        result.Warnings.Should().BeEmpty();
    }

    [Fact]
    public void Decode_TamperedCrc_FlagsInvalidAndAddsWarning()
    {
        // Flip the last hex char so the CRC no longer matches the body.
        var tampered = ValidStaticPayload[..^1] + (ValidStaticPayload[^1] == 'F' ? 'E' : 'F');

        var result = Service.Decode(tampered);

        result.CrcValid.Should().BeFalse();
        result.Warnings.Should().Contain(w => w.Contains("CRC inválido"));
    }

    [Fact]
    public void Decode_DynamicPoi_ReportsDynamicQrType()
    {
        var req = new PixGenerateRequest(
            PixKey: "user@example.com",
            MerchantName: "Loja XYZ",
            MerchantCity: "São Paulo",
            SingleUse: true);
        var payload = Service.Generate(req);

        var result = Service.Decode(payload);

        result.QrType.Should().Be("dynamic");
        result.CrcValid.Should().BeTrue();
    }

    [Fact]
    public void Decode_WithExplicitTxId_SurfacesTxIdField()
    {
        var req = new PixGenerateRequest(
            PixKey: "12345678901",
            MerchantName: "Acme",
            MerchantCity: "Rio",
            TxId: "PEDIDO20240115ABCD0001234567XYZ");
        var payload = Service.Generate(req);

        var result = Service.Decode(payload);

        result.TxId.Should().Be("PEDIDO20240115ABCD0001234567XYZ");
        result.CrcValid.Should().BeTrue();
    }

    [Fact]
    public void Generate_OutputRoundTripsThroughDecodeWithMatchingCrc()
    {
        var req = new PixGenerateRequest(
            PixKey: "550e8400-e29b-41d4-a716-446655440000",
            MerchantName: "Café da Esquina",
            MerchantCity: "Curitiba",
            Amount: 42.50m,
            Description: "Espresso");

        var payload = Service.Generate(req);
        var decoded = Service.Decode(payload);

        decoded.CrcValid.Should().BeTrue();
        decoded.PixKey.Should().Be("550e8400-e29b-41d4-a716-446655440000");
        decoded.PixKeyType.Should().Be("EVP");
        // Merchant name is normalised: accents stripped + uppercased + capped at 25.
        decoded.MerchantName.Should().Be("CAFE DA ESQUINA");
        decoded.MerchantCity.Should().Be("CURITIBA");
        decoded.Amount.Should().Be("42.50");
    }

    [Fact]
    public void Generate_WithBlankPixKey_ThrowsArgumentException()
    {
        var req = new PixGenerateRequest(
            PixKey: "   ",
            MerchantName: "Acme",
            MerchantCity: "Rio");

        var act = () => Service.Generate(req);

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void ValidateTxId_TwentySixAlnumChars_ReturnsValid()
    {
        var result = Service.ValidateTxId("PEDIDO20240115ABCD00012345");

        result.IsValid.Should().BeTrue();
        result.Errors.Should().BeEmpty();
    }

    [Fact]
    public void AnalyzePixKey_Email_ReturnsEmailWithoutWarnings()
    {
        var result = Service.AnalyzePixKey("maria@example.com");

        result.KeyType.Should().Be("EMAIL");
        result.Warnings.Should().BeEmpty();
    }
}
