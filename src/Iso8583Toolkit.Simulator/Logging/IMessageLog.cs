namespace Iso8583Toolkit.Simulator.Logging;

/// <summary>
/// Append-only audit log for messages the simulator processes.
/// Deliberately narrow — the four surfaces IsoSessionHandler +
/// SimulatorController + HealthController actually call today:
/// append, filtered-and-limited read, wipe, count.
///
/// The Simulator library ships an <see cref="InMemoryMessageLog"/> as
/// the default implementation. Standalone Agent hosts wire it up as a
/// singleton in DI; hosted-mode adapters (SQL, Elastic, S3, …) could
/// plug in without touching callers.
///
/// Extracted from the legacy <c>LocalSessionStore</c> in Sprint 12.2 so
/// the Simulator pipeline (IsoSessionHandler / TcpSessionManager /
/// SimulatorController) can move out of the Backend host into a
/// dedicated Agent process without pulling the Backend's log/templates/
/// workspace store along for the ride.
/// </summary>
public interface IMessageLog
{
    /// <summary>
    /// Appends one entry. Implementations may cap the log at a fixed
    /// retention (the default in-memory adapter does, matching the old
    /// <c>LocalSessionStore.LogRetention</c> behaviour).
    /// </summary>
    void LogMessage(MessageLogEntry entry);

    /// <summary>
    /// Most recent entries first, optionally filtered to one session.
    /// <paramref name="limit"/> caps the batch (default 100 preserves
    /// the pre-Sprint-12.2 behaviour).
    /// </summary>
    IEnumerable<MessageLogEntry> GetLog(string? sessionId = null, int limit = 100);

    /// <summary>Wipes every entry. Sessions themselves are not touched.</summary>
    void ClearLog();

    /// <summary>Count of entries currently retained.</summary>
    int TotalMessagesProcessed { get; }
}
