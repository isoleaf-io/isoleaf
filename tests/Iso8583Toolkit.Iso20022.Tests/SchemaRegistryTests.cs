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
    public void SchemaRegistry_LoadsAllSchemas_WithoutErrors()
    {
        // Constructor performs every XSD read; if any fails it throws.
        var act = () => new SchemaRegistry();
        act.Should().NotThrow();
    }

    [Fact]
    public void SchemaRegistry_ListSupportedTypes_Returns44Types()
    {
        // Updated after Sprint 7.4 completed: added pain.012 (4 variants)
        // and then pain.009 (4 variants) to drive the Pix Automático
        // mandate flow — 36 → 40 → 44.
        var registry = new SchemaRegistry();
        registry.ListSupportedTypes().Should().HaveCount(44);
    }

    [Fact]
    public void SchemaRegistry_DetectMessageType_Pain009()
    {
        // Sprint 7.4 — pain.009 is the initiation leg of Pix Automático.
        const string pain009 = """
            <?xml version="1.0" encoding="UTF-8"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.009.001.07">
              <MndtInitnReq><GrpHdr><MsgId>X</MsgId></GrpHdr></MndtInitnReq>
            </Document>
            """;
        new SchemaRegistry().DetectMessageType(pain009).Should().Be("pain.009.001.07");
    }

    [Fact]
    public void SchemaRegistry_DetectMessageType_Pain012()
    {
        // Sprint 7.4 — pain.012 is the acceptance-report leg.
        const string pain012 = """
            <?xml version="1.0" encoding="UTF-8"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.012.001.07">
              <MndtAccptncRpt><GrpHdr><MsgId>X</MsgId></GrpHdr></MndtAccptncRpt>
            </Document>
            """;
        new SchemaRegistry().DetectMessageType(pain012).Should().Be("pain.012.001.07");
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
    public void SchemaRegistry_ReadsFromFilesystem_NotEmbeddedResources()
    {
        // Sprint 9.5 — the registry now scans a directory instead of
        // reading embedded resources. Pointing it at an empty temp dir
        // must yield zero schemas (proving no assembly resource is
        // consulted anymore) — and populating that directory then
        // calling Reload must surface the new file within the same
        // process.
        var dir = Path.Combine(Path.GetTempPath(),
            "isoleaf-registry-tests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        try
        {
            var registry = new SchemaRegistry(dir);
            registry.ListSupportedTypes().Should().BeEmpty(
                "an empty schemas directory must produce an empty registry — proves the embedded-resource fallback is gone");

            var xsd = """
                <?xml version="1.0" encoding="UTF-8"?>
                <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
                           targetNamespace="urn:isoleaf:sprint-9-5:reload-test">
                  <xs:element name="Root" type="xs:string"/>
                </xs:schema>
                """;
            File.WriteAllText(Path.Combine(dir, "sample.xsd"), xsd);
            registry.Reload();
            registry.ListSupportedTypes().Should().ContainSingle();
            registry.GetSchema("urn:isoleaf:sprint-9-5:reload-test").Should().NotBeNull();
        }
        finally
        {
            try { Directory.Delete(dir, recursive: true); } catch { /* best-effort */ }
        }
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
            // camt counts: 052 ×3 + 053 ×3 + 054 ×3 + 056 ×4 + 060 ×2 = 15.
            ["camt"] = 15,
            ["head"] = 1,
            ["pacs"] = 16,
            // pain counts: 001 ×2 + 002 ×2 + 009 ×4 + 012 ×4 (Sprint 7.4) = 12.
            ["pain"] = 12,
        });
    }
}
