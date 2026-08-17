using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Backend.Controllers;

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

        // Optional hint for the frontend's "Agent URL" field on the Workspace
        // screen. Null when unset — the UI leaves the field empty and the user
        // types the URL themselves. Never invent a default like
        // "http://localhost:8583": the hint is meant to be an explicit ops
        // signal ("in this deployment, the Simulator Agent lives at X"),
        // not a guess. Trimmed but otherwise passed through as-is.
        var agentUrlHint = config["AGENT_URL_HINT"]?.Trim();
        if (string.IsNullOrEmpty(agentUrlHint)) agentUrlHint = null;

        return new AppConfig
        {
            Mode = mode,
            SimulatorEnabled = !isOnline,
            EmvCryptoEnabled = !isOnline,
            WorkspaceKeysEnabled = !isOnline,
            SchemaUploadEnabled = !isOnline,
            AgentUrlHint = agentUrlHint,
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
    /// <summary>
    /// Suggested base URL for the Simulator Agent (Sprint 12.2 split — the
    /// Agent runs in a separate process on the operator's machine/network).
    /// Read from <c>AGENT_URL_HINT</c>. Null when unset — the frontend
    /// leaves the Workspace field blank and the user configures it manually.
    /// The Backend never contacts the Agent using this value; it's just a
    /// pre-fill for the UI.
    /// </summary>
    public string? AgentUrlHint { get; init; }
}
