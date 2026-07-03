using Iso8583Toolkit.Iso20022.Swift.Mt;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Agent.Controllers;

/// <summary>
/// Sprint 9.1 — SWIFT MT parser endpoints. Today only the parse step is
/// exposed; future iterations will add MT→MX conversion driven by the
/// MxAlternatives list returned per ambiguous field.
/// </summary>
[ApiController]
[Route("api/swift/mt")]
public sealed class SwiftMtController(MtParserService parser) : ControllerBase
{
    public sealed record ParseRequest(string RawMessage);

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
}
