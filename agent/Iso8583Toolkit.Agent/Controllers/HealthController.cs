using System.Reflection;
using Iso8583Toolkit.Simulator.Logging;
using Iso8583Toolkit.Simulator.Sessions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Agent.Controllers;

[ApiController]
[Route("api/health")]
public sealed class HealthController : ControllerBase
{
    private static readonly DateTime StartedAt = DateTime.UtcNow;
    private readonly IMessageLog _log;
    private readonly ISessionStore _sessions;

    public HealthController(IMessageLog log, ISessionStore sessions)
    {
        _log = log;
        _sessions = sessions;
    }

    [HttpGet]
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
            activeSessions = _sessions.GetActiveSessions().Count(),
            totalMessagesProcessed = _log.TotalMessagesProcessed,
        });
    }
}
