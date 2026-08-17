namespace Iso8583Toolkit.Simulator.Logging;

/// <summary>
/// Default <see cref="IMessageLog"/> — process-local linked list, no
/// persistence, capped at <see cref="LogRetention"/> entries with FIFO
/// eviction. Behaviour matches the legacy log section of the old
/// <c>LocalSessionStore</c> in the Backend one-for-one; the extraction
/// is a pure re-home, not a semantic change.
///
/// Fits the standalone Agent's one-process-per-host deployment model.
/// The <c>lock</c> around the list is coarse but sufficient — the log
/// isn't in any hot path (TCP throughput dominates).
/// </summary>
public sealed class InMemoryMessageLog : IMessageLog
{
    private readonly object _logLock = new();
    private readonly LinkedList<MessageLogEntry> _log = new();

    /// <summary>Max entries kept before FIFO eviction. Matches the
    /// legacy <c>LocalSessionStore.LogRetention</c> default (500).</summary>
    public int LogRetention { get; set; } = 500;

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
}
