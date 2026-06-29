using System.Xml.Linq;
using FluentAssertions;
using Iso8583Toolkit.Iso20022.Services.Summary;
using Iso8583Toolkit.Iso20022.Services.Summary.Extractors;

namespace Iso8583Toolkit.Iso20022.Tests;

public class SummaryServiceTests
{
    private static (XDocument Doc, XNamespace Ns) Load(string xml)
    {
        var doc = XDocument.Parse(xml);
        return (doc, XNamespace.Get(doc.Root!.Name.NamespaceName));
    }

    private const string FullPacs008 = """
        <?xml version="1.0"?>
        <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.09">
          <FIToFICstmrCdtTrf>
            <GrpHdr>
              <MsgId>FULL-001</MsgId>
              <CreDtTm>2024-01-15T10:30:00</CreDtTm>
              <NbOfTxs>1</NbOfTxs>
              <IntrBkSttlmDt>2024-01-15</IntrBkSttlmDt>
            </GrpHdr>
            <CdtTrfTxInf>
              <PmtId>
                <InstrId>INSTR-1</InstrId>
                <EndToEndId>E2E-001</EndToEndId>
                <TxId>TX-001</TxId>
              </PmtId>
              <IntrBkSttlmAmt Ccy="BRL">1500.00</IntrBkSttlmAmt>
              <Dbtr><Nm>João Silva</Nm></Dbtr>
              <DbtrAcct><Id><IBAN>BR1100000000010000000000001</IBAN></Id></DbtrAcct>
              <DbtrAgt><FinInstnId><BICFI>BRASBRRJXXX</BICFI></FinInstnId></DbtrAgt>
              <Cdtr><Nm>Maria Santos</Nm></Cdtr>
              <CdtrAcct><Id><IBAN>BR1100000000020000000000002</IBAN></Id></CdtrAcct>
              <CdtrAgt><FinInstnId><BICFI>ITAUBRSPXXX</BICFI></FinInstnId></CdtrAgt>
            </CdtTrfTxInf>
          </FIToFICstmrCdtTrf>
        </Document>
        """;

    [Fact]
    public void Summarize_FullPacs008_ConfidenceFull_WithAmountAndCreditor()
    {
        var (doc, ns) = Load(FullPacs008);
        var result = new SummaryService().Summarize("pacs.008.001.09", doc, ns);

        result.Operation.Should().Be("FI-to-FI Customer Credit Transfer");
        result.Confidence.Should().Be("full");
        result.Fields.Single(f => f.Label == "Valor").Value.Should().Be("1500.00");
        result.Fields.Single(f => f.Label == "Moeda").Value.Should().Be("BRL");
        result.Fields.Single(f => f.Label == "Credor").Value.Should().Be("Maria Santos");
    }

    [Fact]
    public void Summarize_Pacs008WithoutCreditorAccount_StillFullBecauseIbanIsOptional()
    {
        // Same as FullPacs008 but with <CdtrAcct> stripped. After the
        // optional-vs-required split, an absent creditor IBAN is not enough
        // to demote the badge — only required fields drive the score.
        const string xml = """
            <?xml version="1.0"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.09">
              <FIToFICstmrCdtTrf>
                <GrpHdr>
                  <IntrBkSttlmDt>2024-01-15</IntrBkSttlmDt>
                </GrpHdr>
                <CdtTrfTxInf>
                  <PmtId><EndToEndId>E2E</EndToEndId><TxId>TX</TxId><InstrId>INS</InstrId></PmtId>
                  <IntrBkSttlmAmt Ccy="USD">42.00</IntrBkSttlmAmt>
                  <Dbtr><Nm>D</Nm></Dbtr>
                  <DbtrAcct><Id><IBAN>X</IBAN></Id></DbtrAcct>
                  <DbtrAgt><FinInstnId><BICFI>B1</BICFI></FinInstnId></DbtrAgt>
                  <Cdtr><Nm>C</Nm></Cdtr>
                  <CdtrAgt><FinInstnId><BICFI>B2</BICFI></FinInstnId></CdtrAgt>
                </CdtTrfTxInf>
              </FIToFICstmrCdtTrf>
            </Document>
            """;

        var (doc, ns) = Load(xml);
        var result = new SummaryService().Summarize("pacs.008.001.09", doc, ns);

        result.Confidence.Should().Be("full");
        // The field is still present in the list — the controller maps null Value
        // to Found=false on the wire so the UI can render a "não encontrado" cell.
        result.Fields.Single(f => f.Label == "IBAN/conta credor").Value.Should().BeNull();
    }

