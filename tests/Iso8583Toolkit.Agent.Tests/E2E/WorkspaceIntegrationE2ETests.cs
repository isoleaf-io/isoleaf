using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Iso8583Toolkit.Agent.Models;

namespace Iso8583Toolkit.Agent.Tests.E2E;

public sealed class WorkspaceIntegrationE2ETests
{
    private static HttpClient NewClient() => new AgentWebAppFactory().CreateClient();

    [Fact]
    public async Task Flow4_WorkspaceConfiguresSmartBuilder()
    {
        var c = NewClient();
        var ws = new WorkspaceConfig { TerminalId = "TERM9999", MerchantId = "MERCH123" };
        await c.PutAsJsonAsync("/api/workspace", ws);

        var build = await c.PostAsJsonAsync("/api/build/smart", new
        {
            mti = "0200", role = "Adquirente", brand = "Visa",
            transactionType = "Credito", channel = "Chip"
        });
        var body = await build.Content.ReadFromJsonAsync<JsonElement>();
        var fields = body.GetProperty("fields").EnumerateArray().ToList();

        var bit41 = fields.First(f => f.GetProperty("bitNumber").GetInt32() == 41);
        bit41.GetProperty("value").GetString().Should().Be("TERM9999");

        var bit42 = fields.First(f => f.GetProperty("bitNumber").GetInt32() == 42);
        bit42.GetProperty("value").GetString().Should().Contain("MERCH123");
    }

    [Fact]
    public async Task Flow5_SaveTemplateLoadAndParse()
    {
        var c = NewClient();
        var build = await c.PostAsJsonAsync("/api/build/smart", new
        {
            mti = "0200", role = "Adquirente", brand = "Visa",
            transactionType = "Credito", channel = "Chip"
        });
        var buildBody = await build.Content.ReadFromJsonAsync<JsonElement>();
        var ascii = buildBody.GetProperty("message").GetString()!;
        var binaryHex = buildBody.GetProperty("binaryHexMessage").GetString() ?? "";
        var bits = buildBody.GetProperty("activeBits").EnumerateArray().Select(e => e.GetInt32()).ToList();

        var template = new SavedTemplate
        {
            Name = "Visa 0200 Chip",
            AsciiMessage = ascii,
            BinaryHexMessage = binaryHex,
            Mti = "0200",
            ActiveBits = bits
        };
        var saved = await c.PostAsJsonAsync("/api/workspace/templates", template);
        saved.EnsureSuccessStatusCode();

        var list = await c.GetFromJsonAsync<List<SavedTemplate>>("/api/workspace/templates", AgentWebAppFactory.JsonOpts);
        list.Should().NotBeEmpty();
        var loaded = await c.GetFromJsonAsync<SavedTemplate>(
            $"/api/workspace/templates/{list![0].TemplateId}", AgentWebAppFactory.JsonOpts);

        var parse = await c.PostAsJsonAsync("/api/parse/hex",
            new { hexMessage = loaded!.AsciiMessage, layoutName = "default" });
        var parseBody = await parse.Content.ReadFromJsonAsync<JsonElement>();
        parseBody.GetProperty("success").GetBoolean().Should().BeTrue();
        parseBody.GetProperty("mti").GetString().Should().Be("0200");
    }
}
