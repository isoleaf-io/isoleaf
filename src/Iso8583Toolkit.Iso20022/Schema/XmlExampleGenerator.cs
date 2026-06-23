using System.Text;

namespace Iso8583Toolkit.Iso20022.Schema;

/// <summary>
/// Builds a minimal-but-valid XML skeleton from a tree of
/// <see cref="FieldDefinition"/>. Includes only mandatory fields; values are
/// placeholders chosen from the XSD type name so the result looks plausible
/// (BIC, IBAN, ISO dates, currency codes). Highlight markers wrap the
/// target field for the UI's syntax highlighter. Stateless and reusable —
/// the planned Builder (6.5) will pre-fill its form from the same logic.
/// </summary>
public sealed class XmlExampleGenerator
{
    private static readonly Dictionary<string, string> TypePlaceholders =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["Max35Text"]                    = "PLACEHOLDER",
            ["Max140Text"]                   = "PLACEHOLDER",
            ["Max128Text"]                   = "PLACEHOLDER",
            ["Max15NumericText"]             = "1",
            ["Max5NumericText"]              = "1",
            ["ISODate"]                      = "2024-01-15",
            ["ISODateTime"]                  = "2024-01-15T10:30:00",
            ["ActiveCurrencyCode"]           = "BRL",
            ["ActiveOrHistoricCurrencyCode"] = "BRL",
            ["DecimalNumber"]                = "0.00",
            ["BaseOneRate"]                  = "1.0",
            ["TrueFalseIndicator"]           = "true",
            ["YesNoIndicator"]               = "true",
            ["CountryCode"]                  = "BR",
            ["BICFIDec2014Identifier"]       = "BRASBRRJXXX",
            ["IBAN2007Identifier"]           = "BR1800360305000010009795493P1",
            ["UUIDv4Identifier"]             = "550e8400-e29b-41d4-a716-446655440000",
            ["LEIIdentifier"]                = "529900T8BM49AURSDO55",
        };

    /// <summary>
    /// Generates a minimal XML document for the whole message, including only
    /// mandatory fields. Use this when no specific field needs to be highlighted.
    /// </summary>
    public string GenerateMinimal(string xmlNamespace, IReadOnlyList<FieldDefinition> fields)
    {
        ArgumentNullException.ThrowIfNull(xmlNamespace);
        ArgumentNullException.ThrowIfNull(fields);

        var sb = new StringBuilder();
        sb.AppendLine("""<?xml version="1.0" encoding="UTF-8"?>""");
        sb.AppendLine($"""<Document xmlns="{xmlNamespace}">""");
        foreach (var field in fields.Where(f => f.IsMandatory))
            AppendField(sb, field, indent: 1);
        sb.Append("</Document>");
        return sb.ToString();
    }

    /// <summary>
    /// Generates a minimal XML document and wraps the field at
    /// <paramref name="highlightXPath"/> with <c>&lt;!-- ▶ Name --&gt;</c>
    /// markers. Every ancestor of the target is forced into the output even
    /// when optional — otherwise the user wouldn't see the field at all.
    /// </summary>
    public string GenerateWithHighlight(
        string xmlNamespace,
        IReadOnlyList<FieldDefinition> fields,
        string highlightXPath)
    {
        ArgumentNullException.ThrowIfNull(xmlNamespace);
        ArgumentNullException.ThrowIfNull(fields);
        ArgumentNullException.ThrowIfNull(highlightXPath);

        var pathParts = highlightXPath.Split('/');

        var sb = new StringBuilder();
        sb.AppendLine("""<?xml version="1.0" encoding="UTF-8"?>""");
        sb.AppendLine($"""<Document xmlns="{xmlNamespace}">""");
        foreach (var field in fields.Where(f =>
                     f.IsMandatory || IsAncestorOf(f, pathParts) || f.XPath == highlightXPath))
        {
            AppendFieldWithHighlight(sb, field, indent: 1, highlightXPath, pathParts);
        }
        sb.Append("</Document>");
        return sb.ToString();
    }

    // ---- Internal walkers ---------------------------------------------------
    private void AppendField(StringBuilder sb, FieldDefinition field, int indent)
    {
        var pad = new string(' ', indent * 2);

        if (!field.IsComplex)
        {
            var value = GetPlaceholder(field);
            var attrs = GetAttributes(field);
            sb.AppendLine($"{pad}<{field.Name}{attrs}>{value}</{field.Name}>");
            return;
        }

        var mandatoryChildren = field.Children.Where(c => c.IsMandatory).ToList();
        if (mandatoryChildren.Count == 0)
        {
            sb.AppendLine($"{pad}<{field.Name}/>");
            return;
        }

        sb.AppendLine($"{pad}<{field.Name}>");
        foreach (var child in mandatoryChildren)
            AppendField(sb, child, indent + 1);
        sb.AppendLine($"{pad}</{field.Name}>");
    }

    private void AppendFieldWithHighlight(
        StringBuilder sb,
        FieldDefinition field,
        int indent,
        string highlightXPath,
        string[] pathParts)
    {
        var pad = new string(' ', indent * 2);
        var isTarget = string.Equals(field.XPath, highlightXPath, StringComparison.Ordinal);

        if (!field.IsComplex)
        {
            var value = GetPlaceholder(field);
            var attrs = GetAttributes(field);
            if (isTarget)
            {
                sb.AppendLine($"{pad}<!-- ▶ {field.Name} -->");
                sb.AppendLine($"{pad}<{field.Name}{attrs}>{value}</{field.Name}>");
                sb.AppendLine($"{pad}<!-- ◀ -->");
            }
            else
            {
                sb.AppendLine($"{pad}<{field.Name}{attrs}>{value}</{field.Name}>");
            }
            return;
        }

        // For complex types in the path: keep mandatory children + every
        // ancestor leading to the target. Avoid the spec's allChildren-include
        // — that would explode the output for big structures.
        var children = field.Children
            .Where(c => c.IsMandatory || IsAncestorOf(c, pathParts) || c.XPath == highlightXPath)
            .ToList();

        if (isTarget) sb.AppendLine($"{pad}<!-- ▶ {field.Name} -->");
        sb.AppendLine($"{pad}<{field.Name}>");
        foreach (var child in children)
            AppendFieldWithHighlight(sb, child, indent + 1, highlightXPath, pathParts);
        sb.AppendLine($"{pad}</{field.Name}>");
        if (isTarget) sb.AppendLine($"{pad}<!-- ◀ -->");
    }

    private static bool IsAncestorOf(FieldDefinition field, string[] pathParts)
    {
        var fieldParts = field.XPath.Split('/');
        if (fieldParts.Length >= pathParts.Length) return false;
        return pathParts.Take(fieldParts.Length)
            .SequenceEqual(fieldParts, StringComparer.OrdinalIgnoreCase);
    }

    private static string GetPlaceholder(FieldDefinition field)
    {
        // Enumerations win — the first allowed value is always XSD-valid.
        if (field.Enumerations.Count > 0)
            return field.Enumerations[0];

        if (TypePlaceholders.TryGetValue(field.TypeName, out var placeholder))
            return placeholder;

        // Heuristic fallback based on type-name substrings — covers ISO 20022
        // "FooAmount"/"BarDate" combinations we don't enumerate explicitly.
        if (field.TypeName.Contains("Amount", StringComparison.OrdinalIgnoreCase))  return "0.00";
        if (field.TypeName.Contains("Date", StringComparison.OrdinalIgnoreCase))    return "2024-01-15";
        if (field.TypeName.Contains("Indicator", StringComparison.OrdinalIgnoreCase)) return "true";
        if (field.TypeName.Contains("Code", StringComparison.OrdinalIgnoreCase))    return "CODE";
        if (field.TypeName.Contains("Numeric", StringComparison.OrdinalIgnoreCase)) return "1";
        return "VALUE";
    }

    private static string GetAttributes(FieldDefinition field)
    {
        // ActiveCurrencyAndAmount / ActiveOrHistoricCurrencyAndAmount need the
        // Ccy attribute to be XSD-valid; everything else writes no attributes.
        if (field.TypeName.Contains("CurrencyAndAmount", StringComparison.OrdinalIgnoreCase))
            return " Ccy=\"BRL\"";
        return string.Empty;
    }
}
