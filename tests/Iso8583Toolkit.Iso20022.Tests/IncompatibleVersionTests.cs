using FluentAssertions;
using Iso8583Toolkit.Iso20022.Exceptions;
using Iso8583Toolkit.Iso20022.Services;
using Iso8583Toolkit.Iso20022.Services.Summary;
using Iso8583Toolkit.Iso20022.Validation;

namespace Iso8583Toolkit.Iso20022.Tests;

public class IncompatibleVersionTests
{
    private static Iso20022ParserService NewParser() =>
        new(new SchemaRegistry(), new SummaryService());

    [Fact]
    public void Parse_OldPacs002Version_ThrowsWithCompatibleVersionsListingSupportedOne()
    {
        // pacs.002.001.08 is older than the versions we ship (.001.11 + .001.15).
        // The exception must carry both supported versions so the UI can show them.
        const string xml = """
            <?xml version="1.0"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.002.001.08">
              <FIToFIPmtStsRpt/>
            </Document>
            """;

        var act = () => NewParser().Parse(xml);

        var ex = act.Should().Throw<IncompatibleVersionException>().Which;
        ex.DetectedNamespace.Should().Be("urn:iso:std:iso:20022:tech:xsd:pacs.002.001.08");
        ex.CompatibleVersions.Should().Contain("urn:iso:std:iso:20022:tech:xsd:pacs.002.001.11");
        ex.CompatibleVersions.Should().OnlyContain(ns => ns.Contains("pacs.002"));
        ex.Message.Should().Contain("pacs.002.001.11");
    }

    [Fact]
    public void Parse_CompletelyUnknownFamily_ThrowsWithEmptyCompatibleVersions()
    {
        // acmt is not in our registry at all — neither acmt.999 nor any other
        // acmt variant is shipped. Compatible list should be empty and the
        // message should call out "unknown message type".
        const string xml = """
            <?xml version="1.0"?>
            <Document xmlns="urn:iso:std:iso:20022:tech:xsd:acmt.999.001.01"/>
            """;

        var act = () => NewParser().Parse(xml);

        var ex = act.Should().Throw<IncompatibleVersionException>().Which;
        ex.CompatibleVersions.Should().BeEmpty();
        ex.Message.Should().Contain("Unknown message type");
    }

    [Fact]
    public void GetCompatibleVersions_OldPacs002Namespace_ReturnsSupportedPacs002Namespaces()
    {
        var registry = new SchemaRegistry();

        var versions = registry.GetCompatibleVersions("urn:iso:std:iso:20022:tech:xsd:pacs.002.001.05");

        versions.Should().NotBeEmpty();
        versions.Should().Contain("urn:iso:std:iso:20022:tech:xsd:pacs.002.001.11");
        // The list is filtered to the same family — no pacs.008/pacs.003 leakage.
        versions.Should().OnlyContain(ns => ns.Contains("pacs.002"));
    }
}
