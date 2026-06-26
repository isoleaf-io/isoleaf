using Iso8583Toolkit.Iso20022.Schema;
using Iso8583Toolkit.Iso20022.Services;

namespace Iso8583Toolkit.Iso20022.Builder;

public sealed record BuildField(
    string Name,
    string XPath,
    string? Value,
    string TypeName,
    bool IsMandatory,
    bool IsEcosystemMandatory,
    bool IsOptional,
    string? Hint,
    IReadOnlyList<string> Enumerations,
    int? MinLength,
    int? MaxLength,
    string? Pattern);

public sealed record BuildSection(
    string Name,
    string XPath,
    bool IsMandatory,
    IReadOnlyList<BuildField> Fields,
    IReadOnlyList<BuildSection> Sections);

public sealed record BuildResult(
    string MessageType,
    string ScenarioId,
    string Xml,
    IReadOnlyList<BuildSection> Sections);

/// <summary>
/// Coordinates the three pieces the Builder UI needs: the field-tree of the
/// chosen message type (from <see cref="ReferenceService"/>), the scenario
/// overlay (from <see cref="ScenarioRegistry"/>) and the rendered XML
/// skeleton (from <see cref="XmlExampleGenerator"/>). Stateless after
/// construction — safe as a singleton.
/// </summary>
public sealed class BuilderService
{
    private readonly ReferenceService _referenceService;
    private readonly ScenarioRegistry _scenarioRegistry;
    private readonly XmlExampleGenerator _xmlExampleGenerator;

    public BuilderService(
        ReferenceService referenceService,
        ScenarioRegistry scenarioRegistry,
        XmlExampleGenerator xmlExampleGenerator)
    {
        ArgumentNullException.ThrowIfNull(referenceService);
        ArgumentNullException.ThrowIfNull(scenarioRegistry);
        ArgumentNullException.ThrowIfNull(xmlExampleGenerator);
        _referenceService = referenceService;
        _scenarioRegistry = scenarioRegistry;
        _xmlExampleGenerator = xmlExampleGenerator;
    }

    /// <summary>
    /// Builds the builder payload for a message type and scenario, including
    /// the section/field tree and generated XML example.
    /// </summary>
    /// <exception cref="InvalidOperationException">When the message type isn't loaded in the registry.</exception>
    /// <exception cref="ArgumentException">When the scenario id is unknown.</exception>
    public BuildResult Build(
        string messageType,
        string scenarioId,
        IReadOnlyList<string>? includeOptionalXPaths = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(messageType);
        ArgumentException.ThrowIfNullOrWhiteSpace(scenarioId);

        var scenario = _scenarioRegistry.GetScenario(scenarioId)
            ?? throw new ArgumentException(
                $"Unknown scenario id: '{scenarioId}'.",
                nameof(scenarioId));

        var fields = _referenceService.GetFields(messageType)
            ?? throw new InvalidOperationException(
                $"Unknown message type: '{messageType}'.");

        var xmlNamespace = _referenceService.GetNamespace(messageType)
            ?? throw new InvalidOperationException(
                $"Namespace not registered for message type: '{messageType}'.");

        var ecosystemXPaths = new HashSet<string>(
            scenario.AdditionalMandatoryXPaths,
            StringComparer.Ordinal);

        var addedOptional = includeOptionalXPaths is null
            ? new HashSet<string>(StringComparer.Ordinal)
            : new HashSet<string>(includeOptionalXPaths, StringComparer.Ordinal);

        // Project the field tree into sections containing ONLY mandatory
        // (XSD) + ecosystem-mandatory + explicitly-added optional entries.
        // Until this filter landed, the response carried every optional
        // 10-deep branch (≈30k lines for pacs.008); a Pix build now fits
        // in a few hundred.
        var sections = fields
            .Where(f => ShouldEmit(f, ecosystemXPaths, addedOptional))
            .Select(f => BuildSectionNode(f, scenario, ecosystemXPaths, addedOptional))
            .OfType<BuildSection>()
            .ToList();

        // Ecosystem-mandatory + added-optional both need to make it into
        // the rendered XML on top of XSD-mandatory; merging the two sets
        // gives the generator a single "force this XPath" instruction.
        // Expand with ancestor XPaths so adding "A/B/C" from the search
        // bar also opens "A" and "A/B" without the user having to drill
        // down manually first.
        var xmlInclude = new HashSet<string>(StringComparer.Ordinal);
        foreach (var x in addedOptional) AddWithAncestors(xmlInclude, x);
        foreach (var x in ecosystemXPaths) AddWithAncestors(xmlInclude, x);

        var xml = _xmlExampleGenerator.GenerateMinimal(
            xmlNamespace, fields, scenario.FieldOverrides, xmlInclude);

        return new BuildResult(messageType, scenarioId, xml, sections);
    }

    /// <summary>
    /// A field/section makes it into the response when it (or any of its
    /// descendants) is XSD-mandatory, ecosystem-mandatory, or has been
    /// explicitly added via the editor's "+" picker. Pure-optional branches
    /// stay out — they're reachable via the available-fields endpoint.
    /// </summary>
    private static bool ShouldEmit(
        FieldDefinition field,
        IReadOnlySet<string> ecosystemXPaths,
        IReadOnlySet<string> addedOptional)
    {
        if (field.IsMandatory) return true;
        if (ecosystemXPaths.Contains(field.XPath)) return true;
        if (addedOptional.Contains(field.XPath)) return true;
        if (field.IsComplex)
            return HasMandatoryDescendant(field, ecosystemXPaths, addedOptional);
        return false;
    }

