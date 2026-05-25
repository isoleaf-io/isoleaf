using System.Net.WebSockets;
using Iso8583Toolkit.Simulator.Broker;
using Iso8583Toolkit.Simulator.Protocol;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Api.Controllers;

[ApiController]
[Route("api/simulator")]
public sealed class SimulatorController : ControllerBase
{
    private readonly SimulatorBroker _broker;

    public SimulatorController(SimulatorBroker broker)
    {
        _broker = broker;
    }

    /// <summary>
    /// WebSocket endpoint — agents connect here.
    /// </summary>
    [Route("ws")]
    [ApiExplorerSettings(IgnoreApi = true)]
    public async Task WebSocketEndpoint()
    {
        if (!HttpContext.WebSockets.IsWebSocketRequest)
        {
            HttpContext.Response.StatusCode = StatusCodes.Status400BadRequest;
            await HttpContext.Response.WriteAsync("WebSocket connection required.");
            return;
        }

        var tenantId = HttpContext.Request.Query["tenantId"].FirstOrDefault();
        var apiKey = HttpContext.Request.Query["apiKey"].FirstOrDefault();

        if (string.IsNullOrWhiteSpace(tenantId) || string.IsNullOrWhiteSpace(apiKey))
        {
            HttpContext.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await HttpContext.Response.WriteAsync("tenantId and apiKey query parameters are required.");
            return;
        }

        var socket = await HttpContext.WebSockets.AcceptWebSocketAsync();
        await _broker.HandleAgentConnection(socket, tenantId, HttpContext.RequestAborted);
    }

    /// <summary>
    /// Start a simulation session for a tenant's agent.
    /// </summary>
    [HttpPost("sessions")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> StartSession([FromBody] StartSessionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.TenantId))
            return BadRequest(new { error = "TenantId is required." });

        if (!_broker.IsAgentConnected(request.TenantId))
            return BadRequest(new { error = $"No agent connected for tenant '{request.TenantId}'." });

        var config = request.Config ?? new SessionConfig();
        var command = SimulatorMessage.Create(SimulatorMessageType.StartSession, request.TenantId, config);

        await _broker.SendCommand(request.TenantId, command);

        return Ok(new { sessionId = config.SessionId, status = "StartSession command sent to agent" });
    }

    /// <summary>
    /// Stop a simulation session.
    /// </summary>
    [HttpDelete("sessions/{sessionId}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> StopSession(string sessionId, [FromQuery] string tenantId)
    {
        if (!_broker.IsAgentConnected(tenantId))
            return BadRequest(new { error = $"No agent connected for tenant '{tenantId}'." });

        var command = SimulatorMessage.Create(SimulatorMessageType.StopSession, tenantId,
            new { sessionId });

        await _broker.SendCommand(tenantId, command);

        return Ok(new { sessionId, status = "StopSession command sent to agent" });
    }

    /// <summary>
    /// Inject an ISO message into an active session.
    /// If <c>IncludeTpdu</c> is true, prepends a TPDU header to the message. When
    /// <c>Tpdu</c> is "AUTO" (or null), a valid TPDU is generated automatically.
    /// </summary>
    [HttpPost("sessions/{sessionId}/inject")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> InjectMessage(string sessionId, [FromBody] InjectMessageRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.TenantId))
            return BadRequest(new { error = "TenantId is required." });

        if (!_broker.IsAgentConnected(request.TenantId))
            return BadRequest(new { error = $"No agent connected for tenant '{request.TenantId}'." });

        // TPDU resolution rules:
        //   IncludeTpdu=false or Tpdu=null  → no TPDU prepended
        //   Tpdu="AUTO"                     → generate a valid random TPDU
        //   Tpdu=<10 hex chars>             → use as-is
        string? tpduHex = null;
        if (request.IncludeTpdu && request.Tpdu is not null)
        {
            try
            {
                tpduHex = string.Equals(request.Tpdu, "AUTO", StringComparison.OrdinalIgnoreCase)
                    ? TpduBuilder.GenerateAuto()
                    : request.Tpdu.ToUpperInvariant();

                _ = TpduBuilder.Parse(tpduHex); // validate 10 hex chars
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = $"Invalid TPDU: {ex.Message}" });
            }
        }

        var command = SimulatorMessage.Create(SimulatorMessageType.InjectMessage, request.TenantId,
            new { sessionId, hexMessage = request.HexMessage, tpdu = tpduHex });

        await _broker.SendCommand(request.TenantId, command);

        return Ok(new { sessionId, tpdu = tpduHex, status = "InjectMessage command sent to agent" });
    }

    /// <summary>
    /// Generate a valid TPDU (Transport Protocol Data Unit) header.
    /// Pass <c>destinationNii</c>/<c>sourceNii</c> (4-digit decimal) for deterministic
    /// output, or omit to generate random NIIs.
    /// </summary>
    [HttpPost("tpdu/generate")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult GenerateTpdu([FromBody] GenerateTpduRequest? request)
    {
        try
        {
            var id = request?.Id ?? TpduBuilder.DefaultId;
            var hex = string.IsNullOrWhiteSpace(request?.DestinationNii) ||
                      string.IsNullOrWhiteSpace(request?.SourceNii)
                ? TpduBuilder.GenerateAuto()
                : TpduBuilder.Build(id, request.DestinationNii, request.SourceNii);

            var parts = TpduBuilder.Parse(hex);
            return Ok(new
            {
                tpdu = hex,
                id = $"0x{parts.Id:X2}",
                destinationNii = parts.DestinationNii,
                sourceNii = parts.SourceNii
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// List all connected agents.
    /// </summary>
    [HttpGet("agents")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult GetAgents()
    {
        var agents = _broker.GetConnectedAgents()
            .Select(a => new
            {
                a.TenantId,
                a.AgentId,
                a.ConnectedAt,
                a.LastHeartbeat,
                ActiveSessions = a.ActiveSessionIds,
                Metadata = a.Metadata
            });

        return Ok(agents);
    }

    /// <summary>
    /// Get status for a specific tenant's agent.
    /// </summary>
    [HttpGet("agents/{tenantId}/status")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult GetAgentStatus(string tenantId)
    {
        var agent = _broker.GetAgent(tenantId);
        if (agent is null)
            return NotFound(new { error = $"No agent found for tenant '{tenantId}'." });

        return Ok(new
        {
            Connected = agent.IsAlive,
            agent.TenantId,
            agent.AgentId,
            agent.ConnectedAt,
            agent.LastHeartbeat,
            ActiveSessions = agent.ActiveSessionIds,
            Metadata = agent.Metadata
        });
    }
}

// ── Request DTOs ────────────────────────────────────────────────────────────

public sealed record StartSessionRequest(string TenantId, SessionConfig? Config = null);

public sealed record InjectMessageRequest(
    string TenantId,
    string HexMessage,
    bool IncludeTpdu = false,
    string? Tpdu = null);

public sealed record GenerateTpduRequest(byte? Id = null, string? DestinationNii = null, string? SourceNii = null);
