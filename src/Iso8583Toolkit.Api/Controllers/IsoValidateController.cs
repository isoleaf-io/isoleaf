using Iso8583Toolkit.Api.DTOs;
using Iso8583Toolkit.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Api.Controllers;

[ApiController]
[Route("api/iso/validate")]
public sealed class IsoValidateController : ControllerBase
{
    private readonly IsoValidateService _service;

    public IsoValidateController(IsoValidateService service)
    {
        _service = service;
    }

    [HttpPost("message")]
    [ProducesResponseType<IsoValidateResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult ValidateMessage([FromBody] IsoValidateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.HexMessage))
            return BadRequest(new { error = "HexMessage is required." });

        try
        {
            var result = _service.Validate(request.HexMessage, request.LayoutName, request.RequiredBits);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
