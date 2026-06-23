using FluentAssertions;
using Iso8583Toolkit.Iso20022.Schema;
using Iso8583Toolkit.Iso20022.Services;
using Iso8583Toolkit.Iso20022.Validation;

namespace Iso8583Toolkit.Iso20022.Tests;

public class ReferenceServiceTests
{
    // Single instance reused across the file: ReferenceService construction
    // runs XsdFieldExtractor against every embedded XSD (~32 schemas), which
    // takes seconds. Tests only ever read.
    private static readonly ReferenceService Service = new(new SchemaRegistry());

    private const string Pacs008 = "pacs.008.001.09";

    [Fact]
    public void GetMessageTypes_ReturnsAllExtractedTypes()
    {
        var types = Service.GetMessageTypes();
        // The registry ships 32 XSDs and ReferenceService skips any that fail
        // extraction. Asserting "at least most of them succeeded" is the
        // right bar — we don't want a single broken XSD to fail this test.
        types.Should().NotBeEmpty();
        types.Count.Should().BeGreaterThanOrEqualTo(25);
        types.Should().Contain(Pacs008);
    }

    [Fact]
    public void GetFields_Pacs008_ReturnsNonEmptyTree()
    {
        var fields = Service.GetFields(Pacs008);
        fields.Should().NotBeNull();
        fields!.Should().NotBeEmpty();
    }

    [Fact]
    public void GetFields_Pacs008_MessageRootHasDepthZero()
    {
        var fields = Service.GetFields(Pacs008)!;
        // FIToFICstmrCdtTrf is the single top-level element of pacs.008's
        // <Document>; the extractor surfaces it at depth 0.
        var root = fields.Single(f => f.Name == "FIToFICstmrCdtTrf");
        root.Depth.Should().Be(0);
        root.IsComplex.Should().BeTrue();
    }

    [Fact]
    public void GetFields_Pacs008_MsgIdInsideGrpHdr_HasExpectedXPath()
    {
        var fields = Service.GetFields(Pacs008)!;
        // We don't assert MsgId is the only one — there's an OrgnlMsgId
        // deeper down — just that an entry exists with the GrpHdr/MsgId path.
        AllFields(fields)
            .Should().Contain(f => f.XPath == "FIToFICstmrCdtTrf/GrpHdr/MsgId");
    }

    [Fact]
    public void Search_MsgId_ReturnsAtLeastOneResult()
    {
        var results = Service.Search("MsgId");
        results.Should().NotBeEmpty();
        results.Should().Contain(r => r.FieldName == "MsgId");
    }

    [Fact]
    public void Search_MsgId_FlagsConsistencyCoherently()
    {
        // The flag exists to tell the UI whether to render the "varies by
        // type" warning. We assert internal coherence: the IsConsistent bit
        // must agree with whether any Differences were recorded — never
        // "consistent but differences" or "inconsistent but no differences".
        var msgId = Service.Search("MsgId").Single(r => r.FieldName == "MsgId");
        msgId.Occurrences.Should().NotBeEmpty();
        if (msgId.IsConsistent)
            msgId.Differences.Should().BeEmpty();
        else
            msgId.Differences.Should().NotBeEmpty();
    }

    [Fact]
    public void FindField_MsgId_ReturnsOccurrencesInMultipleMessageTypes()
    {
        var occurrences = Service.FindField("MsgId");
        occurrences.Should().NotBeEmpty();
        occurrences.Select(o => o.MessageType).Distinct().Count().Should().BeGreaterThan(1);
    }

    [Fact]
    public void GetFields_InvalidMessageType_ReturnsNull()
    {
        Service.GetFields("not.a.real.type.0").Should().BeNull();
    }

    [Fact]
    public void GetNamespace_Pacs008_ReturnsNonEmptyNamespace()
    {
        var ns = Service.GetNamespace(Pacs008);
        ns.Should().NotBeNullOrWhiteSpace();
        ns.Should().StartWith("urn:iso:std:iso:20022:tech:xsd:pacs.008");
    }

    [Fact]
    public void GetNamespace_UnknownType_ReturnsNull()
    {
        Service.GetNamespace("not.a.real.type.0").Should().BeNull();
    }

    [Fact]
    public void XmlExampleGenerator_GenerateWithHighlight_WrapsTargetWithMarkers()
    {
        // Drive the generator with the real pacs.008 field tree so we exercise
        // the actual XSD-derived hierarchy, not a hand-rolled stub.
        var fields = Service.GetFields(Pacs008)!;
        var ns = Service.GetNamespace(Pacs008)!;
        var generator = new XmlExampleGenerator();

        var xml = generator.GenerateWithHighlight(ns, fields, "FIToFICstmrCdtTrf/GrpHdr/MsgId");

        xml.Should().Contain("<!-- ▶ MsgId -->");
        xml.Should().Contain("<!-- ◀ -->");
        xml.Should().Contain("<MsgId>");
        // Ancestor scaffolding is forced into the output even though
        // FIToFICstmrCdtTrf/GrpHdr are containers — without them the highlighted
        // node would be orphaned.
        xml.Should().Contain("<FIToFICstmrCdtTrf>");
        xml.Should().Contain("<GrpHdr>");
    }

    private static IEnumerable<FieldDefinition> AllFields(IEnumerable<FieldDefinition> roots)
    {
        foreach (var f in roots)
        {
            yield return f;
            foreach (var c in AllFields(f.Children))
                yield return c;
        }
    }
}
