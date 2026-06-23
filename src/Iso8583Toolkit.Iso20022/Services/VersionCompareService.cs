using Iso8583Toolkit.Iso20022.Schema;

namespace Iso8583Toolkit.Iso20022.Services;

public sealed record FieldChange(string PropertyName, string OldValue, string NewValue);

public sealed record AddedField(
    string Name,
    string XPath,
    string TypeName,
    string Cardinality,
    bool IsMandatory);

public sealed record RemovedField(
    string Name,
    string XPath,
    string TypeName,
    string Cardinality);

public sealed record ChangedField(string Name, string XPath, IReadOnlyList<FieldChange> Changes);

public sealed record CompareResult(
    string FromVersion,
    string ToVersion,
    string Family,
    IReadOnlyList<AddedField> Added,
    IReadOnlyList<RemovedField> Removed,
    IReadOnlyList<ChangedField> Changed);

/// <summary>
/// Diffs two message-type reference trees by XPath. Same XPath in both sides
/// is a "changed" candidate (compared on type + cardinality + length facets);
/// only-in-target is "added"; only-in-source is "removed". Cross-family
/// comparisons are rejected outright — comparing pacs.008 to camt.053 makes
/// no semantic sense.
/// </summary>
public sealed class VersionCompareService
{
    private readonly ReferenceService _referenceService;

    public VersionCompareService(ReferenceService referenceService)
    {
        ArgumentNullException.ThrowIfNull(referenceService);
        _referenceService = referenceService;
    }

    /// <summary>
    /// Compares two ISO 20022 message types from the same family and returns XPath-based field differences.
    /// </summary>
    /// <exception cref="ArgumentException">When the two messageTypes belong to different families.</exception>
    /// <exception cref="InvalidOperationException">When either messageType isn't loaded in the registry.</exception>
    public CompareResult Compare(string fromMessageType, string toMessageType)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(fromMessageType);
        ArgumentException.ThrowIfNullOrWhiteSpace(toMessageType);

        var fromPrefix = ExtractPrefix(fromMessageType);
        var toPrefix = ExtractPrefix(toMessageType);
        if (!string.Equals(fromPrefix, toPrefix, StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException(
                $"Cross-family comparison is not supported: '{fromMessageType}' ({fromPrefix}) " +
                $"and '{toMessageType}' ({toPrefix}) belong to different ISO 20022 families.");
        }

        var fromFields = _referenceService.GetFields(fromMessageType)
            ?? throw new InvalidOperationException($"Unknown message type: '{fromMessageType}'.");
        var toFields = _referenceService.GetFields(toMessageType)
            ?? throw new InvalidOperationException($"Unknown message type: '{toMessageType}'.");

        // Flatten both trees so the diff is XPath-driven, not depth-driven —
        // a field moving up or down a level is treated as add+remove, which is
        // honest about what users have to refactor.
        var fromMap = Flatten(fromFields);
        var toMap = Flatten(toFields);

        var added = new List<AddedField>();
        var removed = new List<RemovedField>();
        var changed = new List<ChangedField>();

        foreach (var (xpath, t) in toMap)
        {
            if (!fromMap.TryGetValue(xpath, out var f))
            {
                added.Add(new AddedField(t.Name, t.XPath, t.TypeName, t.Cardinality, t.IsMandatory));
                continue;
            }

            var changes = DiffProperties(f, t);
            if (changes.Count > 0)
                changed.Add(new ChangedField(t.Name, t.XPath, changes));
        }

        foreach (var (xpath, f) in fromMap)
        {
            if (!toMap.ContainsKey(xpath))
                removed.Add(new RemovedField(f.Name, f.XPath, f.TypeName, f.Cardinality));
        }

        return new CompareResult(
            FromVersion: fromMessageType,
            ToVersion: toMessageType,
            Family: fromPrefix,
            Added: added.OrderBy(a => a.XPath, StringComparer.Ordinal).ToList(),
            Removed: removed.OrderBy(r => r.XPath, StringComparer.Ordinal).ToList(),
            Changed: changed.OrderBy(c => c.XPath, StringComparer.Ordinal).ToList());
    }

    private static Dictionary<string, FieldDefinition> Flatten(IReadOnlyList<FieldDefinition> fields)
    {
        var map = new Dictionary<string, FieldDefinition>(StringComparer.Ordinal);
        Walk(fields);
        return map;

        void Walk(IReadOnlyList<FieldDefinition> nodes)
        {
            foreach (var node in nodes)
            {
                // First writer wins on XPath collisions — XSD generation is
                // deterministic enough that ties are vanishingly rare, and
                // when they happen the first occurrence is the canonical one.
                map.TryAdd(node.XPath, node);
                Walk(node.Children);
            }
        }
    }

    private static List<FieldChange> DiffProperties(FieldDefinition from, FieldDefinition to)
    {
        var changes = new List<FieldChange>();

        if (!string.Equals(from.TypeName, to.TypeName, StringComparison.Ordinal))
            changes.Add(new FieldChange("TypeName", from.TypeName, to.TypeName));
        if (!string.Equals(from.Cardinality, to.Cardinality, StringComparison.Ordinal))
            changes.Add(new FieldChange("Cardinality", from.Cardinality, to.Cardinality));
        if (from.IsMandatory != to.IsMandatory)
            changes.Add(new FieldChange("IsMandatory", from.IsMandatory.ToString(), to.IsMandatory.ToString()));
        if (from.MinLength != to.MinLength)
            changes.Add(new FieldChange("MinLength", from.MinLength?.ToString() ?? "(null)", to.MinLength?.ToString() ?? "(null)"));
        if (from.MaxLength != to.MaxLength)
            changes.Add(new FieldChange("MaxLength", from.MaxLength?.ToString() ?? "(null)", to.MaxLength?.ToString() ?? "(null)"));

        return changes;
    }

    private static string ExtractPrefix(string messageType)
    {
        var dot = messageType.IndexOf('.');
        return dot > 0 ? messageType[..dot] : messageType;
    }
}
