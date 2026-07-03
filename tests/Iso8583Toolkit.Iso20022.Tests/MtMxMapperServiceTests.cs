using System.Xml.Linq;
using FluentAssertions;
using Iso8583Toolkit.Iso20022.Schema;
using Iso8583Toolkit.Iso20022.Services;
using Iso8583Toolkit.Iso20022.Validation;
using Iso8583Toolkit.Iso20022.Swift.Mt;

namespace Iso8583Toolkit.Iso20022.Tests;

public class MtMxMapperServiceTests
{
    // Shared expensive infrastructure — SchemaRegistry parses every
    // embedded XSD on construction, ReferenceService walks each schema
    // for the field tree. Reuse across every Fact.
    private static readonly SchemaRegistry SchemaReg = new();
    private static readonly ReferenceService Reference = new(SchemaReg);
    private static readonly XmlExampleGenerator XmlGen = new();
    private static readonly Iso20022ValidatorService Validator = new(SchemaReg);
    private static readonly MtParserService Parser = new();
    private static readonly MtMxMapperService Mapper =
        new(Parser, SchemaReg, Reference, XmlGen, Validator);

    private const string Mt103 = """
        {1:F01CHASUS33AXXX0000000000}{2:I103HSBCGB2LXXXXN}{3:{121:550e8400-e29b-41d4-a716-446655440000}}{4:
        :20:REF-2024-001
        :23B:CRED
        :32A:240115USD12500,00
        :50K:/123456789
        ACME CORPORATION
        123 MAIN STREET
        NEW YORK NY 10001
        :52A:CHASUS33XXX
        :57A:HSBCGB2LXXX
        :59:/GB29NWBK60161331926819
        GLOBAL TRADING LTD
        456 ELM STREET
        LONDON EC1A 1BB
        :70:INVOICE 2024-001
        :71A:SHA
        -}{5:{CHK:AABBCCDDEE11}}
        """;

    private const string Mt202Cov = """
        {1:F01CHASUS33AXXX0000000000}{2:I202COVBANKDEFFXXXXN}{3:{121:aaaabbbb-cccc-4ddd-8eee-ffff00001111}}{4:
        :20:COV-REF-001
        :21:UNDERLYING-MT103
        :32A:240115USD10000,00
        :52A:CHASUS33XXX
        :57A:BANKDEFFXXX
        :58A:BENFDEFFXXX
        -}
        """;

    [Fact]
    public void BuildMappingTable_Mt103_ReturnsPacs008Target()
    {
        var table = Mapper.BuildMappingTable(Mt103);
        table.MessageType.Should().Be("MT103");
        table.TargetMxType.Should().Be("pacs.008.001.13");
        table.Rows.Should().NotBeEmpty();
    }

    [Fact]
    public void BuildMappingTable_Mt202Cov_ReturnsPacs009Target()
    {
        var table = Mapper.BuildMappingTable(Mt202Cov);
        table.MessageType.Should().Be("MT202COV");
        table.TargetMxType.Should().Be("pacs.009.001.12");
    }

    [Fact]
    public void Convert_Mt103_PopulatesIntrBkSttlmAmtAndCcy()
    {
        var result = Mapper.Convert(new MtMxConvertRequest(Mt103, TargetVersion: null, UserOverrides: null));
        result.GeneratedMxType.Should().Be("pacs.008.001.13");

        var doc = XDocument.Parse(result.Xml);
        var amt = doc.Descendants()
            .Single(e => e.Name.LocalName == "IntrBkSttlmAmt");
        amt.Attribute("Ccy")!.Value.Should().Be("USD");
        amt.Value.Should().Be("12500.00");
    }

