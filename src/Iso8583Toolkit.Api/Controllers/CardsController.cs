using Iso8583Toolkit.Api.DTOs;
using Iso8583Toolkit.Cards;
using Iso8583Toolkit.Cards.Brands;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Api.Controllers;

[ApiController]
[Route("api/cards")]
public sealed class CardsController : ControllerBase
{
    private readonly CardGenerator _generator = new();
    private readonly BinRangeRegistry _registry = new();

    [HttpPost("generate")]
    [ProducesResponseType<VirtualCardResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult Generate([FromBody] GenerateCardRequest request)
    {
        if (!Enum.TryParse<CardBrand>(request.Brand, ignoreCase: true, out var brand))
            return BadRequest(new { error = $"Unknown brand '{request.Brand}'. Available: {string.Join(", ", Enum.GetNames<CardBrand>())}" });

        if (brand == CardBrand.Custom)
            return BadRequest(new { error = "Use POST /api/cards/generate-custom for custom BIN ranges." });

        try
        {
            var card = _generator.Generate(brand, request.CardholderName, request.Expiry);
            return Ok(MapToResponse(card));
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("validate")]
    [ProducesResponseType<ValidatePanResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult Validate([FromBody] ValidatePanRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Pan))
            return BadRequest(new { error = "Pan is required." });

        var isValid = CardGenerator.ValidatePan(request.Pan);
        var brand = _registry.Detect(request.Pan);

        return Ok(new ValidatePanResponse(isValid, brand.ToString(), request.Pan.Length));
    }

    [HttpPost("detect-brand")]
    [ProducesResponseType<DetectBrandResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult DetectBrand([FromBody] DetectBrandRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Pan))
            return BadRequest(new { error = "Pan is required." });

        var brand = _registry.Detect(request.Pan);
        var range = _registry.GetRange(brand);
        var rangeStr = range is not null
            ? range.Start == range.End ? range.Start : $"{range.Start}-{range.End}"
            : null;

        return Ok(new DetectBrandResponse(brand.ToString(), rangeStr));
    }

    [HttpGet("brands")]
    [ProducesResponseType<List<BrandSummary>>(StatusCodes.Status200OK)]
    public IActionResult GetBrands()
    {
        var allRanges = _registry.GetAll();
        var grouped = allRanges
            .GroupBy(r => r.Brand)
            .Select(g => new BrandSummary(
                g.Key.ToString(),
                g.Select(r => new BinRangeDto(r.Start, r.End, r.PanLength)).ToList()))
            .ToList();

        return Ok(grouped);
    }

    private static VirtualCardResponse MapToResponse(Cards.Domain.VirtualCard card) =>
        new(
            Pan: card.Pan,
            PanMasked: card.PanMasked,
            CardholderName: card.CardholderName,
            Expiry: card.Expiry,
            ExpiryFormatted: card.ExpiryFormatted,
            ServiceCode: card.ServiceCode,
            Cvv: card.Cvv,
            Cvv2: card.Cvv2,
            Track1: card.Track1,
            Track2: card.Track2,
            Brand: card.BrandName,
            GeneratedAt: card.GeneratedAt);
}
