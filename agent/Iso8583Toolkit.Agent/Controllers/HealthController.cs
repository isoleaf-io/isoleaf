using System.Diagnostics;
using System.Reflection;
using Iso8583Toolkit.Agent.Services;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Agent.Controllers;

[ApiController]
[Route("api/health")]
public sealed class HealthController : ControllerBase
{
    private static readonly DateTime StartedAt = DateTime.UtcNow;
    private readonly LocalSessionStore _store;
    private readonly IConfiguration _config;

    public HealthController(LocalSessionStore store, IConfiguration config)
    {
        _store = store;
        _config = config;
    }

    [HttpGet]
    public IActionResult Get()
    {
        var version = Assembly.GetExecutingAssembly()
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
            ?? Assembly.GetExecutingAssembly().GetName().Version?.ToString()
            ?? "1.1.1";

        var uptime = DateTime.UtcNow - StartedAt;
        var mongoEnabled = _config.GetValue<bool>("MongoDB:Enabled");
        var brokerEnabled = _config.GetValue<bool>("Broker:Enabled");

        return Ok(new
        {
            status = "ok",
            version,
            uptime = uptime.ToString(@"hh\:mm\:ss"),
            activeSessions = _store.GetActiveSessions().Count(),
            totalMessagesProcessed = _store.TotalMessagesProcessed,
            mongoDbConnected = mongoEnabled,
            brokerConnected = brokerEnabled
        });
    }
}
