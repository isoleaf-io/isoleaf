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
    public async Task ParseHex_LengthPrefixedWithRawTpdu_RoutesToBinaryParser()
    {
        // Regression for "00AA6000020001…" failing as "Invalid MTI '00AA'".
        // Wire = [prefix 2B][raw TPDU 5B][MTI 4B ASCII][bitmap][PAN LLVAR].
        // The raw TPDU bytes after the prefix include 0x00, which the
        // earlier IsBinaryHex length-prefix heuristic rejected as non-
        // printable — routing the wire to the ASCII-wire fallback.
        const string pan = "4111111111111111";
        var bitmap = new byte[8];
        bitmap[0] = 0x40; // bit 2
        var ascii = System.Text.Encoding.ASCII.GetBytes(
            $"0200{Convert.ToHexString(bitmap)}{pan.Length:D2}{pan}");
        var tpdu  = new byte[] { 0x60, 0x00, 0x02, 0x00, 0x01 };
        var wire  = new byte[2 + tpdu.Length + ascii.Length];
        wire[0] = 0x00;
        wire[1] = 0xAA;
        Array.Copy(tpdu,  0, wire, 2,               tpdu.Length);
        Array.Copy(ascii, 0, wire, 2 + tpdu.Length, ascii.Length);
        var hex = Convert.ToHexString(wire);

        var resp = await _client.PostAsJsonAsync("/api/parse/hex",
            new { hexMessage = hex, layoutName = "default" });
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        json.GetProperty("success").GetBoolean().Should().BeTrue();
        json.GetProperty("mti").GetString().Should().Be("0200");
        json.GetProperty("tpdu").GetProperty("hex").GetString().Should().Be("6000020001");
        json.GetProperty("lengthPrefix").GetProperty("hex").GetString().Should().Be("00AA");
    }

    [Fact]
    public async Task ParseHex_LengthPrefixedBinaryHex_RoutesToBinaryParser()
    {
        // Regression for the user-reported "01-FE-39-31-..." failure: the
        // auto-detect inside IsoParseService.IsBinaryHex didn't know the
        // [length-prefix][MTI]... layout, so a wire shaped this way was
        // routed to the ASCII-wire fallback and surfaced as
        // "Invalid MTI '01FE'". Build a synthetic equivalent (no real PAN)
        // and verify the API now decodes it correctly.
        //
        // Wire: [0x01 0xFE] + ASCII "9180" + bitmap-with-bit-2 + LLVAR PAN
        const string pan = "4111111111111111";
        var bitmap = new byte[8];
        bitmap[0] = 0x40; // bit 2
        var body = System.Text.Encoding.ASCII.GetBytes(
            $"9180{Convert.ToHexString(bitmap)}{pan.Length:D2}{pan}");
        var wire = new byte[2 + body.Length];
        wire[0] = 0x01;
        wire[1] = 0xFE; // declared length mismatches body.Length intentionally
        Array.Copy(body, 0, wire, 2, body.Length);
        var hex = Convert.ToHexString(wire);

        var resp = await _client.PostAsJsonAsync("/api/parse/hex",
            new { hexMessage = hex, layoutName = "default" });
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        json.GetProperty("success").GetBoolean().Should().BeTrue(
            "the binary-hex parser must handle a length-prefixed wire — not fall back to ASCII parsing");
        json.GetProperty("mti").GetString().Should().Be("9180");
        json.GetProperty("lengthPrefix").GetProperty("hex").GetString().Should().Be("01FE");
        json.GetProperty("lengthPrefix").GetProperty("match").GetBoolean().Should().BeFalse();
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
