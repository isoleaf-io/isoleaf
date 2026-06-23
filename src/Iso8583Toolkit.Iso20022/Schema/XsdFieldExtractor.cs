using System.Xml.Schema;

namespace Iso8583Toolkit.Iso20022.Schema;

/// <summary>
/// Walks a compiled ISO 20022 <see cref="XmlSchema"/> and produces a flat
/// hierarchy of <see cref="FieldDefinition"/>. Stateless — safe to share or
/// instantiate per call. Reused by <c>ReferenceService</c>, and (planned)
/// by the schema-aware Validator and Builder.
/// </summary>
public sealed class XsdFieldExtractor
{
    // Recursion guard. ISO 20022 schemas don't truly self-reference at this
    // depth in practice, but a few have nested batch structures that need
    // breathing room. 20 is comfortably above the deepest observed path.
    private const int MaxDepth = 20;

    public IReadOnlyList<FieldDefinition> Extract(XmlSchema schema)
    {
        ArgumentNullException.ThrowIfNull(schema);

        // Compile so SchemaTypeName references resolve. Each ISO 20022 XSD is
        // self-contained (every type used by Document lives in the same file),
        // so compilation succeeds without satellite schemas.
        var schemaSet = new XmlSchemaSet();
        schemaSet.Add(schema);
        schemaSet.Compile();

        // Every ISO 20022 message has a global <Document> root containing one
        // top-level message element (FIToFICstmrCdtTrf, BkToCstmrStmt, ...).
        var documentElement = schemaSet.GlobalElements.Values
            .OfType<XmlSchemaElement>()
            .FirstOrDefault(e => e.Name == "Document");

        if (documentElement == null)
            return [];

        var messageRoot = GetComplexTypeChildren(documentElement, schemaSet).FirstOrDefault();
        if (messageRoot == null)
            return [];

        return ExtractChildren(messageRoot, schemaSet, parentXPath: string.Empty, depth: 0);
    }

    private IReadOnlyList<FieldDefinition> ExtractChildren(
        XmlSchemaElement element,
        XmlSchemaSet schemaSet,
        string parentXPath,
        int depth)
    {
        if (depth > MaxDepth) return [];

        var xpath = string.IsNullOrEmpty(parentXPath)
            ? element.Name ?? "unknown"
            : $"{parentXPath}/{element.Name}";

        var isComplex = IsComplexType(element, schemaSet);
        var typeName = ResolveTypeName(element, schemaSet);
        var (minOccurs, maxOccurs) = GetCardinality(element);
        var restrictions = GetRestrictions(element, schemaSet);
        var documentation = GetDocumentation(element);
        var children = isComplex && depth < MaxDepth
            ? ExtractChildren(GetComplexTypeChildren(element, schemaSet), schemaSet, xpath, depth + 1)
            : [];

        var field = new FieldDefinition
        {
            Name = element.Name ?? "unknown",
            XPath = xpath,
            Depth = depth,
            TypeName = typeName,
            IsComplex = isComplex,
            MinOccurs = minOccurs,
            MaxOccurs = maxOccurs,
            MinLength = restrictions.MinLength,
            MaxLength = restrictions.MaxLength,
            Pattern = restrictions.Pattern,
            Enumerations = restrictions.Enumerations,
            Documentation = documentation,
            Children = children,
        };

        return [field];
    }

    private IReadOnlyList<FieldDefinition> ExtractChildren(
        IEnumerable<XmlSchemaElement> elements,
        XmlSchemaSet schemaSet,
        string parentXPath,
        int depth)
    {
        var result = new List<FieldDefinition>();
        foreach (var el in elements)
            result.AddRange(ExtractChildren(el, schemaSet, parentXPath, depth));
        return result;
    }

    private static IEnumerable<XmlSchemaElement> GetComplexTypeChildren(
        XmlSchemaElement element,
        XmlSchemaSet schemaSet)
    {
        var complexType = ResolveComplexType(element, schemaSet);
        if (complexType == null) yield break;

        // ContentTypeParticle is the post-compile particle (set by Compile()).
        // Particle is the raw declaration. Prefer the compiled one when present.
        var particle = complexType.ContentTypeParticle ?? complexType.Particle;
        foreach (var child in GetParticleElements(particle, schemaSet))
            yield return child;
    }

    private static IEnumerable<XmlSchemaElement> GetParticleElements(
        XmlSchemaParticle? particle,
        XmlSchemaSet schemaSet)
    {
        switch (particle)
        {
            case XmlSchemaSequence seq:
                foreach (XmlSchemaObject item in seq.Items)
                    foreach (var e in EmitOrRecurse(item, schemaSet))
                        yield return e;
                break;
            case XmlSchemaChoice choice:
                foreach (XmlSchemaObject item in choice.Items)
                    foreach (var e in EmitOrRecurse(item, schemaSet))
                        yield return e;
                break;
            case XmlSchemaAll all:
                foreach (XmlSchemaObject item in all.Items)
                    if (item is XmlSchemaElement el)
                        yield return el;
                break;
        }
    }

