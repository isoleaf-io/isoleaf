using FluentAssertions;
using Iso8583Toolkit.Iso20022.Services;
using Iso8583Toolkit.Iso20022.Validation;

namespace Iso8583Toolkit.Iso20022.Tests;

public class ReturnGeneratorServiceTests
{
    // Shared registry — XSD scan at startup is the expensive part, every
    // test reuses the same instance.
    private static readonly SchemaRegistry Registry = new();
    private static readonly ReturnGeneratorService Service = new(Registry);

    private const string Pacs008Sample = """
        <?xml version="1.0" encoding="UTF-8"?>
        <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.09">
          <FIToFICstmrCdtTrf>
            <GrpHdr>
              <MsgId>ORIG-PACS008-001</MsgId>
              <CreDtTm>2024-01-15T10:30:00</CreDtTm>
              <NbOfTxs>1</NbOfTxs>
              <SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf>
            </GrpHdr>
            <CdtTrfTxInf>
              <PmtId>
                <EndToEndId>E2E-PACS008-XYZ</EndToEndId>
                <TxId>TX-PACS008-XYZ</TxId>
              </PmtId>
              <IntrBkSttlmAmt Ccy="BRL">150.00</IntrBkSttlmAmt>
              <ChrgBr>SLEV</ChrgBr>
              <Dbtr><Nm>João Silva</Nm></Dbtr>
              <DbtrAgt><FinInstnId><BICFI>BRASBRRJXXX</BICFI></FinInstnId></DbtrAgt>
              <CdtrAgt><FinInstnId><BICFI>ITAUBRSPXXX</BICFI></FinInstnId></CdtrAgt>
              <Cdtr><Nm>Maria Santos</Nm></Cdtr>
            </CdtTrfTxInf>
          </FIToFICstmrCdtTrf>
        </Document>
        """;

    private const string Pacs009Sample = """
        <?xml version="1.0" encoding="UTF-8"?>
        <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.009.001.09">
          <FICdtTrf>
            <GrpHdr>
              <MsgId>ORIG-PACS009-001</MsgId>
              <CreDtTm>2024-01-15T10:30:00</CreDtTm>
              <NbOfTxs>1</NbOfTxs>
              <SttlmInf><SttlmMtd>INDA</SttlmMtd></SttlmInf>
            </GrpHdr>
            <CdtTrfTxInf>
              <PmtId>
                <EndToEndId>E2E-PACS009-XYZ</EndToEndId>
                <UETR>550e8400-e29b-41d4-a716-446655440000</UETR>
              </PmtId>
              <IntrBkSttlmAmt Ccy="USD">75000.00</IntrBkSttlmAmt>
              <Dbtr><FinInstnId><BICFI>CHASUS33XXX</BICFI></FinInstnId></Dbtr>
              <Cdtr><FinInstnId><BICFI>HSBCGB2LXXX</BICFI></FinInstnId></Cdtr>
            </CdtTrfTxInf>
          </FICdtTrf>
        </Document>
        """;

    private const string Pain001Sample = """
        <?xml version="1.0" encoding="UTF-8"?>
        <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09">
          <CstmrCdtTrfInitn>
            <GrpHdr>
              <MsgId>ORIG-PAIN001-001</MsgId>
              <CreDtTm>2024-01-15T10:30:00</CreDtTm>
              <NbOfTxs>1</NbOfTxs>
              <InitgPty><Nm>Acme Corp</Nm></InitgPty>
            </GrpHdr>
            <PmtInf>
              <PmtInfId>PMTINF-XYZ</PmtInfId>
              <PmtMtd>TRF</PmtMtd>
              <ReqdExctnDt><Dt>2024-01-15</Dt></ReqdExctnDt>
              <Dbtr><Nm>Acme Corp</Nm></Dbtr>
              <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
              <DbtrAgt><FinInstnId><BICFI>BNPAFRPPXXX</BICFI></FinInstnId></DbtrAgt>
              <CdtTrfTxInf>
                <PmtId><EndToEndId>E2E-PAIN001-XYZ</EndToEndId></PmtId>
                <Amt><InstdAmt Ccy="EUR">1000.00</InstdAmt></Amt>
                <CdtrAgt><FinInstnId><BICFI>DEUTDEDBXXX</BICFI></FinInstnId></CdtrAgt>
                <Cdtr><Nm>Schmidt AG</Nm></Cdtr>
              </CdtTrfTxInf>
            </PmtInf>
          </CstmrCdtTrfInitn>
        </Document>
        """;

