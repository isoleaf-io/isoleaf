using Iso8583Toolkit.Agent.Models;
using Iso8583Toolkit.Agent.Services;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Agent.Controllers;

[ApiController]
[Route("api/workspace")]
public sealed class WorkspaceController : ControllerBase
{
    private readonly LocalSessionStore _store;

    public WorkspaceController(LocalSessionStore store) => _store = store;

    [HttpGet]
    public IActionResult Get() => Ok(_store.GetWorkspaceConfig());

    [HttpPut]
    public IActionResult Update([FromBody] WorkspaceConfig config)
    {
        _store.UpdateWorkspaceConfig(config);
        return Ok(_store.GetWorkspaceConfig());
    }

    [HttpGet("templates")]
    public IActionResult GetTemplates() => Ok(_store.GetTemplates());

    [HttpPost("templates")]
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
    public IActionResult GetTemplate(string id)
    {
        var t = _store.GetTemplate(id);
        return t is null ? NotFound() : Ok(t);
    }

    [HttpDelete("templates/{id}")]
    public IActionResult DeleteTemplate(string id) =>
        _store.DeleteTemplate(id) ? NoContent() : NotFound();
}
