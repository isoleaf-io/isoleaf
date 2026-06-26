using FluentAssertions;
using Iso8583Toolkit.Iso20022.Builder;
using Iso8583Toolkit.Iso20022.Schema;
using Iso8583Toolkit.Iso20022.Services;
using Iso8583Toolkit.Iso20022.Validation;
using System.Linq;

namespace Iso8583Toolkit.Iso20022.Tests;

public class BuilderServiceTests
{
    // Shared infra — ReferenceService construction takes ~1.5s, so the suite
    // builds it once and threads it through every test.
    private static readonly ReferenceService Reference = new(new SchemaRegistry());
    private static readonly ScenarioRegistry Scenarios = new();
    private static readonly BuilderService Builder =
        new(Reference, Scenarios, new XmlExampleGenerator());

    [Fact]
    public void Build_Pacs008_PixCreditTransfer_AppliesPixOverridesInXml()
    {
        var result = Builder.Build("pacs.008.001.09", "pix-credit-transfer");

        // The override map contains BRL + CLRG; both must end up in the
        // rendered XML, not the generic placeholder.
        result.Xml.Should().Contain("BRL");
        result.Xml.Should().Contain("CLRG");
        result.MessageType.Should().Be("pacs.008.001.09");
        result.ScenarioId.Should().Be("pix-credit-transfer");
    }

    [Fact]
    public void Build_Pacs008_Generic_DoesNotApplyEcosystemDefaults()
    {
        var result = Builder.Build("pacs.008.001.09", "generic");

        // No override map → XML uses the engine's default placeholders. The
        // sample is also valid, so we just assert the absence of the Pix
        // tells — no SLEV charge bearer, no CLRG settlement method.
        result.Xml.Should().NotContain("SLEV");
        result.Xml.Should().NotContain("CLRG");
    }

    [Fact]
    public void GetScenarios_BrazilianPix_ReturnsAtLeastThreeScenarios()
    {
        var scenarios = Scenarios.GetScenarios("brazilian-pix");
        scenarios.Count.Should().BeGreaterThanOrEqualTo(3);
        scenarios.Should().Contain(s => s.ScenarioId == "pix-credit-transfer");
    }

    [Fact]
    public void GetScenariosForMessageType_SwiftCbpr_Pacs008_ContainsDirectPayment()
    {
        var scenarios = Scenarios.GetScenariosForMessageType("swift-cbpr", "pacs.008.001.09");
        scenarios.Should().Contain(s => s.ScenarioId == "cbpr-direct-payment");
        // Generic scenarios live under their own ecosystem — not in CBPR+.
        scenarios.Should().OnlyContain(s => s.EcosystemId == "swift-cbpr");
    }

    [Fact]
    public void Build_CbprDirectPayment_FlagsUetrAsEcosystemMandatory()
    {
        var result = Builder.Build("pacs.008.001.09", "cbpr-direct-payment");

        var uetr = FindField(result.Sections, "FIToFICstmrCdtTrf/CdtTrfTxInf/PmtId/UETR");
        uetr.Should().NotBeNull();
        uetr!.IsEcosystemMandatory.Should().BeTrue();
        uetr.Hint.Should().NotBeNull();
    }

