using Iso8583Toolkit.Iso20022.Iso8583.Flow;
using Iso8583Toolkit.Iso20022.Pix.Flow;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Backend.Controllers;

/// <summary>
/// Sprint 9.4 — ISO 8583 card-payment flows for the Flow Visualizer.
/// Mirrors the Pix/Swift flow contracts so the unified frontend widget
/// can render either family through the same request/response shape.
/// </summary>
[ApiController]
[Route("api/iso8583/flow")]
public sealed class Iso8583FlowController(Iso8583FlowService flow) : ControllerBase
{
    public sealed record GenerateRequest(
        string FlowType,
        Dictionary<int, string>? Overrides);

    [HttpGet("types")]
    [EndpointSummary("List supported ISO 8583 flow types")]
    [ProducesResponseType<IReadOnlyList<string>>(StatusCodes.Status200OK)]
    public IActionResult GetTypes() => Ok(flow.SupportedFlows);

    [HttpPost("generate")]
    [EndpointSummary("Generate an ISO 8583 flow with optional per-step raw-message overrides")]
    [ProducesResponseType<PixFlowResult>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public ActionResult<PixFlowResult> Generate([FromBody] GenerateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request?.FlowType))
            return BadRequest(new { error = "Forneça flowType." });
        try
        {
            return Ok(flow.GenerateFlow(request.FlowType, request.Overrides));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
