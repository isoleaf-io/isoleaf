using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace Iso8583Toolkit.Agent.Tests.Functional;

public sealed class BuildControllerTests : IClassFixture<AgentWebAppFactory>
{
    private readonly HttpClient _client;
    public BuildControllerTests(AgentWebAppFactory f) => _client = f.CreateClient();

    [Fact]
    public async Task SmartBuild_0200Chip_HasBit55()
    {
        var resp = await _client.PostAsJsonAsync("/api/build/smart", new
        {
            mti = "0200",
            role = "Adquirente",
            brand = "Visa",
            transactionType = "Credito",
            channel = "Chip"
        });
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("success").GetBoolean().Should().BeTrue();
        var bits = body.GetProperty("activeBits").EnumerateArray().Select(e => e.GetInt32()).ToList();
        bits.Should().Contain(55);
    }

    [Fact]
    public async Task SmartBuild_0200CNP_NoBit35()
    {
        var resp = await _client.PostAsJsonAsync("/api/build/smart", new
        {
            mti = "0200",
            role = "Adquirente",
            brand = "Visa",
            transactionType = "Credito",
            channel = "CNP"
        });
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var bits = body.GetProperty("activeBits").EnumerateArray().Select(e => e.GetInt32()).ToList();
        bits.Should().NotContain(35);
    }

    [Fact]
    public async Task SmartBuild_InvalidBrand_Returns400()
    {
        var resp = await _client.PostAsJsonAsync("/api/build/smart", new
        {
            mti = "0200", role = "Adquirente", brand = "DoesNotExist",
            transactionType = "Credito", channel = "Chip"
        });
        // JsonStringEnumConverter throws on unknown value → 400 from MVC binding
        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task BuildMessage_WithFields_ReturnsHexMessage()
    {
        var resp = await _client.PostAsJsonAsync("/api/build/message", new
        {
            mti = "0200",
            layoutName = "default",
            fields = new[]
            {
                new { bitNumber = 2, value = "4111111111111111" },
                new { bitNumber = 3, value = "000000" },
                new { bitNumber = 4, value = "000000000100" },
                new { bitNumber = 11, value = "000001" }
            }
        });
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("success").GetBoolean().Should().BeTrue();
        body.GetProperty("message").GetString().Should().StartWith("0200");
    }

    [Fact]
    public async Task GetSmartProfiles_ReturnsAllBrands()
    {
        var resp = await _client.GetAsync("/api/build/smart/profiles");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task GetSmartRules_ReturnsRulesList()
    {
        var resp = await _client.GetAsync("/api/build/smart/rules");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().BeGreaterThan(5);
    }
}
