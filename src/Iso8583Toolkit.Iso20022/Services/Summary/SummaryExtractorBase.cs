using System.Xml.Linq;

namespace Iso8583Toolkit.Iso20022.Services.Summary;

/// <summary>
/// Common base for concrete extractors. Handles confidence aggregation and
/// exposes safe path-walking helpers so each extractor's body stays focused
/// on declaring the field map for its message family.
/// </summary>
public abstract class SummaryExtractorBase : ISummaryExtractor
{
    public abstract IReadOnlyList<string> SupportedPrefixes { get; }

    public MessageSummaryResult Extract(XDocument doc, XNamespace ns)
    {
        var fields = ExtractFields(doc, ns);
        var foundCount = fields.Count(f => f.Value != null);
        var confidence = fields.Count > 0 && foundCount == fields.Count ? "full" : "partial";
        return new MessageSummaryResult(OperationName, confidence, fields);
    }

    protected abstract string OperationName { get; }
    protected abstract List<SummaryFieldResult> ExtractFields(XDocument doc, XNamespace ns);

    /// <summary>
    /// Walks <paramref name="path"/> from <paramref name="root"/> and returns
    /// the deepest element's trimmed text, or <c>null</c> when any step is
    /// missing or the final value is empty. Tries the parent's namespace first,
    /// then a namespace-less name so head/body messages with mixed namespaces
    /// (e.g. <c>head.001</c> + <c>pacs.008</c>) still resolve.
    /// </summary>
    protected static string? Get(XElement? root, params string[] path)
    {
        var current = root;
        foreach (var step in path)
        {
            if (current == null) return null;
            current = current.Element(current.Name.Namespace + step)
                     ?? current.Element(XName.Get(step));
        }
        return current?.Value?.Trim() is { Length: > 0 } v ? v : null;
    }

    /// <summary>Returns an attribute value at the end of a <c>/</c>-separated path, or <c>null</c>.</summary>
    protected static string? Attr(XElement? root, string elementPath, string attrName)
    {
        var el = root;
        foreach (var step in elementPath.Split('/'))
        {
            if (el == null) return null;
            el = el.Element(el.Name.Namespace + step)
               ?? el.Element(XName.Get(step));
        }
        return el?.Attribute(attrName)?.Value;
    }
}