    [Fact]
    public void Convert_Mt103_WithDbtrAcctOverride_UsesUserValue()
    {
        // The user's Mode A choice for :50K: /conta must ripple into the
        // generated pacs.008 DbtrAcct/Id. After the Sprint 9.2 refactor
        // the converter is driven by XmlExampleGenerator overrides
        // keyed on the full XSD XPath (root=FIToFICstmrCdtTrf).
        const string overriddenAcct = "ACCT-USER-CHOSEN-42";
        var overrides = new Dictionary<string, string>
        {
            ["FIToFICstmrCdtTrf/CdtTrfTxInf/DbtrAcct/Id/Othr/Id"] = overriddenAcct,
        };
        var result = Mapper.Convert(new MtMxConvertRequest(Mt103, TargetVersion: null, UserOverrides: overrides));

        var doc = XDocument.Parse(result.Xml);
        var acctId = doc.Descendants()
            .Where(e => e.Name.LocalName == "DbtrAcct")
            .Descendants()
            .Single(e => e.Name.LocalName == "Id" && !e.HasElements);
        acctId.Value.Should().Be(overriddenAcct);
    }

    [Fact]
    public void Convert_Mt103_GeneratedXmlPassesXsdValidation()
    {
        // Sprint 9.2 fix #3 — end-to-end regression for the XSD
        // element-order fix in BuildCdtTrfTxInf. Before the reorder,
        // the generated XML was well-formed but the validator rejected
        // it with sequence errors ("Dbtr expected here, DbtrAgt found").
        var result = Mapper.Convert(new MtMxConvertRequest(Mt103, TargetVersion: null, UserOverrides: null));
        var validation = Validator.Validate(result.Xml);

        validation.IsValid.Should().BeTrue(
            $"generated pacs.008 must satisfy the XSD sequence — "
            + $"got {validation.ErrorCount} errors: "
            + string.Join(" | ", validation.Issues
                .Where(i => i.Severity == "error")
                .Select(i => i.Message)));
        validation.ErrorCount.Should().Be(0);
    }

    [Fact]
    public void Convert_Mt103_XmlHasDeclarationAndNamespace()
    {
        // Sprint 9.2 fix #1 — the generated pacs.008 must ship with a
        // real <?xml version="1.0" encoding="UTF-8"?> prolog and the
        // official namespace on <Document> so downstream tools (XSD
        // validator, MX parser, "Abrir no Parser") pick it up cleanly.
        var result = Mapper.Convert(new MtMxConvertRequest(Mt103, TargetVersion: null, UserOverrides: null));
        result.Xml.Should().StartWith("<?xml");
        // XmlExampleGenerator emits the uppercase form; accept either
        // spelling since XML parsers treat encoding names case-insensitively.
        result.Xml.ToLowerInvariant().Should().Contain("encoding=\"utf-8\"");
        result.Xml.Should()
            .Contain("xmlns=\"urn:iso:std:iso:20022:tech:xsd:pacs.008.001.13\"");

        // XDocument-parseable end-to-end (declaration + body).
        var doc = XDocument.Parse(result.Xml);
        doc.Declaration.Should().NotBeNull();
        doc.Root!.Name.NamespaceName
            .Should().Be("urn:iso:std:iso:20022:tech:xsd:pacs.008.001.13");
    }

    // ── Sprint 9.2 multi-version conversion (Opção B) ─────────────────

    [Fact]
    public void Convert_Mt103_DefaultVersion_UsesMostRecent()
    {
        // No TargetVersion → the converter picks the newest pacs.008
        // XSD embedded in the agent. Assert the header matches whatever
        // SchemaRegistry surfaces so this test survives future XSD bumps.
        var expected = SchemaReg.ListSupportedTypes()
            .Where(t => t.MessageType.StartsWith("pacs.008", StringComparison.Ordinal))
            .OrderByDescending(t => t.MessageType, StringComparer.Ordinal)
            .First().MessageType;

        var result = Mapper.Convert(new MtMxConvertRequest(Mt103, TargetVersion: null, UserOverrides: null));
        result.GeneratedMxType.Should().Be(expected);
    }

    [Fact]
    public void Convert_Mt103_SpecificVersion_UsesRequestedVersion()
    {
        // Ask for the older 001.09 variant explicitly. Namespace on the
        // root MUST match the requested version.
        var result = Mapper.Convert(new MtMxConvertRequest(
            Mt103, TargetVersion: "001.09", UserOverrides: null));

        result.GeneratedMxType.Should().Be("pacs.008.001.09");
        result.Xml.Should().Contain("urn:iso:std:iso:20022:tech:xsd:pacs.008.001.09");
    }

