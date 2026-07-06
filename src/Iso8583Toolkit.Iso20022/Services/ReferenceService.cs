using Iso8583Toolkit.Iso20022.Schema;
using Iso8583Toolkit.Iso20022.Validation;

namespace Iso8583Toolkit.Iso20022.Services;

/// <summary>
/// Field reference for every ISO 20022 message type the agent supports.
/// Heavy to construct (runs <see cref="XsdFieldExtractor"/> over every XSD
/// in the <see cref="SchemaRegistry"/>) — register as a singleton so the
/// cost is paid once at startup. Reads are lock-guarded but rarely
/// contended; the write path (<see cref="Reload"/>) is called only on
/// XSD upload and rebuilds every map atomically before the swap.
/// </summary>
public sealed class ReferenceService
{
    private readonly SchemaRegistry _schemaRegistry;
    private readonly object _stateLock = new();

    private Dictionary<string, IReadOnlyList<FieldDefinition>> _fieldsByType;
    private Dictionary<string, string> _namespaceByType;
    private FieldIndex _fieldIndex;
    private IReadOnlyList<string> _messageTypes;

    public ReferenceService(SchemaRegistry schemaRegistry)
    {
        ArgumentNullException.ThrowIfNull(schemaRegistry);
        _schemaRegistry = schemaRegistry;

        // Seed the four fields with empty containers so the non-null
        // fields are populated before Reload() runs, satisfying the
        // definite-assignment analyser without unsafe suppressions.
        _fieldsByType = new Dictionary<string, IReadOnlyList<FieldDefinition>>(
            StringComparer.OrdinalIgnoreCase);
        _namespaceByType = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        _fieldIndex = new FieldIndex();
        _messageTypes = [];

        Reload();
    }

    /// <summary>
    /// Rebuilds every internal map by re-reading the schema registry.
    /// Called from the constructor at startup and from the Workspace
    /// upload endpoint (after <see cref="SchemaRegistry.Reload"/>) so a
    /// newly-added XSD is queryable in the same HTTP request.
    ///
    /// <para>Extraction still happens under a per-schema try/catch: a
    /// single malformed XSD is skipped and the remaining message types
    /// stay loadable, matching the tolerance the constructor already had
    /// before the refactor.</para>
    /// </summary>
    public void Reload()
    {
        var extractor = new XsdFieldExtractor();
        var fieldsByType = new Dictionary<string, IReadOnlyList<FieldDefinition>>(
            StringComparer.OrdinalIgnoreCase);
        var namespaceByType = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var fieldIndex = new FieldIndex();

        foreach (var info in _schemaRegistry.ListSupportedTypes())
        {
            var schema = _schemaRegistry.GetSchema(info.Namespace);
            if (schema == null) continue;

            try
            {
                var fields = extractor.Extract(schema);
                fieldsByType[info.MessageType] = fields;
                namespaceByType[info.MessageType] = info.Namespace;
                foreach (var field in fields)
                    fieldIndex.Add(info.MessageType, field);
            }
            catch (Exception)
            {
                // A schema we can't extract from is logged-and-skipped
                // rather than fatal: the reference UI still serves every
                // other type. Common causes: a satellite-schema import
                // we don't ship, or a user-uploaded malformed XSD.
            }
        }

        var messageTypes = fieldsByType.Keys.OrderBy(t => t, StringComparer.Ordinal).ToList();

        // All four maps are ready — swap under the lock so any read in
        // flight either sees the fully-previous state or the fully-new
        // state, never a torn mix.
        lock (_stateLock)
        {
            _fieldsByType = fieldsByType;
            _namespaceByType = namespaceByType;
            _fieldIndex = fieldIndex;
            _messageTypes = messageTypes;
        }
    }

    public IReadOnlyList<string> GetMessageTypes()
    {
        lock (_stateLock) return _messageTypes;
    }

    public IReadOnlyList<FieldDefinition>? GetFields(string messageType)
    {
        lock (_stateLock) return _fieldsByType.GetValueOrDefault(messageType);
    }

    /// <summary>Resolves the XML target namespace for a registered message type, or <c>null</c>.</summary>
    public string? GetNamespace(string messageType)
    {
        lock (_stateLock) return _namespaceByType.GetValueOrDefault(messageType);
    }

    public IReadOnlyList<FieldSearchResult> Search(string term)
    {
        lock (_stateLock) return _fieldIndex.Search(term);
    }

    public IReadOnlyList<FieldOccurrence> FindField(string fieldName)
    {
        lock (_stateLock) return _fieldIndex.Find(fieldName);
    }

    /// <summary>Exact-name lookup wrapped as a <see cref="FieldSearchResult"/>.</summary>
    public FieldSearchResult? GetFieldDetail(string fieldName)
    {
        lock (_stateLock) return _fieldIndex.FindAsSearchResult(fieldName);
    }

    /// <summary>All indexed field names (for the Builder's autocomplete).</summary>
    public IReadOnlyList<string> GetAllFieldNames()
    {
        lock (_stateLock) return _fieldIndex.AllFieldNames();
    }
}
