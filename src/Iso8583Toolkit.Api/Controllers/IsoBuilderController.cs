using Iso8583Toolkit.Api.DTOs;
using Iso8583Toolkit.Api.Services;
using Iso8583Toolkit.IsoCore.Building.Smart;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Api.Controllers;

[ApiController]
[Route("api/iso/build")]
public sealed class IsoBuilderController : ControllerBase
{
    private readonly IsoBuildService _service;
    private readonly SmartIsoBuilder _smartBuilder;
    private readonly BrandProfileLoader _profileLoader = new();

    public IsoBuilderController(IsoBuildService service, SmartIsoBuilder smartBuilder)
    {
        _service = service;
        _smartBuilder = smartBuilder;
    }

    [HttpPost("message")]
    [ProducesResponseType<IsoBuildResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult BuildMessage([FromBody] IsoBuildRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Mti))
            return BadRequest(new IsoBuildResponse(Success: false, Error: "Mti is required."));
        if (request.Fields is null or { Count: 0 })
            return BadRequest(new IsoBuildResponse(Success: false, Error: "At least one field is required."));

        try
        {
            var result = _service.Build(request.Mti, request.Fields, request.LayoutName);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return BadRequest(new IsoBuildResponse(Success: false, Error: ex.Message));
        }
    }

    /// <summary>
    /// Smart build: generates a realistic ISO 8583 message from a high-level
    /// transaction profile, applying brand rules, channel-driven field selection,
    /// and auto-generating values (PAN, Track 2, PIN block, EMV TLV).
    /// </summary>
    [HttpPost("smart")]
    [ProducesResponseType<SmartBuildResult>(StatusCodes.Status200OK)]
    public IActionResult SmartBuild([FromBody] SmartBuildRequest request)
    {
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
            IssuerMasterKey = request.IssuerMasterKey,
            CustomFields = request.CustomFields,
            OverrideTpdu = request.OverrideTpdu
        };

        var result = _smartBuilder.Build(profile);
        return Ok(result);
    }

    /// <summary>Returns available brand profiles with mandatory bits per MTI/Role.</summary>
    [HttpGet("smart/profiles")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult GetSmartProfiles()
    {
        var profiles = _profileLoader.GetAll();
        var result = profiles.Select(kv => new
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
        return Ok(result);
    }

    /// <summary>Returns the list of automatic rules the smart builder can apply.</summary>
    [HttpGet("smart/rules")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult GetSmartRules()
    {
        var rules = new[]
        {
            new { rule = "Chip→Bit55Added", description = "Canal Chip adiciona bit 55 (EMV data)" },
            new { rule = "Contactless→Bit55Added", description = "Canal Contactless adiciona bit 55 (EMV data)" },
            new { rule = "Chip→Bit35Added", description = "Canal Chip adiciona bit 35 (Track 2)" },
            new { rule = "Tarja→Bit35Added", description = "Canal Tarja adiciona bit 35 (Track 2)" },
            new { rule = "Contactless→Bit35Added", description = "Canal Contactless adiciona bit 35 (Track 2)" },
            new { rule = "Fallback→Bit35Added", description = "Canal Fallback adiciona bit 35 (Track 2)" },
            new { rule = "Fallback→Bit55Removed", description = "Fallback remove bit 55 (sem chip)" },
            new { rule = "CNP→Bit35Removed", description = "Card Not Present remove bit 35 (sem Track 2)" },
            new { rule = "CNP→Bit52Removed", description = "Card Not Present remove bit 52 (sem PIN)" },
            new { rule = "Debito→Bit52Added", description = "Débito adiciona bit 52 (PIN Block)" },
            new { rule = "Saque→Bit52Added", description = "Saque adiciona bit 52 (PIN Block)" },
            new { rule = "Saque→ProcessingCode010000", description = "Saque usa processing code 010000" },
            new { rule = "Standin→Bit55Removed", description = "Stand-in remove bit 55 (sem EMV online)" },
            new { rule = "Reversal→Bit90Added", description = "Reversão adiciona bit 90 (dados originais)" },
            new { rule = "Track2→DerivedFromPAN", description = "Track 2 derivado automaticamente do PAN" },
            new { rule = "Derived→Track2FromCustomPAN", description = "Track 2 re-derivado após PAN customizado" },
            new { rule = "Derived→EMVAmountUpdated", description = "Tag 9F02 do EMV atualizada após valor customizado" },
            new { rule = "TPDU→Generated", description = "TPDU gerado automaticamente baseado na bandeira/role" },
            new { rule = "CustomPAN→BrandDetected", description = "Brand auto-detectada pelo PAN customizado" },
            new { rule = "PAN→Generated(brand)", description = "PAN gerado para a bandeira especificada" },
            new { rule = "InstallmentsN→ParceladoSignal", description = "Parcelado sinalizado (N parcelas)" }
        };
        return Ok(rules);
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
    public string? OverrideTpdu { get; init; }
}
