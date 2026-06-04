using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Agent.Controllers;

/// <summary>
/// Exposes the runtime feature-flag profile to the frontend. The flags are
/// derived from ISOHUB_MODE — read through <see cref="IConfiguration"/> so it
/// flows from env vars in production AND from in-memory config in tests
/// (avoiding process-global mutation across parallel xUnit collections).
/// </summary>
[ApiController]
[Route("api/config")]
public sealed class ConfigController : ControllerBase
{
    private readonly IConfiguration _config;

    public ConfigController(IConfiguration config) => _config = config;

    [HttpGet]
    public IActionResult Get() => Ok(BuildConfig(_config));

    internal static AppConfig BuildConfig(IConfiguration config)
    {
        var mode = config["ISOHUB_MODE"]?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(mode)) mode = "standalone";
        var isOnline = mode == "online";

        return new AppConfig
        {
            Mode = mode,
            SimulatorEnabled = !isOnline,
            EmvCryptoEnabled = !isOnline,
            WorkspaceKeysEnabled = !isOnline,
        };
    }
}

public sealed class AppConfig
{
    public string Mode { get; init; } = "standalone";
    public bool SimulatorEnabled { get; init; } = true;
    public bool EmvCryptoEnabled { get; init; } = true;
    public bool WorkspaceKeysEnabled { get; init; } = true;
}