    [Fact]
    public void Generate_Pacs008_ProducesPacs004ReturnEchoingOriginalEndToEndId()
    {
        var result = Service.Generate(Pacs008Sample);

        result.OriginalMessageType.Should().Be("pacs.008.001.09");
        result.ReturnMessageType.Should().Be("pacs.004");
        result.Xml.Should().Contain("<PmtRtr>");
        result.Xml.Should().Contain("<OrgnlEndToEndId>E2E-PACS008-XYZ</OrgnlEndToEndId>");
        result.Xml.Should().Contain("<OrgnlMsgId>ORIG-PACS008-001</OrgnlMsgId>");
        result.Xml.Should().Contain("<RtrdIntrBkSttlmAmt Ccy=\"BRL\">150.00</RtrdIntrBkSttlmAmt>");
        result.AvailableReturnTypes.Should().BeEquivalentTo("pacs.004", "pacs.002");
    }

    [Fact]
    public void Generate_Pacs008_TargetPacs002_ProducesStatusReportWithAccp()
    {
        var result = Service.Generate(Pacs008Sample, targetMessageType: "pacs.002.001.11");

        result.ReturnMessageType.Should().Be("pacs.002");
        result.Xml.Should().Contain("<FIToFIPmtStsRpt>");
        result.Xml.Should().Contain("<TxSts>ACCP</TxSts>");
        result.Xml.Should().Contain("<OrgnlEndToEndId>E2E-PACS008-XYZ</OrgnlEndToEndId>");
        result.Xml.Should().Contain("<OrgnlMsgNmId>pacs.008.001.09</OrgnlMsgNmId>");
    }

    [Fact]
    public void Generate_Pacs009_DefaultsToPacs004CarryingOriginalUetr()
    {
        var result = Service.Generate(Pacs009Sample);

        result.OriginalMessageType.Should().Be("pacs.009.001.09");
        result.ReturnMessageType.Should().Be("pacs.004");
        result.Xml.Should().Contain("<PmtRtr>");
        result.Xml.Should().Contain("<OrgnlUETR>550e8400-e29b-41d4-a716-446655440000</OrgnlUETR>");
        result.Xml.Should().Contain("<RtrdIntrBkSttlmAmt Ccy=\"USD\">75000.00</RtrdIntrBkSttlmAmt>");
    }

    [Fact]
    public void Generate_Pain001_ProducesPain002WithGrpStsAccp()
    {
        var result = Service.Generate(Pain001Sample);

        result.OriginalMessageType.Should().Be("pain.001.001.09");
        result.ReturnMessageType.Should().Be("pain.002");
        result.Xml.Should().Contain("<CstmrPmtStsRpt>");
        result.Xml.Should().Contain("<GrpSts>ACCP</GrpSts>");
        result.Xml.Should().Contain("<OrgnlMsgId>ORIG-PAIN001-001</OrgnlMsgId>");
        result.Xml.Should().Contain("<OrgnlPmtInfId>PMTINF-XYZ</OrgnlPmtInfId>");
        result.Xml.Should().Contain("<OrgnlEndToEndId>E2E-PAIN001-XYZ</OrgnlEndToEndId>");
    }

    [Fact]
    public void Generate_Camt053_NotSupportedPrefix_ThrowsArgumentException()
    {
        const string camt053 = """
            <?xml version="1.0" encoding="UTF-8"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.09">
              <BkToCstmrStmt>
                <Stmt><Id>STMT-1</Id></Stmt>
              </BkToCstmrStmt>
            </Document>
            """;

        var act = () => Service.Generate(camt053);

        act.Should().Throw<ArgumentException>()
            .WithMessage("*not supported for 'camt.053'*");
    }
}
