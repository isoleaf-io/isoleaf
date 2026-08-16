using Iso8583Toolkit.Application.DTOs;
using Iso8583Toolkit.Application.Services;
using Iso8583Toolkit.IsoCore.Domain.Exceptions;
using Iso8583Toolkit.IsoCore.Parsing;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Agent.Controllers;

[ApiController]
[Route("api/parse")]
public sealed class ParseController : ControllerBase
{
    private readonly IsoParseService _service;

    public ParseController(IsoParseService service) => _service = service;

    [HttpPost("hex")]
    [EndpointSummary("Parse an ISO 8583 message from a hex string")]
    [EndpointDescription("Auto-detects the wire format: tries the ASCII-on-the-wire layout first (the most common in Brazilian acquirer protocols), then falls back to binary-hex. Failures surface as `success=false` JSON with the reason — never as a 5xx — so the UI can render partial results.")]
    [ProducesResponseType(typeof(IsoParseResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
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
    [EndpointSummary("Parse an ISO 8583 message from an ASCII wire payload")]
    [EndpointDescription("Same parser as `/api/parse/hex` but pins the input to the ASCII-on-the-wire path explicitly (no auto-detection). Use when the source is known to be plain ASCII and binary-hex would be a false positive — e.g. payload contains real visible characters from terminal/track data.")]
    [ProducesResponseType(typeof(IsoParseResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult ParseAscii([FromBody] ParseAsciiRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.AsciiMessage))
            return BadRequest(new { error = "AsciiMessage is required." });

        try { return Ok(_service.ParseAscii(request.AsciiMessage, request.LayoutName)); }
        catch (KeyNotFoundException ex) { return BadRequest(new { error = ex.Message }); }
        catch (IsoParseException ex) { return Ok(new IsoParseResponse(Success: false, Error: ex.Message)); }
    }

    [HttpPost("bitmap")]
    [EndpointSummary("Decode an ISO 8583 bitmap (primary + optional secondary)")]
    [EndpointDescription("Returns the list of active bits, whether a secondary bitmap is present, and the raw hex of each bitmap segment. Used by the Bitmap helper page to explore a wire's bitmap without parsing the rest of the message.")]
    [ProducesResponseType(typeof(BitmapParseResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult ParseBitmap([FromBody] ParseBitmapRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.HexBitmap))
            return BadRequest(new { error = "HexBitmap is required." });

        try { return Ok(_service.ParseBitmap(request.HexBitmap)); }
        catch (ArgumentException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpGet("layouts")]
    [EndpointSummary("List the ISO 8583 layouts the parser knows about")]
    [EndpointDescription("Each layout is a named field-definition set. The shipped default covers the ISO 8583:1987 field set; custom layouts can be registered server-side for proprietary variants.")]
    [ProducesResponseType(typeof(IEnumerable<LayoutSummary>), StatusCodes.Status200OK)]
    public IActionResult GetLayouts() => Ok(_service.GetLayouts());

    [HttpGet("layouts/{name}/fields")]
    [EndpointSummary("Inspect every field definition in the named layout")]
    [EndpointDescription("Returns each bit number, name, type, max length and encoding. Powers the Builder's Add Field modal — clients filter out bits already present in the message client-side.")]
    [ProducesResponseType(typeof(IEnumerable<LayoutFieldDefinition>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult GetLayoutFields(string name)
    {
        try { return Ok(_service.GetLayoutFields(name)); }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }
}
