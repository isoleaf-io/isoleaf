using Iso8583Toolkit.Simulator.Logging;
using Iso8583Toolkit.Simulator.Protocol;
using Microsoft.AspNetCore.SignalR;

namespace Iso8583Toolkit.Agent.Hubs;

/// <summary>
/// Broadcasts simulator events to UI subscribers. Clients can join a per-session
/// group to receive only that session's stream, or subscribe at the connection level
/// to get every event the agent emits.
/// </summary>
public sealed class SimulatorHub : Hub
{
    public Task JoinSession(string sessionId) =>
        Groups.AddToGroupAsync(Context.ConnectionId, sessionId);

    public Task LeaveSession(string sessionId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, sessionId);
}

/// <summary>
/// Server-side helpers to emit events to connected clients.
/// </summary>
public static class SimulatorHubEvents
{
    public static Task MessageReceived(IHubContext<SimulatorHub> hub, MessageLogEntry entry) =>
        hub.Clients.Group(entry.SessionId).SendAsync("OnMessageReceived", entry);

    public static Task MessageSent(IHubContext<SimulatorHub> hub, MessageLogEntry entry) =>
        hub.Clients.Group(entry.SessionId).SendAsync("OnMessageSent", entry);

    public static Task SessionStarted(IHubContext<SimulatorHub> hub, SimulatorSession session) =>
        hub.Clients.All.SendAsync("OnSessionStarted", session);

    public static Task SessionStopped(IHubContext<SimulatorHub> hub, SimulatorSession session) =>
        hub.Clients.All.SendAsync("OnSessionStopped", session);

    public static Task Error(IHubContext<SimulatorHub> hub, string sessionId, string error) =>
        hub.Clients.Group(sessionId).SendAsync("OnError", new { sessionId, error });
}
