using Iso8583Toolkit.Agent.Models;
using Iso8583Toolkit.Agent.Services;
using Iso8583Toolkit.Iso20022.Validation;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Agent.Controllers;

[ApiController]
[Route("api/workspace")]
public sealed class WorkspaceController : ControllerBase
{
    private readonly LocalSessionStore _store;
    private readonly SchemaRegistry _schemaRegistry;
    private readonly SchemaUploadService _schemaUpload;

    public WorkspaceController(
        LocalSessionStore store,
        SchemaRegistry schemaRegistry,
        SchemaUploadService schemaUpload)
    {
        _store = store;
        _schemaRegistry = schemaRegistry;
        _schemaUpload = schemaUpload;
    }

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

    // ── Sprint 9.5 — ISO 20022 schemas storage ────────────────────────

    /// <summary>Wire shape returned by <c>GET /api/workspace/schemas</c>.</summary>
    public sealed record SchemaEntryDto(
        string MessageType,
        string Family,
        string Version,
        string Namespace,
        string FileName);

    /// <summary>Wire shape returned by <c>POST /api/workspace/schemas/upload</c>.</summary>
    public sealed record SchemaUploadDto(
        string MessageType,
        string Namespace,
        string FileName);

    [HttpGet("schemas")]
    [EndpointSummary("List every ISO 20022 schema currently loaded on the agent")]
    [EndpointDescription("Feeds the Workspace \"Schemas ISO 20022\" section with the fields shown in the table: message type, family, version, target namespace, and the source filename on disk.")]
    [ProducesResponseType<IReadOnlyList<SchemaEntryDto>>(StatusCodes.Status200OK)]
    public IActionResult GetSchemas() =>
        Ok(_schemaRegistry.ListSupportedTypes()
            .Select(s => new SchemaEntryDto(
                s.MessageType, s.Family, s.Version, s.Namespace, s.FileName))
            .ToList());

    [HttpPost("schemas/upload")]
    [EndpointSummary("Upload a new ISO 20022 XSD (replaces existing by namespace)")]
    [EndpointDescription("Validates the multipart file as an xs:schema, writes it under the schemas directory (grouped by family), removes any pre-existing entry with the same target namespace, and reloads the registry synchronously so subsequent requests see the new schema without a restart.")]
    [ProducesResponseType<SchemaUploadDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [RequestSizeLimit(10 * 1024 * 1024)] // 10 MB is generous for an XSD.
    public async Task<IActionResult> UploadSchema(IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "Envie um arquivo .xsd via multipart/form-data." });

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);
        var result = _schemaUpload.UploadSchema(file.FileName, ms.ToArray());
        if (!result.Success)
        {
            return BadRequest(new
            {
                error = result.Error,
                lineNumber = result.LineNumber,
                linePosition = result.LinePosition,
            });
        }

        return Ok(new SchemaUploadDto(
            result.MessageType ?? string.Empty,
            result.Namespace ?? string.Empty,
            result.FileName ?? string.Empty));
    }
}
