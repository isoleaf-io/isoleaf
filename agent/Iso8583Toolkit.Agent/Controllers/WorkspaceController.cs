using Iso8583Toolkit.Agent.Models;
using Iso8583Toolkit.Agent.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Agent.Controllers;

[ApiController]
[Route("api/workspace")]
public sealed class WorkspaceController : ControllerBase
{
    private readonly LocalSessionStore _store;

    public WorkspaceController(LocalSessionStore store) => _store = store;

    [HttpGet]
    [EndpointSummary("Read the workspace configuration (terminal IDs, NIIs, MCC, IMK, ZPK…)")]
    [EndpointDescription("Returns the persisted defaults the rest of the API consumes when the user doesn't override them — Acquirer/Merchant identifiers, NII pair, default currency/country, processing codes, and the test issuer/zone keys (IMK/ZPK). Stored locally on the agent, never transmitted off-host.")]
    [ProducesResponseType(typeof(WorkspaceConfig), StatusCodes.Status200OK)]
    public IActionResult Get() => Ok(_store.GetWorkspaceConfig());

    [HttpPut]
    [EndpointSummary("Replace the workspace configuration")]
    [EndpointDescription("Persists the supplied workspace config (terminal/merchant identifiers, NIIs, processing codes, IMK, ZPK…). The new values take effect on the very next API call — no restart required.")]
    [ProducesResponseType(typeof(WorkspaceConfig), StatusCodes.Status200OK)]
    public IActionResult Update([FromBody] WorkspaceConfig config)
    {
        _store.UpdateWorkspaceConfig(config);
        return Ok(_store.GetWorkspaceConfig());
    }

    [HttpGet("templates")]
    [EndpointSummary("List every saved ISO 8583 message template")]
    [EndpointDescription("Templates are message snapshots the user named in the Builder for quick re-use (e.g. \"Visa Credit Online\", \"Mastercard Debit Saque\"). Returns each template's metadata plus the ASCII wire and the active-bit mask.")]
    [ProducesResponseType(typeof(IEnumerable<SavedTemplate>), StatusCodes.Status200OK)]
    public IActionResult GetTemplates() => Ok(_store.GetTemplates());

    [HttpPost("templates")]
    [EndpointSummary("Save a new ISO 8583 message template")]
    [EndpointDescription("Persists a message snapshot (name, optional description, ASCII wire, MTI, active bits, tags) for later reuse from the Builder UI. Returns 201 Created with the canonical resource URL of the new template.")]
    [ProducesResponseType(typeof(SavedTemplate), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult SaveTemplate([FromBody] SavedTemplate template)
    {
        if (string.IsNullOrWhiteSpace(template.Name))
            return BadRequest(new { error = "Name is required." });
        if (string.IsNullOrWhiteSpace(template.AsciiMessage))
            return BadRequest(new { error = "AsciiMessage is required." });

        _store.SaveTemplate(template);
        return CreatedAtAction(nameof(GetTemplate), new { id = template.TemplateId }, template);
    }

    [HttpGet("templates/{id}")]
    [EndpointSummary("Fetch a single saved template by id")]
    [EndpointDescription("Returns the full template body (ASCII wire, bits, metadata). 404 when the id doesn't exist — useful guard for the Load Template modal in the Builder.")]
    [ProducesResponseType(typeof(SavedTemplate), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult GetTemplate(string id)
    {
        var t = _store.GetTemplate(id);
        return t is null ? NotFound() : Ok(t);
    }

    [HttpDelete("templates/{id}")]
    [EndpointSummary("Delete a saved template by id")]
    [EndpointDescription("Removes the template permanently. Returns 204 No Content on success, 404 when the id is unknown.")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult DeleteTemplate(string id) =>
        _store.DeleteTemplate(id) ? NoContent() : NotFound();
}
