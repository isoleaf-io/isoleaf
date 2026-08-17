using Iso8583Toolkit.Simulator.Protocol;

namespace Iso8583Toolkit.Simulator.Sessions;

/// <summary>
/// Registry of simulator sessions the host has active or has recently
/// stopped. Deliberately narrow: only the four calls the Agent host and
/// the TCP handler actually make today (AddSession / GetSession /
/// GetActiveSessions / RemoveSession) — no persistence, no log storage,
/// no workspace/template surface. Those latter concerns are host-side
/// concerns and stay in whichever component owns them.
///
/// The Simulator library ships an <see cref="InMemorySessionStore"/>
/// as the default implementation; a hosted-mode adapter (Redis, SQL,
/// etc.) could plug in without touching callers.
/// </summary>
public interface ISessionStore
{
    /// <summary>
    /// Registers (or replaces) a session under its <c>SessionId</c>.
    /// Called when the TCP listener is bound or the outbound client
    /// connects, before status flips to Active.
    /// </summary>
    void AddSession(SimulatorSession session);

    /// <summary>
    /// Returns the session with the given id, or null if it was never
    /// registered / has already been evicted.
    /// </summary>
    SimulatorSession? GetSession(string sessionId);

    /// <summary>
    /// Sessions still in <see cref="SessionStatus.Active"/> or
    /// <see cref="SessionStatus.Starting"/>. Stopped sessions stay in
    /// the store for observability but drop out of this projection.
    /// </summary>
    IEnumerable<SimulatorSession> GetActiveSessions();

    /// <summary>
    /// Marks the session as stopped (status + StoppedAt timestamp).
    /// Idempotent — no-op when the id is unknown.
    /// </summary>
    void RemoveSession(string sessionId);
}
