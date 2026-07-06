using System.Text;
using FluentAssertions;
using Iso8583Toolkit.Iso20022.Services;
using Iso8583Toolkit.Iso20022.Validation;

namespace Iso8583Toolkit.Iso20022.Tests;

/// <summary>
/// Sprint 9.5 — end-to-end tests for the schemas upload service.
/// Each test uses a fresh isolated temp directory so runs don't
/// interfere with the shared source-tree schemas registry.
/// </summary>
public sealed class SchemaUploadServiceTests : IDisposable
{
    private readonly string _tempDir;
    private readonly SchemaRegistry _registry;
    private readonly SchemaUploadService _service;

    public SchemaUploadServiceTests()
    {
        _tempDir = Path.Join(Path.GetTempPath(),
            "isoleaf-schema-tests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_tempDir);
        _registry = new SchemaRegistry(_tempDir);
        _service = new SchemaUploadService(_registry);
    }

    public void Dispose()
    {
        try { Directory.Delete(_tempDir, recursive: true); } catch { /* best-effort */ }
    }

    [Fact]
    public void UploadSchema_ValidXsd_PersistsAndRegistersNamespace()
    {
        var xsd = MakeMinimalXsd("urn:isoleaf:test:sprint-9-5-a", "MessageA");
        var result = _service.UploadSchema("test-a.xsd", Encoding.UTF8.GetBytes(xsd));

        result.Success.Should().BeTrue(result.Error);
        result.Namespace.Should().Be("urn:isoleaf:test:sprint-9-5-a");
        result.FileName.Should().Be("test-a.xsd");
        // Reload happened synchronously — registry sees the new schema.
        _registry.GetSchema("urn:isoleaf:test:sprint-9-5-a").Should().NotBeNull();
    }

    [Fact]
    public void UploadSchema_ReuploadSameNamespace_ReplacesExisting()
    {
        var xsd = MakeMinimalXsd("urn:isoleaf:test:sprint-9-5-b", "MessageB");
        _service.UploadSchema("first.xsd", Encoding.UTF8.GetBytes(xsd));
        var again = _service.UploadSchema("second.xsd", Encoding.UTF8.GetBytes(xsd));

        again.Success.Should().BeTrue();
        // Only the second file must remain on disk — the first one
        // shared the same namespace and got wiped by the overwrite policy.
        var files = Directory.EnumerateFiles(_tempDir, "*.xsd", SearchOption.AllDirectories).ToList();
        files.Should().ContainSingle(f => Path.GetFileName(f) == "second.xsd");
        files.Should().NotContain(f => Path.GetFileName(f) == "first.xsd");
    }

    [Fact]
    public void UploadSchema_MalformedXml_ReturnsErrorWithLocation()
    {
        // Missing closing tag on the schema root — well-formedness fails.
        var xml = "<?xml version=\"1.0\"?><xs:schema xmlns:xs=\"http://www.w3.org/2001/XMLSchema\" targetNamespace=\"x\">";
        var result = _service.UploadSchema("broken.xsd", Encoding.UTF8.GetBytes(xml));

        result.Success.Should().BeFalse();
        result.Error.Should().NotBeNullOrEmpty();
        // File was NOT persisted — nothing under _tempDir.
        Directory.EnumerateFiles(_tempDir).Should().BeEmpty();
    }

    [Fact]
    public void UploadSchema_NotAnXsd_ReturnsErrorAndDoesNotPersist()
    {
        // Well-formed XML but not an xs:schema — parser hands us null.
        var xml = "<?xml version=\"1.0\"?><Document xmlns=\"urn:something\"><Body/></Document>";
        var result = _service.UploadSchema("wrong.xsd", Encoding.UTF8.GetBytes(xml));

        result.Success.Should().BeFalse();
        result.Error.Should().NotBeNullOrEmpty();
        Directory.EnumerateFiles(_tempDir).Should().BeEmpty();
    }

    [Fact]
    public void UploadSchema_WithReferenceService_TriggersReferenceReloadInSameCall()
    {
        // Sprint 9.6 — the upload must cascade into ReferenceService so
        // downstream screens (Version Comparator, Field Reference,
        // Builder) see the new schema within the same request. Before
        // the fix, ReferenceService kept a snapshot from startup and
        // ignored SchemaRegistry.Reload.
        var reference = new ReferenceService(_registry);
        var serviceWithReference = new SchemaUploadService(_registry, reference);

        var xsd = MakePacs008ShapedXsd(
            "urn:iso:std:iso:20022:tech:xsd:pacs.008.001.05",
            "FIToFICstmrCdtTrf-v05");
        var result = serviceWithReference.UploadSchema(
            "pacs.008.001.05.xsd", Encoding.UTF8.GetBytes(xsd));

        result.Success.Should().BeTrue(result.Error);
        // MessageTypes list rebuilt — new type is queryable via the
        // same path the frontend uses (GET /api/iso20022/reference).
        reference.GetMessageTypes().Should().Contain("pacs.008.001.05");
        reference.GetFields("pacs.008.001.05").Should().NotBeNull(
            "GetFields must return a value so the Version Comparator can diff the new version");
    }

    [Fact]
    public void UploadSchema_WithReferenceService_ComparatorCanCompareNewVersionAgainstExisting()
    {
        // Regression for the Sprint 9.6 bug: uploading pacs.008.001.05
        // while the catalogue already had .009 broke the "compare
        // versions" endpoint with "Unknown message type". Wiring
        // ReferenceService.Reload into the upload flow fixes it.
        var reference = new ReferenceService(_registry);
        var uploader = new SchemaUploadService(_registry, reference);
        var compare = new VersionCompareService(reference);

        // Seed the existing version first (mimics the pre-upload state).
        uploader.UploadSchema("pacs.008.001.09.xsd", Encoding.UTF8.GetBytes(
            MakePacs008ShapedXsd(
                "urn:iso:std:iso:20022:tech:xsd:pacs.008.001.09",
                "FIToFICstmrCdtTrf-v09")));

        // Upload the new version — Reference must see it immediately.
        uploader.UploadSchema("pacs.008.001.05.xsd", Encoding.UTF8.GetBytes(
            MakePacs008ShapedXsd(
                "urn:iso:std:iso:20022:tech:xsd:pacs.008.001.05",
                "FIToFICstmrCdtTrf-v05")));

        // Sanity check: both message types are now known to Reference.
        reference.GetMessageTypes().Should().BeEquivalentTo(new[]
        {
            "pacs.008.001.05",
            "pacs.008.001.09",
        });

        // VersionCompareService.Compare would throw
        // InvalidOperationException("Unknown message type") if either
        // side wasn't in ReferenceService's map. Passing here proves
        // the reference snapshot was rebuilt after upload.
        var act = () => compare.Compare("pacs.008.001.05", "pacs.008.001.09");
        act.Should().NotThrow<InvalidOperationException>(
            "the Version Comparator must accept a freshly-uploaded version — regression for Sprint 9.6");
    }

    [Fact]
    public void UploadSchema_MessageTypeNamespace_PersistsUnderFamilyDirectory()
    {
        // A canonical ISO 20022 namespace should be organised into a
        // family subdirectory (e.g. Schemas/pacs/pacs.999.001.01.xsd).
        var xsd = MakeMinimalXsd("urn:iso:std:iso:20022:tech:xsd:pacs.999.001.01", "FIToFICustom");
        var result = _service.UploadSchema("pacs.999.001.01.xsd", Encoding.UTF8.GetBytes(xsd));

        result.Success.Should().BeTrue();
        result.MessageType.Should().Be("pacs.999.001.01");
        var expected = Path.Join(_tempDir, "pacs", "pacs.999.001.01.xsd");
        File.Exists(expected).Should().BeTrue();
    }

    private static string MakeMinimalXsd(string targetNamespace, string rootElementName) => $$"""
        <?xml version="1.0" encoding="UTF-8"?>
        <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
                   targetNamespace="{{targetNamespace}}"
                   xmlns="{{targetNamespace}}"
                   elementFormDefault="qualified">
          <xs:element name="{{rootElementName}}">
            <xs:complexType>
              <xs:sequence>
                <xs:element name="Value" type="xs:string" minOccurs="0"/>
              </xs:sequence>
            </xs:complexType>
          </xs:element>
        </xs:schema>
        """;

    /// <summary>
    /// Shapes the XSD like a real pacs.008 — <c>&lt;Document&gt;</c>
    /// wrapping a body element — so <see cref="Iso8583Toolkit.Iso20022.Schema.XsdFieldExtractor"/>
    /// walks past its "no Document root" short-circuit and produces field entries.
    /// </summary>
    private static string MakePacs008ShapedXsd(string targetNamespace, string bodyName) => $$"""
        <?xml version="1.0" encoding="UTF-8"?>
        <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
                   targetNamespace="{{targetNamespace}}"
                   xmlns="{{targetNamespace}}"
                   elementFormDefault="qualified">
          <xs:element name="Document">
            <xs:complexType>
              <xs:sequence>
                <xs:element name="{{bodyName}}" type="MessageBody"/>
              </xs:sequence>
            </xs:complexType>
          </xs:element>
          <xs:complexType name="MessageBody">
            <xs:sequence>
              <xs:element name="MsgId" type="xs:string" minOccurs="1"/>
              <xs:element name="CreDtTm" type="xs:string" minOccurs="1"/>
            </xs:sequence>
          </xs:complexType>
        </xs:schema>
        """;
}
