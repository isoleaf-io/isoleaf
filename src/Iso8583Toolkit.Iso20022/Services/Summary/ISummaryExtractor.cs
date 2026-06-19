using System.Xml.Linq;

namespace Iso8583Toolkit.Iso20022.Services.Summary;

/// <summary>
/// Extracts a human-readable summary from one ISO 20022 message family
/// (e.g. all <c>pacs.008.*</c> versions). Implementations are stateless and
/// indexed by short message-type prefix in <see cref="SummaryService"/>.
/// </summary>
public interface ISummaryExtractor
{
    /// <summary>Message-type prefixes handled by this extractor, e.g. <c>["pacs.008"]</c>.</summary>
    IReadOnlyList<string> SupportedPrefixes { get; }

    /// <summary>Extracts the summary from a parsed XDocument under the given root namespace.</summary>
    MessageSummaryResult Extract(XDocument doc, XNamespace ns);
}

public record MessageSummaryResult(
    string Operation,
    string Confidence,
    List<SummaryFieldResult> Fields,
    /// <summary>Statement entries (Ntry rows). Only populated for camt.053.</summary>
    List<Extractors.StatementEntryResult>? Entries = null);

public record SummaryFieldResult(string Label, string? Value);
