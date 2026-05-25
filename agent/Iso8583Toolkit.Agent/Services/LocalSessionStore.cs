using System.Collections.Concurrent;
using Iso8583Toolkit.Agent.Models;

namespace Iso8583Toolkit.Agent.Services;

/// <summary>
/// In-memory store for sessions, message log, templates and workspace config.
/// Standalone agent has no DB dependency in v1; everything lives here.
/// </summary>
public sealed class LocalSessionStore
{
    private readonly ConcurrentDictionary<string, SimulatorSession> _sessions = new();
    private readonly ConcurrentDictionary<string, SavedTemplate> _templates = new();
    private readonly object _logLock = new();
    private readonly LinkedList<MessageLogEntry> _log = new();
    private WorkspaceConfig _workspace = new();

    public int LogRetention { get; set; } = 500;

    // ── Sessions ────────────────────────────────────────────────────────────

    public void AddSession(SimulatorSession session) =>
        _sessions[session.SessionId] = session;

    public void RemoveSession(string sessionId)
    {
        if (_sessions.TryGetValue(sessionId, out var s))
        {
            s.Status = SessionStatus.Stopped;
            s.StoppedAt = DateTime.UtcNow;
        }
    }

    public SimulatorSession? GetSession(string sessionId) =>
        _sessions.TryGetValue(sessionId, out var s) ? s : null;

    public IEnumerable<SimulatorSession> GetActiveSessions() =>
        _sessions.Values.Where(s => s.Status is SessionStatus.Active or SessionStatus.Starting);

    public IEnumerable<SimulatorSession> GetAllSessions() => _sessions.Values;

    // ── Message log ─────────────────────────────────────────────────────────

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
