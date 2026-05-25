using Iso8583Toolkit.Api.DTOs;
using Iso8583Toolkit.Cards;
using Iso8583Toolkit.Cards.Brands;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Agent.Controllers;

[ApiController]
[Route("api/cards")]
public sealed class CardsController : ControllerBase
{
    private readonly CardGenerator _generator;
    private readonly BinRangeRegistry _registry = new();

    public CardsController(CardGenerator generator) => _generator = generator;

    [HttpPost("generate")]
    public IActionResult Generate([FromBody] GenerateCardRequest request)
    {
        if (!Enum.TryParse<CardBrand>(request.Brand, ignoreCase: true, out var brand))
            return BadRequest(new { error = $"Unknown brand '{request.Brand}'." });
        if (brand == CardBrand.Custom)
            return BadRequest(new { error = "Custom brand requires explicit BIN range." });

        try
        {
            var card = _generator.Generate(brand, request.CardholderName, request.Expiry);
            return Ok(new VirtualCardResponse(
                card.Pan, card.PanMasked, card.CardholderName, card.Expiry, card.ExpiryFormatted,
                card.ServiceCode, card.Cvv, card.Cvv2, card.Track1, card.Track2, card.BrandName,
                card.GeneratedAt));
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("validate")]
    public IActionResult Validate([FromBody] ValidatePanRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Pan))
            return BadRequest(new { error = "Pan is required." });

        var isValid = CardGenerator.ValidatePan(request.Pan);
        var brand = _registry.Detect(request.Pan);
        return Ok(new ValidatePanResponse(isValid, brand.ToString(), request.Pan.Length));
    }

    [HttpPost("detect-brand")]
    public IActionResult DetectBrand([FromBody] DetectBrandRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Pan))
            return BadRequest(new { error = "Pan is required." });

        var brand = _registry.Detect(request.Pan);
        var range = _registry.GetRange(brand);
        var rangeStr = range is null ? null
            : range.Start == range.End ? range.Start
            : $"{range.Start}-{range.End}";
        return Ok(new DetectBrandResponse(brand.ToString(), rangeStr));
    }

    [HttpGet("brands")]
    public IActionResult GetBrands()
    {
        var grouped = _registry.GetAll()
            .GroupBy(r => r.Brand)
            .Select(g => new BrandSummary(
                g.Key.ToString(),
                g.Select(r => new BinRangeDto(r.Start, r.End, r.PanLength)).ToList()))
            .ToList();
        return Ok(grouped);
    }
}
