using FluentAssertions;
using Iso8583Toolkit.Iso20022.Exceptions;
using Iso8583Toolkit.Iso20022.Services;
using Iso8583Toolkit.Iso20022.Validation;

namespace Iso8583Toolkit.Iso20022.Tests;

public class ValidatorServiceTests
{
    private static Iso20022ValidatorService NewService() => new(new SchemaRegistry());

    // Minimal pacs.008 instance with the fields the XSD really requires.
    // Built to validate cleanly so we can exercise the "happy path" branch.
    private const string ValidPacs008 = """
        <?xml version="1.0"?>
        <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.09">
          <FIToFICstmrCdtTrf>
            <GrpHdr>
              <MsgId>MSG-001</MsgId>
              <CreDtTm>2024-01-15T10:30:00</CreDtTm>
              <NbOfTxs>1</NbOfTxs>
              <SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf>
            </GrpHdr>
            <CdtTrfTxInf>
              <PmtId>
                <EndToEndId>E2E-001</EndToEndId>
              </PmtId>
              <IntrBkSttlmAmt Ccy="BRL">1500.00</IntrBkSttlmAmt>
              <ChrgBr>SHAR</ChrgBr>
              <Dbtr><Nm>Joao</Nm></Dbtr>
              <DbtrAgt><FinInstnId><BICFI>BRASBRRJXXX</BICFI></FinInstnId></DbtrAgt>
              <CdtrAgt><FinInstnId><BICFI>ITAUBRSPXXX</BICFI></FinInstnId></CdtrAgt>
              <Cdtr><Nm>Maria</Nm></Cdtr>
            </CdtTrfTxInf>
          </FIToFICstmrCdtTrf>
        </Document>
        """;

    [Fact]
    public void Validate_ValidPacs008_ReportsNoErrors()
    {
        var result = NewService().Validate(ValidPacs008);
        result.IsValid.Should().BeTrue();
        result.ErrorCount.Should().Be(0);
        result.MessageType.Should().Be("pacs.008.001.09");
    }

    [Fact]
    public void Validate_MissingMandatoryField_ReportsErrorWithDescriptiveMessage()
    {
        // Drop the required GrpHdr/MsgId — the schema engine surfaces a
        // "missing required element" error pointing at the GrpHdr line.
        const string xml = """
            <?xml version="1.0"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.09">
              <FIToFICstmrCdtTrf>
                <GrpHdr>
                  <CreDtTm>2024-01-15T10:30:00</CreDtTm>
                </GrpHdr>
              </FIToFICstmrCdtTrf>
            </Document>
            """;
        var result = NewService().Validate(xml);
        result.IsValid.Should().BeFalse();
        result.ErrorCount.Should().BeGreaterThan(0);
        result.Issues.Should().Contain(i => i.Severity == "error");
    }

    [Fact]
    public void Validate_TextInNumericField_ReportsTypeError()
    {
        // NbOfTxs is Max15NumericText — a free-text value triggers a pattern
        // violation that the schema engine reports as an error.
        const string xml = """
            <?xml version="1.0"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.09">
              <FIToFICstmrCdtTrf>
                <GrpHdr>
                  <MsgId>M</MsgId>
                  <CreDtTm>2024-01-15T10:30:00</CreDtTm>
                  <NbOfTxs>NOT-A-NUMBER</NbOfTxs>
                  <SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf>
                </GrpHdr>
              </FIToFICstmrCdtTrf>
            </Document>
            """;
        var result = NewService().Validate(xml);
        result.IsValid.Should().BeFalse();
        result.Issues.Should().Contain(i => i.Severity == "error");
    }

    [Fact]
    public void Validate_UnknownNamespace_ThrowsIncompatibleVersionException()
    {
        const string xml = """<?xml version="1.0"?><Document xmlns="urn:example:unknown"/>""";
        var act = () => NewService().Validate(xml);
        act.Should().Throw<IncompatibleVersionException>();
    }

    [Fact]
    public void Validate_EmptyInput_ThrowsArgumentException()
    {
        var act = () => NewService().Validate("");
        act.Should().Throw<ArgumentException>();
    }
}