    [Fact]
    public void Summarize_Pacs008WithoutSettlementDate_StaysFull()
    {
        // IntrBkSttlmDt is optional for confidence — its absence should not
        // demote an otherwise-complete pacs.008.
        const string xml = """
            <?xml version="1.0"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.09">
              <FIToFICstmrCdtTrf>
                <GrpHdr/>
                <CdtTrfTxInf>
                  <PmtId><EndToEndId>E2E</EndToEndId></PmtId>
                  <IntrBkSttlmAmt Ccy="USD">42.00</IntrBkSttlmAmt>
                  <Dbtr><Nm>D</Nm></Dbtr>
                  <DbtrAgt><FinInstnId><BICFI>B1</BICFI></FinInstnId></DbtrAgt>
                  <Cdtr><Nm>C</Nm></Cdtr>
                  <CdtrAgt><FinInstnId><BICFI>B2</BICFI></FinInstnId></CdtrAgt>
                </CdtTrfTxInf>
              </FIToFICstmrCdtTrf>
            </Document>
            """;

        var (doc, ns) = Load(xml);
        var result = new SummaryService().Summarize("pacs.008.001.09", doc, ns);

        result.Confidence.Should().Be("full");
        result.Fields.Single(f => f.Label == "Data de liquidação").Value.Should().BeNull();
    }

    [Fact]
    public void Summarize_Pacs008WithoutDebtorName_DropsToPartial()
    {
        // Dbtr/Nm is required — removing it must demote the badge.
        const string xml = """
            <?xml version="1.0"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.09">
              <FIToFICstmrCdtTrf>
                <GrpHdr><IntrBkSttlmDt>2024-01-15</IntrBkSttlmDt></GrpHdr>
                <CdtTrfTxInf>
                  <PmtId><EndToEndId>E2E</EndToEndId></PmtId>
                  <IntrBkSttlmAmt Ccy="USD">42.00</IntrBkSttlmAmt>
                  <Dbtr/>
                  <DbtrAgt><FinInstnId><BICFI>B1</BICFI></FinInstnId></DbtrAgt>
                  <Cdtr><Nm>C</Nm></Cdtr>
                  <CdtrAgt><FinInstnId><BICFI>B2</BICFI></FinInstnId></CdtrAgt>
                </CdtTrfTxInf>
              </FIToFICstmrCdtTrf>
            </Document>
            """;

        var (doc, ns) = Load(xml);
        var result = new SummaryService().Summarize("pacs.008.001.09", doc, ns);

        result.Confidence.Should().Be("partial");
        result.Fields.Single(f => f.Label == "Devedor").Value.Should().BeNull();
    }

