using System.Reflection;
using Iso8583Toolkit.Backend.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Backend.Controllers;

[ApiController]
[Route("api/health")]
public sealed class HealthController : ControllerBase
{
    private static readonly DateTime StartedAt = DateTime.UtcNow;
    private readonly LocalSessionStore _store;

    public HealthController(LocalSessionStore store)
    {
        _store = store;
    }

    [HttpGet]
    [EndpointSummary("Liveness probe + Backend runtime metadata")]
    [EndpointDescription("Returns a constant `status=ok` plus the running assembly version, process uptime and total messages processed by the Backend-side log store since startup. Designed for container HEALTHCHECKs and for the frontend's Backend badge. Simulator session/message counters live on the Agent host's own /api/health after the Sprint 12.2 split.")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult Get()
    {
        var version = Assembly.GetExecutingAssembly()
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
            ?? Assembly.GetExecutingAssembly().GetName().Version?.ToString()
            ?? "3.0.0";

        var uptime = DateTime.UtcNow - StartedAt;

        return Ok(new
        {
            status = "ok",
            version,
            uptime = uptime.ToString(@"hh\:mm\:ss"),
            totalMessagesProcessed = _store.TotalMessagesProcessed,
        });
    }
}
