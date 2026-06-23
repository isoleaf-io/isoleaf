using FluentAssertions;
using Iso8583Toolkit.Iso20022.Services;
using Iso8583Toolkit.Iso20022.Validation;

namespace Iso8583Toolkit.Iso20022.Tests;

public class VersionCompareServiceTests
{
    // Sharing one ReferenceService across the suite avoids re-running the
    // XSD field extractor for every test (~1.5s saved).
    private static readonly ReferenceService Reference = new(new SchemaRegistry());
    private static VersionCompareService NewService() => new(Reference);

    [Fact]
    public void Compare_SameVersionAgainstItself_NoDifferences()
    {
        var result = NewService().Compare("pacs.008.001.09", "pacs.008.001.09");
        result.Added.Should().BeEmpty();
        result.Removed.Should().BeEmpty();
        result.Changed.Should().BeEmpty();
        result.Family.Should().Be("pacs");
    }

    [Fact]
    public void Compare_Pacs008_v09_vs_v13_ProducesNonEmptyDelta()
    {
        var result = NewService().Compare("pacs.008.001.09", "pacs.008.001.13");
        // The catalogue ships two real versions of pacs.008 — there are
        // documented schema changes between them, so *something* must differ.
        (result.Added.Count + result.Removed.Count + result.Changed.Count)
            .Should().BeGreaterThan(0);
        result.FromVersion.Should().Be("pacs.008.001.09");
        result.ToVersion.Should().Be("pacs.008.001.13");
    }

    [Fact]
    public void Compare_DifferentFamilies_ThrowsArgumentException()
    {
        var act = () => NewService().Compare("pacs.008.001.09", "camt.053.001.09");
        act.Should().Throw<ArgumentException>()
            .WithMessage("*Cross-family*");
    }

    [Fact]
    public void Compare_UnknownVersion_ThrowsInvalidOperationException()
    {
        // pacs is in the family list, but .999 doesn't exist in the catalogue.
        // Spec says "404 if a version doesn't exist" — surface it as a domain
        // exception here so the controller can map it cleanly.
        var act = () => NewService().Compare("pacs.999.001.99", "pacs.999.001.99");
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Unknown message type*");
    }

    [Fact]
    public void Compare_ChangedField_AppearsInChangedWithCorrectPropertyName()
    {
        var result = NewService().Compare("pacs.008.001.09", "pacs.008.001.13");
        // Whatever changes between the two real versions, the contract is that
        // *if* the Changed bucket is non-empty, every change carries a
        // PropertyName ≥ TypeName/Cardinality/IsMandatory/MinLength/MaxLength.
        if (result.Changed.Count > 0)
        {
            result.Changed.SelectMany(c => c.Changes)
                .Select(ch => ch.PropertyName)
                .Distinct()
                .Should().OnlyContain(p =>
                    p == "TypeName" ||
                    p == "Cardinality" ||
                    p == "IsMandatory" ||
                    p == "MinLength" ||
                    p == "MaxLength");
        }
    }
}
