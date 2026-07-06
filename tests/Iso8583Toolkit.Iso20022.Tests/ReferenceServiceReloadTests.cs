using System.Text;
using FluentAssertions;
using Iso8583Toolkit.Iso20022.Services;
using Iso8583Toolkit.Iso20022.Validation;

namespace Iso8583Toolkit.Iso20022.Tests;

/// <summary>
/// Sprint 9.6 — regressions for the reference-snapshot cache-invalidation
/// bug. Each test uses an isolated temp directory so the shared source-
/// tree registry stays untouched.
/// </summary>
public sealed class ReferenceServiceReloadTests : IDisposable
{
    private readonly string _tempDir;

    public ReferenceServiceReloadTests()
    {
        _tempDir = Path.Join(Path.GetTempPath(),
            "isoleaf-reference-tests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_tempDir);
    }

    public void Dispose()
    {
        try { Directory.Delete(_tempDir, recursive: true); } catch { /* best-effort */ }
    }

    [Fact]
    public void Reload_AfterSchemaRegistryReload_SurfacesNewMessageType()
    {
        // Start with an XSD already on disk — this becomes the "old"
        // catalogue the ReferenceService captures at construction.
        WriteMinimalSchema("pacs.008.001.09");

        var registry = new SchemaRegistry(_tempDir);
        var reference = new ReferenceService(registry);

        reference.GetMessageTypes().Should().ContainSingle().Which.Should().Be("pacs.008.001.09");

        // Drop a new XSD into the same directory — mimics the upload
        // flow that would land in place before Reload() is invoked.
        WriteMinimalSchema("pacs.008.001.05");
        registry.Reload();
        reference.Reload();

        // Both message types must be visible now — Message Types list,
        // Fields lookup, and Namespace lookup all rebuilt after Reload.
        reference.GetMessageTypes().Should().BeEquivalentTo(new[]
        {
            "pacs.008.001.05",
            "pacs.008.001.09",
        });
        reference.GetFields("pacs.008.001.05").Should().NotBeNull(
            "GetFields must return a value for a freshly-loaded message type — snapshot was stale before Sprint 9.6");
        reference.GetNamespace("pacs.008.001.05").Should()
            .Be("urn:iso:std:iso:20022:tech:xsd:pacs.008.001.05");
    }

    [Fact]
    public void Reload_MalformedXsdInDirectory_SkipsAndKeepsOthers()
    {
        // The try/catch that used to live in the constructor now lives
        // inside Reload; a schema that fails to extract must not blow
        // up the rebuild for everyone else.
        WriteMinimalSchema("pacs.008.001.09");
        WriteMinimalSchema("pacs.008.001.13");

        var registry = new SchemaRegistry(_tempDir);
        var reference = new ReferenceService(registry);

        // Poison an existing file with content the XSD parser cannot
        // digest (SchemaRegistry.Reload throws before Reference sees
        // it — we simulate the pre-registry failure by writing an XSD
        // that parses but explodes inside XsdFieldExtractor).
        var brokenPath = Path.Join(_tempDir, "pacs.008.001.13.xsd");
        // A schema that compiles under XmlSchemaSet but has no
        // <Document> global element still passes SchemaRegistry.Reload
        // and just yields zero fields — not a hard failure. Instead we
        // corrupt the file: bytes that fail XmlSchema.Read. That path
        // is caught by SchemaRegistry.Reload itself, so to reach the
        // ReferenceService try/catch we upload a schema whose contents
        // trip a runtime exception during Extract() — a self-cycling
        // element reference does that.
        var cyclic = """
            <?xml version="1.0" encoding="UTF-8"?>
            <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
                       targetNamespace="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.13"
                       xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.13"
                       elementFormDefault="qualified">
              <xs:element name="Document">
                <xs:complexType>
                  <xs:sequence>
                    <xs:element name="Body" type="Loop"/>
                  </xs:sequence>
                </xs:complexType>
              </xs:element>
              <xs:complexType name="Loop">
                <xs:sequence>
                  <xs:element name="Inner" type="Loop"/>
                </xs:sequence>
              </xs:complexType>
            </xs:schema>
            """;
        File.WriteAllText(brokenPath, cyclic);

        registry.Reload();
        reference.Reload();

        // The unaffected .009 must still be listed — the poisoned .013
        // is skipped by the per-schema try/catch. Whether .013 lands
        // in the map or not is implementation-detail; what matters is
        // that Reload didn't throw and .009 remains queryable.
        reference.GetMessageTypes().Should().Contain("pacs.008.001.09");
        reference.GetFields("pacs.008.001.09").Should().NotBeNull();
    }

    private void WriteMinimalSchema(string messageType)
    {
        // pacs.008-shaped XSD: <Document> wrapping the messageType body,
        // enough for XsdFieldExtractor to walk and produce field entries.
        var ns = "urn:iso:std:iso:20022:tech:xsd:" + messageType;
        var body = MessageBodyName(messageType);
        var xsd = $"""
            <?xml version="1.0" encoding="UTF-8"?>
            <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
                       targetNamespace="{ns}"
                       xmlns="{ns}"
                       elementFormDefault="qualified">
              <xs:element name="Document">
                <xs:complexType>
                  <xs:sequence>
                    <xs:element name="{body}" type="MessageBody"/>
                  </xs:sequence>
                </xs:complexType>
              </xs:element>
              <xs:complexType name="MessageBody">
                <xs:sequence>
                  <xs:element name="MsgId" type="xs:string" minOccurs="1"/>
                </xs:sequence>
              </xs:complexType>
            </xs:schema>
            """;
        File.WriteAllBytes(
            Path.Join(_tempDir, messageType + ".xsd"),
            Encoding.UTF8.GetBytes(xsd));
    }

    /// <summary>Uses a stable dummy body element so downstream tests can
    /// assert on the field tree without hardcoding a real ISO 20022 root.</summary>
    private static string MessageBodyName(string messageType) =>
        // Just something that's a valid XML NCName; the extractor
        // doesn't validate against the real ISO 20022 catalogue.
        "TestBody" + messageType.Replace(".", "");
}
