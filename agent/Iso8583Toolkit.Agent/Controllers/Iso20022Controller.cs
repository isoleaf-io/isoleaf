using Iso8583Toolkit.Api.Models.Iso20022;
using Iso8583Toolkit.Iso20022.Exceptions;
using Iso8583Toolkit.Iso20022.Services;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Agent.Controllers;

/// <summary>
/// ISO 20022 message processing — parser only at this stage. Validation,
/// builder and the MX/MT comparator will land in follow-up controllers.
/// </summary>
[ApiController]
[Route("api/iso20022")]
public sealed class Iso20022Controller(Iso20022ParserService parserService) : ControllerBase
{
    /// <summary>Parses an ISO 20022 XML message into a typed tree.</summary>
    /// <remarks>
    /// Auto-detects the message type from the document's root XML namespace
    /// against the embedded XSD catalog. The response includes the message
    /// type, the root namespace and a recursive tree where attributes are
    /// flattened as leaf children prefixed with <c>@</c>.
    /// </remarks>
    [HttpPost("parse")]
    [EndpointSummary("Parse ISO 20022 XML")]
    [EndpointDescription("Detects the message type from the XML namespace and returns a tree representation.")]
    [ProducesResponseType<ParseResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity)]
    public IActionResult Parse([FromBody] ParseRequest request)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.XmlContent))
            return BadRequest(Problem("XML content is required.", StatusCodes.Status400BadRequest));

        try
        {
            var result = parserService.Parse(request.XmlContent);

            // Statement entries (camt.053). Domain layer hands us null when
            // the extractor doesn't apply; pass that through so the wire
            // contract keeps the field optional.
            var entries = result.Summary.Entries?
                .Select(e => new StatementEntry(
                    e.Amount,
                    e.Currency,
                    e.CreditDebitInd,
                    e.BookingDate,
                    e.ValueDate,
                    e.Status,
                    e.EndToEndId,
                    e.RemittanceInfo))
                .ToList();

            var summary = new MessageSummary(
                result.Summary.Operation,
                result.Summary.Confidence,
                result.Summary.Fields
                    .Select(f => new SummaryField(f.Label, f.Value, f.Value != null))
                    .ToList(),
                entries);
            return Ok(new ParseResponse(
                result.MessageType,
                result.Namespace,
                summary,
                MapNode(result.Root)));
        }
        catch (System.Xml.XmlException ex)
        {
            // Malformed input or hostile DTD — caller's problem, not ours.
            return BadRequest(Problem($"Invalid XML: {ex.Message}", StatusCodes.Status400BadRequest));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(Problem(ex.Message, StatusCodes.Status400BadRequest));
        }
        catch (IncompatibleVersionException ex)
        {
            // Specialised diagnostic — carries the offending namespace and the
            // list of versions we DO support so the UI can guide the user.
            // Returned as a plain anonymous body (not ProblemDetails) because
            // ProblemDetails has no slot for structured per-error extensions
            // that the frontend can typecheck against.
            return UnprocessableEntity(new
            {
                title = "Incompatible Version",
                detail = ex.Message,
                detectedNamespace = ex.DetectedNamespace,
                compatibleVersions = ex.CompatibleVersions,
            });
        }
        catch (InvalidOperationException ex)
        {
            // Well-formed XML but we can't make sense of it (missing root, etc.).
            // 422 communicates "we got it, we just can't process it".
            return UnprocessableEntity(Problem(ex.Message, StatusCodes.Status422UnprocessableEntity));
        }
    }

    private static ParsedNode MapNode(Iso20022Node node) =>
        new(node.Name,
            node.Value,
            node.Namespace,
            node.Children.Select(MapNode).ToList());

    private static ProblemDetails Problem(string detail, int status) =>
        new()
        {
            Title = "Parse Error",
            Detail = detail,
            Status = status,
        };
}
