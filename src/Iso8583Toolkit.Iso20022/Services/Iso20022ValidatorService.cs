using System.Linq;
using System.Xml;
using System.Xml.Schema;
using Iso8583Toolkit.Iso20022.Exceptions;
using Iso8583Toolkit.Iso20022.Validation;

namespace Iso8583Toolkit.Iso20022.Services;

public sealed record ValidationIssue(
    string Message,
    string Severity,
    int? LineNumber,
    int? LinePosition,
    string? XPath);

public sealed record ValidationResult(
    string MessageType,
    bool IsValid,
    int ErrorCount,
    int WarningCount,
    IReadOnlyList<ValidationIssue> Issues);

/// <summary>
/// Validates ISO 20022 XML against the embedded XSD for its detected (or
/// supplied) message type. Uses <see cref="XmlReader"/> in
/// <see cref="ValidationType.Schema"/> mode with a callback so we collect
/// *every* error in one pass instead of throwing on the first hit; line
/// information from <see cref="IXmlLineInfo"/> is mapped to XPaths via
/// <see cref="XmlLineMapper"/> so the UI can pin each error to the right
/// node in the parsed tree.
/// </summary>
public sealed class Iso20022ValidatorService
{
    private readonly SchemaRegistry _schemaRegistry;

    public Iso20022ValidatorService(SchemaRegistry schemaRegistry)
    {
        ArgumentNullException.ThrowIfNull(schemaRegistry);
        _schemaRegistry = schemaRegistry;
    }

    /// <summary>
    /// Validates ISO 20022 XML content against the resolved schema for the supplied
    /// or detected message type and returns all collected validation issues.
    /// </summary>
    /// <param name="xmlContent">The ISO 20022 XML payload to validate.</param>
    /// <param name="messageType">Optional message type override; when null, the type is auto-detected.</param>
    /// <returns>A <see cref="ValidationResult"/> containing validity status and collected issues.</returns>
    /// <exception cref="ArgumentException">When the input is null/empty.</exception>
    /// <exception cref="IncompatibleVersionException">When the XML namespace doesn't match a registered schema.</exception>
    public ValidationResult Validate(string xmlContent, string? messageType = null)
    {
        if (string.IsNullOrWhiteSpace(xmlContent))
            throw new ArgumentException("XML content is required.", nameof(xmlContent));

        // Detect message type when caller didn't provide one. Same routing as
        // the parser — keeps both endpoints behaviour-consistent.
        var detected = messageType ?? _schemaRegistry.DetectMessageType(xmlContent);
        if (string.IsNullOrEmpty(detected))
        {
            // Re-use the parser's IncompatibleVersionException so the UI can
            // recognise the "namespace recognised, no XSD" case uniformly.
            var probableNs = ExtractRootNamespace(xmlContent);
            var compat = _schemaRegistry.GetCompatibleVersions(probableNs ?? string.Empty);
            throw new IncompatibleVersionException(probableNs ?? "unknown", compat);
        }

        // Resolve schema. For a caller-supplied messageType we still need its
        // target namespace to look up the XmlSchema — message types are unique
        // so we can scan supported types for a match.
        var schema = ResolveSchema(detected);
        if (schema == null)
        {
            var probableNs = "urn:iso:std:iso:20022:tech:xsd:" + detected;
            var compat = _schemaRegistry.GetCompatibleVersions(probableNs);
            throw new IncompatibleVersionException(probableNs, compat);
        }

        var issues = new List<ValidationIssue>();
        var lineMap = XmlLineMapper.Build(xmlContent);

        var settings = new XmlReaderSettings
        {
            ValidationType = ValidationType.Schema,
            DtdProcessing = DtdProcessing.Prohibit,
            XmlResolver = null,
            ValidationFlags = XmlSchemaValidationFlags.ReportValidationWarnings,
        };
        settings.Schemas.Add(schema);
        settings.ValidationEventHandler += (sender, args) =>
        {
            var severity = args.Severity == XmlSeverityType.Warning ? "warning" : "error";
            var line = args.Exception?.LineNumber > 0 ? args.Exception.LineNumber : (int?)null;
            var pos = args.Exception?.LinePosition > 0 ? args.Exception.LinePosition : (int?)null;
            issues.Add(new ValidationIssue(
                Message: args.Message ?? args.Exception?.Message ?? "Unknown validation error",
                Severity: severity,
                LineNumber: line,
                LinePosition: pos,
                XPath: line.HasValue && lineMap.TryGetValue(line.Value, out var x) ? x : null));
        };

        try
        {
            using var reader = XmlReader.Create(new StringReader(xmlContent), settings);
            while (reader.Read()) { /* drain — handler captures every issue */ }
        }
        catch (XmlException ex)
        {
            // Hostile DTD or malformed root before schema validation kicks in.
            issues.Add(new ValidationIssue(
                Message: $"Malformed XML: {ex.Message}",
                Severity: "error",
                LineNumber: ex.LineNumber > 0 ? ex.LineNumber : (int?)null,
                LinePosition: ex.LinePosition > 0 ? ex.LinePosition : (int?)null,
                XPath: null));
        }

        var errors = issues.Count(i => i.Severity == "error");
        var warnings = issues.Count(i => i.Severity == "warning");
        return new ValidationResult(detected, errors == 0, errors, warnings, issues);
    }

    private XmlSchema? ResolveSchema(string messageType)
    {
        var match = _schemaRegistry
            .ListSupportedTypes()
            .Where(info => string.Equals(info.MessageType, messageType, StringComparison.OrdinalIgnoreCase))
            .FirstOrDefault();

        return match is null ? null : _schemaRegistry.GetSchema(match.Namespace);
    }

    private static string? ExtractRootNamespace(string xmlContent)
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
                if (reader.NodeType == XmlNodeType.Element)
                    return reader.NamespaceURI;
        }
        catch (XmlException) { /* best-effort */ }
        return null;
    }
}
