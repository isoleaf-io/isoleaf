using System.Net.WebSockets;

namespace Iso8583Toolkit.Simulator.Broker;

public sealed class AgentConnection
{
    public required string TenantId { get; init; }
    public required string AgentId { get; init; }
    public required WebSocket Socket { get; init; }
    public DateTime ConnectedAt { get; init; } = DateTime.UtcNow;
    public DateTime LastHeartbeat { get; set; } = DateTime.UtcNow;
    public List<string> ActiveSessionIds { get; } = [];
    public AgentMetadata? Metadata { get; set; }
    public bool IsAlive => Socket.State == WebSocketState.Open;
}
