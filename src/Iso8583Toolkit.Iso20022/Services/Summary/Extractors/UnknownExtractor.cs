using System.Xml.Linq;

namespace Iso8583Toolkit.Iso20022.Services.Summary.Extractors;

/// <summary>
/// Fallback when no concrete extractor matches the message type. Keeps the
/// pipeline shape uniform — the caller can always render a summary card,
/// even when we have nothing semantic to say about the message.
/// </summary>
public sealed class UnknownExtractor : ISummaryExtractor
{
    public static readonly UnknownExtractor Instance = new();
    public IReadOnlyList<string> SupportedPrefixes => [];

    public MessageSummaryResult Extract(XDocument doc, XNamespace ns) =>
        new("ISO 20022 Message", "unknown", []);
}
