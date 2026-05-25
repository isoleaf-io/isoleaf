using Iso8583Toolkit.Api.DTOs;
using Iso8583Toolkit.Api.Services;
using Iso8583Toolkit.IsoCore.Domain.Exceptions;
using Iso8583Toolkit.IsoCore.Parsing;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Agent.Controllers;

[ApiController]
[Route("api/parse")]
public sealed class ParseController : ControllerBase
{
    private readonly IsoParseService _service;

    public ParseController(IsoParseService service) => _service = service;

    [HttpPost("hex")]
    public IActionResult ParseHex([FromBody] ParseHexRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.HexMessage))
            return BadRequest(new { error = "HexMessage is required." });

        try
        {
            // Auto-detection: try ASCII wire first, then binary-hex.
            // Both branches surface failures as success=false JSON (never 5xx).
            try { return Ok(_service.ParseHex(request.HexMessage, request.LayoutName)); }
            catch (IsoParseException)
            {
                try { return Ok(_service.ParseBinaryHex(request.HexMessage, request.LayoutName)); }
                catch (IsoParseException ex)
                {
                    return Ok(new IsoParseResponse(Success: false, Error: ex.Message));
                }
                catch (ArgumentException ex)
                {
                    // e.g. odd-length hex or non-hex chars after whitespace strip
                    return Ok(new IsoParseResponse(Success: false, Error: ex.Message));
                }
            }
        }
        catch (KeyNotFoundException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("ascii")]
    public IActionResult ParseAscii([FromBody] ParseAsciiRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.AsciiMessage))
            return BadRequest(new { error = "AsciiMessage is required." });

        try { return Ok(_service.ParseAscii(request.AsciiMessage, request.LayoutName)); }
        catch (KeyNotFoundException ex) { return BadRequest(new { error = ex.Message }); }
        catch (IsoParseException ex) { return Ok(new IsoParseResponse(Success: false, Error: ex.Message)); }
    }

    [HttpPost("bitmap")]
    public IActionResult ParseBitmap([FromBody] ParseBitmapRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.HexBitmap))
            return BadRequest(new { error = "HexBitmap is required." });

        try { return Ok(_service.ParseBitmap(request.HexBitmap)); }
        catch (ArgumentException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpGet("layouts")]
    public IActionResult GetLayouts() => Ok(_service.GetLayouts());

    /// <summary>
    /// Returns every field definition in the named layout (default = "default").
    /// Powers the Builder's Add Field modal — clients filter out bits already
    /// present in the message client-side.
    /// </summary>
    [HttpGet("layouts/{name}/fields")]
    public IActionResult GetLayoutFields(string name)
    {
        try { return Ok(_service.GetLayoutFields(name)); }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }
}
