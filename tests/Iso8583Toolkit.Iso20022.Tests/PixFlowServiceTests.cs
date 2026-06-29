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
        // Anchor selection prefers pacs.008 — supply a clean pacs.008
        // override (becomes source of truth) AND a pacs.002 override
        // with disagreeing Orgnl* refs. The mismatch surfaces as
        // error-severity alerts on the pacs.002 step.
        const string anchorE2E = "E1111111120240115000000000000001";
        const string anchorMsgId = "ANCHOR-MSG-001";
        var pacs008Override = $"""
            <?xml version="1.0" encoding="UTF-8"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.13">
              <FIToFICstmrCdtTrf>
                <GrpHdr>
                  <MsgId>{anchorMsgId}</MsgId>
                  <CreDtTm>2024-01-15T10:30:00</CreDtTm>
                  <NbOfTxs>1</NbOfTxs>
                  <SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf>
                </GrpHdr>
                <CdtTrfTxInf>
                  <PmtId><EndToEndId>{anchorE2E}</EndToEndId></PmtId>
                  <IntrBkSttlmAmt Ccy="BRL">42.00</IntrBkSttlmAmt>
                </CdtTrfTxInf>
              </FIToFICstmrCdtTrf>
            </Document>
            """;
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

        var overrides = new Dictionary<int, string>
        {
            [1] = pacs008Override,
            [2] = pacs002Override,
        };
        var result = Service.GenerateFlow("pix-transfer", overrides);

        result.Alerts.Should().Contain(a =>
            a.StepId == 2 && a.Field == "OrgnlEndToEndId" && a.Severity == "error");
        result.Alerts.Should().Contain(a =>
            a.StepId == 2 && a.Field == "OrgnlMsgId" && a.Severity == "error");
    }

    [Fact]
    public void GenerateFlow_PixAutomatico_FollowsBcbSpiArrangement()
    {
        // Per BCB's "Guia de Implementação do Pix Automático", the
        // mandate flow is INITIATED BY THE PSP RECEBEDOR (not by the
        // payer as in transactional Pix). The pain.009 request travels
        // payee → SPI (repasse) → payer; the pain.012 acceptance goes
        // back payer → SPI (repasse) → payee; client notifications close
        // the loop.
        var result = Service.GenerateFlow("pix-automatico");

        result.Steps.Should().HaveCount(6);

        // Step 1: pain.009 originated by PSP Recebedor.
        result.Steps[0].MessageType.Should().Be("pain.009.001.07");
        result.Steps[0].FromActor.Should().Be("PSP Recebedor");
        result.Steps[0].ToActor.Should().Be("SPI/BCB");

        // Step 2: SPI relays the pain.009 to the PSP Pagador.
        result.Steps[1].MessageType.Should().Be("pain.009.001.07");
        result.Steps[1].FromActor.Should().Be("SPI/BCB");
        result.Steps[1].ToActor.Should().Be("PSP Pagador");
        result.Steps[1].IsRelay.Should().BeTrue();

        // Step 3: PSP Pagador answers with pain.012.
        result.Steps[2].MessageType.Should().StartWith("pain.012");
        result.Steps[2].FromActor.Should().Be("PSP Pagador");
        result.Steps[2].ToActor.Should().Be("SPI/BCB");

        // Step 4: SPI relays the pain.012 back to the PSP Recebedor.
        result.Steps[3].MessageType.Should().StartWith("pain.012");
        result.Steps[3].FromActor.Should().Be("SPI/BCB");
        result.Steps[3].ToActor.Should().Be("PSP Recebedor");
        result.Steps[3].IsRelay.Should().BeTrue();

        // Steps 5 + 6: client-facing notifications close the loop.
        result.Steps[4].FromActor.Should().Be("PSP Pagador");
        result.Steps[4].ToActor.Should().Be("Pagador");
        result.Steps[5].FromActor.Should().Be("PSP Recebedor");
        result.Steps[5].ToActor.Should().Be("Recebedor");

        // MndtId anchored on step 1 (pain.009) must be the same on every
        // hop — both downstream pain.009 relays and upstream pain.012s.
        var mandateIds = result.Steps
            .Select(s => ExtractFirstValue(s.Xml, "MndtId"))
            .Distinct()
            .ToList();
        mandateIds.Should().HaveCount(1);
        mandateIds[0].Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void GenerateFlow_OpenFinance_Pacs008OverrideBackPropagatesToPain001()
    {
        // The Open Finance flow has pain.001 BEFORE pacs.008. When the
        // user supplies an override for the pacs.008 (step 2), the
        // pain.001 (step 1) is regenerated and must adopt the override's
        // EndToEndId — otherwise the two upstream steps reference
        // different transactions.
        const string customE2E = "E1234567890OPENFINANCEOVERRIDE01";
        var pacs008Override = $"""
            <?xml version="1.0" encoding="UTF-8"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.13">
              <FIToFICstmrCdtTrf>
                <GrpHdr>
                  <MsgId>OF-CUSTOM-PACS008</MsgId>
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

        var overrides = new Dictionary<int, string> { [2] = pacs008Override };
        var result = Service.GenerateFlow("pix-open-finance", overrides);

        // step 1 (pain.001) — back-propagated from anchor (step 2).
        var pain001E2E = ExtractFirstValue(result.Steps[0].Xml, "EndToEndId");
        pain001E2E.Should().Be(customE2E,
            "the pain.001 upstream of the pacs.008 override must adopt the override's EndToEndId");
        // step 2 (override) — pinned as-is.
        result.Steps[1].Xml.Should().Contain(customE2E);
        // step 3 (pacs.002) — forward-propagated as before.
        ExtractFirstValue(result.Steps[2].Xml, "OrgnlEndToEndId").Should().Be(customE2E);
    }

    [Fact]
    public void GenerateFlow_PixAutomatico_MndtIdOverrideOnStep1_PropagatesToAllSubsequentSteps()
    {
        // Pix Automático step 1 is the pain.009 anchor. A custom MndtId
        // there must ripple to every other hop — including the pain.012
        // steps (4–6), which carry the mandate id under a different
        // parent (<OrgnlMndt>) than the pain.009 hops (<Mndt>).
        const string customMndtId = "MNDT-CUSTOM-PIXAUT-9999";
        var pain009Override = $"""
            <?xml version="1.0" encoding="UTF-8"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.009.001.07">
              <MndtInitnReq>
                <GrpHdr><MsgId>MND-CUSTOM</MsgId><CreDtTm>2024-01-15T10:30:00</CreDtTm></GrpHdr>
                <Mndt>
                  <MndtId>{customMndtId}</MndtId>
                  <MndtReqId>MNDREQ-CUSTOM</MndtReqId>
                  <TrckgInd>true</TrckgInd>
                  <Cdtr><Nm>Maria Santos</Nm></Cdtr>
                  <Dbtr><Nm>João Silva</Nm></Dbtr>
                  <DbtrAgt><FinInstnId><BICFI>BRASBRRJXXX</BICFI></FinInstnId></DbtrAgt>
                </Mndt>
              </MndtInitnReq>
            </Document>
            """;

        var overrides = new Dictionary<int, string> { [1] = pain009Override };
        var result = Service.GenerateFlow("pix-automatico", overrides);

        // Every other step must echo the override's MndtId, regardless
        // of whether it's pain.009 (<Mndt>) or pain.012 (<OrgnlMndt>).
        foreach (var step in result.Steps.Skip(1))
        {
            var mndtId = ExtractFirstValue(step.Xml, "MndtId");
            mndtId.Should().Be(customMndtId,
                $"step {step.StepId} ({step.MessageType}) should adopt the anchor's MndtId");
        }
    }

    [Fact]
    public void GenerateFlow_PixAutomatico_Pain009OverrideRipplesAllMandateFieldsIntoPain012()
    {
        // Regression: when the user replaces the pain.009 step, the
        // mandate-related payload (MndtReqId, MaxAmt + Ccy, SeqTp,
        // SvcLvl/Cd, Cdtr/Nm and Dbtr/Nm) must travel into every
        // generated pain.012 — not just the MndtId.
        var pain009Override = """
            <?xml version="1.0" encoding="UTF-8"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.009.001.07">
              <MndtInitnReq>
                <GrpHdr><MsgId>MND-OV-2026</MsgId><CreDtTm>2026-06-28T09:00:00</CreDtTm></GrpHdr>
                <Mndt>
                  <MndtId>MNDT-OV-77</MndtId>
                  <MndtReqId>MNDREQ-OV-77</MndtReqId>
                  <SvcLvl><Cd>SRDE</Cd></SvcLvl>
                  <Ocrncs><SeqTp>RCUR</SeqTp></Ocrncs>
                  <MaxAmt Ccy="BRL">750.55</MaxAmt>
                  <TrckgInd>true</TrckgInd>
                  <Cdtr><Nm>Padaria Esquina LTDA</Nm></Cdtr>
                  <Dbtr><Nm>Carlos Andrade</Nm></Dbtr>
                  <DbtrAgt><FinInstnId><BICFI>BRASBRRJXXX</BICFI></FinInstnId></DbtrAgt>
                </Mndt>
              </MndtInitnReq>
            </Document>
            """;

        var overrides = new Dictionary<int, string> { [1] = pain009Override };
        var result = Service.GenerateFlow("pix-automatico", overrides);

        // The downstream relay (step 2 pain.009) is the override itself —
        // assert that the generated pain.012 hops (3..6) all carry the
        // mandate payload supplied in the override.
        foreach (var step in result.Steps.Where(s => s.MessageType.StartsWith("pain.012")))
        {
            ExtractFirstValue(step.Xml, "MndtId").Should().Be("MNDT-OV-77");
            ExtractFirstValue(step.Xml, "MndtReqId").Should().Be("MNDREQ-OV-77");
            ExtractFirstValue(step.Xml, "SeqTp").Should().Be("RCUR");

            var doc = System.Xml.Linq.XDocument.Parse(step.Xml);

            var svcLvlCd = doc.Descendants()
                .FirstOrDefault(e => e.Name.LocalName == "Cd"
                                  && !e.HasElements
                                  && e.Parent?.Name.LocalName == "SvcLvl")?.Value;
            svcLvlCd.Should().NotBeNull(
                $"step {step.StepId} should carry SvcLvl/Cd");
            svcLvlCd!.Should().Be("SRDE",
                $"step {step.StepId} should adopt the anchor's SvcLvl/Cd");

            var maxAmt = doc.Descendants()
                .FirstOrDefault(e => e.Name.LocalName == "MaxAmt" && !e.HasElements);
            maxAmt.Should().NotBeNull(
                $"step {step.StepId} ({step.MessageType}) must carry MaxAmt");
            maxAmt!.Value.Should().Be("750.55");
            maxAmt.Attributes()
                .FirstOrDefault(a => a.Name.LocalName == "Ccy")?.Value
                .Should().Be("BRL");

            var cdtrNmElement = doc.Descendants()
                .FirstOrDefault(e => e.Name.LocalName == "Nm"
                                  && e.Parent?.Name.LocalName == "Cdtr");
            cdtrNmElement.Should().NotBeNull(
                $"step {step.StepId} should include Cdtr/Nm");
            cdtrNmElement!.Value.Should().Be("Padaria Esquina LTDA",
                $"step {step.StepId} should adopt the anchor's Cdtr/Nm");

            var dbtrNm = doc.Descendants()
                .FirstOrDefault(e => e.Name.LocalName == "Nm"
                                  && e.Parent?.Name.LocalName == "Dbtr")?.Value;
            dbtrNm.Should().NotBeNull(
                $"step {step.StepId} ({step.MessageType}) must carry Dbtr/Nm");
            dbtrNm!.Should().Be("Carlos Andrade",
                $"step {step.StepId} should adopt the anchor's Dbtr/Nm");
        }
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
