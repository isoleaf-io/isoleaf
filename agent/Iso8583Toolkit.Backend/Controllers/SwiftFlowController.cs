using Iso8583Toolkit.Iso20022.Pix.Flow;
using Iso8583Toolkit.Iso20022.Swift.Flow;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Backend.Controllers;

/// <summary>
/// Sprint 9.3 — SWIFT CBPR+ (MX + legacy MT) flow visualizer endpoints.
/// Mirrors the Pix Flow contract so the unified frontend widget can
/// hit either family through the same request/response shape.
/// </summary>
[ApiController]
[Route("api/swift/flow")]
public sealed class SwiftFlowController(SwiftFlowService flow) : ControllerBase
{
    public sealed record GenerateRequest(
        string FlowType,
        Dictionary<int, string>? Overrides);

    [HttpGet("types")]
    [EndpointSummary("List supported SWIFT CBPR+ flow types")]
    [ProducesResponseType<IReadOnlyList<string>>(StatusCodes.Status200OK)]
    public IActionResult GetTypes() => Ok(flow.SupportedFlows);

    [HttpPost("generate")]
    [EndpointSummary("Generate a CBPR+ MX or MT flow with optional per-step overrides")]
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