    /// <summary>
    /// Walks descendants looking for an entry the user has explicitly
    /// opted in to — either ecosystem-mandatory or added via the editor.
    /// XSD-mandatory descendants alone don't pull an optional ancestor
    /// in; that's what kept ~500 noise fields in pacs.008 (every optional
    /// CashAccount has a mandatory Id under it, every optional party has
    /// a mandatory choice arm, etc.). The user must mark the leaf they
    /// care about for the section path to open up.
    /// </summary>
    private static bool HasMandatoryDescendant(
        FieldDefinition field,
        IReadOnlySet<string> ecosystemXPaths,
        IReadOnlySet<string> addedOptional)
    {
        if (!field.IsComplex) return false;
        foreach (var child in field.Children)
        {
            if (ecosystemXPaths.Contains(child.XPath)) return true;
            if (addedOptional.Contains(child.XPath)) return true;
            if (child.IsComplex
                && HasMandatoryDescendant(child, ecosystemXPaths, addedOptional))
                return true;
        }
        return false;
    }

    /// <summary>
    /// Recursive walker that emits a <see cref="BuildSection"/> for a
    /// complex node (or a <see cref="BuildField"/> for the
    /// CurrencyAndAmount leaf-like case). Children are filtered by
    /// <see cref="ShouldEmit"/>; attribute pseudo-fields ("@Ccy", "@Id"…)
    /// are dropped on the way out as a defensive guard — XsdFieldExtractor
    /// doesn't emit them today, but the filter makes the contract explicit.
    /// </summary>
    private object BuildSectionNode(
        FieldDefinition field,
        ScenarioDefinition scenario,
        IReadOnlySet<string> ecosystemXPaths,
        IReadOnlySet<string> addedOptional)
    {
        if (field.IsComplex && !XmlExampleGenerator.IsLeafLikeComplex(field))
        {
            var mandatoryFields = field.Children
                .Where(c => !c.IsComplex
                            && !c.Name.StartsWith('@')
                            && ShouldEmit(c, ecosystemXPaths, addedOptional))
                .Select(c => BuildLeaf(c, scenario, ecosystemXPaths))
                .ToList();

            var mandatorySections = field.Children
                .Where(c => c.IsComplex
                            && ShouldEmit(c, ecosystemXPaths, addedOptional))
                .Select(c => BuildSectionNode(c, scenario, ecosystemXPaths, addedOptional))
                .OfType<BuildSection>()
                .ToList();

            // Leaf-like complex children (CurrencyAndAmount) get folded into
            // the fields bucket so the UI shows an input next to their siblings.
            var leafLikeAmounts = field.Children
                .Where(c => c.IsComplex
                            && XmlExampleGenerator.IsLeafLikeComplex(c)
                            && ShouldEmit(c, ecosystemXPaths, addedOptional))
                .Select(c => BuildLeaf(c, scenario, ecosystemXPaths))
                .ToList();

            return new BuildSection(
                Name: field.Name,
                XPath: field.XPath,
                IsMandatory: field.IsMandatory,
                Fields: mandatoryFields.Concat(leafLikeAmounts).ToList(),
                Sections: mandatorySections);
        }

        return BuildLeaf(field, scenario, ecosystemXPaths);
    }

    private static void AddWithAncestors(HashSet<string> set, string xpath)
    {
        if (string.IsNullOrEmpty(xpath)) return;
        set.Add(xpath);
        var slash = xpath.LastIndexOf('/');
        while (slash > 0)
        {
            xpath = xpath[..slash];
            if (!set.Add(xpath)) return; // ancestor already in — chain explored.
            slash = xpath.LastIndexOf('/');
        }
    }

    private BuildField BuildLeaf(
        FieldDefinition field,
        ScenarioDefinition scenario,
        IReadOnlySet<string> ecosystemXPaths)
    {
        var isXsdMandatory = field.IsMandatory;
        var isEcoMandatory = ecosystemXPaths.Contains(field.XPath);
        var hasOverride = scenario.FieldOverrides.TryGetValue(field.XPath, out var overrideValue);
        // Default-value rule: scenario override wins on the full XPath;
        // otherwise pull the placeholder used in the XML so the form
        // matches the document.
        var value = hasOverride ? overrideValue : _xmlExampleGenerator.DefaultValueFor(field);

        return new BuildField(
            Name: field.Name,
            XPath: field.XPath,
            Value: value,
            TypeName: field.TypeName,
            IsMandatory: isXsdMandatory,
            IsEcosystemMandatory: isEcoMandatory,
            IsOptional: !isXsdMandatory && !isEcoMandatory,
            Hint: scenario.FieldHints.GetValueOrDefault(field.XPath),
            Enumerations: field.Enumerations,
            MinLength: field.MinLength,
            MaxLength: field.MaxLength,
            Pattern: field.Pattern);
    }
}
