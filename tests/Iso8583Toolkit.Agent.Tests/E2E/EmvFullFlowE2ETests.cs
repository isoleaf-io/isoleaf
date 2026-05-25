using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace Iso8583Toolkit.Agent.Tests.E2E;

public sealed class EmvFullFlowE2ETests : IClassFixture<AgentWebAppFactory>
{
    private readonly HttpClient _client;
    public EmvFullFlowE2ETests(AgentWebAppFactory f) => _client = f.CreateClient();

    [Fact]
    public async Task Flow8_GenerateCard_BuildSmart_ParseBit55_FullFlow()
    {
        // 1. Generate Visa card
        var card = await _client.PostAsJsonAsync("/api/cards/generate", new { brand = "Visa" });
        var cardBody = await card.Content.ReadFromJsonAsync<JsonElement>();
        var pan = cardBody.GetProperty("pan").GetString()!;

        // 2. Smart build with that PAN
        var build = await _client.PostAsJsonAsync("/api/build/smart", new
        {
            mti = "0200", role = "Adquirente", brand = "Auto",
            transactionType = "Credito", channel = "Chip",
            customFields = new Dictionary<string, string> { ["2"] = pan }
        });
        var buildBody = await build.Content.ReadFromJsonAsync<JsonElement>();
        var fields = buildBody.GetProperty("fields").EnumerateArray().ToList();
        var bit55 = fields.First(f => f.GetProperty("bitNumber").GetInt32() == 55).GetProperty("value").GetString()!;

        // 3. Parse Bit 55 — verify ARQC tag
        var parseBit55 = await _client.PostAsJsonAsync("/api/emv/parse-bit55", new { hexBit55 = bit55 });
        var parseBody = await parseBit55.Content.ReadFromJsonAsync<JsonElement>();
        var tags = parseBody.GetProperty("tags").EnumerateArray()
            .Select(t => t.GetProperty("tag").GetString()!).ToList();
        tags.Should().Contain("9F26");
        parseBody.GetProperty("cryptogramType").GetString().Should().Be("ARQC");

        // 4. Full flow
        var full = await _client.PostAsJsonAsync("/api/emv/full-flow", new
        {
            hexBit55Request = bit55,
            issuerMasterKey = "0123456789ABCDEF0123456789ABCDEF",
            pan,
            panSequenceNumber = "00",
            authResponseCode = "3030",
            profile = "Visa"
        });
        var fullBody = await full.Content.ReadFromJsonAsync<JsonElement>();
        fullBody.GetProperty("arpc").GetString().Should().NotBeNullOrEmpty();
        var responseHex = fullBody.GetProperty("hexBit55Response").GetString()!;
        responseHex.Should().Contain("91", "Issuer Authentication Data tag must be present");
    }
}
