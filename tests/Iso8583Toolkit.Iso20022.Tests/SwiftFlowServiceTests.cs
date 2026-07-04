using System.Xml.Linq;
using FluentAssertions;
using Iso8583Toolkit.Iso20022.Builder;
using Iso8583Toolkit.Iso20022.Schema;
using Iso8583Toolkit.Iso20022.Services;
using Iso8583Toolkit.Iso20022.Swift.Flow;
using Iso8583Toolkit.Iso20022.TestData;
using Iso8583Toolkit.Iso20022.Validation;

namespace Iso8583Toolkit.Iso20022.Tests;

public class SwiftFlowServiceTests
{
    // Shared infra — reuse across tests so XSD parsing isn't repeated.
    private static readonly SchemaRegistry SchemaReg = new();
    private static readonly ReferenceService Reference = new(SchemaReg);
    private static readonly XmlExampleGenerator XmlGen = new();
    private static readonly PaymentTestDataGenerator Fixtures = new();
    private static readonly ScenarioRegistry Scenarios = new(Fixtures);
    private static readonly BuilderService Builder = new(Reference, Scenarios, XmlGen);
    private static readonly SwiftFlowService Service = new(Builder, SchemaReg, Fixtures);

    [Fact]
    public void GenerateFlow_CbprDirectPayment_ProducesFourStepsStartingWithPacs008()
    {
        var result = Service.GenerateFlow("cbpr-direct-payment");

        result.Steps.Should().HaveCount(4);
        result.Steps[0].MessageType.Should().StartWith("pacs.008");
        result.Steps[0].ContentType.Should().Be("xml");
        result.Steps[1].IsRelay.Should().BeTrue();
        result.Steps[3].IsRelay.Should().BeTrue();
    }

    [Fact]
    public void GenerateFlow_CbprCoverPayment_ProducesSixSteps()
    {
        var result = Service.GenerateFlow("cbpr-cover-payment");

        result.Steps.Should().HaveCount(6);
        // Step 1: MT103's ISO 20022 counterpart (underlying customer transfer).
        result.Steps[0].MessageType.Should().StartWith("pacs.008");
        // Steps 2..4: the cover payment on pacs.009, with two relays.
        result.Steps[1].MessageType.Should().StartWith("pacs.009");
        result.Steps[2].IsRelay.Should().BeTrue();
        result.Steps[3].IsRelay.Should().BeTrue();
        // Steps 5..6: status report bouncing back through the correspondent.
        result.Steps[4].MessageType.Should().StartWith("pacs.002");
        result.Steps[5].IsRelay.Should().BeTrue();
    }

    [Fact]
    public void GenerateFlow_CbprMtDirect_TwoStepsBothMt()
    {
        var result = Service.GenerateFlow("cbpr-mt-direct");

        result.Steps.Should().HaveCount(2);
        result.Steps.Should().OnlyContain(s => s.ContentType == "mt");
        result.Steps[0].MessageType.Should().Be("MT103");
        result.Steps[1].MessageType.Should().Be("MT910");
        // Both MT payloads must share the same UETR envelope (block 3).
        result.Steps[0].Xml.Should().Contain("{121:");
        result.Steps[1].Xml.Should().Contain("{121:");
    }

    [Fact]
    public void GenerateFlow_CbprCancellation_UsesLatestEmbeddedCamt056Version()
    {
        // Regression for the hardcoded "camt.056.001.08" that was never
        // embedded (available: 001.01, 001.09, 001.10, 001.11). Version
        // is now resolved via SchemaRegistry so this test tracks the
        // newest embedded XSD dynamically.
        var expected = SchemaReg.ListSupportedTypes()
            .Where(t => t.MessageType.StartsWith("camt.056", StringComparison.Ordinal))
            .OrderByDescending(t => t.MessageType, StringComparer.Ordinal)
            .First().MessageType;

        var result = Service.GenerateFlow("cbpr-cancellation");
        var camtStep = result.Steps.Single(s => s.StepId == 2);
        camtStep.MessageType.Should().Be(expected);
    }

    [Fact]
    public void GenerateFlow_CbprStatusInquiry_UsesLatestEmbeddedPacs028Version()
    {
        // Same regression pattern as the camt.056 test — "pacs.028.001.03"
        // was hardcoded but the embedded versions are 001.04 and 001.06.
        var expected = SchemaReg.ListSupportedTypes()
            .Where(t => t.MessageType.StartsWith("pacs.028", StringComparison.Ordinal))
            .OrderByDescending(t => t.MessageType, StringComparer.Ordinal)
            .First().MessageType;

        var result = Service.GenerateFlow("cbpr-status-inquiry");
        var statusReqStep = result.Steps.Single(s => s.StepId == 2);
        statusReqStep.MessageType.Should().Be(expected);
    }

    [Fact]
    public void GenerateFlow_CbprDirectPayment_WithStep1Override_PropagatesRefsDownstream()
    {
        // Feed a full pacs.008 override with bespoke references — the
        // downstream pacs.002 must adopt them via Orgnl* even though
        // we didn't override the status-report step.
        const string customE2E = "ANCHOR-E2E-CUSTOM-CBPR";
        const string customMsgId = "ANCHOR-MSG-CUSTOM-CBPR";
        var pacs008Override = $$"""
            <?xml version="1.0" encoding="UTF-8"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.13">
              <FIToFICstmrCdtTrf>
                <GrpHdr>
                  <MsgId>{{customMsgId}}</MsgId>
                  <CreDtTm>2024-01-15T10:30:00</CreDtTm>
                  <NbOfTxs>1</NbOfTxs>
                  <SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf>
                </GrpHdr>
                <CdtTrfTxInf>
                  <PmtId>
                    <EndToEndId>{{customE2E}}</EndToEndId>
                  </PmtId>
                  <IntrBkSttlmAmt Ccy="USD">100.00</IntrBkSttlmAmt>
                </CdtTrfTxInf>
              </FIToFICstmrCdtTrf>
            </Document>
            """;

        var overrides = new Dictionary<int, string> { [1] = pacs008Override };
        var result = Service.GenerateFlow("cbpr-direct-payment", overrides);

        // Step 3 (pacs.002 issued by the beneficiary) is generated by
        // the service, not the user — after propagation its Orgnl*
        // references must match the anchor's EndToEndId / MsgId.
        var step3 = result.Steps.Single(s => s.StepId == 3);
        var doc = XDocument.Parse(step3.Xml);
        var orgnlE2E = doc.Descendants()
            .First(e => e.Name.LocalName == "OrgnlEndToEndId").Value;
        var orgnlMsgId = doc.Descendants()
            .First(e => e.Name.LocalName == "OrgnlMsgId").Value;

        orgnlE2E.Should().Be(customE2E,
            "the anchor's EndToEndId must propagate into the downstream pacs.002");
        orgnlMsgId.Should().Be(customMsgId,
            "the anchor's MsgId must propagate into the downstream pacs.002");
    }
}
