using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Iso8583Toolkit.Api.DTOs;

namespace Iso8583Toolkit.Agent.Tests.Functional;

public sealed class ParseControllerTests : IClassFixture<AgentWebAppFactory>
{
    private readonly HttpClient _client;
    public ParseControllerTests(AgentWebAppFactory f) => _client = f.CreateClient();

    private const string SampleAsciiMessage =
        "020072300000000000001634567890123456780600000000000001000605123000000006123000";

    [Fact]
    public async Task ParseHex_ValidMessage_ReturnsMtiAndFields()
    {
        var resp = await _client.PostAsJsonAsync("/api/parse/hex",
            new { hexMessage = SampleAsciiMessage, layoutName = "default" });
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("success").GetBoolean().Should().BeTrue();
        body.GetProperty("mti").GetString().Should().Be("0200");
    }

    [Fact]
    public async Task ParseHex_InvalidMessage_ReturnsSuccessFalse()
    {
        var resp = await _client.PostAsJsonAsync("/api/parse/hex",
            new { hexMessage = "BADBADBAD", layoutName = "default" });
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("success").GetBoolean().Should().BeFalse();
        body.GetProperty("error").GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task ParseHex_EmptyPayload_Returns400()
    {
        var resp = await _client.PostAsJsonAsync("/api/parse/hex",
            new { hexMessage = "", layoutName = "default" });
        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ParseBitmap_ValidBitmap_ReturnsActiveBits()
    {
        var resp = await _client.PostAsJsonAsync("/api/parse/bitmap",
            new { hexBitmap = "7230000000000000" });
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var bits = body.GetProperty("activeBits").EnumerateArray()
            .Select(e => e.GetInt32()).ToList();
        bits.Should().Contain([2, 3, 4, 11, 12]);
    }

    [Fact]
    public async Task GetLayouts_ReturnsAtLeastDefault()
    {
        var resp = await _client.GetAsync("/api/parse/layouts");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<List<LayoutSummary>>();
        body.Should().NotBeNullOrEmpty();
        body!.Should().Contain(l => l.Name.Contains("Default", StringComparison.OrdinalIgnoreCase));
    }
}
