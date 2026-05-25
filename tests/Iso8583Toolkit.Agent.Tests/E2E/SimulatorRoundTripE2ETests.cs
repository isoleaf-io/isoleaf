using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Iso8583Toolkit.IsoCore.Layouts;
using Iso8583Toolkit.IsoCore.Parsing;
using Iso8583Toolkit.Simulator.Protocol;
using Iso8583Toolkit.Simulator.Responder;

namespace Iso8583Toolkit.Agent.Tests.E2E;

public sealed class SimulatorRoundTripE2ETests : IClassFixture<AgentWebAppFactory>
{
    private readonly HttpClient _client;
    public SimulatorRoundTripE2ETests(AgentWebAppFactory f) => _client = f.CreateClient();

    [Fact]
    public async Task Flow6_BuildSimulateRoundTrip_NoTcp()
    {
        // Build via API
        var build = await _client.PostAsJsonAsync("/api/build/smart", new
        {
            mti = "0200", role = "Adquirente", brand = "Elo",
            transactionType = "Debito", channel = "Chip"
        });
        var body = await build.Content.ReadFromJsonAsync<JsonElement>();
        var ascii = body.GetProperty("message").GetString()!;

        // In-process simulate (no TCP)
        var parser = new IsoParser();
        var layout = IsoLayout.Default();
        var responder = new AutoResponder();
        var request = parser.ParseFromAscii(ascii, layout);
        var responseHex = responder.BuildResponseHex(request, new SessionConfig
        {
            Role = SimulatorRole.Adquirente,
            DefaultResponseCode = "00",
            AutoRespond = true
        }, layout);

        // Parse the response via API
        var parse = await _client.PostAsJsonAsync("/api/parse/hex",
            new { hexMessage = responseHex, layoutName = "default" });
        var parseBody = await parse.Content.ReadFromJsonAsync<JsonElement>();
        parseBody.GetProperty("success").GetBoolean().Should().BeTrue();
        parseBody.GetProperty("mti").GetString().Should().Be("0210");

        var fields = parseBody.GetProperty("fields").EnumerateArray()
            .ToDictionary(f => f.GetProperty("bitNumber").GetInt32(), f => f.GetProperty("value").GetString());
        fields[39].Should().Be("00");
        fields[38].Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Flow7_SequenceOfMtis_StanIncrements()
    {
        var stans = new List<string>();
        foreach (var (mti, channel, isReversal) in new[] {
            ("0100", "Tarja", false),
            ("0200", "Chip", false),
            ("0400", "Chip", true)
        })
        {
            var resp = await _client.PostAsJsonAsync("/api/build/smart", new
            {
                mti, role = "Adquirente", brand = "Visa",
                transactionType = "Credito", channel,
                isReversal
            });
            var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
            body.GetProperty("success").GetBoolean().Should().BeTrue($"{mti} build");

            var fields = body.GetProperty("fields").EnumerateArray().ToList();
            var bit11 = fields.FirstOrDefault(f => f.GetProperty("bitNumber").GetInt32() == 11);
            stans.Add(bit11.GetProperty("value").GetString()!);

            if (isReversal)
            {
                var hasBit90 = fields.Any(f => f.GetProperty("bitNumber").GetInt32() == 90);
                hasBit90.Should().BeTrue();
            }
        }

        var asInts = stans.Select(s => int.Parse(s)).ToList();
        asInts[1].Should().BeGreaterThan(asInts[0]);
        asInts[2].Should().BeGreaterThan(asInts[1]);
    }
}
