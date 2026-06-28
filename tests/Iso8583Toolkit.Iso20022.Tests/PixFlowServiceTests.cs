using FluentAssertions;
using Iso8583Toolkit.Iso20022.Builder;
using Iso8583Toolkit.Iso20022.Pix.Flow;
using Iso8583Toolkit.Iso20022.Schema;
using Iso8583Toolkit.Iso20022.Services;
using Iso8583Toolkit.Iso20022.Validation;

namespace Iso8583Toolkit.Iso20022.Tests;

public class PixFlowServiceTests
{
    // Reuse the same heavy reference/builder pair across tests — XSD
    // parsing dominates the cost.
    private static readonly SchemaRegistry SchemaReg = new();
    private static readonly ReferenceService Reference = new(SchemaReg);
    private static readonly ScenarioRegistry Scenarios = new();
    private static readonly BuilderService Builder =
        new(Reference, Scenarios, new XmlExampleGenerator());
    private static readonly PixFlowService Service = new(Builder);

    [Fact]
    public void GenerateFlow_PixTransfer_ProducesThreeStepsWithConsistentEndToEndId()
    {
        var result = Service.GenerateFlow("pix-transfer");

        result.FlowType.Should().Be("pix-transfer");
        result.Steps.Should().HaveCount(3);
        result.Alerts.Should().BeEmpty();

        var anchorE2E = ExtractFirstValue(result.Steps[0].Xml, "EndToEndId");
        anchorE2E.Should().NotBeNullOrEmpty();
        // Status report mirrors the anchor's EndToEndId via OrgnlEndToEndId.
        ExtractFirstValue(result.Steps[1].Xml, "OrgnlEndToEndId")
            .Should().Be(anchorE2E);
        // camt.054 carries it inside Refs/EndToEndId.
        result.Steps[2].Xml.Should().Contain($"<EndToEndId>{anchorE2E}</EndToEndId>");
    }

    [Fact]
    public void GenerateFlow_PixTransferWithReturn_FiveStepsAndAllRoundTrip()
    {
        var result = Service.GenerateFlow("pix-transfer-with-return");

        result.Steps.Should().HaveCount(5);
        result.Steps[3].MessageType.Should().Be("pacs.004.001.10");
        result.Steps[4].MessageType.Should().Be("pacs.002.001.11");
        result.Alerts.Should().BeEmpty();
    }

    [Fact]
    public void GenerateFlow_WithPacs008Override_PropagatesUserEndToEndIdDownstream()
    {
        var customE2E = "E1234567890CUSTOMOVERRIDE0000001";
        var pacs008Override = $"""
            <?xml version="1.0" encoding="UTF-8"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.13">
              <FIToFICstmrCdtTrf>
                <GrpHdr>
                  <MsgId>CUSTOM-MSG-001</MsgId>
                  <CreDtTm>2024-01-15T10:30:00</CreDtTm>
                  <NbOfTxs>1</NbOfTxs>
                  <SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf>
                </GrpHdr>
                <CdtTrfTxInf>
                  <PmtId><EndToEndId>{customE2E}</EndToEndId></PmtId>
                  <IntrBkSttlmAmt Ccy="BRL">200.00</IntrBkSttlmAmt>
                </CdtTrfTxInf>
              </FIToFICstmrCdtTrf>
            </Document>
            """;

        var overrides = new Dictionary<int, string> { [1] = pacs008Override };
        var result = Service.GenerateFlow("pix-transfer", overrides);

        // Override pinned as-is.
        result.Steps[0].Xml.Should().Contain(customE2E);
        // Generated downstream steps adopt the anchor.
        ExtractFirstValue(result.Steps[1].Xml, "OrgnlEndToEndId")
            .Should().Be(customE2E);
        result.Steps[2].Xml.Should().Contain($"<EndToEndId>{customE2E}</EndToEndId>");
    }

    [Fact]
    public void GenerateFlow_WithMismatchedOverride_EmitsConsistencyAlert()
    {
        // pacs.002 override carrying an OrgnlEndToEndId that doesn't match
        // the anchor — should surface as an error-severity alert.
        var pacs002Override = """
            <?xml version="1.0" encoding="UTF-8"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.002.001.11">
              <FIToFIPmtStsRpt>
                <GrpHdr>
                  <MsgId>STS-CUSTOM-001</MsgId>
                  <CreDtTm>2024-01-15T10:30:01</CreDtTm>
                </GrpHdr>
                <OrgnlGrpInfAndSts>
                  <OrgnlMsgId>WRONG-MSG-ID</OrgnlMsgId>
                  <OrgnlMsgNmId>pacs.008.001.13</OrgnlMsgNmId>
                </OrgnlGrpInfAndSts>
                <TxInfAndSts>
                  <OrgnlEndToEndId>WRONG-E2E-ID</OrgnlEndToEndId>
                  <TxSts>ACCP</TxSts>
                </TxInfAndSts>
              </FIToFIPmtStsRpt>
            </Document>
            """;

        var overrides = new Dictionary<int, string> { [2] = pacs002Override };
        var result = Service.GenerateFlow("pix-transfer", overrides);

        result.Alerts.Should().Contain(a =>
            a.StepId == 2 && a.Field == "OrgnlEndToEndId" && a.Severity == "error");
        result.Alerts.Should().Contain(a =>
            a.StepId == 2 && a.Field == "OrgnlMsgId" && a.Severity == "error");
    }

    [Fact]
    public void GenerateFlow_UnknownFlowType_ThrowsArgumentException()
    {
        var act = () => Service.GenerateFlow("not-a-real-flow");
        act.Should().Throw<ArgumentException>()
            .WithMessage("*not-a-real-flow*");
    }

    private static string? ExtractFirstValue(string xml, string localName)
    {
        var doc = System.Xml.Linq.XDocument.Parse(xml);
        return doc.Descendants()
            .FirstOrDefault(e => e.Name.LocalName == localName && !e.HasElements)
            ?.Value;
    }
}
