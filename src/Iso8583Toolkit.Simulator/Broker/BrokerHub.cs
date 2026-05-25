using Iso8583Toolkit.Simulator.Protocol;
using Microsoft.AspNetCore.SignalR;

namespace Iso8583Toolkit.Simulator.Broker;

/// <summary>
/// SignalR Hub for real-time communication with the frontend panel.
/// Groups are organized by TenantId and SessionId.
/// </summary>
public sealed class BrokerHub : Hub
{
    public async Task JoinSession(string sessionId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"session:{sessionId}");
    }

    public async Task LeaveSession(string sessionId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"session:{sessionId}");
    }

    public async Task JoinTenant(string tenantId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"tenant:{tenantId}");
    }

    /// <summary>
    /// Sends a message event to all clients in a tenant group.
    /// Called internally by the broker, not directly by clients.
    /// </summary>
    public static async Task NotifyTenant(IHubContext<BrokerHub> hubContext, string tenantId, SimulatorMessage message)
    {
        await hubContext.Clients.Group($"tenant:{tenantId}").SendAsync("OnSessionEvent", message);
    }

    /// <summary>
    /// Sends a message event to all clients in a session group.
    /// </summary>
    public static async Task NotifySession(IHubContext<BrokerHub> hubContext, string sessionId, SimulatorMessage message)
    {
        await hubContext.Clients.Group($"session:{sessionId}").SendAsync("OnMessageReceived", message);
    }
}
