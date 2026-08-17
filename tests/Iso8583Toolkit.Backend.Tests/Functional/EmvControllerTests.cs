using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace Iso8583Toolkit.Backend.Tests.Functional;

public sealed class EmvControllerTests : IClassFixture<BackendWebAppFactory>
{
    private readonly HttpClient _client;
    public EmvControllerTests(BackendWebAppFactory f) => _client = f.CreateClient();

    private const string SampleBit55 =
        "9F2608A1B2C3D4E5F607089F2701809F100706010A03A400009F3704AABBCCDD9F3602001E" +
        "95050080000400009A032501159C01009F02060000000010005F2A020986820218009F1A0209869F0306000000000000";

    [Fact]
    public async Task ParseBit55_ReturnsTags()
    {
        var resp = await _client.PostAsJsonAsync("/api/emv/parse-bit55", new { hexBit55 = SampleBit55 });
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var tags = body.GetProperty("tags").EnumerateArray()
            .Select(t => t.GetProperty("tag").GetString()!).ToList();
        tags.Should().Contain("9F26");
    }

    [Fact]
    public async Task ParseBit55_ReturnsArqcCryptogramType()
    {
        var resp = await _client.PostAsJsonAsync("/api/emv/parse-bit55", new { hexBit55 = SampleBit55 });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("cryptogramType").GetString().Should().Be("ARQC");
    }

    [Fact]
    public async Task BuildResponseBit55_HasTag91_And8A()
    {
        var resp = await _client.PostAsJsonAsync("/api/emv/build-response-bit55", new
        {
            arpc = "A1B2C3D4E5F60708",
            authResponseCode = "3030"
        });
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var tags = body.GetProperty("tags").EnumerateArray()
            .Select(t => t.GetProperty("tag").GetString()!).ToList();
        tags.Should().Contain("91");
        tags.Should().Contain("8A");
    }

    [Fact]
    public async Task FullFlow_ProducesArpcAndBit55Response()
    {
        var resp = await _client.PostAsJsonAsync("/api/emv/full-flow", new
        {
            hexBit55Request = SampleBit55,
            issuerMasterKey = "0123456789ABCDEF0123456789ABCDEF",
            pan = "4111111111111111",
            panSequenceNumber = "00",
            authResponseCode = "3030",
            profile = "Visa"
        });
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("arpc").GetString().Should().NotBeNullOrEmpty();
        body.GetProperty("hexBit55Response").GetString().Should().NotBeNullOrEmpty();
    }
}
