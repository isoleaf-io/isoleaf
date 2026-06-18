using Iso8583Toolkit.Agent.Models;
using Iso8583Toolkit.Agent.Services;
using Iso8583Toolkit.Api.DTOs;
using Iso8583Toolkit.Api.Services;
using Iso8583Toolkit.IsoCore.Building.Smart;
using Iso8583Toolkit.Simulator.Protocol;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Agent.Controllers;

[ApiController]
[Route("api/build")]
public sealed class BuildController : ControllerBase
{
    private readonly IsoBuildService _service;
    private readonly SmartIsoBuilder _smartBuilder;
    private readonly LocalSessionStore _store;
    private readonly BrandProfileLoader _profiles = new();

    public BuildController(IsoBuildService service, SmartIsoBuilder smartBuilder, LocalSessionStore store)
    {
        _service = service;
        _smartBuilder = smartBuilder;
        _store = store;
    }

    [HttpPost("message")]
    [EndpointSummary("Build an ISO 8583 wire from an MTI + explicit bit/value list")]
    [EndpointDescription("Low-level constructor: caller supplies every field they want set and the response carries the serialised wire (ASCII or binary-hex depending on layout). Used by the Builder page when the user is composing a message manually.")]
    [ProducesResponseType(typeof(IsoBuildResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(IsoBuildResponse), StatusCodes.Status400BadRequest)]
    public IActionResult BuildMessage([FromBody] IsoBuildRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Mti))
            return BadRequest(new IsoBuildResponse(Success: false, Error: "Mti is required."));
        if (request.Fields is null or { Count: 0 })
            return BadRequest(new IsoBuildResponse(Success: false, Error: "At least one field is required."));

