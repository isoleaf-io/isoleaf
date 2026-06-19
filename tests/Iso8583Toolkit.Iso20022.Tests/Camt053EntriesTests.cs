using System.Xml.Linq;
using FluentAssertions;
using Iso8583Toolkit.Iso20022.Services.Summary;

namespace Iso8583Toolkit.Iso20022.Tests;

public class Camt053EntriesTests
{
    private static (XDocument Doc, XNamespace Ns) Load(string xml)
    {
        var doc = XDocument.Parse(xml);
        return (doc, XNamespace.Get(doc.Root!.Name.NamespaceName));
    }

    private const string Camt053WithTwoEntries = """
        <?xml version="1.0"?>
        <Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.09">
          <BkToCstmrStmt>
            <Stmt>
              <Id>STMT-1</Id>
              <FrToDt><FrDtTm>2024-01-01T00:00:00</FrDtTm><ToDtTm>2024-01-31T23:59:59</ToDtTm></FrToDt>
              <Acct><Id><IBAN>BR0000000000001</IBAN></Id></Acct>
              <Bal>
                <Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp>
                <Amt Ccy="BRL">1000.00</Amt>
                <CdtDbtInd>CRDT</CdtDbtInd>
              </Bal>
              <Ntry>
                <Amt Ccy="BRL">250.00</Amt>
                <CdtDbtInd>CRDT</CdtDbtInd>
                <Sts><Cd>BOOK</Cd></Sts>
                <BookgDt><Dt>2024-01-10</Dt></BookgDt>
                <ValDt><Dt>2024-01-10</Dt></ValDt>
                <NtryDtls>
                  <TxDtls>
                    <Refs><EndToEndId>E2E-A-001</EndToEndId></Refs>
                    <RmtInf><Ustrd>Salary payment</Ustrd></RmtInf>
                  </TxDtls>
                </NtryDtls>
              </Ntry>
              <Ntry>
                <Amt Ccy="BRL">75.50</Amt>
                <CdtDbtInd>DBIT</CdtDbtInd>
                <Sts><Cd>BOOK</Cd></Sts>
                <BookgDt><Dt>2024-01-12</Dt></BookgDt>
                <NtryDtls>
                  <TxDtls>
                    <Refs><EndToEndId>E2E-B-002</EndToEndId></Refs>
                    <RmtInf><Ustrd>Card purchase</Ustrd></RmtInf>
                  </TxDtls>
                </NtryDtls>
              </Ntry>
            </Stmt>
          </BkToCstmrStmt>
        </Document>
        """;

    [Fact]
    public void Summarize_Camt053WithTwoEntries_ReturnsTwoEntries()
    {
        var (doc, ns) = Load(Camt053WithTwoEntries);
        var result = new SummaryService().Summarize("camt.053.001.09", doc, ns);

        result.Entries.Should().NotBeNull();
        result.Entries!.Should().HaveCount(2);
    }

    [Fact]
    public void Summarize_FirstEntry_HasExpectedAmountIndicatorDateAndRemittance()
    {
        var (doc, ns) = Load(Camt053WithTwoEntries);
        var result = new SummaryService().Summarize("camt.053.001.09", doc, ns);

        var first = result.Entries!.First();
        first.Amount.Should().Be("250.00");
        first.Currency.Should().Be("BRL");
        first.CreditDebitInd.Should().Be("CRDT");
        first.BookingDate.Should().Be("2024-01-10");
        first.RemittanceInfo.Should().Be("Salary payment");
        first.EndToEndId.Should().Be("E2E-A-001");
    }

    [Fact]
    public void Summarize_Camt053WithNoEntries_ReturnsEmptyListNotNull()
    {
        const string noEntries = """
            <?xml version="1.0"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.09">
              <BkToCstmrStmt>
                <Stmt>
                  <Id>STMT-EMPTY</Id>
                  <Acct><Id><IBAN>BR0000000000002</IBAN></Id></Acct>
                </Stmt>
              </BkToCstmrStmt>
            </Document>
            """;

        var (doc, ns) = Load(noEntries);
        var result = new SummaryService().Summarize("camt.053.001.09", doc, ns);

        // Empty list — never null — keeps the controller mapping uniform and
        // the wire contract predictable for the UI.
        result.Entries.Should().NotBeNull();
        result.Entries!.Should().BeEmpty();
    }
}
