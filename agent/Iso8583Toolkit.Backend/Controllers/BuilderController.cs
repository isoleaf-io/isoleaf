using Iso8583Toolkit.Application.Models.Iso20022;
using Iso8583Toolkit.Iso20022.Builder;
using Iso8583Toolkit.Iso20022.Schema;
using Iso8583Toolkit.Iso20022.Services;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Backend.Controllers;

/// <summary>
/// ISO 20022 Builder endpoints: lists the ecosystems and their scenarios,
/// and renders a Build response (XML + per-section editor data) for a
/// chosen message type + scenario.
/// </summary>
[ApiController]
[Route("api/iso20022/builder")]
public sealed class BuilderController(
    BuilderService builderService,
    ScenarioRegistry scenarioRegistry,
    ReferenceService referenceService) : ControllerBase
{
    [HttpGet("ecosystems")]
    [EndpointSummary("List supported ISO 20022 ecosystems")]
    [ProducesResponseType<IReadOnlyList<EcosystemDto>>(StatusCodes.Status200OK)]
    public IActionResult GetEcosystems()
    {
        var dtos = scenarioRegistry.GetEcosystems()
            .Select(e => new EcosystemDto(e.EcosystemId, e.DisplayName, e.Description))
            .ToList();
        return Ok(dtos);
    }

    [HttpGet("scenarios")]
    [EndpointSummary("List scenarios for an ecosystem, optionally filtered by message type")]
    [ProducesResponseType<IReadOnlyList<ScenarioDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public IActionResult GetScenarios(
        [FromQuery] string? ecosystemId,
        [FromQuery] string? messageTypePrefix,
        // `messageType` kept as an alias for backwards-compat with anyone
        // already consuming the previous parameter name.
        [FromQuery] string? messageType)
    {
        if (string.IsNullOrWhiteSpace(ecosystemId))
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Missing parameter",
                Detail = "Query parameter 'ecosystemId' is required.",
                Status = StatusCodes.Status400BadRequest,
            });
        }

        // GetScenariosForMessageType already extracts the family prefix from
        // a full messageType, so either parameter shape lands on the same
        // filter behaviour.
        var prefix = messageTypePrefix ?? messageType;
        var scenarios = string.IsNullOrWhiteSpace(prefix)
            ? scenarioRegistry.GetScenarios(ecosystemId)
            : scenarioRegistry.GetScenariosForMessageType(ecosystemId, prefix);

        var dtos = scenarios
            .Select(s => new ScenarioDto(
                s.ScenarioId, s.EcosystemId, s.MessageTypePrefix, s.DisplayName, s.Description))
            .ToList();

        return Ok(dtos);
    }

    [HttpPost("build")]
    [EndpointSummary("Build XML + editor sections for a message type + scenario pair")]
    [ProducesResponseType<BuildResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public IActionResult Build([FromBody] BuildRequest request)
    {
        if (request is null
            || string.IsNullOrWhiteSpace(request.MessageType)
            || string.IsNullOrWhiteSpace(request.ScenarioId))
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Invalid request",
                Detail = "Both 'messageType' and 'scenarioId' are required.",
                Status = StatusCodes.Status400BadRequest,
            });
        }

        try
        {
            var result = builderService.Build(
                request.MessageType,
                request.ScenarioId,
                request.IncludeOptionalXPaths);
            var dto = new BuildResponse(
                result.MessageType,
                result.ScenarioId,
                result.Xml,
                MapSections(result.Sections));
            return Ok(dto);
        }
        catch (ArgumentException ex)
        {
            // Unknown scenarioId — spec: 400.
            return BadRequest(new ProblemDetails
            {
                Title = "Unknown scenario",
                Detail = ex.Message,
                Status = StatusCodes.Status400BadRequest,
            });
        }
        catch (InvalidOperationException ex)
        {
            // Unknown messageType — spec: 404.
            return NotFound(new ProblemDetails
            {
                Title = "Unknown message type",
                Detail = ex.Message,
                Status = StatusCodes.Status404NotFound,
            });
        }
    }

    [HttpGet("available-fields")]
    [EndpointSummary("List optional fields available to add for a message type + scenario")]
    [ProducesResponseType<AvailableFieldsResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public IActionResult GetAvailableFields(
        [FromQuery] string? messageType,
        [FromQuery] string? scenarioId)
    {
        if (string.IsNullOrWhiteSpace(messageType) || string.IsNullOrWhiteSpace(scenarioId))
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Missing parameter",
                Detail = "Query parameters 'messageType' and 'scenarioId' are required.",
                Status = StatusCodes.Status400BadRequest,
            });
        }

        var scenario = scenarioRegistry.GetScenario(scenarioId);
        if (scenario is null)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Unknown scenario",
                Detail = $"Unknown scenario id: '{scenarioId}'.",
                Status = StatusCodes.Status400BadRequest,
            });
        }

        var fields = referenceService.GetFields(messageType);
        if (fields is null)
        {
            return NotFound(new ProblemDetails
            {
                Title = "Unknown message type",
                Detail = $"Unknown message type: '{messageType}'.",
                Status = StatusCodes.Status404NotFound,
            });
        }

        var ecosystemXPaths = new HashSet<string>(
            scenario.AdditionalMandatoryXPaths, StringComparer.Ordinal);

        var result = new List<AvailableFieldDto>();
        FlattenOptional(fields, ecosystemXPaths, result);
        return Ok(new AvailableFieldsResponse(result));
    }

    private static void FlattenOptional(
        IReadOnlyList<FieldDefinition> fields,
        HashSet<string> ecosystemXPaths,
        List<AvailableFieldDto> out_)
    {
        foreach (var f in fields.Where(f => !f.Name.StartsWith('@')))
        {
            if (!f.IsComplex && !f.IsMandatory && !ecosystemXPaths.Contains(f.XPath))
            {
                out_.Add(new AvailableFieldDto(
                    f.Name, f.XPath, f.TypeName, f.Enumerations));
            }
            if (f.IsComplex)
                FlattenOptional(f.Children, ecosystemXPaths, out_);
        }
    }

    private static List<BuildSectionDto> MapSections(IReadOnlyList<BuildSection> sections) =>
        sections.Select(s => new BuildSectionDto(
            s.Name,
            s.XPath,
            s.IsMandatory,
            s.Fields.Select(f => new BuildFieldDto(
                f.Name,
                f.XPath,
                f.Value,
                f.TypeName,
                f.IsMandatory,
                f.IsEcosystemMandatory,
                f.IsOptional,
                f.Hint,
                f.Enumerations,
                f.MinLength,
                f.MaxLength,
                f.Pattern)).ToList(),
            MapSections(s.Sections))).ToList();
}
