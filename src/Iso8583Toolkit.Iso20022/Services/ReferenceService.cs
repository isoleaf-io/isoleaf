using Iso8583Toolkit.Iso20022.Schema;
using Iso8583Toolkit.Iso20022.Validation;

namespace Iso8583Toolkit.Iso20022.Services;

/// <summary>
/// Field reference for every ISO 20022 message type the agent supports.
/// Heavy to construct (runs <see cref="XsdFieldExtractor"/> over every XSD
/// in the <see cref="SchemaRegistry"/>) — register as a singleton so the
/// cost is paid once at startup. Stateless after construction; safe to
/// share across requests.
/// </summary>
public sealed class ReferenceService
{
    private readonly Dictionary<string, IReadOnlyList<FieldDefinition>> _fieldsByType;
    private readonly Dictionary<string, string> _namespaceByType;
    private readonly FieldIndex _fieldIndex;
    private readonly IReadOnlyList<string> _messageTypes;

    public ReferenceService(SchemaRegistry schemaRegistry)
    {
        ArgumentNullException.ThrowIfNull(schemaRegistry);

        var extractor = new XsdFieldExtractor();
        _fieldsByType = new Dictionary<string, IReadOnlyList<FieldDefinition>>(
            StringComparer.OrdinalIgnoreCase);
        _namespaceByType = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        _fieldIndex = new FieldIndex();

        foreach (var info in schemaRegistry.ListSupportedTypes())
        {
            var schema = schemaRegistry.GetSchema(info.Namespace);
            if (schema == null) continue;

            try
            {
                var fields = extractor.Extract(schema);
                _fieldsByType[info.MessageType] = fields;
                _namespaceByType[info.MessageType] = info.Namespace;
                foreach (var field in fields)
                    _fieldIndex.Add(info.MessageType, field);
            }
            catch (Exception)
            {
                // A schema we can't extract from is logged-and-skipped rather
                // than fatal: the reference UI still serves every other type.
                // Common causes: a satellite-schema import we don't ship.
            }
        }

        _messageTypes = _fieldsByType.Keys.OrderBy(t => t, StringComparer.Ordinal).ToList();
    }

    public IReadOnlyList<string> GetMessageTypes() => _messageTypes;

    public IReadOnlyList<FieldDefinition>? GetFields(string messageType)
        => _fieldsByType.GetValueOrDefault(messageType);

    /// <summary>Resolves the XML target namespace for a registered message type, or <c>null</c>.</summary>
    public string? GetNamespace(string messageType)
        => _namespaceByType.GetValueOrDefault(messageType);

    public IReadOnlyList<FieldSearchResult> Search(string term) => _fieldIndex.Search(term);

    public IReadOnlyList<FieldOccurrence> FindField(string fieldName) => _fieldIndex.Find(fieldName);

    /// <summary>Exact-name lookup wrapped as a <see cref="FieldSearchResult"/>.</summary>
    public FieldSearchResult? GetFieldDetail(string fieldName) => _fieldIndex.FindAsSearchResult(fieldName);

    /// <summary>All indexed field names (for the upcoming Builder's autocomplete).</summary>
    public IReadOnlyList<string> GetAllFieldNames() => _fieldIndex.AllFieldNames();
}
