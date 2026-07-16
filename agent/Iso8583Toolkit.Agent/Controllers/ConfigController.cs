using Microsoft.AspNetCore.Http;
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
    [EndpointSummary("Report the runtime feature-flag profile (standalone vs online)")]
    [EndpointDescription("Returns the current `mode` resolved from `ISOHUB_MODE` and the per-feature toggles (simulator, EMV crypto, workspace keys). The frontend uses this to hide locked menus and to label the public demo banner. Standalone is the default when the variable is unset.")]
    [ProducesResponseType(typeof(AppConfig), StatusCodes.Status200OK)]
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
            SchemaUploadEnabled = !isOnline,
        };
    }
}

public sealed class AppConfig
{
    public string Mode { get; init; } = "standalone";
    public bool SimulatorEnabled { get; init; } = true;
    public bool EmvCryptoEnabled { get; init; } = true;
    public bool WorkspaceKeysEnabled { get; init; } = true;
    /// <summary>
    /// False when running the public online demo — the middleware in
    /// Program.cs also 403s POST /api/workspace/schemas/upload in that
    /// mode. The list/read endpoints stay open so the Reference and
    /// Version Comparator screens keep working over the fixed catalogue.
    /// </summary>
    public bool SchemaUploadEnabled { get; init; } = true;
}
