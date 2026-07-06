using System.Collections.ObjectModel;
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
    string Namespace)
{
    /// <summary>
    /// Basename (no path) of the file that produced this entry.
    /// Populated when the registry reads XSDs from disk (Sprint 9.5).
    /// Empty for entries loaded from unknown / synthetic sources.
    /// </summary>
    public string FileName { get; init; } = string.Empty;
}

/// <summary>
/// Catalogue of ISO 20022 schemas — reads every <c>*.xsd</c> under the
/// configured schemas directory and indexes it by target namespace.
///
/// <para>Sprint 9.5 replaced the previous "read from embedded resources"
/// implementation with a directory-based one so operators can drop
/// custom or updated schemas into a persistable path (via the Workspace
/// UI upload). Construction eagerly scans the folder; <see cref="Reload"/>
/// re-scans on demand and swaps the internal state atomically.</para>
///
/// <para>Lookup remains an in-memory dictionary hit — the on-disk read
/// only happens on construction and on <see cref="Reload"/>.</para>
/// </summary>
public sealed class SchemaRegistry
{
    // Every official ISO 20022 namespace starts with this prefix; the suffix is
    // exactly the message type, so we can pivot in both directions.
    private const string NamespacePrefix = "urn:iso:std:iso:20022:tech:xsd:";

    private readonly string _schemasPath;
    private readonly object _stateLock = new();
    private Dictionary<string, XmlSchema> _byNamespace = new(StringComparer.Ordinal);
    private ReadOnlyCollection<SchemaInfo> _supportedTypes =
        new List<SchemaInfo>().AsReadOnly();

    /// <summary>
    /// Default constructor — resolves the schemas path from the
    /// <c>ISOHUB_SCHEMAS_PATH</c> environment variable, or falls back
    /// to <c>&lt;bin&gt;/Schemas</c> which is populated by the csproj
    /// Content Include (Sprint 9.5).
    /// </summary>
    public SchemaRegistry() : this(ResolveDefaultPath()) { }

    public SchemaRegistry(string schemasPath)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(schemasPath);
        _schemasPath = schemasPath;
        Reload();
    }

    /// <summary>Absolute path currently being read for XSDs.</summary>
    public string SchemasPath => _schemasPath;

    /// <summary>Returns the parsed <see cref="XmlSchema"/> for the given namespace, or <c>null</c>.</summary>
    public XmlSchema? GetSchema(string xmlNamespace)
    {
        ArgumentNullException.ThrowIfNull(xmlNamespace);
        lock (_stateLock)
        {
            return _byNamespace.TryGetValue(xmlNamespace, out var schema) ? schema : null;
        }
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

        lock (_stateLock)
        {
            return _byNamespace.Keys
                .Where(ns => ExtractFamilyPrefix(ns) == prefix)
                .Order(StringComparer.Ordinal)
                .ToList();
        }
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
    public IEnumerable<SchemaInfo> ListSupportedTypes()
    {
        lock (_stateLock)
        {
            return _supportedTypes;
        }
    }

    /// <summary>
    /// Re-scans the configured directory and atomically swaps the
    /// in-memory maps. Invoked from the Workspace upload endpoint so a
    /// newly-added XSD is queryable within the same HTTP request.
    /// </summary>
    public void Reload()
    {
        var byNs = new Dictionary<string, XmlSchema>(StringComparer.Ordinal);
        var infos = new List<SchemaInfo>();

        if (Directory.Exists(_schemasPath))
        {
            foreach (var file in Directory.EnumerateFiles(_schemasPath, "*.xsd", SearchOption.AllDirectories))
            {
                using var stream = File.OpenRead(file);
                // The validation callback is intentionally a no-op — imports
                // and includes aren't resolved here (we never call Compile()
                // at load-time), so any surfaced "errors" would be noise.
                var schema = XmlSchema.Read(stream, static (_, _) => { })
                    ?? throw new InvalidOperationException($"Failed to parse XSD: {file}");

                if (string.IsNullOrEmpty(schema.TargetNamespace))
                    throw new InvalidOperationException($"XSD has empty targetNamespace: {file}");

                byNs[schema.TargetNamespace] = schema;
                infos.Add(BuildInfo(schema.TargetNamespace, Path.GetFileName(file)));
            }
        }

        var ordered = infos
            .OrderBy(i => i.Family, StringComparer.Ordinal)
            .ThenBy(i => i.MessageType, StringComparer.Ordinal)
            .ToList()
            .AsReadOnly();

        lock (_stateLock)
        {
            _byNamespace = byNs;
            _supportedTypes = ordered;
        }
    }

    private string? ResolveMessageType(string? xmlNamespace)
    {
        if (string.IsNullOrEmpty(xmlNamespace)) return null;
        lock (_stateLock)
        {
            if (!_byNamespace.ContainsKey(xmlNamespace)) return null;
        }
        return xmlNamespace.StartsWith(NamespacePrefix, StringComparison.Ordinal)
            ? xmlNamespace[NamespacePrefix.Length..]
            : null;
    }

    private static SchemaInfo BuildInfo(string targetNamespace, string fileName)
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

        return new SchemaInfo(messageType, family, version, targetNamespace)
        {
            FileName = fileName,
        };
    }

    /// <summary>
    /// Resolves the default XSD directory: the <c>ISOHUB_SCHEMAS_PATH</c>
    /// environment variable when set (Docker mounts a volume here); the
    /// <c>Schemas</c> subdirectory of <see cref="AppContext.BaseDirectory"/>
    /// otherwise (dev — populated by the csproj Content Include).
    /// </summary>
    private static string ResolveDefaultPath()
    {
        var env = Environment.GetEnvironmentVariable("ISOHUB_SCHEMAS_PATH");
        return !string.IsNullOrWhiteSpace(env)
            ? env
            : Path.Combine(AppContext.BaseDirectory, "Schemas");
    }
}
