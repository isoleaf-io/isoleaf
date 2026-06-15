using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text.Json;
using Iso8583Toolkit.Simulator.Protocol;
using Microsoft.Extensions.Logging;

namespace Iso8583Toolkit.Simulator.Broker;

public sealed class SimulatorBroker
{
    private readonly ConcurrentDictionary<string, AgentConnection> _agents = new();
    private readonly ILogger<SimulatorBroker> _logger;

    /// <summary>
    /// Fired when an event should be broadcast to panel clients (e.g., via SignalR).
    /// </summary>
    public event Action<string, SimulatorMessage>? OnBroadcast;

    public SimulatorBroker(ILogger<SimulatorBroker> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Strips CR/LF from a string before sending it to the logger. Defends
    /// against log forging (CWE-117) when the value is sourced from a
    /// WebSocket URL parameter or agent-supplied payload.
    /// </summary>
    private static string Safe(string? s) =>
        s?.Replace("\r", "\\r").Replace("\n", "\\n") ?? "";

    /// <summary>
    /// Handles the full lifecycle of an agent WebSocket connection.
    /// </summary>
    public async Task HandleAgentConnection(WebSocket socket, string tenantId, CancellationToken ct)
    {
        var agentId = Guid.NewGuid().ToString();
        var connection = new AgentConnection
        {
            TenantId = tenantId,
            AgentId = agentId,
            Socket = socket
        };

        _agents[tenantId] = connection;
        _logger.LogInformation("Agent registered: tenant={TenantId}, agentId={AgentId}", Safe(tenantId), agentId);

        // Send registration confirmation
        var registered = SimulatorMessage.Create(SimulatorMessageType.AgentRegistered, tenantId,
            new { agentId, message = "Agent registered successfully" });
        await SendToSocket(socket, registered, ct);

        var buffer = new byte[1024 * 16];

        try
        {
            while (socket.State == WebSocketState.Open && !ct.IsCancellationRequested)
            {
                var result = await socket.ReceiveAsync(buffer, ct);

                if (result.MessageType == WebSocketMessageType.Close)
                {
                    _logger.LogInformation("Agent disconnected cleanly: tenant={TenantId}", Safe(tenantId));
                    break;
                }

                if (result.MessageType == WebSocketMessageType.Text)
                {
                    var message = SimulatorMessage.Deserialize(buffer.AsSpan(0, result.Count));
                    if (message is not null)
                        await ProcessAgentMessage(connection, message, ct);
                }
            }
        }
        catch (WebSocketException ex)
        {
            _logger.LogWarning(ex, "WebSocket error for tenant={TenantId}", Safe(tenantId));
        }
        catch (OperationCanceledException)
        {
            // Normal shutdown
        }
        finally
        {
            _agents.TryRemove(tenantId, out _);
            _logger.LogInformation("Agent removed: tenant={TenantId}", Safe(tenantId));

            if (socket.State == WebSocketState.Open)
            {
                try
                {
                    await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Server closing", CancellationToken.None);
                }
                catch { /* best effort */ }
            }
        }
    }

    /// <summary>
    /// Sends a command to the agent for a specific tenant.
    /// </summary>
    public async Task SendCommand(string tenantId, SimulatorMessage command, CancellationToken ct = default)
    {
        if (!_agents.TryGetValue(tenantId, out var connection))
            throw new InvalidOperationException($"No agent connected for tenant '{tenantId}'.");

        if (!connection.IsAlive)
            throw new InvalidOperationException($"Agent for tenant '{tenantId}' is disconnected.");

        await SendToSocket(connection.Socket, command, ct);
    }

    /// <summary>
    /// Broadcasts an event from agent to panel clients.
    /// </summary>
    public void BroadcastEvent(string tenantId, SimulatorMessage evt)
    {
        OnBroadcast?.Invoke(tenantId, evt);
    }

    public bool IsAgentConnected(string tenantId) =>
        _agents.TryGetValue(tenantId, out var conn) && conn.IsAlive;

    public IEnumerable<AgentConnection> GetConnectedAgents() =>
        _agents.Values.Where(a => a.IsAlive);

    public AgentConnection? GetAgent(string tenantId) =>
        _agents.GetValueOrDefault(tenantId);

    private async Task ProcessAgentMessage(AgentConnection connection, SimulatorMessage message, CancellationToken ct)
    {
        switch (message.Type)
        {
            case SimulatorMessageType.AgentRegister:
                connection.Metadata = message.DeserializePayload<AgentMetadata>();
                connection.LastHeartbeat = DateTime.UtcNow;
                _logger.LogInformation("Agent metadata updated: tenant={TenantId}, host={Host}",
                    Safe(connection.TenantId), Safe(connection.Metadata?.Hostname));
                break;

            case SimulatorMessageType.AgentHeartbeat:
                connection.LastHeartbeat = DateTime.UtcNow;
                var ack = SimulatorMessage.Create(SimulatorMessageType.AgentHeartbeatAck, connection.TenantId);
                await SendToSocket(connection.Socket, ack, ct);
                break;

            case SimulatorMessageType.AgentDisconnect:
                _logger.LogInformation("Agent requested disconnect: tenant={TenantId}", Safe(connection.TenantId));
                break;

            // Events to forward to panel
            case SimulatorMessageType.SessionStarted:
            case SimulatorMessageType.SessionStopped:
            case SimulatorMessageType.ConnectionAccepted:
            case SimulatorMessageType.ConnectionClosed:
            case SimulatorMessageType.MessageReceived:
            case SimulatorMessageType.MessageSent:
            case SimulatorMessageType.ValidationResult:
            case SimulatorMessageType.Error:
                BroadcastEvent(connection.TenantId, message);
                break;
        }
    }

    private static async Task SendToSocket(WebSocket socket, SimulatorMessage message, CancellationToken ct)
    {
        var data = message.Serialize();
        await socket.SendAsync(data, WebSocketMessageType.Text, true, ct);
    }
}
