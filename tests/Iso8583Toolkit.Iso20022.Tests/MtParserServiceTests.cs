using FluentAssertions;
using Iso8583Toolkit.Iso20022.Swift.Mt;

namespace Iso8583Toolkit.Iso20022.Tests;

public class MtParserServiceTests
{
    private static readonly MtParserService Parser = new();

    // Reference MT103 payload — based on SWIFT CBPR+ documentation
    // shape but BICs/IBAN/UETR are illustrative (not real institutions).
    private const string Mt103Payload = """
        {1:F01CHASUS33AXXX0000000000}{2:I103HSBCGB2LXXXXN}{3:{121:550e8400-e29b-41d4-a716-446655440000}}{4:
        :20:REF-2024-001
        :23B:CRED
        :32A:240115USD75000,00
        :50K:/123456789
        ACME CORPORATION
        123 MAIN STREET
        NEW YORK NY 10001
        :52A:CHASUS33XXX
        :57A:HSBCGB2LXXX
        :59:/GB29NWBK60161331926819
        GLOBAL TRADING LTD
        456 ELM STREET
        LONDON EC1A 1BB
        :70:INVOICE 2024-001
        :71A:SHA
        -}{5:{CHK:AABBCCDDEE11}}
        """;

    [Fact]
    public void Parse_Mt103Payload_DetectsMessageType()
    {
        var result = Parser.Parse(Mt103Payload);
        result.MessageType.Should().Be("MT103");
        result.Sender.Should().Be("CHASUS33AXXX");
        result.Receiver.Should().Be("HSBCGB2LXXXX");
    }

    [Fact]
    public void Parse_Mt103_Field32A_SplitsIntoDateCurrencyAmount()
    {
        var result = Parser.Parse(Mt103Payload);
        var body = result.Blocks.Single(b => b.BlockId == "4");
        var field32A = body.Fields.Single(f => f.Tag == "32A");

        field32A.SubFields.Should().HaveCount(3);
        var date = field32A.SubFields.Single(s => s.SubId == "Data");
        date.RawValue.Should().Be("240115");
        date.MxValue.Should().Be("2024-01-15");
        date.MxPath.Should().Be("IntrBkSttlmDt");

        var ccy = field32A.SubFields.Single(s => s.SubId == "Moeda");
        ccy.MxValue.Should().Be("USD");
        ccy.MxPath.Should().Be("IntrBkSttlmAmt/@Ccy");

        var amt = field32A.SubFields.Single(s => s.SubId == "Valor");
        amt.MxValue.Should().Be("75000.00");
    }

    [Fact]
    public void Parse_Mt103_Field71A_MapsShaToShar()
    {
        // OUR/SHA/BEN → DEBT/SHAR/CRED per SWIFT CBPR+ ChrgBr mapping.
        var result = Parser.Parse(Mt103Payload);
        var body = result.Blocks.Single(b => b.BlockId == "4");
        var field71A = body.Fields.Single(f => f.Tag == "71A");

        field71A.MxPath.Should().Be("ChrgBr");
        field71A.SubFields.Should().HaveCount(1);
        field71A.SubFields[0].RawValue.Should().Be("SHA");
        field71A.SubFields[0].MxValue.Should().Be("SHAR");
        field71A.SubFields[0].Confidence.Should().Be(MtFieldConfidence.Automatic);
    }

    [Fact]
    public void Parse_Mt103_Field50K_FlaggedAsAmbiguous()
    {
        // :50K: is the legacy free-format ordering customer — the parser
        // surfaces the line breakdown but flags the field as ambiguous
        // because the lines could map to different MX leaves.
        var result = Parser.Parse(Mt103Payload);
        var body = result.Blocks.Single(b => b.BlockId == "4");
        var field50K = body.Fields.Single(f => f.Tag == "50K");

        field50K.Confidence.Should().Be(MtFieldConfidence.Ambiguous);
        field50K.MxAlternatives.Should().NotBeEmpty();
        field50K.MxAlternatives.Should().Contain("DbtrAcct/Id/IBAN");
        field50K.SubFields.Should().NotBeEmpty();
        field50K.SubFields.Should().Contain(s => s.SubId == "Nome"
            && s.ParsedValue == "ACME CORPORATION");
    }

    [Fact]
    public void Parse_Mt202Cov_ExtractsReceiverBicSkippingCovSuffix()
    {
        // Regression: earlier the parser sliced 12 chars starting at
        // position 4 of block {2:}, which for MT202COV grabbed the "COV"
        // suffix as part of the BIC (e.g. "COVBANKDEFF" instead of
        // "BANKDEFFXXXX"). The fix bumps the BIC start to position 7
        // whenever the header carries the "COV" suffix.
        const string mt202Cov = """
            {1:F01CHASUS33AXXX0000000000}{2:I202COVBANKDEFFXXXXN}{3:{121:aaaabbbb-cccc-4ddd-8eee-ffff00001111}}{4:
            :20:COV-REF-001
            :21:UNDERLYING-MT103
            :32A:240115USD10000,00
            :52A:CHASUS33XXX
            :57A:BANKDEFFXXX
            :58A:BENFDEFFXXX
            :50K:/1234
            UNDERLYING PAYER
            :59:/5678
            UNDERLYING BENEFICIARY
            -}
            """;

        var result = Parser.Parse(mt202Cov);

        result.MessageType.Should().Be("MT202COV");
        result.Receiver.Should().Be("BANKDEFFXXXX",
            "MT202COV BIC must be extracted after the 'COV' suffix");
    }

    [Fact]
    public void Parse_Mt103_UetrExtractedFromBlock3()
    {
        var result = Parser.Parse(Mt103Payload);
        result.Uetr.Should().Be("550e8400-e29b-41d4-a716-446655440000");

        // Should also be exposed inside block 3 as a typed field.
        var block3 = result.Blocks.Single(b => b.BlockId == "3");
        var uetrField = block3.Fields.Single(f => f.Tag == "121");
        uetrField.MxPath.Should().Be("PmtId/UETR");
    }
}
