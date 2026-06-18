namespace Iso8583Toolkit.Iso20022.Exceptions;

/// <summary>
/// Thrown when an XML document's namespace was recognised in shape (the
/// <c>urn:iso:std:iso:20022:tech:xsd:</c> prefix is present) but no XSD with
/// exactly that namespace is in the registry. Carries the namespaces of other
/// supported versions of the same message family so the caller can guide the
/// user toward a compatible payload — much friendlier than a flat
/// "type not detected" error.
/// </summary>
public sealed class IncompatibleVersionException(
    string detectedNamespace,
    IReadOnlyList<string> compatibleVersions)
    : InvalidOperationException(BuildMessage(detectedNamespace, compatibleVersions))
{
    public string DetectedNamespace { get; } = detectedNamespace;
    public IReadOnlyList<string> CompatibleVersions { get; } = compatibleVersions;

    private static string BuildMessage(string ns, IReadOnlyList<string> versions)
    {
        // Surface the trailing segment ("pacs.002.001.08") rather than the full
        // URN — that's the part users recognise from the XSD names.
        var family = ns.Split(':').LastOrDefault() ?? ns;

        if (versions.Count == 0)
        {
            return $"Unknown message type: '{family}'. " +
                   "The namespace does not match any supported ISO 20022 message.";
        }

        var supported = string.Join(", ", versions.Select(v => v.Split(':').Last()));
        return $"Incompatible version: '{family}'. " +
               $"Supported versions for this message type: {supported}.";
    }
}