    [Fact]
    public void Summarize_Pacs002WithRejection_StatusIsRJCT()
    {
        const string xml = """
            <?xml version="1.0"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.002.001.11">
              <FIToFIPmtStsRpt>
                <GrpHdr><MsgId>STS-1</MsgId><CreDtTm>2024-01-15T10:00:00</CreDtTm></GrpHdr>
                <OrgnlGrpInfAndSts><OrgnlMsgId>ORIG-1</OrgnlMsgId></OrgnlGrpInfAndSts>
                <TxInfAndSts>
                  <OrgnlEndToEndId>E2E-001</OrgnlEndToEndId>
                  <OrgnlTxId>TX-001</OrgnlTxId>
                  <TxSts>RJCT</TxSts>
                  <StsRsnInf>
                    <Rsn><Cd>AC01</Cd></Rsn>
                    <AddtlInf>Account closed</AddtlInf>
                  </StsRsnInf>
                </TxInfAndSts>
              </FIToFIPmtStsRpt>
            </Document>
            """;

        var (doc, ns) = Load(xml);
        var result = new SummaryService().Summarize("pacs.002.001.11", doc, ns);

        result.Operation.Should().Be("FI-to-FI Payment Status Report");
        result.Fields.Single(f => f.Label == "Status").Value.Should().Be("RJCT");
        result.Fields.Single(f => f.Label == "Reason code").Value.Should().Be("AC01");
    }

    [Fact]
    public void Summarize_Camt053_ExtractsStatementPeriod()
    {
        const string xml = """
            <?xml version="1.0"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.09">
              <BkToCstmrStmt>
                <Stmt>
                  <Id>STMT-1</Id>
                  <FrToDt>
                    <FrDtTm>2024-01-01T00:00:00</FrDtTm>
                    <ToDtTm>2024-01-31T23:59:59</ToDtTm>
                  </FrToDt>
                  <Acct>
                    <Id><IBAN>BR0000000000003</IBAN></Id>
                    <Ownr><Nm>Acme Corp</Nm></Ownr>
                  </Acct>
                  <Bal><Amt>10000.00</Amt></Bal>
                  <TxsSummry><TtlNtries><NbOfNtries>12</NbOfNtries></TtlNtries></TxsSummry>
                </Stmt>
              </BkToCstmrStmt>
            </Document>
            """;

        var (doc, ns) = Load(xml);
        var result = new SummaryService().Summarize("camt.053.001.09", doc, ns);

        result.Operation.Should().Be("Bank-to-Customer Statement");
        result.Fields.Single(f => f.Label == "Período (início)").Value.Should().Be("2024-01-01T00:00:00");
        result.Fields.Single(f => f.Label == "Período (fim)").Value.Should().Be("2024-01-31T23:59:59");
    }

    [Fact]
    public void Summarize_UnknownMessageType_ReturnsUnknownConfidence()
    {
        // acmt.001 has no extractor — should fall through to UnknownExtractor.
        const string xml = """<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:acmt.001.001.01"/>""";
        var (doc, ns) = Load(xml);

        var result = new SummaryService().Summarize("acmt.001.001.01", doc, ns);

        result.Confidence.Should().Be("unknown");
        result.Operation.Should().Be("ISO 20022 Message");
        result.Fields.Should().BeEmpty();
    }

    [Fact]
    public void Summarize_Pacs004PixReturn_PicksReasonCodeAndOperationName()
    {
        const string xml = """
            <?xml version="1.0"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.004.001.10">
              <PmtRtr>
                <GrpHdr><MsgId>RTR-1</MsgId><CreDtTm>2024-01-15T10:30:00</CreDtTm></GrpHdr>
                <TxInf>
                  <RtrId>E9999901020240115103058000000002</RtrId>
                  <OrgnlEndToEndId>E9999901020240115103058000000001</OrgnlEndToEndId>
                  <RtrdIntrBkSttlmAmt Ccy="BRL">150.00</RtrdIntrBkSttlmAmt>
                  <RtrRsnInf><Rsn><Cd>FOCR</Cd></Rsn></RtrRsnInf>
                </TxInf>
              </PmtRtr>
            </Document>
            """;
        var (doc, ns) = Load(xml);
        var result = new SummaryService().Summarize("pacs.004.001.10", doc, ns);

        result.Operation.Should().Be("Payment Return");
        result.Fields.Single(f => f.Label == "Motivo da devolução").Value.Should().Be("FOCR");
        result.Confidence.Should().Be("full");
    }