    [Fact]
    public void Convert_Mt103_InvalidVersion_ThrowsArgumentException()
    {
        var act = () => Mapper.Convert(new MtMxConvertRequest(
            Mt103, TargetVersion: "001.99", UserOverrides: null));
        act.Should().Throw<ArgumentException>()
            .WithMessage("*001.99*not available*");
    }

    [Fact]
    public void Convert_Mt103_AllVersions_PassXsdValidation()
    {
        // Every embedded pacs.008 XSD must round-trip through the
        // converter and validate against its own schema. This is the
        // headline benefit of the Opção B refactor — the moment a new
        // pacs.008 version lands in Schemas/pacs it starts being a
        // valid conversion target, no code changes required.
        var versions = SchemaReg.ListSupportedTypes()
            .Where(t => t.MessageType.StartsWith("pacs.008", StringComparison.Ordinal))
            .ToList();

        versions.Should().NotBeEmpty();
        foreach (var v in versions)
        {
            var result = Mapper.Convert(new MtMxConvertRequest(
                Mt103, TargetVersion: v.Version, UserOverrides: null));
            var validation = Validator.Validate(result.Xml);
            validation.IsValid.Should().BeTrue(
                $"pacs.008 version {v.Version} must validate — got "
                + $"{validation.ErrorCount} errors: "
                + string.Join(" | ", validation.Issues
                    .Where(i => i.Severity == "error")
                    .Select(i => i.Message)));
        }
    }

    [Fact]
    public void Compare_Mt103AgainstEquivalentPacs008_MatchesCoreFieldsAndReportsCompatible()
    {
        // Round-trip: MT → Convert → Compare. The core business leaves
        // (amount + ccy, BICs on 52A/57A, Cdtr/Dbtr names, remittance,
        // ChrgBr) must land as Match — regression coverage for the
        // Sprint 9.2 fix #4 path-normalisation in the comparator.
        var generated = Mapper.Convert(new MtMxConvertRequest(Mt103, TargetVersion: null, UserOverrides: null));
        var comparison = Mapper.Compare(Mt103, generated.Xml);

        comparison.IsCompatible.Should().BeTrue(
            $"generated MX must be self-consistent — diverges={comparison.DivergenceCount}, "
            + $"onlyInMt={comparison.OnlyInMtCount}");
        comparison.DivergenceCount.Should().Be(0);
        comparison.MatchCount.Should().BeGreaterThan(0);

        string[] mustMatch =
        [
            "IntrBkSttlmAmt",
            "IntrBkSttlmAmt/@Ccy",
            "DbtrAgt/FinInstnId/BICFI",
            "CdtrAgt/FinInstnId/BICFI",
            "ChrgBr",
        ];
        foreach (var path in mustMatch)
        {
            comparison.Rows.Should().Contain(r =>
                r.MxPath == path && r.Status == MtMxCompareStatus.Match,
                $"path '{path}' must resolve to Match after path normalisation");
        }
    }

    [Fact]
    public void Compare_Mt103AgainstPacs008WithDivergentChrgBr_FlagsIncompatible()
    {
        // Take the freshly generated pacs.008 and flip ChrgBr from SHAR
        // (SHA → SHAR is auto-equivalent) to DEBT — that must surface as
        // a divergence, not a Match.
        var generated = Mapper.Convert(new MtMxConvertRequest(Mt103, TargetVersion: null, UserOverrides: null));
        var doc = XDocument.Parse(generated.Xml);
        doc.Descendants().Single(e => e.Name.LocalName == "ChrgBr").Value = "DEBT";
        var mutated = doc.ToString(SaveOptions.None);

        var comparison = Mapper.Compare(Mt103, mutated);

        comparison.IsCompatible.Should().BeFalse();
        comparison.DivergenceCount.Should().BeGreaterThan(0);
        comparison.Rows.Should().Contain(r =>
            r.MxPath == "ChrgBr" && r.Status == MtMxCompareStatus.Diverge);
    }
}
