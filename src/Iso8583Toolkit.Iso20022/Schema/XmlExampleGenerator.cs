using System.Linq;
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
            ["Max35Text"]                    = "MSG-20240115-001",
            ["Max140Text"]                   = "Sample text description",
            ["Max70Text"]                    = "Sample text",
            ["Max128Text"]                   = "Sample text description for field",
            ["Max15NumericText"]             = "1",
            ["Max5NumericText"]              = "1",
            ["ISODate"]                      = "2024-01-15",
            ["ISODateTime"]                  = "2024-01-15T10:30:00",
            ["ActiveCurrencyCode"]           = "USD",
            ["ActiveOrHistoricCurrencyCode"] = "USD",
            ["DecimalNumber"]                = "1000.00",
            ["BaseOneRate"]                  = "1.0000",
            ["TrueFalseIndicator"]           = "true",
            ["YesNoIndicator"]               = "true",
            ["CountryCode"]                  = "US",
            ["BICFIDec2014Identifier"]       = "AAAAUSXX",
            ["IBAN2007Identifier"]           = "GB29NWBK60161331926819",
            ["UUIDv4Identifier"]             = "550e8400-e29b-41d4-a716-446655440000",
            ["LEIIdentifier"]                = "529900T8BM49AURSDO55",
            ["ExternalServiceLevel1Code"]    = "SEPA",
            ["ExternalLocalInstrument1Code"] = "INST",
            ["Priority2Code"]                = "NORM",
            ["SettlementMethod1Code"]        = "CLRG",
            ["ChargeBearerType1Code"]        = "SHAR",
            ["ExternalPaymentTransactionStatus1Code"] = "ACCP",
            ["ExternalReturnReason1Code"]    = "AC04",
        };

    /// <summary>
    /// Generates a minimal XML document for the whole message, including only
    /// mandatory fields. Use this when no specific field needs to be highlighted.
    /// </summary>
    public string GenerateMinimal(string xmlNamespace, IReadOnlyList<FieldDefinition> fields)
        => GenerateMinimal(xmlNamespace, fields, null, null);

    /// <summary>
    /// Same as <see cref="GenerateMinimal(string,IReadOnlyList{FieldDefinition})"/>
    /// but lets the caller pin specific values by XPath (or by attribute path
    /// such as <c>FIToFICstmrCdtTrf/CdtTrfTxInf/IntrBkSttlmAmt/@Ccy</c>) —
    /// used by the Builder so ecosystem-specific defaults (Pix → BRL, SEPA →
    /// EUR, etc.) substitute the generic placeholders.
    /// </summary>
    public string GenerateMinimal(
        string xmlNamespace,
        IReadOnlyList<FieldDefinition> fields,
        IReadOnlyDictionary<string, string>? overrides)
        => GenerateMinimal(xmlNamespace, fields, overrides, null);

    /// <summary>
    /// Adds an "include optional" set: every XPath in that set is treated as
    /// mandatory for the purpose of emission, so the Builder's "+ Adicionar
    /// campo opcional" UI can surface those fields in the XML preview
    /// without the user having to type the parent path by hand.
    /// </summary>
    public string GenerateMinimal(
        string xmlNamespace,
        IReadOnlyList<FieldDefinition> fields,
        IReadOnlyDictionary<string, string>? overrides,
        ISet<string>? includeOptionalXPaths)
    {
        ArgumentNullException.ThrowIfNull(xmlNamespace);
        ArgumentNullException.ThrowIfNull(fields);

        var include = includeOptionalXPaths ?? (ISet<string>)new HashSet<string>(StringComparer.Ordinal);
        var sb = new StringBuilder();
        sb.AppendLine("""<?xml version="1.0" encoding="UTF-8"?>""");
        sb.AppendLine($"""<Document xmlns="{xmlNamespace}">""");
        foreach (var field in fields.Where(f => f.IsMandatory || include.Contains(f.XPath)))
            AppendField(sb, field, indent: 1, overrides, include);
        sb.Append("</Document>");
        return sb.ToString();
    }

    /// <summary>
    /// Public so the Builder service can reuse the same placeholder logic
    /// when populating the per-field default in the editor table — keeps
    /// the form values in sync with what would land in the generated XML.
    /// </summary>
    public string DefaultValueFor(FieldDefinition field)
        => GetPlaceholder(field);

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

    /// <summary>
    /// CurrencyAndAmount-family types are XSD-complex (simpleContent +
    /// attribute) but semantically leaves — render them as &lt;X Ccy="…"&gt;0.00&lt;/X&gt;
    /// rather than the empty &lt;X/&gt; the generic complex-walker would emit.
    /// Exposed so <see cref="Iso8583Toolkit.Iso20022.Builder.BuilderService"/>
    /// can apply the same rule when projecting the editor tree — otherwise an
    /// IntrBkSttlmAmt shows up as an empty section in the UI even though the
    /// XML treats it as a leaf.
    /// </summary>
    public static bool IsLeafLikeComplex(FieldDefinition field) =>
        field.TypeName.Contains("CurrencyAndAmount", StringComparison.OrdinalIgnoreCase);

    // ---- Internal walkers ---------------------------------------------------
    private void AppendField(
        StringBuilder sb,
        FieldDefinition field,
        int indent,
        IReadOnlyDictionary<string, string>? overrides = null,
        ISet<string>? includeOptional = null)
    {
        var pad = new string(' ', indent * 2);
        var include = includeOptional ?? (ISet<string>)new HashSet<string>(StringComparer.Ordinal);

        if (!field.IsComplex || IsLeafLikeComplex(field))
        {
            var value = TryOverride(overrides, field.XPath) ?? GetPlaceholder(field);
            var attrs = GetAttributes(field, overrides);
            sb.AppendLine($"{pad}<{field.Name}{attrs}>{value}</{field.Name}>");
            return;
        }

        var includedChildren = SelectIncludedChildren(field, overrides, include);
        if (includedChildren.Count == 0)
        {
            sb.AppendLine($"{pad}<{field.Name}/>");
            return;
        }

        sb.AppendLine($"{pad}<{field.Name}>");
        foreach (var child in includedChildren)
            AppendField(sb, child, indent + 1, overrides, include);
        sb.AppendLine($"{pad}</{field.Name}>");
    }

    /// <summary>
    /// Picks which children of a complex node to emit. The base rule is
    /// "mandatory OR explicitly included", but xs:choice arms need
    /// special handling: a parent with choice branches must emit AT MOST
    /// ONE of them. Preference order for the chosen arm is
    /// (1) an arm with a scenario override, (2) an arm with a descendant
    /// in the include set, (3) the first arm declared.
    /// </summary>
    private static List<FieldDefinition> SelectIncludedChildren(
        FieldDefinition field,
        IReadOnlyDictionary<string, string>? overrides,
        ISet<string> include)
    {
        var choiceChildren = field.Children.Where(c => c.IsChoice).ToList();
        var nonChoiceChildren = field.Children
            .Where(c => !c.IsChoice && (c.IsMandatory || include.Contains(c.XPath)))
            .ToList();

        if (choiceChildren.Count == 0) return nonChoiceChildren;

        var pickedChoice =
            choiceChildren.FirstOrDefault(c => HasOverrideUnder(c, overrides))
            ?? choiceChildren.FirstOrDefault(c => HasIncludeUnder(c, include))
            ?? choiceChildren.FirstOrDefault();

        if (pickedChoice is null) return nonChoiceChildren;

        var merged = new List<FieldDefinition>(nonChoiceChildren.Count + 1);
        merged.AddRange(nonChoiceChildren);
        merged.Add(pickedChoice);
        // Preserve XSD declaration order so the output sequence stays valid.
        var indexOf = new Dictionary<string, int>(StringComparer.Ordinal);
        for (var i = 0; i < field.Children.Count; i++)
            indexOf[field.Children[i].XPath] = i;
        merged.Sort((a, b) => indexOf[a.XPath].CompareTo(indexOf[b.XPath]));
        return merged;
    }

    private static bool HasOverrideUnder(
        FieldDefinition field,
        IReadOnlyDictionary<string, string>? overrides)
    {
        if (overrides is null || overrides.Count == 0) return false;
        if (overrides.ContainsKey(field.XPath)) return true;
        return field.Children.Any(child => HasOverrideUnder(child, overrides));
    }

    private static bool HasIncludeUnder(FieldDefinition field, ISet<string> include)
    {
        if (include.Count == 0) return false;
        if (include.Contains(field.XPath)) return true;
        return field.Children.Any(child => HasIncludeUnder(child, include));
    }

    private static string? TryOverride(IReadOnlyDictionary<string, string>? overrides, string xpath)
        => overrides is not null && overrides.TryGetValue(xpath, out var v) ? v : null;

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

    private static string GetAttributes(
        FieldDefinition field,
        IReadOnlyDictionary<string, string>? overrides = null)
    {
        // ActiveCurrencyAndAmount / ActiveOrHistoricCurrencyAndAmount need the
        // Ccy attribute to be XSD-valid; everything else writes no attributes.
        if (field.TypeName.Contains("CurrencyAndAmount", StringComparison.OrdinalIgnoreCase))
        {
            // Honour an explicit per-attribute override (e.g. SEPA → EUR,
            // Pix → BRL) so the user-visible attribute matches what
            // ScenarioRegistry promises. USD is the ecosystem-neutral
            // fallback — Pix and SEPA scenarios pin their own currency
            // explicitly, and defaulting to BRL was leaking into pacs.009
            // (CBPR+, T2) when those scenarios forgot to set @Ccy.
            var ccy = TryOverride(overrides, $"{field.XPath}/@Ccy") ?? "USD";
            return $" Ccy=\"{ccy}\"";
        }
        return string.Empty;
    }
}
