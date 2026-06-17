using Iso8583Toolkit.Api.DTOs;
using Iso8583Toolkit.Cards;
using Iso8583Toolkit.Cards.Brands;
using Microsoft.AspNetCore.Http;
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
    [EndpointSummary("Generate a synthetic test card for the requested brand")]
    [EndpointDescription("Returns a Luhn-valid PAN within the brand's BIN range plus matching Track 1, Track 2, CVV, CVV2, service code, expiry and cardholder name when not supplied. **Test data only** — never feed real cardholder information into this endpoint.")]
    [ProducesResponseType(typeof(VirtualCardResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
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
    [EndpointSummary("Run Luhn validation on a PAN and report the detected brand")]
    [EndpointDescription("Returns whether the PAN's check digit is valid (Luhn mod-10), the brand inferred from the BIN range and the PAN's length. Treats the PAN as opaque digits — no logging, no persistence.")]
    [ProducesResponseType(typeof(ValidatePanResponse), StatusCodes.Status200OK)]
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
    [EndpointSummary("Identify the brand a PAN belongs to by its BIN range")]
    [EndpointDescription("Returns the brand and the BIN range string (\"start-end\" or a single value when the range is exact). Used by the Cards page to surface the brand label as the user types.")]
    [ProducesResponseType(typeof(DetectBrandResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
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
    [EndpointSummary("List every supported card brand and its BIN ranges")]
    [EndpointDescription("Returns one entry per brand, each carrying the list of BIN ranges with their start, end and expected PAN length. The shipped registry covers Visa, Mastercard, Amex, Elo, Hipercard, Diners, Discover and JCB.")]
    [ProducesResponseType(typeof(IEnumerable<BrandSummary>), StatusCodes.Status200OK)]
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
