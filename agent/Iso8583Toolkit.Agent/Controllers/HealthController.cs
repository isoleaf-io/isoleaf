using System.Reflection;
using Iso8583Toolkit.Agent.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Agent.Controllers;

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
    [EndpointSummary("Liveness probe + agent runtime metadata")]
    [EndpointDescription("Returns a constant `status=ok` plus the running assembly version, process uptime, active simulator session count and total messages processed since startup. Designed for container HEALTHCHECKs and for the frontend's Agent badge.")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult Get()
    {
        var version = Assembly.GetExecutingAssembly()
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
            ?? Assembly.GetExecutingAssembly().GetName().Version?.ToString()
            ?? "1.4.2";

        var uptime = DateTime.UtcNow - StartedAt;

        return Ok(new
        {
            status = "ok",
            version,
            uptime = uptime.ToString(@"hh\:mm\:ss"),
            activeSessions = _store.GetActiveSessions().Count(),
            totalMessagesProcessed = _store.TotalMessagesProcessed,
        });
    }
}
