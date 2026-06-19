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
    public void Summarize_Pacs008WithoutCreditorAccount_PartialAndCdtrAcctMissing()
    {
        // Same as FullPacs008 but with <CdtrAcct> stripped so one field is missing.
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

        result.Confidence.Should().Be("partial");
        // The field is still present in the list — the controller maps null Value
        // to Found=false on the wire so the UI can render a "não encontrado" cell.
        result.Fields.Single(f => f.Label == "IBAN/conta credor").Value.Should().BeNull();
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
