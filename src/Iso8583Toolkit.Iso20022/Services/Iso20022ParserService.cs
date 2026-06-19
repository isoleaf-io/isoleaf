using System.Xml;
using System.Xml.Linq;
using Iso8583Toolkit.Iso20022.Exceptions;
using Iso8583Toolkit.Iso20022.Services.Summary;
using Iso8583Toolkit.Iso20022.Validation;

namespace Iso8583Toolkit.Iso20022.Services;

/// <summary>
/// Internal tree node used by the parser. Mapped to the API's <c>ParsedNode</c>
/// DTO at the controller boundary so the Iso20022 project stays free of
/// HTTP-layer dependencies and the API DTO can evolve independently.
/// </summary>
public sealed record Iso20022Node(
    string Name,
    string? Value,
    string? Namespace,
    IReadOnlyList<Iso20022Node> Children);

/// <summary>Result of a successful parse — message type metadata, the tree, and the summary.</summary>
public sealed record ParseResult(
    string MessageType,
    string Namespace,
    MessageSummaryResult Summary,
    Iso20022Node Root);

/// <summary>
/// Parses ISO 20022 XML documents into a typed tree. Detects the message type
/// from the root namespace via <see cref="SchemaRegistry"/> and converts the
/// document into a depth-first node tree where attributes are flattened as
/// leaf children prefixed with <c>@</c>.
/// </summary>
public sealed class Iso20022ParserService
{
    private readonly SchemaRegistry _schemaRegistry;
    private readonly SummaryService _summaryService;

    public Iso20022ParserService(SchemaRegistry schemaRegistry, SummaryService summaryService)
    {
        ArgumentNullException.ThrowIfNull(schemaRegistry);
        ArgumentNullException.ThrowIfNull(summaryService);
        _schemaRegistry = schemaRegistry;
        _summaryService = summaryService;
    }

    /// <summary>
    /// Parses the supplied XML into a <see cref="ParseResult"/>.
    /// </summary>
    /// <exception cref="ArgumentException">When the input is null, empty or whitespace.</exception>
    /// <exception cref="InvalidOperationException">When the message type cannot be detected or the root element is missing.</exception>
    /// <exception cref="XmlException">When the input is not well-formed XML, or contains a DTD (XXE defence).</exception>
    public ParseResult Parse(string xmlContent)
    {
        if (string.IsNullOrWhiteSpace(xmlContent))
            throw new ArgumentException("XML content is required.", nameof(xmlContent));

        var messageType = _schemaRegistry.DetectMessageType(xmlContent);
        if (messageType == null)
        {
            // Re-read just the root element to recover the offending namespace
            // for diagnostics. Reusing DetectMessageType isn't enough — it lost
            // that information when it returned null.
            var xmlNs = ExtractNamespace(xmlContent);
            var compatible = _schemaRegistry.GetCompatibleVersions(xmlNs ?? string.Empty);
            throw new IncompatibleVersionException(xmlNs ?? "unknown", compatible);
        }

        var settings = new XmlReaderSettings
        {
            // DTDs are not a normal part of ISO 20022 instance documents — and a
            // hostile DTD opens the door to XXE. Treat any DTD as a parse error.
            DtdProcessing = DtdProcessing.Prohibit,
            XmlResolver = null,
            IgnoreWhitespace = true,
            IgnoreComments = true,
            // Explicit no-op: this stage produces a typed tree only. Schema
            // validation against the embedded XSDs is a separate concern that
            // will live in a future Iso20022Validator service.
            ValidationType = ValidationType.None,
        };

        XDocument doc;
        using (var reader = XmlReader.Create(new StringReader(xmlContent), settings))
        {
            doc = XDocument.Load(reader);
        }

        var rootElement = doc.Root
            ?? throw new InvalidOperationException("Invalid XML: no root element.");

        var rootNamespace = rootElement.Name.NamespaceName;
        var rootNode = BuildNode(rootElement, rootNamespace);
        // Walk the doc once more — the summary extractors do their own targeted
        // queries (XDocument.Element/Descendants), which is cleaner than
        // threading the partially-built node tree through them.
        var summary = _summaryService.Summarize(messageType, doc, XNamespace.Get(rootNamespace));
        return new ParseResult(messageType, rootNamespace, summary, rootNode);
    }

    private static Iso20022Node BuildNode(XElement element, string rootNamespace)
    {
        var ns = element.Name.NamespaceName;
        // Only surface the namespace if it differs from the document root — head
        // (head.001.001.03) + body (e.g. pacs.008.001.09) cohabit one document
        // and the UI uses the hint to flag the boundary.
        var nsHint = !string.IsNullOrEmpty(ns) && !string.Equals(ns, rootNamespace, StringComparison.Ordinal)
            ? ns
            : null;

        var children = new List<Iso20022Node>();

        // Attributes become leaf children prefixed with "@". Skip xmlns
        // declarations — they're noise in the tree view.
        foreach (var attr in element.Attributes().Where(a => !a.IsNamespaceDeclaration))
        {
            children.Add(new Iso20022Node($"@{attr.Name.LocalName}", attr.Value, null, []));
        }

        foreach (var child in element.Elements())
        {
            children.Add(BuildNode(child, rootNamespace));
        }

        // A node is a leaf iff it has no element children AND no attributes.
        // When attributes-only ("@x") we still expose the element's text value
        // alongside; otherwise null marks a container.
        var hasElementChildren = element.HasElements;
        var value = hasElementChildren ? null : NormaliseValue(element.Value);

        return new Iso20022Node(element.Name.LocalName, value, nsHint, children);
    }

    private static string? NormaliseValue(string? raw)
    {
        if (raw is null) return null;
        var trimmed = raw.Trim();
        return trimmed.Length == 0 ? null : trimmed;
    }

    /// <summary>
    /// Reads the very first element from the supplied XML and returns its
    /// namespace URI. Used only for diagnostic purposes when the message type
    /// is unknown; swallows any parse error and returns <c>null</c>.
    /// </summary>
    private static string? ExtractNamespace(string xmlContent)
    {
        try
        {
            var settings = new XmlReaderSettings
            {
                DtdProcessing = DtdProcessing.Prohibit,
                XmlResolver = null,
                ValidationType = ValidationType.None,
            };
            using var reader = XmlReader.Create(new StringReader(xmlContent), settings);
            while (reader.Read())
            {
                if (reader.NodeType == XmlNodeType.Element)
                    return reader.NamespaceURI;
            }
        }
        catch (XmlException)
        {
            // Best-effort diagnostic — a malformed document still throws from
            // the main Parse() path with the underlying XmlException's message.
        }
        return null;
    }
}
