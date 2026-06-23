using Iso8583Toolkit.Api.Models.Iso20022;
using Iso8583Toolkit.Iso20022.Schema;
using Iso8583Toolkit.Iso20022.Services;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Agent.Controllers;

/// <summary>
/// Read-only reference endpoints over the embedded ISO 20022 XSD catalogue.
/// Routes:
///   <list type="bullet">
///   <item><c>GET /api/iso20022/reference</c> — list every message type.</item>
///   <item><c>GET /api/iso20022/reference/{messageType}</c> — hierarchical field map.</item>
///   <item><c>GET /api/iso20022/reference/search?term=...</c> — substring search across every field name.</item>
///   <item><c>GET /api/iso20022/reference/field/{fieldName}</c> — exact-name lookup.</item>
///   </list>
/// </summary>
[ApiController]
[Route("api/iso20022/reference")]
public sealed class ReferenceController(ReferenceService referenceService) : ControllerBase
{
    // Stateless generator; instantiating once per controller is fine, but a
    // static field would also work. Keeping it as instance state to mirror
    // the dependency-injection pattern of the rest of the controller.
    private readonly XmlExampleGenerator _exampleGenerator = new();

    [HttpGet]
    [EndpointSummary("List supported message types")]
    [ProducesResponseType<MessageTypeListResponse>(StatusCodes.Status200OK)]
    public IActionResult GetMessageTypes()
        => Ok(new MessageTypeListResponse(referenceService.GetMessageTypes()));

    [HttpGet("{messageType}")]
    [EndpointSummary("Get the field tree for one message type")]
    [ProducesResponseType<MessageReferenceResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public IActionResult GetReference(string messageType)
    {
        var fields = referenceService.GetFields(messageType);
        if (fields == null)
        {
            return NotFound(new ProblemDetails
            {
                Title = "Message type not found",
                Detail = $"No reference data available for '{messageType}'.",
                Status = StatusCodes.Status404NotFound,
            });
        }

        var dtos = fields.Select(MapField).ToList();
        var total = CountFields(fields);
        return Ok(new MessageReferenceResponse(messageType, total, dtos));
    }

    [HttpGet("search")]
    [EndpointSummary("Search field names across every message type")]
    [ProducesResponseType<SearchResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public IActionResult Search([FromQuery] string term)
    {
        if (string.IsNullOrWhiteSpace(term) || term.Length < 2)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Invalid search term",
                Detail = "Search term must be at least 2 characters.",
                Status = StatusCodes.Status400BadRequest,
            });
        }

        var results = referenceService.Search(term);
        var dtos = results.Select(MapSearchResult).ToList();
        return Ok(new SearchResponse(term, dtos.Count, dtos));
    }

    [HttpGet("{messageType}/example/{*xpath}")]
    [EndpointSummary("Generate a minimal XML example with the field highlighted")]
    [ProducesResponseType<FieldExampleResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public IActionResult GetFieldExample(string messageType, string xpath)
    {
        var fields = referenceService.GetFields(messageType);
        if (fields == null)
        {
            return NotFound(new ProblemDetails
            {
                Title = "Message type not found",
                Detail = $"No reference data for '{messageType}'.",
                Status = StatusCodes.Status404NotFound,
            });
        }

        var xmlNamespace = referenceService.GetNamespace(messageType);
        if (xmlNamespace == null)
        {
            return NotFound(new ProblemDetails
            {
                Title = "Namespace not found",
                Detail = $"Could not resolve namespace for '{messageType}'.",
                Status = StatusCodes.Status404NotFound,
            });
        }

        var xml = _exampleGenerator.GenerateWithHighlight(xmlNamespace, fields, xpath);
        return Ok(new FieldExampleResponse(messageType, xmlNamespace, xpath, xml));
    }

    [HttpGet("field/{fieldName}")]
    [EndpointSummary("Find every occurrence of a field by exact name")]
    [ProducesResponseType<FieldSearchResultDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public IActionResult GetField(string fieldName)
    {
        // ReferenceService computes consistency using the same logic Search
        // uses, so the IsConsistent flag here is meaningful (not a naïve
        // record-Distinct check that would fail on list reference equality).
        var detail = referenceService.GetFieldDetail(fieldName);
        if (detail == null)
        {
            return NotFound(new ProblemDetails
            {
                Title = "Field not found",
                Detail = $"No field named '{fieldName}' found in any supported message type.",
                Status = StatusCodes.Status404NotFound,
            });
        }

        return Ok(MapSearchResult(detail));
    }

    private static FieldDefinitionDto MapField(FieldDefinition f) => new(
        f.Name,
        f.XPath,
        f.Depth,
        f.TypeName,
        f.IsComplex,
        f.Cardinality,
        f.IsMandatory,
        f.MinLength,
        f.MaxLength,
        f.Pattern,
        f.Enumerations,
        f.Documentation,
        f.Children.Select(MapField).ToList());

    private static int CountFields(IReadOnlyList<FieldDefinition> fields)
    {
        var count = 0;
        foreach (var f in fields)
        {
            count++;
            count += CountFields(f.Children);
        }
        return count;
    }

    private static FieldSearchResultDto MapSearchResult(FieldSearchResult r) => new(
        r.FieldName,
        r.IsConsistent,
        r.Occurrences.Select(o => new FieldOccurrenceDto(
            o.MessageType,
            o.Field.XPath,
            o.Field.Cardinality,
            o.Field.IsMandatory,
            o.Field.TypeName)).ToList(),
        r.Differences.Select(d => new FieldDifferenceDto(
            d.MessageTypeA,
            d.MessageTypeB,
            d.DifferentProperties)).ToList());
}
