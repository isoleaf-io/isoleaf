using System.Collections.ObjectModel;
using System.Reflection;
using System.Xml;
using System.Xml.Schema;

namespace Iso8583Toolkit.Iso20022.Validation;

/// <summary>
/// Metadata describing one ISO 20022 message variant loaded into the registry.
/// </summary>
/// <param name="MessageType">Canonical message identifier, e.g. <c>pacs.008.001.09</c>.</param>
/// <param name="Family">Top-level family extracted from the message type — <c>pacs</c>, <c>camt</c>, <c>pain</c>, <c>head</c>.</param>
/// <param name="Version">Variant + version segments of the message type, e.g. <c>001.09</c>.</param>
/// <param name="Namespace">Full XML target namespace, e.g. <c>urn:iso:std:iso:20022:tech:xsd:pacs.008.001.09</c>.</param>
public record SchemaInfo(
    string MessageType,
    string Family,
    string Version,
    string Namespace);

/// <summary>
/// Catalog of the embedded ISO 20022 schemas. Eagerly reads every <c>*.xsd</c>
/// resource shipped in this assembly and indexes it by target namespace.
/// Construction is the only I/O — every lookup is an in-memory dictionary hit.
/// </summary>
public sealed class SchemaRegistry
{
    // Every official ISO 20022 namespace starts with this prefix; the suffix is
    // exactly the message type, so we can pivot in both directions.
    private const string NamespacePrefix = "urn:iso:std:iso:20022:tech:xsd:";

    private readonly Dictionary<string, XmlSchema> _byNamespace;
    private readonly ReadOnlyCollection<SchemaInfo> _supportedTypes;

    public SchemaRegistry() : this(typeof(SchemaRegistry).Assembly) { }

    public SchemaRegistry(Assembly schemaAssembly)
    {
        ArgumentNullException.ThrowIfNull(schemaAssembly);

        _byNamespace = new Dictionary<string, XmlSchema>(StringComparer.Ordinal);
        var infos = new List<SchemaInfo>();

        foreach (var resourceName in schemaAssembly.GetManifestResourceNames())
        {
            if (!resourceName.EndsWith(".xsd", StringComparison.OrdinalIgnoreCase))
                continue;

            using var stream = schemaAssembly.GetManifestResourceStream(resourceName)
                ?? throw new InvalidOperationException($"Embedded resource stream missing: {resourceName}");

            // Validation callback is intentionally a no-op: imports/includes are
            // not resolved at this stage (we never call XmlSchemaSet.Compile),
            // so the only "errors" surfaced here would be self-inflicted noise.
            var schema = XmlSchema.Read(stream, static (_, _) => { })
                ?? throw new InvalidOperationException($"Failed to parse XSD: {resourceName}");

            if (string.IsNullOrEmpty(schema.TargetNamespace))
                throw new InvalidOperationException($"XSD has empty targetNamespace: {resourceName}");

            _byNamespace[schema.TargetNamespace] = schema;
            infos.Add(BuildInfo(schema.TargetNamespace));
        }

        _supportedTypes = infos
            .OrderBy(i => i.Family, StringComparer.Ordinal)
            .ThenBy(i => i.MessageType, StringComparer.Ordinal)
            .ToList()
            .AsReadOnly();
    }

    /// <summary>Returns the parsed <see cref="XmlSchema"/> for the given namespace, or <c>null</c>.</summary>
    public XmlSchema? GetSchema(string xmlNamespace)
    {
        ArgumentNullException.ThrowIfNull(xmlNamespace);
        return _byNamespace.TryGetValue(xmlNamespace, out var schema) ? schema : null;
    }

    /// <summary>
    /// Returns every registered namespace that belongs to the same message
    /// family as the supplied namespace (e.g. all <c>pacs.002.*</c> when given
    /// <c>urn:iso:std:iso:20022:tech:xsd:pacs.002.001.08</c>). Used to build
    /// a "supported versions" hint when the exact namespace is unknown.
    /// Returns an empty list if the family itself is not registered.
    /// </summary>
    public IReadOnlyList<string> GetCompatibleVersions(string xmlNamespace)
    {
        if (string.IsNullOrEmpty(xmlNamespace)) return [];
        var prefix = ExtractFamilyPrefix(xmlNamespace);
        if (prefix == null) return [];

        return _byNamespace.Keys
            .Where(ns => ExtractFamilyPrefix(ns) == prefix)
            .Order(StringComparer.Ordinal)
            .ToList();
    }

    private static string? ExtractFamilyPrefix(string xmlNamespace)
    {
        // Format: urn:iso:std:iso:20022:tech:xsd:family.subId.variant.version
        // We want "family.subId" (e.g. "pacs.002").
        var idx = xmlNamespace.IndexOf(NamespacePrefix, StringComparison.Ordinal);
        if (idx < 0) return null;
        var msgPart = xmlNamespace[(idx + NamespacePrefix.Length)..];
        var parts = msgPart.Split('.');
        if (parts.Length < 2) return null;
        return $"{parts[0]}.{parts[1]}";
    }

    /// <summary>Detects the message type from the document's root namespace URI. Returns <c>null</c> if the namespace is not registered.</summary>
    public string? DetectMessageType(XmlDocument doc)
    {
        ArgumentNullException.ThrowIfNull(doc);
        var rootNs = doc.DocumentElement?.NamespaceURI;
        return ResolveMessageType(rootNs);
    }

    /// <inheritdoc cref="DetectMessageType(XmlDocument)"/>
    public string? DetectMessageType(string xmlContent)
    {
        ArgumentNullException.ThrowIfNull(xmlContent);
        var doc = new XmlDocument();
        // Disable DTD processing — these are ISO 20022 instance documents, not
        // XHTML, and a hostile DTD would open the door to XXE.
        var settings = new XmlReaderSettings
        {
            DtdProcessing = DtdProcessing.Prohibit,
            XmlResolver = null,
        };
        using var reader = XmlReader.Create(new StringReader(xmlContent), settings);
        doc.Load(reader);
        return DetectMessageType(doc);
    }

    /// <summary>Lists every schema currently loaded in the registry.</summary>
    public IEnumerable<SchemaInfo> ListSupportedTypes() => _supportedTypes;

    private string? ResolveMessageType(string? xmlNamespace)
    {
        if (string.IsNullOrEmpty(xmlNamespace)) return null;
        if (!_byNamespace.ContainsKey(xmlNamespace)) return null;
        return xmlNamespace.StartsWith(NamespacePrefix, StringComparison.Ordinal)
            ? xmlNamespace[NamespacePrefix.Length..]
            : null;
    }

    private static SchemaInfo BuildInfo(string targetNamespace)
    {
        var messageType = targetNamespace.StartsWith(NamespacePrefix, StringComparison.Ordinal)
            ? targetNamespace[NamespacePrefix.Length..]
            : targetNamespace;

        // Message types look like family.subId.variant.version (e.g. pacs.008.001.09).
        // Family is parts[0]; "Version" per spec is the variant+version tail (parts[2..]).
        var parts = messageType.Split('.');
        var family = parts.Length > 0 ? parts[0] : messageType;
        var version = parts.Length >= 4
            ? string.Join('.', parts[2..])
            : (parts.Length > 1 ? parts[^1] : string.Empty);

        return new SchemaInfo(messageType, family, version, targetNamespace);
    }
}
