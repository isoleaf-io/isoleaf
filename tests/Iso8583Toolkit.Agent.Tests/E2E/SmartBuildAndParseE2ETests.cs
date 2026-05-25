using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace Iso8583Toolkit.Agent.Tests.E2E;

public sealed class SmartBuildAndParseE2ETests : IClassFixture<AgentWebAppFactory>
{
    private readonly HttpClient _client;
    public SmartBuildAndParseE2ETests(AgentWebAppFactory f) => _client = f.CreateClient();

    [Fact]
    public async Task Flow1_SmartBuild_Parse_Validate()
    {
        // 1. Build
        var build = await _client.PostAsJsonAsync("/api/build/smart", new
        {
            mti = "0200", role = "Adquirente", brand = "Visa",
            transactionType = "Credito", channel = "Chip"
        });
        var buildBody = await build.Content.ReadFromJsonAsync<JsonElement>();
        buildBody.GetProperty("success").GetBoolean().Should().BeTrue();
        var ascii = buildBody.GetProperty("message").GetString();
        var bitmap = buildBody.GetProperty("bitmap").GetString();
        var activeBits = buildBody.GetProperty("activeBits").EnumerateArray().Select(e => e.GetInt32()).ToList();

        // 2. Parse
        var parse = await _client.PostAsJsonAsync("/api/parse/hex",
            new { hexMessage = ascii, layoutName = "default" });
        var parseBody = await parse.Content.ReadFromJsonAsync<JsonElement>();
        parseBody.GetProperty("success").GetBoolean().Should().BeTrue();
        parseBody.GetProperty("mti").GetString().Should().Be("0200");

        // 3. Bitmap parse round-trip
        var bm = await _client.PostAsJsonAsync("/api/parse/bitmap", new { hexBitmap = bitmap![..16] });
        var bmBody = await bm.Content.ReadFromJsonAsync<JsonElement>();
        var bmBits = bmBody.GetProperty("activeBits").EnumerateArray().Select(e => e.GetInt32()).ToList();
        // Primary bitmap covers bits 1-64; intersect with build's first-64 active bits
        var expectedPrimary = activeBits.Where(b => b <= 64).Where(b => b != 1).ToList();
        var bmSet = bmBits.Where(b => b != 1).ToList();
        bmSet.Should().Contain(expectedPrimary);
    }

    [Fact]
    public async Task Flow2_CustomPan_DetectsBrand()
    {
        const string customPan = "4111111111111111";
        var build = await _client.PostAsJsonAsync("/api/build/smart", new
        {
            mti = "0200", role = "Adquirente", brand = "Auto",
            transactionType = "Credito", channel = "Chip",
            customFields = new Dictionary<string, string> { ["2"] = customPan }
        });
        var body = await build.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("success").GetBoolean().Should().BeTrue();
        body.GetProperty("profileUsed").GetString().Should().Be("Visa");

        var detect = await _client.PostAsJsonAsync("/api/cards/detect-brand", new { pan = customPan });
        var detectBody = await detect.Content.ReadFromJsonAsync<JsonElement>();
        detectBody.GetProperty("brand").GetString().Should().Be("Visa");
    }

    [Fact]
    public async Task Flow3_GenerateCard_UsedInSmartBuilder()
    {
        var gen = await _client.PostAsJsonAsync("/api/cards/generate", new { brand = "Elo" });
        var genBody = await gen.Content.ReadFromJsonAsync<JsonElement>();
        var pan = genBody.GetProperty("pan").GetString();

        var build = await _client.PostAsJsonAsync("/api/build/smart", new
        {
            mti = "0200", role = "Adquirente", brand = "Auto",
            transactionType = "Credito", channel = "Chip",
            customFields = new Dictionary<string, string> { ["2"] = pan! }
        });
        var buildBody = await build.Content.ReadFromJsonAsync<JsonElement>();
        var fields = buildBody.GetProperty("fields").EnumerateArray().ToList();
        var bit35 = fields.FirstOrDefault(f => f.GetProperty("bitNumber").GetInt32() == 35);
        bit35.ValueKind.Should().NotBe(JsonValueKind.Undefined);
        bit35.GetProperty("value").GetString()!.Should().StartWith(pan! + "=");
    }
}
