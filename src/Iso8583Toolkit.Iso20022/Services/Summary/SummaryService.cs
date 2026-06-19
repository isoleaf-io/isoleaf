using System.Xml.Linq;
using Iso8583Toolkit.Iso20022.Services.Summary.Extractors;

namespace Iso8583Toolkit.Iso20022.Services.Summary;

/// <summary>
/// Picks the right extractor based on the message type's first two segments
/// (e.g. <c>pacs.008.001.09 → pacs.008</c>) and runs it. Stateless after
/// construction, safe to register as a singleton.
/// </summary>
public sealed class SummaryService
{
    private readonly Dictionary<string, ISummaryExtractor> _extractors;

    public SummaryService()
    {
        var all = new List<ISummaryExtractor>
        {
            new Pacs008Extractor(),
            new Pain001Extractor(),
            new Pacs002Extractor(),
            new Camt053Extractor(),
        };

        _extractors = new Dictionary<string, ISummaryExtractor>(StringComparer.OrdinalIgnoreCase);
        foreach (var ex in all)
            foreach (var prefix in ex.SupportedPrefixes)
                _extractors[prefix] = ex;
    }

    public MessageSummaryResult Summarize(string messageType, XDocument doc, XNamespace ns)
    {
        ArgumentNullException.ThrowIfNull(messageType);
        ArgumentNullException.ThrowIfNull(doc);
        ArgumentNullException.ThrowIfNull(ns);

        // Message type shape: family.subId.variant.version → key off the first
        // two segments so every variant/version of the same business message
        // shares one extractor.
        var parts = messageType.Split('.');
        var prefix = parts.Length >= 2 ? $"{parts[0]}.{parts[1]}" : messageType;

        var extractor = _extractors.GetValueOrDefault(prefix, UnknownExtractor.Instance);
        var result = extractor.Extract(doc, ns);

        // Per-message-type extensions: camt.053 ships statement entries in
        // addition to the flat field list. Kept here rather than inside the
        // ISummaryExtractor contract so most extractors stay single-purpose.
        if (extractor is Camt053Extractor camt053)
        {
            return result with { Entries = camt053.ExtractEntries(doc, ns) };
        }

        return result;
    }
}