    [Fact]
    public void Build_UnknownScenarioId_ThrowsArgumentException()
    {
        var act = () => Builder.Build("pacs.008.001.09", "not-a-real-scenario");
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void PixCreditTransfer_DeclaresAtLeastSixEcosystemMandatoryXPaths()
    {
        var scenario = Scenarios.GetScenario("pix-credit-transfer");
        scenario.Should().NotBeNull();
        // SPI/BCB requires payer name + CPF, both PSPs by ISPB, payee name +
        // Pix key — six entries minimum even though the XSD lets them slide.
        scenario!.AdditionalMandatoryXPaths.Should().HaveCountGreaterThanOrEqualTo(6);
        scenario.AdditionalMandatoryXPaths.Should().Contain(
            "FIToFICstmrCdtTrf/CdtTrfTxInf/Dbtr/Id/OrgId/Othr/Id");
        scenario.AdditionalMandatoryXPaths.Should().Contain(
            "FIToFICstmrCdtTrf/CdtTrfTxInf/CdtrAcct/Id/Othr/Id");
    }

    [Fact]
    public void Build_Pacs008_PixCreditTransfer_EndToEndIdMatchesBcbFormat()
    {
        var result = Builder.Build("pacs.008.001.09", "pix-credit-transfer");

        var e2e = FindField(result.Sections, "FIToFICstmrCdtTrf/CdtTrfTxInf/PmtId/EndToEndId");
        e2e.Should().NotBeNull();
        // BCB spec: "E" + ISPB(8) + AAAAMMDD(8) + HHMMSS(6) + sequencial(11)
        // = 32 chars total, always starting with 'E'.
        e2e!.Value.Should().NotBeNull();
        e2e.Value!.Length.Should().Be(32);
        e2e.Value.Should().StartWith("E");
    }

    [Fact]
    public void Build_Pacs008_PixCreditTransfer_KeepsResponseUnderFiftyFields()
    {
        var result = Builder.Build("pacs.008.001.09", "pix-credit-transfer");
        var totalFields = CountFields(result.Sections);
        // Pre-filter the response carried every optional branch (30k+ lines
        // for pacs.008). Mandatory + ecosystem-mandatory fits in ~20.
        totalFields.Should().BeLessThan(50);
    }

    [Fact]
    public void Build_Pacs008_PixCreditTransfer_AppliesOverrideOnDbtrName()
    {
        var result = Builder.Build("pacs.008.001.09", "pix-credit-transfer");
        var dbtrNm = FindField(result.Sections, "FIToFICstmrCdtTrf/CdtTrfTxInf/Dbtr/Nm");
        dbtrNm.Should().NotBeNull();
        dbtrNm!.Value.Should().Be("João Silva");
        dbtrNm.IsEcosystemMandatory.Should().BeTrue();
    }

    [Fact]
    public void Build_Pacs008_PixCreditTransfer_AppliesOverrideOnDbtrAgtBicfi()
    {
        var result = Builder.Build("pacs.008.001.09", "pix-credit-transfer");
        var bicfi = FindField(
            result.Sections,
            "FIToFICstmrCdtTrf/CdtTrfTxInf/DbtrAgt/FinInstnId/BICFI");
        bicfi.Should().NotBeNull();
        bicfi!.Value.Should().Be("BRASBRRJXXX");
        bicfi.IsEcosystemMandatory.Should().BeTrue();
    }

    [Fact]
    public void Build_Pacs008_PixCreditTransfer_NoFieldNameStartsWithAt()
    {
        var result = Builder.Build("pacs.008.001.09", "pix-credit-transfer");
        var offenders = CollectFieldNames(result.Sections)
            .Where(n => n.StartsWith('@'))
            .ToList();
        offenders.Should().BeEmpty(
            "attribute pseudo-fields (e.g. @Ccy) must not surface as editor rows");
    }

    [Fact]
    public void Build_Pacs008_Generic_StructureStaysShallow()
    {
        var result = Builder.Build("pacs.008.001.09", "generic");
        var maxDepth = MaxXPathDepth(result.Sections);
        // Generic scenario has no ecosystem extras, so depth is the
        // XSD-mandatory closure only — no leaf should sit deeper than 4
        // slashes (e.g. FIToFI.../CdtTrfTxInf/PmtId/EndToEndId = 4).
        maxDepth.Should().BeLessThanOrEqualTo(4);
    }

    [Fact]
    public void Build_Pacs008_PixCreditTransfer_XmlOmitsPrvtIdChoiceArm()
    {
        var result = Builder.Build("pacs.008.001.09", "pix-credit-transfer");
        // OrgId is the choice arm carrying the Pix CPF override; PrvtId
        // (the sibling arm) must stay out of the rendered XML.
        result.Xml.Should().NotContain("<PrvtId");
    }

    [Fact]
    public void Build_Pacs008_PixCreditTransfer_XmlOmitsIbanInCreditorAccount()
    {
        var result = Builder.Build("pacs.008.001.09", "pix-credit-transfer");
        // CdtrAcct/Id is a choice between IBAN and Othr; Pix uses a key
        // (email / phone / EVP) under Othr, so IBAN must not appear.
        result.Xml.Should().NotContain("<IBAN>");
    }

    [Fact]
    public void Build_Pacs008_PixCreditTransfer_XmlContainsPixKeyUnderOthr()
    {
        var result = Builder.Build("pacs.008.001.09", "pix-credit-transfer");
        result.Xml.Should().Contain("<Othr>");
        result.Xml.Should().Contain("maria@email.com");
    }

    [Fact]
    public void PixCreditNotification_RegisteredUnderBrazilianPix()
    {
        var scenario = Scenarios.GetScenario("pix-credit-notification");
        scenario.Should().NotBeNull();
        scenario!.EcosystemId.Should().Be("brazilian-pix");
        scenario.MessageTypePrefix.Should().Be("camt.054");
    }

    [Fact]
    public void SepaInitiation_RegisteredWithPmtMtdTrfOverride()
    {
        var scenario = Scenarios.GetScenario("sepa-initiation");
        scenario.Should().NotBeNull();
        scenario!.MessageTypePrefix.Should().Be("pain.001");
        scenario.FieldOverrides.Should().ContainKey("CstmrCdtTrfInitn/PmtInf/PmtMtd")
            .WhoseValue.Should().Be("TRF");
    }

    [Fact]
    public void CbprStatusRequest_RegisteredWithOrgnlUetrMandatory()
    {
        var scenario = Scenarios.GetScenario("cbpr-status-request");
        scenario.Should().NotBeNull();
        scenario!.MessageTypePrefix.Should().Be("pacs.028");
        scenario.AdditionalMandatoryXPaths.Should().Contain(
            "FIToFIPmtStsReq/TxInf/OrgnlUETR");
    }

    [Fact]
    public void CbprCancellation_RegisteredWithCxlRsnCodeOverride()
    {
        var scenario = Scenarios.GetScenario("cbpr-cancellation");
        scenario.Should().NotBeNull();
        scenario!.MessageTypePrefix.Should().Be("camt.056");
        scenario.FieldOverrides.Should().ContainKey(
            "FIToFIPmtCxlReq/Undrlyg/TxInf/CxlRsnInf/Rsn/Cd");
    }

    [Fact]
    public void T2Cancellation_RegisteredWithEurosystemBicOverride()
    {
        var scenario = Scenarios.GetScenario("t2-cancellation");
        scenario.Should().NotBeNull();
        scenario!.MessageTypePrefix.Should().Be("camt.056");
        scenario.FieldOverrides.Values.Should().Contain("TRGTXE2XXXX");
    }

    [Fact]
    public void T2FiTransfer_AmountCurrencyOverrideIsNotBrl()
    {
        var scenario = Scenarios.GetScenario("t2-fi-transfer");
        scenario.Should().NotBeNull();
        scenario!.FieldOverrides.Should().ContainKey(
            "FICdtTrf/CdtTrfTxInf/IntrBkSttlmAmt/@Ccy");
        scenario.FieldOverrides["FICdtTrf/CdtTrfTxInf/IntrBkSttlmAmt/@Ccy"]
            .Should().NotBe("BRL").And.Be("EUR");
    }

    private static int CountFields(IReadOnlyList<BuildSection> sections)
    {
        var total = 0;
        foreach (var s in sections)
        {
            total += s.Fields.Count;
            total += CountFields(s.Sections);
        }
        return total;
    }

    private static IEnumerable<string> CollectFieldNames(IReadOnlyList<BuildSection> sections)
    {
        foreach (var s in sections)
        {
            yield return s.Name;
            foreach (var f in s.Fields) yield return f.Name;
            foreach (var name in CollectFieldNames(s.Sections)) yield return name;
        }
    }

    private static int MaxXPathDepth(IReadOnlyList<BuildSection> sections)
    {
        var max = 0;
        foreach (var s in sections)
        {
            max = Math.Max(max, s.XPath.Count(c => c == '/'));
            foreach (var f in s.Fields)
                max = Math.Max(max, f.XPath.Count(c => c == '/'));
            max = Math.Max(max, MaxXPathDepth(s.Sections));
        }
        return max;
    }

    private static BuildField? FindField(IReadOnlyList<BuildSection> sections, string xpath)
    {
        foreach (var s in sections)
        {
            var direct = s.Fields.FirstOrDefault(f => f.XPath == xpath);
            if (direct != null) return direct;
            var deeper = FindField(s.Sections, xpath);
            if (deeper != null) return deeper;
        }
        return null;
    }
}
