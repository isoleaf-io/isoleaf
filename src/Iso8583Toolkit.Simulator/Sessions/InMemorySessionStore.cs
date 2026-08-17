using System.Collections.Concurrent;
using Iso8583Toolkit.Simulator.Protocol;

namespace Iso8583Toolkit.Simulator.Sessions;

/// <summary>
/// Default <see cref="ISessionStore"/> — process-local dictionary, no
/// persistence, no shared state across replicas. Fits the standalone
/// Agent's one-process-per-host deployment model. Concurrent because
/// the AcceptLoop and the controllers touch the store from different
/// threads.
///
/// Behaviour matches the legacy Sessions section of the old
/// <c>LocalSessionStore</c> in the Backend one-for-one — the extraction
/// only splits Simulator concerns out of the workspace/templates store,
/// no logic change.
/// </summary>
public sealed class InMemorySessionStore : ISessionStore
{
    private readonly ConcurrentDictionary<string, SimulatorSession> _sessions = new();

    public void AddSession(SimulatorSession session) =>
        _sessions[session.SessionId] = session;

    public SimulatorSession? GetSession(string sessionId) =>
        _sessions.TryGetValue(sessionId, out var s) ? s : null;

    public IEnumerable<SimulatorSession> GetActiveSessions() =>
        _sessions.Values.Where(s => s.Status is SessionStatus.Active or SessionStatus.Starting);

    public void RemoveSession(string sessionId)
    {
        if (_sessions.TryGetValue(sessionId, out var s))
        {
            s.Status = SessionStatus.Stopped;
            s.StoppedAt = DateTime.UtcNow;
        }
    }
}