    private static IEnumerable<XmlSchemaElement> EmitOrRecurse(XmlSchemaObject item, XmlSchemaSet schemaSet)
    {
        if (item is XmlSchemaElement el) yield return el;
        else if (item is XmlSchemaParticle inner)
            foreach (var e in GetParticleElements(inner, schemaSet))
                yield return e;
    }

    private static XmlSchemaComplexType? ResolveComplexType(
        XmlSchemaElement element,
        XmlSchemaSet schemaSet)
    {
        if (element.SchemaType is XmlSchemaComplexType ct) return ct;

        if (element.SchemaTypeName != null && !element.SchemaTypeName.IsEmpty)
        {
            return schemaSet.GlobalTypes.Values
                .OfType<XmlSchemaComplexType>()
                .FirstOrDefault(t => t.QualifiedName == element.SchemaTypeName);
        }

        if (element.RefName != null && !element.RefName.IsEmpty)
        {
            var refEl = schemaSet.GlobalElements.Values
                .OfType<XmlSchemaElement>()
                .FirstOrDefault(e => e.QualifiedName == element.RefName);
            if (refEl != null) return ResolveComplexType(refEl, schemaSet);
        }

        return null;
    }

    private static bool IsComplexType(XmlSchemaElement element, XmlSchemaSet schemaSet)
        => ResolveComplexType(element, schemaSet) != null;

    private static string ResolveTypeName(XmlSchemaElement element, XmlSchemaSet schemaSet)
    {
        if (element.SchemaType != null)
        {
            return element.SchemaType.Name ?? (IsComplexType(element, schemaSet) ? "complex" : "anonymous");
        }
        if (element.SchemaTypeName != null && !element.SchemaTypeName.IsEmpty)
            return element.SchemaTypeName.Name;
        return "unknown";
    }

    private static (int MinOccurs, int MaxOccurs) GetCardinality(XmlSchemaElement element)
    {
        var min = (int)element.MinOccurs;
        var max = string.Equals(element.MaxOccursString, "unbounded", StringComparison.OrdinalIgnoreCase)
            ? -1
            : (int)element.MaxOccurs;
        return (min, max);
    }

    private sealed record Restrictions(
        int? MinLength, int? MaxLength, string? Pattern, IReadOnlyList<string> Enumerations);

    private static Restrictions GetRestrictions(XmlSchemaElement element, XmlSchemaSet schemaSet)
    {
        XmlSchemaSimpleType? simpleType = element.SchemaType as XmlSchemaSimpleType;

        if (simpleType == null && element.SchemaTypeName != null && !element.SchemaTypeName.IsEmpty)
        {
            simpleType = schemaSet.GlobalTypes.Values
                .OfType<XmlSchemaSimpleType>()
                .FirstOrDefault(t => t.QualifiedName == element.SchemaTypeName);
        }

        if (simpleType?.Content is not XmlSchemaSimpleTypeRestriction restriction)
            return new Restrictions(null, null, null, []);

        int? minLen = null, maxLen = null;
        string? pattern = null;
        var enums = new List<string>();

        foreach (XmlSchemaFacet facet in restriction.Facets)
        {
            switch (facet)
            {
                case XmlSchemaMinLengthFacet f when int.TryParse(f.Value, out var mn):
                    minLen = mn;
                    break;
                case XmlSchemaMaxLengthFacet f when int.TryParse(f.Value, out var mx):
                    maxLen = mx;
                    break;
                case XmlSchemaLengthFacet f when int.TryParse(f.Value, out var l):
                    minLen = l;
                    maxLen = l;
                    break;
                case XmlSchemaPatternFacet f:
                    pattern = f.Value;
                    break;
                case XmlSchemaEnumerationFacet f:
                    enums.Add(f.Value ?? string.Empty);
                    break;
            }
        }

        return new Restrictions(minLen, maxLen, pattern, enums);
    }

    private static string? GetDocumentation(XmlSchemaElement element)
    {
        var annotation = element.Annotation
            ?? element.SchemaType?.Annotation;
        if (annotation == null) return null;

        foreach (XmlSchemaObject item in annotation.Items)
        {
            if (item is XmlSchemaDocumentation doc && doc.Markup is { Length: > 0 } markup)
            {
                var text = string.Concat(markup.Select(n => n.InnerText ?? string.Empty)).Trim();
                if (!string.IsNullOrEmpty(text)) return text;
            }
        }
        return null;
    }
}
