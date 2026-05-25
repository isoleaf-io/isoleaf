using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Iso8583Toolkit.Agent.Models;

namespace Iso8583Toolkit.Agent.Tests.Functional;

/// <summary>
/// Each test gets a brand-new factory so the LocalSessionStore is isolated.
/// </summary>
public sealed class WorkspaceControllerTests
{
    private static HttpClient NewClient() => new AgentWebAppFactory().CreateClient();

    [Fact]
    public async Task Get_ReturnsDefault()
    {
        var c = NewClient();
        var resp = await c.GetAsync("/api/workspace");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<WorkspaceConfig>(AgentWebAppFactory.JsonOpts);
        body.Should().NotBeNull();
        body!.DefaultCurrency.Should().Be("986");
    }

    [Fact]
    public async Task Put_UpdatesAndPersists()
    {
        var c = NewClient();
        var updated = new WorkspaceConfig { TerminalId = "TEST001" };
        var put = await c.PutAsJsonAsync("/api/workspace", updated);
        put.StatusCode.Should().Be(HttpStatusCode.OK);

        var get = await c.GetAsync("/api/workspace");
        var body = await get.Content.ReadFromJsonAsync<WorkspaceConfig>(AgentWebAppFactory.JsonOpts);
        body!.TerminalId.Should().Be("TEST001");
    }

    [Fact]
    public async Task SaveAndListAndDeleteTemplate_RoundTrip()
    {
        var c = NewClient();
        var template = new SavedTemplate
        {
            Name = "T1",
            AsciiMessage = "0200ABCD",
            Mti = "0200",
            ActiveBits = [2, 3, 4]
        };
        var saved = await c.PostAsJsonAsync("/api/workspace/templates", template);
        saved.StatusCode.Should().Be(HttpStatusCode.Created);

        var list = await c.GetFromJsonAsync<List<SavedTemplate>>("/api/workspace/templates", AgentWebAppFactory.JsonOpts);
        list.Should().HaveCount(1);
        var id = list![0].TemplateId;

        var loaded = await c.GetFromJsonAsync<SavedTemplate>($"/api/workspace/templates/{id}", AgentWebAppFactory.JsonOpts);
        loaded!.Name.Should().Be("T1");

        var del = await c.DeleteAsync($"/api/workspace/templates/{id}");
        del.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var listAfter = await c.GetFromJsonAsync<List<SavedTemplate>>("/api/workspace/templates", AgentWebAppFactory.JsonOpts);
        listAfter.Should().BeEmpty();
    }
}
