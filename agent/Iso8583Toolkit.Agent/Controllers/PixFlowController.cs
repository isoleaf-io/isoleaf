using Iso8583Toolkit.Iso20022.Pix.Flow;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Agent.Controllers;

/// <summary>
/// Pix Flow Visualizer endpoint — orchestrates a multi-message flow
/// (pacs.008 → pacs.002 → camt.054, optionally with return) and
/// returns every step's XML plus consistency alerts. The frontend
/// renders this as an interactive sequence diagram.
/// </summary>
[ApiController]
[Route("api/pix/flow")]
public sealed class PixFlowController(PixFlowService service) : ControllerBase
{
    public sealed record GenerateFlowRequest(
        string FlowType,
        IReadOnlyDictionary<int, string>? Overrides = null);

    [HttpPost("generate")]
    [EndpointSummary("Generate a Pix message flow (one XML per step)")]
    [ProducesResponseType<PixFlowResult>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public IActionResult Generate([FromBody] GenerateFlowRequest request)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.FlowType))
            return BadRequest(Problem("flowType is required."));

        try
        {
            return Ok(service.GenerateFlow(request.FlowType, request.Overrides));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(Problem(ex.Message));
        }
    }

    [HttpGet("types")]
    [EndpointSummary("List supported Pix flow types")]
    [ProducesResponseType<IReadOnlyList<string>>(StatusCodes.Status200OK)]
    public IActionResult ListTypes() => Ok(service.SupportedFlows);

    private static ProblemDetails Problem(string detail) => new()
    {
        Title = "Pix flow request error",
        Detail = detail,
        Status = StatusCodes.Status400BadRequest,
    };
}
