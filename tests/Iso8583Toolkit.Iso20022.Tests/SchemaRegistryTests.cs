using System.Xml;
using FluentAssertions;
using Iso8583Toolkit.Iso20022.Validation;

namespace Iso8583Toolkit.Iso20022.Tests;

public class SchemaRegistryTests
{
    private const string Pacs008Sample = """
        <?xml version="1.0" encoding="UTF-8"?>
        <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.09">
          <FIToFICstmrCdtTrf>
            <GrpHdr>
              <MsgId>TEST001</MsgId>
              <CreDtTm>2026-01-01T00:00:00</CreDtTm>
              <NbOfTxs>1</NbOfTxs>
              <SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf>
            </GrpHdr>
          </FIToFICstmrCdtTrf>
        </Document>
        """;

    [Fact]
    public void SchemaRegistry_LoadsAll32Schemas_WithoutErrors()
    {
        // Constructor performs every XSD read; if any fails it throws.
        var act = () => new SchemaRegistry();
        act.Should().NotThrow();
    }

    [Fact]
    public void SchemaRegistry_ListSupportedTypes_Returns32Types()
    {
        var registry = new SchemaRegistry();
        registry.ListSupportedTypes().Should().HaveCount(32);
    }

    [Fact]
    public void SchemaRegistry_DetectMessageType_Pacs008()
    {
        var registry = new SchemaRegistry();
        var detected = registry.DetectMessageType(Pacs008Sample);
        detected.Should().Be("pacs.008.001.09");
    }

    [Fact]
    public void SchemaRegistry_DetectMessageType_UnknownNamespace_ReturnsNull()
    {
        var registry = new SchemaRegistry();
        var doc = new XmlDocument();
        doc.LoadXml("""<?xml version="1.0"?><Root xmlns="urn:example:unknown:ns"/>""");

        registry.DetectMessageType(doc).Should().BeNull();
        registry.DetectMessageType("""<?xml version="1.0"?><Root xmlns="urn:example:unknown:ns"/>""").Should().BeNull();
    }

    [Fact]
    public void SchemaRegistry_GetSchema_ReturnsCorrectSchema()
    {
        var registry = new SchemaRegistry();
        var schema = registry.GetSchema("urn:iso:std:iso:20022:tech:xsd:pacs.008.001.09");

        schema.Should().NotBeNull();
        schema!.TargetNamespace.Should().Be("urn:iso:std:iso:20022:tech:xsd:pacs.008.001.09");
    }

    [Fact]
    public void SchemaRegistry_FamilyGrouping_IsCorrect()
    {
        var registry = new SchemaRegistry();
        var byFamily = registry.ListSupportedTypes()
            .GroupBy(s => s.Family)
            .ToDictionary(g => g.Key, g => g.Count());

        byFamily.Should().BeEquivalentTo(new Dictionary<string, int>
        {
            ["camt"] = 11,
            ["head"] = 1,
            ["pacs"] = 16,
            ["pain"] = 4,
        });
    }
}
