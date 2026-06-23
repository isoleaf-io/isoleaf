namespace Iso8583Toolkit.Iso20022.Schema;

/// <summary>
/// Inverted index over every <see cref="FieldDefinition"/> across all loaded
/// message types: maps field name → list of occurrences. Built once at
/// service startup. Drives the cross-type search panel today; the upcoming
/// Builder will lean on it for field-name autocomplete.
/// </summary>
public sealed class FieldIndex
{
    private readonly Dictionary<string, List<FieldOccurrence>> _index =
        new(StringComparer.OrdinalIgnoreCase);

    public void Add(string messageType, FieldDefinition field)
    {
        if (!_index.TryGetValue(field.Name, out var list))
        {
            list = [];
            _index[field.Name] = list;
        }
        list.Add(new FieldOccurrence(messageType, field));

        foreach (var child in field.Children)
            Add(messageType, child);
    }

    /// <summary>Every occurrence of a field name across loaded message types.</summary>
    public IReadOnlyList<FieldOccurrence> Find(string fieldName)
        => _index.TryGetValue(fieldName, out var list) ? list : [];

    /// <summary>
    /// Substring search across every indexed field name. Returns a per-name
    /// rollup with a flag indicating whether the field's structural
    /// properties (type, cardinality, length facets) are the same in every
    /// message type that defines it.
    /// </summary>
    public IReadOnlyList<FieldSearchResult> Search(string term)
    {
        if (string.IsNullOrWhiteSpace(term)) return [];

        var results = new List<FieldSearchResult>();
        foreach (var (name, occurrences) in _index)
        {
            if (!name.Contains(term, StringComparison.OrdinalIgnoreCase))
                continue;

            results.Add(BuildResult(name, occurrences));
        }

        return results.OrderBy(r => r.FieldName, StringComparer.Ordinal).ToList();
    }

    /// <summary>
    /// Builds a <see cref="FieldSearchResult"/> for an exact field name.
    /// Returns <c>null</c> when the name is not indexed.
    /// </summary>
    public FieldSearchResult? FindAsSearchResult(string fieldName)
        => _index.TryGetValue(fieldName, out var list) ? BuildResult(fieldName, list) : null;

    /// <summary>Sorted list of every indexed field name (autocomplete-ready).</summary>
    public IReadOnlyList<string> AllFieldNames()
        => _index.Keys.OrderBy(n => n, StringComparer.Ordinal).ToList();

    private static FieldSearchResult BuildResult(string name, List<FieldOccurrence> occurrences)
    {
        var consistent = ArePropertiesConsistent(occurrences);
        var diffs = consistent ? [] : GetDifferences(occurrences);
        return new FieldSearchResult(name, occurrences, consistent, diffs);
    }

    private static bool ArePropertiesConsistent(List<FieldOccurrence> occurrences)
    {
        if (occurrences.Count <= 1) return true;
        var first = occurrences[0].Field;
        return occurrences.Skip(1).All(o =>
            o.Field.TypeName == first.TypeName &&
            o.Field.MinOccurs == first.MinOccurs &&
            o.Field.MaxOccurs == first.MaxOccurs &&
            o.Field.MinLength == first.MinLength &&
            o.Field.MaxLength == first.MaxLength);
    }

    private static IReadOnlyList<FieldDifference> GetDifferences(List<FieldOccurrence> occurrences)
    {
        var diffs = new List<FieldDifference>();
        var first = occurrences[0];

        foreach (var other in occurrences.Skip(1))
        {
            var changed = new List<string>();
            if (other.Field.TypeName != first.Field.TypeName) changed.Add("TypeName");
            if (other.Field.MinOccurs != first.Field.MinOccurs) changed.Add("MinOccurs");
            if (other.Field.MaxOccurs != first.Field.MaxOccurs) changed.Add("MaxOccurs");
            if (other.Field.MinLength != first.Field.MinLength) changed.Add("MinLength");
            if (other.Field.MaxLength != first.Field.MaxLength) changed.Add("MaxLength");

            if (changed.Count > 0)
                diffs.Add(new FieldDifference(first.MessageType, other.MessageType, changed));
        }

        return diffs;
    }
}

public record FieldOccurrence(string MessageType, FieldDefinition Field);

public record FieldSearchResult(
    string FieldName,
    IReadOnlyList<FieldOccurrence> Occurrences,
    bool IsConsistent,
    IReadOnlyList<FieldDifference> Differences);

public record FieldDifference(
    string MessageTypeA,
    string MessageTypeB,
    IReadOnlyList<string> DifferentProperties);
