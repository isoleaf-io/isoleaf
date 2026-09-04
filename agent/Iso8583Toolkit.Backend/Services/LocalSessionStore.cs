using System.Collections.Concurrent;
using Iso8583Toolkit.Backend.Models;
using Iso8583Toolkit.Simulator.Logging;

namespace Iso8583Toolkit.Backend.Services;

/// <summary>
/// Backend-side store for the message log, saved templates and workspace
/// config. Sessions themselves live in <c>ISessionStore</c> (Simulator
/// library) since Sprint 12.2. Also implements <see cref="IMessageLog"/>
/// so the Backend can satisfy the same log port the Agent's Simulator
/// components consume — the interface + the class share the exact same
/// storage semantics (linked list, FIFO eviction at
/// <see cref="LogRetention"/>).
/// Standalone agent has no DB dependency in v1; everything lives here.
/// </summary>
public sealed class LocalSessionStore : IMessageLog
{
    private readonly ConcurrentDictionary<string, SavedTemplate> _templates = new();
    private readonly object _logLock = new();
    private readonly LinkedList<MessageLogEntry> _log = new();
    private WorkspaceConfig _workspace = new();

    public int LogRetention { get; set; } = 500;

    // ── Message log (IMessageLog) ───────────────────────────────────────────

    public void LogMessage(MessageLogEntry entry)
    {
        lock (_logLock)
        {
            _log.AddLast(entry);
            while (_log.Count > LogRetention)
                _log.RemoveFirst();
        }
    }

    public IEnumerable<MessageLogEntry> GetLog(string? sessionId = null, int limit = 100)
    {
        lock (_logLock)
        {
            IEnumerable<MessageLogEntry> q = _log;
            if (sessionId is not null)
                q = q.Where(e => e.SessionId == sessionId);
            return q.Reverse().Take(limit).ToList();
        }
    }

    public void ClearLog()
    {
        lock (_logLock) { _log.Clear(); }
    }

    public int TotalMessagesProcessed
    {
        get { lock (_logLock) { return _log.Count; } }
    }

    // ── Templates ───────────────────────────────────────────────────────────

    public void SaveTemplate(SavedTemplate template) =>
        _templates[template.TemplateId] = template;

    public IEnumerable<SavedTemplate> GetTemplates() =>
        _templates.Values.OrderByDescending(t => t.SavedAt);

    public SavedTemplate? GetTemplate(string id) =>
        _templates.TryGetValue(id, out var t) ? t : null;

    public bool DeleteTemplate(string id) => _templates.TryRemove(id, out _);

    // ── Workspace ───────────────────────────────────────────────────────────

    public void UpdateWorkspaceConfig(WorkspaceConfig config) => _workspace = config;

    public WorkspaceConfig GetWorkspaceConfig() => _workspace;
}