        try { return Ok(_service.Build(request.Mti, request.Fields, request.LayoutName)); }
        catch (KeyNotFoundException ex)
        {
            return BadRequest(new IsoBuildResponse(Success: false, Error: ex.Message));
        }
    }

    [HttpPost("smart")]
    [EndpointSummary("Smart-build an ISO 8583 message from a transaction profile")]
    [EndpointDescription("Higher-level constructor: pick a brand + role + channel + transaction type and the builder fills mandatory and conditional fields based on the brand profile rules (PAN generation, Track 2 derivation, TPDU, Bit 55 derivation, etc). Custom fields override the defaults. Used by the Builder page's \"Smart\" flow and the SmartBuildE2E test suite.")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult SmartBuild([FromBody] SmartBuildRequest request)
    {
        var workspace = _store.GetWorkspaceConfig();
        // Workspace identity (terminal/merchant) only makes sense for Adquirente —
        // Bandeira/Emissor messages strip 41/42/43 by spec.
        var customs = request.Role == SmartRole.Adquirente
            ? MergeWorkspaceDefaults(request.CustomFields, workspace)
            : request.CustomFields;

        // ── TPDU resolution ────────────────────────────────────────────────
        // The new flow is `includeTpdu` + `tpduOverride`; OverrideTpdu (legacy)
        // is kept as a final fallback for clients that still send it.
        string? overrideTpdu = request.OverrideTpdu;
        if (request.IncludeTpdu == false)
        {
            // Explicit opt-out: tell SmartIsoBuilder to emit no TPDU regardless of brand.
            overrideTpdu = "NONE";
        }
        else if (request.IncludeTpdu == true)
        {
            // Literal override wins; otherwise build from workspace NIIs and
            // fall back to auto-generation when they're not configured.
            overrideTpdu = !string.IsNullOrWhiteSpace(request.TpduOverride)
                ? request.TpduOverride
                : TryBuildTpduFromWorkspace(workspace) ?? TpduBuilder.GenerateAuto();
        }

        var profile = new TransactionProfile
        {
            Mti = request.Mti ?? "0200",
            Role = request.Role,
            Brand = request.Brand,
            TransactionType = request.TransactionType,
            Channel = request.Channel,
            ApprovalMode = request.ApprovalMode,
            Installments = request.Installments,
            IsReversal = request.IsReversal,
            IssuerMasterKey = request.IssuerMasterKey ?? workspace.Imk,
            CustomFields = customs,
            OverrideTpdu = overrideTpdu,
            // Workspace keys (IMK/ZPK) flow into field generation so bit 55 can derive a real ARQC.
            WorkspaceKeys = workspace,
        };

        var result = _smartBuilder.Build(profile);
        return Ok(result);
    }

    private static string? TryBuildTpduFromWorkspace(WorkspaceConfig ws)
    {
        if (string.IsNullOrWhiteSpace(ws.OriginNii) || string.IsNullOrWhiteSpace(ws.DestinationNii))
            return null;
        try { return TpduBuilder.Build(TpduBuilder.DefaultId, ws.DestinationNii, ws.OriginNii); }
        catch (ArgumentException) { return null; }
    }

    [HttpGet("smart/profiles")]
    [EndpointSummary("List the brand profiles available to the smart builder")]
    [EndpointDescription("Each profile exposes the mandatory/conditional bit sets per MTI and role, the brand's default currency and country, and whether TPDU is required at the Acquirer→Brand or Brand→Issuer hops. Used by the UI to render the brand-specific Builder controls.")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult GetProfiles()
    {
        var profiles = _profiles.GetAll();
        var shaped = profiles.Select(kv => new
        {
            brand = kv.Key.ToString(),
            profile = new
            {
                kv.Value.BrandName,
                kv.Value.MandatoryBitsByMtiAndRole,
                kv.Value.ConditionalBitsByMtiAndRole,
                kv.Value.RequiresTpduAdquirenteToBrand,
                kv.Value.RequiresTpduBrandToIssuer,
                kv.Value.DefaultCurrencyCode,
                kv.Value.DefaultCountryCode,
                kv.Value.SupportedMtis
            }
        });
        return Ok(shaped);
    }

    [HttpGet("smart/rules")]
    [EndpointSummary("List every transformation rule the smart builder may apply")]
    [EndpointDescription("Reference table of the named rules (Chip→Bit55Added, Reversal→Bit90Added, Track2→DerivedFromPAN…) with a Portuguese description for each. Used by the Builder's \"applied rules\" badges to make the build pipeline transparent.")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult GetRules() => Ok(new[]
    {
        new { rule = "Chip→Bit55Added", description = "Canal Chip adiciona bit 55 (EMV data)" },
        new { rule = "Contactless→Bit55Added", description = "Canal Contactless adiciona bit 55" },
        new { rule = "Chip→Bit35Added", description = "Canal Chip adiciona bit 35 (Track 2)" },
        new { rule = "Tarja→Bit35Added", description = "Canal Tarja adiciona bit 35" },
        new { rule = "Contactless→Bit35Added", description = "Canal Contactless adiciona bit 35" },
        new { rule = "Fallback→Bit35Added", description = "Canal Fallback adiciona bit 35" },
        new { rule = "Fallback→Bit55Removed", description = "Fallback remove bit 55 (sem chip)" },
        new { rule = "CNP→Bit35Removed", description = "CNP remove bit 35" },
        new { rule = "CNP→Bit52Removed", description = "CNP remove bit 52" },
        new { rule = "Debito→Bit52Added", description = "Débito adiciona bit 52 (PIN)" },
        new { rule = "Saque→Bit52Added", description = "Saque adiciona bit 52 (PIN)" },
        new { rule = "Saque→ProcessingCode010000", description = "Saque usa processing code 010000" },
        new { rule = "Standin→Bit55Removed", description = "Stand-in remove bit 55" },
        new { rule = "Reversal→Bit90Added", description = "Reversão adiciona bit 90" },
        new { rule = "Track2→DerivedFromPAN", description = "Track 2 derivado do PAN" },
        new { rule = "Derived→Track2FromCustomPAN", description = "Track 2 re-derivado após PAN customizado" },
        new { rule = "Derived→EMVAmountUpdated", description = "Tag 9F02 atualizada após valor customizado" },
        new { rule = "TPDU→Generated", description = "TPDU gerado automaticamente" },
        new { rule = "CustomPAN→BrandDetected", description = "Brand detectada pelo PAN customizado" },
        new { rule = "PAN→Generated(brand)", description = "PAN gerado para a bandeira" },
        new { rule = "InstallmentsN→ParceladoSignal", description = "Parcelado sinalizado" }
    });

    private static Dictionary<int, string>? MergeWorkspaceDefaults(
        Dictionary<int, string>? customFields, WorkspaceConfig ws)
    {
        var merged = customFields is null
            ? new Dictionary<int, string>()
            : new Dictionary<int, string>(customFields);

        // Apply workspace defaults only when not already overridden by request
        if (!merged.ContainsKey(41) && !string.IsNullOrWhiteSpace(ws.TerminalId))
            merged[41] = ws.TerminalId.PadRight(8)[..8];
        if (!merged.ContainsKey(42) && !string.IsNullOrWhiteSpace(ws.MerchantId))
            merged[42] = ws.MerchantId.PadRight(15)[..15];

        return merged.Count == 0 ? null : merged;
    }
}

public sealed record SmartBuildRequest
{
    public string? Mti { get; init; } = "0200";
    public SmartRole Role { get; init; } = SmartRole.Adquirente;
    public SmartBrand Brand { get; init; } = SmartBrand.Auto;
    public TransactionType TransactionType { get; init; } = TransactionType.Credito;
    public TransactionChannel Channel { get; init; } = TransactionChannel.Chip;
    public ApprovalMode ApprovalMode { get; init; } = ApprovalMode.Online;
    public int Installments { get; init; } = 1;
    public bool IsReversal { get; init; }
    public string? IssuerMasterKey { get; init; }
    public Dictionary<int, string>? CustomFields { get; init; }

    /// <summary>
    /// Explicit TPDU control. When null, falls back to the legacy
    /// <see cref="OverrideTpdu"/> path / brand profile default.
    /// </summary>
    public bool? IncludeTpdu { get; init; }

    /// <summary>
    /// Optional literal 10-char hex TPDU. Used only when <see cref="IncludeTpdu"/>
    /// is true; otherwise the workspace NIIs (or auto) drive the value.
    /// </summary>
    public string? TpduOverride { get; init; }

    /// <summary>Legacy: pass "NONE" to suppress, or a literal hex string.</summary>
    public string? OverrideTpdu { get; init; }
}
