using Iso8583Toolkit.Iso20022.Swift.Mt;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Backend.Controllers;

/// <summary>
/// Sprint 9.1 — SWIFT MT parser endpoints. Today only the parse step is
/// exposed; future iterations will add MT→MX conversion driven by the
/// MxAlternatives list returned per ambiguous field.
/// </summary>
[ApiController]
[Route("api/swift/mt")]
public sealed class SwiftMtController(
    MtParserService parser,
    MtMxMapperService mapper) : ControllerBase
{
    public sealed record ParseRequest(string RawMessage);
    public sealed record MappingRequest(string RawMessage);
    public sealed record CompareRequest(string RawMt, string RawMx);

    [HttpPost("parse")]
    [EndpointSummary("Parse a SWIFT MT103 / MT202 / MT202COV message")]
    [ProducesResponseType<MtParseResult>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public ActionResult<MtParseResult> Parse([FromBody] ParseRequest request)
    {
        if (string.IsNullOrWhiteSpace(request?.RawMessage))
            return BadRequest(new { error = "Payload vazio: forneça rawMessage." });

        MtParseResult result;
        try
        {
            result = parser.Parse(request.RawMessage);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }

        if (result.MessageType is not ("MT103" or "MT202" or "MT202COV"))
        {
            return UnprocessableEntity(new
            {
                error = $"Tipo {result.MessageType} não suportado. "
                    + "Apenas MT103, MT202 e MT202COV são reconhecidos nesta sprint.",
                detected = result.MessageType,
                warnings = result.Warnings,
            });
        }

        return Ok(result);
    }

    // ── Sprint 9.2 — MT ↔ MX endpoints ────────────────────────────────

    [HttpPost("mapping")]
    [EndpointSummary("Mode A step 1 — MT→MX mapping preview")]
    [ProducesResponseType<MtMxMappingTable>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public ActionResult<MtMxMappingTable> Mapping([FromBody] MappingRequest request)
    {
        if (string.IsNullOrWhiteSpace(request?.RawMessage))
            return BadRequest(new { error = "Payload vazio: forneça rawMessage." });
        try { return Ok(mapper.BuildMappingTable(request.RawMessage)); }
        catch (ArgumentException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("convert")]
    [EndpointSummary("Mode A step 2 — convert MT into pacs.008 or pacs.009 XML")]
    [ProducesResponseType<MtMxConvertResult>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public ActionResult<MtMxConvertResult> Convert([FromBody] MtMxConvertRequest request)
    {
        if (string.IsNullOrWhiteSpace(request?.RawMessage))
            return BadRequest(new { error = "Payload vazio: forneça rawMessage." });
        try { return Ok(mapper.Convert(request)); }
        catch (ArgumentException ex) { return BadRequest(new { error = ex.Message }); }
        catch (InvalidOperationException ex)
        {
            return UnprocessableEntity(new { error = ex.Message });
        }
    }

    [HttpPost("compare")]
    [EndpointSummary("Mode B — compare an MT message against an MX XML document")]
    [ProducesResponseType<MtMxCompareResult>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public ActionResult<MtMxCompareResult> Compare([FromBody] CompareRequest request)
    {
        if (string.IsNullOrWhiteSpace(request?.RawMt) || string.IsNullOrWhiteSpace(request.RawMx))
            return BadRequest(new { error = "Forneça rawMt e rawMx." });
        try { return Ok(mapper.Compare(request.RawMt, request.RawMx)); }
        catch (ArgumentException ex) { return BadRequest(new { error = ex.Message }); }
    }

    /// <summary>
    /// Lists every embedded pacs.008 / pacs.009 version (or any prefix
    /// the caller supplies), most recent first. Feeds the Modo A
    /// version selector in the frontend.
    /// </summary>
    [HttpGet("versions")]
    [EndpointSummary("List embedded pacs.008 / pacs.009 versions available for conversion")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult GetAvailableVersions([FromQuery] string messageType)
    {
        if (string.IsNullOrWhiteSpace(messageType))
            return BadRequest(new { error = "Forneça messageType (ex: pacs.008)." });
        var versions = mapper.ListAvailableVersions(messageType)
            .Select(t => new { messageType = t.MessageType, version = t.Version })
            .ToList();
        return Ok(new { versions });
    }
}