    [Fact]
    public void Summarize_Pacs009CbprCover_PicksDebtorBicAndUetr()
    {
        const string xml = """
            <?xml version="1.0"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.009.001.09">
              <FICdtTrf>
                <GrpHdr><MsgId>FI-1</MsgId><CreDtTm>2024-01-15T10:30:00</CreDtTm></GrpHdr>
                <CdtTrfTxInf>
                  <PmtId>
                    <EndToEndId>WIRE-2024-00001</EndToEndId>
                    <UETR>550e8400-e29b-41d4-a716-446655440000</UETR>
                  </PmtId>
                  <IntrBkSttlmAmt Ccy="USD">75000.00</IntrBkSttlmAmt>
                  <Dbtr><FinInstnId><BICFI>CHASUS33XXX</BICFI></FinInstnId></Dbtr>
                  <Cdtr><FinInstnId><BICFI>HSBCGB2LXXX</BICFI></FinInstnId></Cdtr>
                </CdtTrfTxInf>
              </FICdtTrf>
            </Document>
            """;
        var (doc, ns) = Load(xml);
        var result = new SummaryService().Summarize("pacs.009.001.09", doc, ns);

        result.Operation.Should().Be("Financial Institution Credit Transfer");
        result.Fields.Single(f => f.Label == "BIC banco devedor").Value.Should().Be("CHASUS33XXX");
        result.Fields.Single(f => f.Label == "UETR").Value.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public void Summarize_Camt054PixNotification_PicksCdtDbtIndAndStatus()
    {
        const string xml = """
            <?xml version="1.0"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.054.001.09">
              <BkToCstmrDbtCdtNtfctn>
                <GrpHdr><MsgId>NTF-1</MsgId><CreDtTm>2024-01-15T10:30:00</CreDtTm></GrpHdr>
                <Ntfctn>
                  <Id>NTFCTN-20240115-001</Id>
                  <Acct><Id><Othr><Id>conta-recebedor-001</Id></Othr></Id></Acct>
                  <Ntry>
                    <Amt Ccy="BRL">150.00</Amt>
                    <CdtDbtInd>CRDT</CdtDbtInd>
                    <Sts><Cd>BOOK</Cd></Sts>
                    <BookgDt><DtTm>2024-01-15T10:30:01</DtTm></BookgDt>
                  </Ntry>
                </Ntfctn>
              </BkToCstmrDbtCdtNtfctn>
            </Document>
            """;
        var (doc, ns) = Load(xml);
        var result = new SummaryService().Summarize("camt.054.001.09", doc, ns);

        result.Operation.Should().Be("Bank-to-Customer Debit/Credit Notification");
        result.Fields.Single(f => f.Label == "Indicador D/C").Value.Should().Be("CRDT");
        result.Fields.Single(f => f.Label == "Status").Value.Should().Be("BOOK");
    }

    [Fact]
    public void Summarize_Camt056CbprCancellation_PicksReasonAndAssignerBic()
    {
        const string xml = """
            <?xml version="1.0"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.056.001.09">
              <FIToFIPmtCxlReq>
                <Assgnmt>
                  <Id>CXL-1</Id>
                  <Assgnr><Agt><FinInstnId><BICFI>CHASUS33XXX</BICFI></FinInstnId></Agt></Assgnr>
                  <Assgne><Agt><FinInstnId><BICFI>HSBCGB2LXXX</BICFI></FinInstnId></Agt></Assgne>
                  <CreDtTm>2024-01-15T10:30:00</CreDtTm>
                </Assgnmt>
                <Undrlyg>
                  <TxInf>
                    <OrgnlEndToEndId>WIRE-2024-00001</OrgnlEndToEndId>
                    <CxlRsnInf><Rsn><Cd>DUPL</Cd></Rsn></CxlRsnInf>
                  </TxInf>
                </Undrlyg>
              </FIToFIPmtCxlReq>
            </Document>
            """;
        var (doc, ns) = Load(xml);
        var result = new SummaryService().Summarize("camt.056.001.09", doc, ns);

        result.Operation.Should().Be("FI-to-FI Payment Cancellation Request");
        result.Fields.Single(f => f.Label == "Motivo cancelamento").Value.Should().Be("DUPL");
        result.Fields.Single(f => f.Label == "De (BIC)").Value.Should().Be("CHASUS33XXX");
    }

    [Fact]
    public void Summarize_Pacs028CbprStatusRequest_PicksOriginalMessageType()
    {
        const string xml = """
            <?xml version="1.0"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.028.001.04">
              <FIToFIPmtStsReq>
                <GrpHdr><MsgId>STSREQ-1</MsgId><CreDtTm>2024-01-15T10:30:00</CreDtTm></GrpHdr>
                <OrgnlGrpInf>
                  <OrgnlMsgId>CHASUS33XXX20240115001</OrgnlMsgId>
                  <OrgnlMsgNmId>pacs.008.001.13</OrgnlMsgNmId>
                </OrgnlGrpInf>
                <TxInf>
                  <OrgnlEndToEndId>WIRE-2024-00001</OrgnlEndToEndId>
                  <OrgnlUETR>550e8400-e29b-41d4-a716-446655440000</OrgnlUETR>
                </TxInf>
              </FIToFIPmtStsReq>
            </Document>
            """;
        var (doc, ns) = Load(xml);
        var result = new SummaryService().Summarize("pacs.028.001.04", doc, ns);

        result.Operation.Should().Be("Payment Status Request");
        result.Fields.Single(f => f.Label == "Tipo msg original").Value
            .Should().Be("pacs.008.001.13");
    }

    [Theory]
    [InlineData("pacs.004.001.10", "Payment Return")]
    [InlineData("pacs.009.001.09", "Financial Institution Credit Transfer")]
    [InlineData("pacs.028.001.04", "Payment Status Request")]
    [InlineData("pain.002.001.12", "Customer Payment Status Report")]
    [InlineData("camt.054.001.09", "Bank-to-Customer Debit/Credit Notification")]
    [InlineData("camt.056.001.09", "FI-to-FI Payment Cancellation Request")]
    public void Summarize_NewExtractors_NeverFallBackToUnknown(
        string messageType, string expectedOperation)
    {
        // A document with the right root element + namespace is enough to
        // route to the extractor; the goal is to make sure none of these
        // prefixes still hit UnknownExtractor.
        var parts = messageType.Split('.');
        var family = parts[0];
        // Map family → root element produced by each schema. Keeps the test
        // self-contained without hauling in real example XML.
        var rootElement = (family, parts[1]) switch
        {
            ("pacs", "004") => "PmtRtr",
            ("pacs", "009") => "FICdtTrf",
            ("pacs", "028") => "FIToFIPmtStsReq",
            ("pain", "002") => "CstmrPmtStsRpt",
            ("camt", "054") => "BkToCstmrDbtCdtNtfctn",
            ("camt", "056") => "FIToFIPmtCxlReq",
            _ => throw new InvalidOperationException($"No mapping for {messageType}"),
        };
        var nsUri = $"urn:iso:std:iso:20022:tech:xsd:{messageType}";
        var xml = $"""<?xml version="1.0"?><Document xmlns="{nsUri}"><{rootElement}/></Document>""";

        var (doc, ns) = Load(xml);
        var result = new SummaryService().Summarize(messageType, doc, ns);

        result.Operation.Should().Be(expectedOperation);
        // No "unknown" confidence — that's UnknownExtractor's signature.
        result.Confidence.Should().NotBe("unknown");
    }

    [Fact]
    public void Summarize_Pain009PixAutomatico_ExtractsMandateIdAndOperationName()
    {
        // pain.009 = MandateInitiationRequest (initiation leg).
        const string xml = """
            <?xml version="1.0" encoding="UTF-8"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.009.001.07">
              <MndtInitnReq>
                <GrpHdr><MsgId>MND-009-001</MsgId><CreDtTm>2024-01-15T10:30:00</CreDtTm></GrpHdr>
                <Mndt>
                  <MndtId>MNDT-PIXAUT-20240115-0001</MndtId>
                  <MndtReqId>MNDREQ-001</MndtReqId>
                  <TrckgInd>true</TrckgInd>
                  <Tp><SvcLvl><Cd>SRDE</Cd></SvcLvl></Tp>
                  <Cdtr><Nm>Maria Santos</Nm></Cdtr>
                  <Dbtr><Nm>João Silva</Nm></Dbtr>
                  <DbtrAgt><FinInstnId><BICFI>BRASBRRJXXX</BICFI></FinInstnId></DbtrAgt>
                </Mndt>
              </MndtInitnReq>
            </Document>
            """;
        var (doc, ns) = Load(xml);
        var result = new SummaryService().Summarize("pain.009.001.07", doc, ns);

        result.Operation.Should().Be("Mandate Initiation Request (Pix Automático)");
        result.Fields.Single(f => f.Label == "Mandate ID").Value
            .Should().Be("MNDT-PIXAUT-20240115-0001");
        result.Fields.Single(f => f.Label == "Mandate Req ID").Value.Should().Be("MNDREQ-001");
        result.Fields.Single(f => f.Label == "Credor").Value.Should().Be("Maria Santos");
    }

    [Fact]
    public void Summarize_Pain012PixAutomatico_ExtractsMandateIdAndCreditor()
    {
        const string xml = """
            <?xml version="1.0" encoding="UTF-8"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.012.001.07">
              <MndtAccptncRpt>
                <GrpHdr><MsgId>MND-001</MsgId><CreDtTm>2024-01-15T10:30:00</CreDtTm></GrpHdr>
                <UndrlygAccptncDtls>
                  <AccptncRslt><Accptd>true</Accptd></AccptncRslt>
                  <OrgnlMndt>
                    <OrgnlMndt>
                      <MndtId>MNDT-PIXAUT-20240115-0001</MndtId>
                      <Tp><SvcLvl><Cd>SRDE</Cd></SvcLvl></Tp>
                      <Ocrncs><SeqTp>FRST</SeqTp></Ocrncs>
                      <FrstColltnDt>2024-01-16</FrstColltnDt>
                      <Cdtr><Nm>Maria Santos</Nm></Cdtr>
                      <Dbtr><Nm>João Silva</Nm></Dbtr>
                    </OrgnlMndt>
                  </OrgnlMndt>
                </UndrlygAccptncDtls>
              </MndtAccptncRpt>
            </Document>
            """;
        var (doc, ns) = Load(xml);
        var result = new SummaryService().Summarize("pain.012.001.07", doc, ns);

        result.Operation.Should().Be("Mandate Acceptance Report (Pix Automático)");
        result.Fields.Single(f => f.Label == "Mandate ID").Value
            .Should().Be("MNDT-PIXAUT-20240115-0001");
        result.Fields.Single(f => f.Label == "Credor").Value.Should().Be("Maria Santos");
        result.Fields.Single(f => f.Label == "Service Level").Value.Should().Be("SRDE");
        result.Fields.Single(f => f.Label == "Aceito").Value.Should().Be("true");
    }

    [Fact]
    public void Summarize_PrefixExtraction_VariantAndVersionStillRouteToPacs008()
    {
        // A different pacs.008 variant must still find the Pacs008Extractor.
        // We assert by checking the operation name, which only Pacs008Extractor produces.
        var (doc, ns) = Load(FullPacs008);

        var byV09 = new SummaryService().Summarize("pacs.008.001.09", doc, ns);
        var byV13 = new SummaryService().Summarize("pacs.008.001.13", doc, ns);

        byV09.Operation.Should().Be("FI-to-FI Customer Credit Transfer");
        byV13.Operation.Should().Be("FI-to-FI Customer Credit Transfer");
        byV09.Operation.Should().NotBe(UnknownExtractor.Instance.Extract(doc, ns).Operation);
    }
}
