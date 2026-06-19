using System.Xml;
using FluentAssertions;
using Iso8583Toolkit.Iso20022.Services;
using Iso8583Toolkit.Iso20022.Services.Summary;
using Iso8583Toolkit.Iso20022.Validation;

namespace Iso8583Toolkit.Iso20022.Tests;

public class ParserServiceTests
{
    private static Iso20022ParserService NewService() =>
        new(new SchemaRegistry(), new SummaryService());

    private const string Pacs008Xml = """
        <?xml version="1.0"?>
        <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.09">
          <FIToFICstmrCdtTrf>
            <GrpHdr>
              <MsgId>MSG001</MsgId>
              <CreDtTm>2024-01-15T10:30:00</CreDtTm>
              <NbOfTxs>1</NbOfTxs>
            </GrpHdr>
          </FIToFICstmrCdtTrf>
        </Document>
        """;

    private const string Pain001Xml = """
        <?xml version="1.0"?>
        <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09">
          <CstmrCdtTrfInitn>
            <GrpHdr>
              <MsgId>PAIN-1</MsgId>
              <CreDtTm>2024-02-01T09:00:00</CreDtTm>
              <NbOfTxs>1</NbOfTxs>
            </GrpHdr>
          </CstmrCdtTrfInitn>
        </Document>
        """;

    [Fact]
    public void Parse_Pacs008_ReturnsCorrectMessageType()
    {
        var result = NewService().Parse(Pacs008Xml);

        result.MessageType.Should().Be("pacs.008.001.09");
        result.Namespace.Should().Be("urn:iso:std:iso:20022:tech:xsd:pacs.008.001.09");
        result.Root.Name.Should().Be("Document");
        result.Root.Children.Should().ContainSingle(c => c.Name == "FIToFICstmrCdtTrf");
    }

    [Fact]
    public void Parse_Pain001_ReturnsCorrectMessageType()
    {
        var result = NewService().Parse(Pain001Xml);

        result.MessageType.Should().Be("pain.001.001.09");
        result.Root.Children.Should().ContainSingle(c => c.Name == "CstmrCdtTrfInitn");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\t\n")]
    public void Parse_EmptyOrWhitespace_ThrowsArgumentException(string input)
    {
        var act = () => NewService().Parse(input);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Parse_UnknownNamespace_ThrowsIncompatibleVersionException()
    {
        // urn:example:unknown:ns has the right URN shape but doesn't match any
        // ISO 20022 family. The specialised IncompatibleVersionException is
        // still an InvalidOperationException, so any caller catching that base
        // type keeps working — but tests assert the richer type here.
        const string xml = """<?xml version="1.0"?><Document xmlns="urn:example:unknown:ns"><X>1</X></Document>""";

        var act = () => NewService().Parse(xml);
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Unknown message type*");
    }

    [Fact]
    public void Parse_XmlWithDtd_ThrowsXmlException()
    {
        // Classic XXE shape: external entity reference. DtdProcessing.Prohibit
        // makes XmlReader throw before any expansion attempt happens.
        const string xml = """
            <?xml version="1.0"?>
            <!DOCTYPE Document [
              <!ENTITY xxe SYSTEM "file:///etc/passwd">
            ]>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.09">
              <X>&xxe;</X>
            </Document>
            """;

        var act = () => NewService().Parse(xml);
        act.Should().Throw<XmlException>();
    }

    [Fact]
    public void Parse_NodeWithAttributes_AttributesAppearAsAtPrefixedChildren()
    {
        const string xml = """
            <?xml version="1.0"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.09">
              <FIToFICstmrCdtTrf>
                <GrpHdr>
                  <MsgId Ccy="BRL">MSG-WITH-ATTR</MsgId>
                </GrpHdr>
              </FIToFICstmrCdtTrf>
            </Document>
            """;

        var result = NewService().Parse(xml);
        var msgId = result.Root
            .Children.Single(c => c.Name == "FIToFICstmrCdtTrf")
            .Children.Single(c => c.Name == "GrpHdr")
            .Children.Single(c => c.Name == "MsgId");

        // MsgId carries both an @Ccy attribute and its own text value.
        msgId.Value.Should().Be("MSG-WITH-ATTR");
        msgId.Children.Should().ContainSingle();
        msgId.Children[0].Name.Should().Be("@Ccy");
        msgId.Children[0].Value.Should().Be("BRL");
    }

    [Fact]
    public void Parse_ContainerNodes_HaveNullValue()
    {
        var result = NewService().Parse(Pacs008Xml);
        var fiToFi = result.Root.Children.Single(c => c.Name == "FIToFICstmrCdtTrf");

        fiToFi.Value.Should().BeNull();
        fiToFi.Children.Single(c => c.Name == "GrpHdr").Value.Should().BeNull();
        // Leaves do carry values.
        var msgId = fiToFi.Children[0].Children.Single(c => c.Name == "MsgId");
        msgId.Value.Should().Be("MSG001");
    }
}
