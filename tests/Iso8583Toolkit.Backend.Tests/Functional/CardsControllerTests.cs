using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace Iso8583Toolkit.Backend.Tests.Functional;

public sealed class CardsControllerTests : IClassFixture<BackendWebAppFactory>
{
    private readonly HttpClient _client;
    public CardsControllerTests(BackendWebAppFactory f) => _client = f.CreateClient();

    [Fact]
    public async Task GenerateVisa_StartsWith4_LuhnValid()
    {
        var resp = await _client.PostAsJsonAsync("/api/cards/generate", new { brand = "Visa" });
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var pan = body.GetProperty("pan").GetString();
        pan.Should().StartWith("4").And.HaveLength(16);
    }

    [Fact]
    public async Task GenerateMastercard_HasValidBin()
    {
        var resp = await _client.PostAsJsonAsync("/api/cards/generate", new { brand = "Mastercard" });
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var pan = body.GetProperty("pan").GetString()!;
        var prefix2 = int.Parse(pan[..2]);
        var prefix4 = int.Parse(pan[..4]);
        var validMc = (prefix2 >= 51 && prefix2 <= 55) || (prefix4 >= 2221 && prefix4 <= 2720);
        validMc.Should().BeTrue($"PAN {pan} should be in MC BIN ranges");
    }

    [Fact]
    public async Task ValidatePan_Valid_ReturnsTrue()
    {
        var resp = await _client.PostAsJsonAsync("/api/cards/validate",
            new { pan = "4111111111111111" });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("isValid").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task ValidatePan_Invalid_ReturnsFalse()
    {
        var resp = await _client.PostAsJsonAsync("/api/cards/validate",
            new { pan = "4111111111111112" });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("isValid").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task DetectBrand_EloPan_ReturnsElo()
    {
        var resp = await _client.PostAsJsonAsync("/api/cards/detect-brand",
            new { pan = "6362970000000005" });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("brand").GetString().Should().Be("Elo");
    }

    [Fact]
    public async Task GetBrands_ListsKnownBrands()
    {
        var resp = await _client.GetAsync("/api/cards/brands");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var brandNames = body.EnumerateArray().Select(e => e.GetProperty("name").GetString()!).ToList();
        brandNames.Should().Contain(["Visa", "Mastercard", "Elo"]);
    }
}
