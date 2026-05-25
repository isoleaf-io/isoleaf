using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Iso8583Toolkit.Agent.Models;
using Iso8583Toolkit.Simulator.Protocol;

namespace Iso8583Toolkit.Agent.Tests.Functional;

public sealed class SimulatorControllerTests
{
    private static HttpClient NewClient() => new AgentWebAppFactory().CreateClient();

    [Fact]
    public async Task GetSessions_Empty_InitiallyReturnsEmptyArray()
    {
        var c = NewClient();
        var resp = await c.GetAsync("/api/simulator/sessions");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var sessions = await resp.Content.ReadFromJsonAsync<List<SimulatorSession>>(AgentWebAppFactory.JsonOpts);
        sessions.Should().BeEmpty();
    }

    [Fact]
    public async Task StartSession_WithEphemeralPort_CreatesSession()
    {
        var c = NewClient();
        var port = NextFreePort();
        var resp = await c.PostAsJsonAsync("/api/simulator/sessions", new
        {
            config = new
            {
                sessionId = Guid.NewGuid().ToString(),
                tcpPort = port,
                mode = "Rebatedor",
                role = "Adquirente",
                layoutName = "default",
                defaultResponseCode = "00",
                autoRespond = true
            }
        });
        resp.StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.Conflict);

        if (resp.StatusCode == HttpStatusCode.OK)
        {
            var session = await resp.Content.ReadFromJsonAsync<SimulatorSession>(AgentWebAppFactory.JsonOpts);
            session.Should().NotBeNull();
            session!.Status.Should().BeOneOf(SessionStatus.Active, SessionStatus.Starting);

            // cleanup
            await c.DeleteAsync($"/api/simulator/sessions/{session.SessionId}");
        }
    }

    [Fact]
    public async Task GetLog_Empty_ReturnsEmptyArray()
    {
        var c = NewClient();
        var resp = await c.GetAsync("/api/simulator/log");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var entries = await resp.Content.ReadFromJsonAsync<List<MessageLogEntry>>(AgentWebAppFactory.JsonOpts);
        entries.Should().BeEmpty();
    }

    [Fact]
    public async Task GetHealth_ReturnsOk()
    {
        var c = NewClient();
        var resp = await c.GetAsync("/api/health");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("status").GetString().Should().Be("ok");
        body.GetProperty("version").GetString().Should().NotBeNullOrEmpty();
    }

    private static int NextFreePort()
    {
        using var l = new System.Net.Sockets.TcpListener(System.Net.IPAddress.Loopback, 0);
        l.Start();
        var port = ((System.Net.IPEndPoint)l.LocalEndpoint).Port;
        l.Stop();
        return port;
    }

    // ── inject-direct (stateless TCP send/receive) ──────────────────────────

    [Fact]
    public async Task InjectDirect_InvalidHost_ReturnsError()
    {
        var c = NewClient();
        // Connecting to a closed loopback port → SocketException, surfaced as
        // a friendly "Connection refused" payload (HTTP 200, success=false).
        var freePort = NextFreePort();
        var resp = await c.PostAsJsonAsync("/api/simulator/inject-direct", new
        {
            targetHost = "127.0.0.1",
            targetPort = freePort,
            message = "0200",
            includeTpdu = false,
        });
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("success").GetBoolean().Should().BeFalse();
        body.GetProperty("error").GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task InjectDirect_EmptyMessage_Returns400()
    {
        var c = NewClient();
        var resp = await c.PostAsJsonAsync("/api/simulator/inject-direct", new
        {
            targetHost = "127.0.0.1",
            targetPort = 12345,
            message = "",
        });
        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task InjectDirect_InvalidPort_Returns400()
    {
        var c = NewClient();
        var resp = await c.PostAsJsonAsync("/api/simulator/inject-direct", new
        {
            targetHost = "127.0.0.1",
            targetPort = 0,
            message = "0200",
        });
        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    /// <summary>
    /// End-to-end proof that VaryIdentifiers=true actually flows through the
    /// controller → InjectVariationService → wire path: 2 sequential calls
    /// produce 2 different STANs and 2 different RRNs in the request fields.
    /// </summary>
    [Fact]
    public async Task InjectDirect_VaryIdentifiers_True_FieldsChange()
    {
        // Minimal echo server: accept one connection, echo whatever framed bytes
        // come in, close. Tiny on purpose — we only care about the request side.
        var listener = new System.Net.Sockets.TcpListener(System.Net.IPAddress.Loopback, 0);
        listener.Start();
        var port = ((System.Net.IPEndPoint)listener.LocalEndpoint).Port;

        var serverTask = Task.Run(async () =>
        {
            for (var i = 0; i < 2; i++)
            {
                using var client = await listener.AcceptTcpClientAsync();
                using var stream = client.GetStream();
                var header = new byte[2];
                await stream.ReadAsync(header, 0, 2);
                var len = (header[0] << 8) | header[1];
                var body = new byte[len];
                var read = 0;
                while (read < len)
                {
                    var n = await stream.ReadAsync(body, read, len - read);
                    if (n <= 0) break;
                    read += n;
                }
                // Echo the same body back as a framed message — the controller
                // requires a response frame to complete the request handler.
                await stream.WriteAsync(header, 0, 2);
                await stream.WriteAsync(body, 0, body.Length);
            }
        });

        try
        {
            var c = NewClient();

            // Build a minimal ASCII wire with bit 11 (STAN) + bit 37 (RRN) so the
            // variation service has something to refresh.
            const string baseMsg = "02002000000002000010000001AAAAAAAAAAAA";
            // bitmap "2000000002000010" → bits 3 (no, but...) — easier: use the
            // builder via IsoMessageBuilder for a real wire. Keep it simple here
            // and trust IsoMessageBuilder via a hand-crafted minimal wire.

            object payload(string m) => new
            {
                targetHost = "127.0.0.1",
                targetPort = port,
                message = m,
                includeTpdu = false,
                varyIdentifiers = true,
                varyAmount = false,
            };

            // Build a proper ISO 8583 wire programmatically so the variation
            // service can parse + mutate it.
            var layout = Iso8583Toolkit.IsoCore.Layouts.IsoLayout.Default();
            var msg = new Iso8583Toolkit.IsoCore.Building.IsoMessageBuilder()
                .WithMti("0200")
                .WithLayout(layout)
                .WithField(4, "000000010000")
                .WithField(7, "0101000000")
                .WithField(11, "000001")
                .WithField(12, "000000")
                .WithField(13, "0101")
                .WithField(37, "AAAAAAAAAAAA")
                .BuildHex();

            var r1 = await c.PostAsJsonAsync("/api/simulator/inject-direct", payload(msg));
            r1.StatusCode.Should().Be(HttpStatusCode.OK);
            var b1 = await r1.Content.ReadFromJsonAsync<JsonElement>();

            var r2 = await c.PostAsJsonAsync("/api/simulator/inject-direct", payload(msg));
            r2.StatusCode.Should().Be(HttpStatusCode.OK);
            var b2 = await r2.Content.ReadFromJsonAsync<JsonElement>();

            // Extract bit 11 + bit 37 from the request fields each response carries.
            static string GetField(JsonElement body, int bit)
            {
                var fields = body.GetProperty("requestFields");
                foreach (var f in fields.EnumerateArray())
                    if (f.GetProperty("bitNumber").GetInt32() == bit)
                        return f.GetProperty("value").GetString()!;
                return "";
            }

            GetField(b1, 11).Should().NotBe(GetField(b2, 11), "STAN must refresh on each call");
            GetField(b1, 37).Should().NotBe(GetField(b2, 37), "RRN must refresh on each call");

            await serverTask;
        }
        finally
        {
            listener.Stop();
        }
    }
}
