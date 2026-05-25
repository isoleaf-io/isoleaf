using Iso8583Toolkit.Api.DTOs;
using Iso8583Toolkit.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Api.Controllers;

[ApiController]
[Route("api/iso/parse")]
public sealed class IsoParseController : ControllerBase
{
    private readonly IsoParseService _service;

    public IsoParseController(IsoParseService service)
    {
        _service = service;
    }

    /// <summary>
    /// Parses an ISO 8583 message from an ASCII/hex-bitmap wire format string.
    /// </summary>
    [HttpPost("hex")]
    [ProducesResponseType<IsoParseResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult ParseHex([FromBody] ParseHexRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.HexMessage))
            return BadRequest(new IsoParseResponse(Success: false, Error: "HexMessage is required."));

        try
        {
            var result = _service.ParseHex(request.HexMessage, request.LayoutName);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return BadRequest(new IsoParseResponse(Success: false, Error: ex.Message));
        }
    }

    /// <summary>
    /// Parses an ISO 8583 message from an ASCII string.
    /// </summary>
    [HttpPost("ascii")]
    [ProducesResponseType<IsoParseResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult ParseAscii([FromBody] ParseAsciiRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.AsciiMessage))
            return BadRequest(new IsoParseResponse(Success: false, Error: "AsciiMessage is required."));

        try
        {
            var result = _service.ParseAscii(request.AsciiMessage, request.LayoutName);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return BadRequest(new IsoParseResponse(Success: false, Error: ex.Message));
        }
    }

    /// <summary>
    /// Parses an ISO 8583 message from a binary-hex wire format string.
    /// The entire message is a hex-encoded byte stream (2 hex chars per byte).
    /// ASCII fields are decoded from bytes; Binary fields (e.g. PIN, EMV) are raw bytes.
    /// </summary>
    [HttpPost("binary-hex")]
    [ProducesResponseType<IsoParseResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult ParseBinaryHex([FromBody] ParseBinaryHexRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.HexMessage))
            return BadRequest(new IsoParseResponse(Success: false, Error: "HexMessage is required."));

        try
        {
            var result = _service.ParseBinaryHex(request.HexMessage, request.LayoutName);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return BadRequest(new IsoParseResponse(Success: false, Error: ex.Message));
        }
    }

    /// <summary>
    /// Parses a standalone 16-character hex bitmap and returns the active bit positions.
    /// </summary>
    [HttpPost("bitmap")]
    [ProducesResponseType<BitmapParseResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult ParseBitmap([FromBody] ParseBitmapRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.HexBitmap))
            return BadRequest(new { error = "HexBitmap is required." });

        try
        {
            var result = _service.ParseBitmap(request.HexBitmap);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Returns the list of available ISO 8583 field layouts.
    /// </summary>
    [HttpGet("layouts")]
    [ProducesResponseType<List<LayoutSummary>>(StatusCodes.Status200OK)]
    public IActionResult GetLayouts()
    {
        return Ok(_service.GetLayouts());
    }
}
