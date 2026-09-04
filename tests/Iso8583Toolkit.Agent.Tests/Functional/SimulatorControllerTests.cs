using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Iso8583Toolkit.Simulator.Logging;
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
    /// Length-prefix flag toggles framing on the wire end-to-end.
    /// Captures the raw bytes the listener received and asserts:
    ///   IncludeLengthPrefix=true  → first 2 bytes are uint16 BE of body length
    ///   IncludeLengthPrefix=false → no prefix; the body is sent verbatim
    /// </summary>
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task InjectDirect_LengthPrefixFlag_ControlsFraming(bool includePrefix)
    {
        // Minimal valid ASCII wire so the controller's auto-detect takes the
        // ASCII path (bodyBytes = ASCII chars of the string). A short all-hex
        // payload would otherwise be misread as binary-hex and shrink to
        // half the byte count, throwing off the length-prefix assertion.
        // 4 MTI + 16 bitmap (bit 2 active) + 2-char LLVAR length + 16-char PAN = 38 chars.
        // MTI(4) + bitmap with bit 2(16) + LLVAR length "16"(2) + 16-digit PAN(16) = 38.
        const string body = "02004000000000000000164111111111111111";

        using var listener = new System.Net.Sockets.TcpListener(System.Net.IPAddress.Loopback, 0);
        listener.Start();
        var port = ((System.Net.IPEndPoint)listener.LocalEndpoint).Port;
        var receivedBytes = new TaskCompletionSource<byte[]>(TaskCreationOptions.RunContinuationsAsynchronously);

        var serverTask = Task.Run(async () =>
        {
            using var client = await listener.AcceptTcpClientAsync();
            using var stream = client.GetStream();
            // Read up to 64 bytes — well past either form of our short payload.
            using var ms = new MemoryStream();
            var buf = new byte[64];
            using var readCts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
            try
            {
                while (!readCts.IsCancellationRequested)
                {
                    var n = await stream.ReadAsync(buf, readCts.Token);
                    if (n <= 0) break;
                    ms.Write(buf, 0, n);
                    // Stop as soon as we have enough to disambiguate both shapes.
                    if (ms.Length >= 12) break;
                }
            }
            catch (OperationCanceledException) { /* timed read — that's fine */ }
            receivedBytes.SetResult(ms.ToArray());
            // Send a framed reply so the controller's read-side doesn't time out.
            var reply = System.Text.Encoding.ASCII.GetBytes("0210");
            await stream.WriteAsync(new byte[] { (byte)(reply.Length >> 8), (byte)(reply.Length & 0xFF) });
            await stream.WriteAsync(reply);
        });

        try
        {
            var c = NewClient();
            await c.PostAsJsonAsync("/api/simulator/inject-direct", new
            {
                targetHost = "127.0.0.1",
                targetPort = port,
                message = body,
                includeLengthPrefix = includePrefix,
            });

            var wire = await receivedBytes.Task;
            var bodyBytes = System.Text.Encoding.ASCII.GetBytes(body);

            if (includePrefix)
            {
                wire.Length.Should().BeGreaterThanOrEqualTo(2 + bodyBytes.Length);
                wire[0].Should().Be((byte)((bodyBytes.Length >> 8) & 0xFF));
                wire[1].Should().Be((byte)(bodyBytes.Length & 0xFF));
                wire.Skip(2).Take(bodyBytes.Length).Should().BeEquivalentTo(bodyBytes);
            }
            else
            {
                // No prefix — body bytes start at offset 0.
                wire.Take(bodyBytes.Length).Should().BeEquivalentTo(bodyBytes);
                // The first byte must NOT be the high byte of the length prefix
                // (0x00 for a 10-char payload) — that would prove framing leaked.
                wire[0].Should().NotBe(0x00, "non-framed mode must not prepend a length high byte");
            }
        }
        finally
        {
            listener.Stop();
            await Task.WhenAny(serverTask, Task.Delay(500));
        }
    }

    /// <summary>
    /// When the user pastes a wire that already starts with a length prefix
    /// (e.g. "0171" + body), the injetor must detect, strip, and recompute
    /// the prefix from the post-strip payload. Otherwise the framing math is
    /// off and the rebatedor either reads garbage as the MTI or times out.
    /// </summary>
    [Fact]
    public async Task InjectDirect_StripsExistingLengthPrefix_BeforeSending()
    {
        // Synthetic: "0004" prefix declaring 4 wire bytes, plus an 8-hex-char
        // body that decodes to a 4-byte ASCII wire "0200".
        const string body = "30323030";        // → bytes "0200"
        const string input = "0004" + body;    // pasted wire incl. prefix

        using var listener = new System.Net.Sockets.TcpListener(System.Net.IPAddress.Loopback, 0);
        listener.Start();
        var port = ((System.Net.IPEndPoint)listener.LocalEndpoint).Port;

        var received = new TaskCompletionSource<byte[]>(TaskCreationOptions.RunContinuationsAsynchronously);
        var serverTask = Task.Run(async () =>
        {
            using var client = await listener.AcceptTcpClientAsync();
            using var stream = client.GetStream();
            var header = new byte[2];
            // ReadExactlyAsync guarantees the 2 framing bytes — ReadAsync may
            // return short reads on slow networks (CA2022).
            await stream.ReadExactlyAsync(header.AsMemory(0, 2));
            var len = (header[0] << 8) | header[1];
            var bodyBuf = new byte[len];
            var read = 0;
            while (read < len)
            {
                var n = await stream.ReadAsync(bodyBuf, read, len - read);
                if (n <= 0) break;
                read += n;
            }
            // The listener returns the FRAMED bytes (header + body) so the
            // test can assert on both the declared length and the payload.
            var full = new byte[2 + len];
            Array.Copy(header, full, 2);
            Array.Copy(bodyBuf, 0, full, 2, len);
            received.SetResult(full);
            // Send a framed reply so the injetor's read side doesn't time out.
            var reply = System.Text.Encoding.ASCII.GetBytes("0210");
            await stream.WriteAsync(new byte[] { 0x00, 0x04 });
            await stream.WriteAsync(reply);
        });

        try
        {
            var c = NewClient();
            var resp = await c.PostAsJsonAsync("/api/simulator/inject-direct", new
            {
                targetHost = "127.0.0.1",
                targetPort = port,
                message = input,
                includeLengthPrefix = true,
            });

            resp.StatusCode.Should().Be(HttpStatusCode.OK);
            var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
            json.GetProperty("success").GetBoolean().Should().BeTrue();

            // The detected prefix is echoed back to the UI.
            var detected = json.GetProperty("detectedLengthPrefix");
            detected.GetProperty("hex").GetString().Should().Be("0004");
            detected.GetProperty("expectedLength").GetInt32().Should().Be(4);

            var wire = await received.Task.WaitAsync(TimeSpan.FromSeconds(5));
            // The framed wire is [0x00 0x04] (new prefix declaring 4 bytes)
            // + the 4-byte body "0200". The OLD "0004" prefix in the user
            // input must NOT appear inside the body — otherwise the receiver
            // would see "\x00\x040200" and fail the MTI parse.
            wire.Should().BeEquivalentTo(new byte[] { 0x00, 0x04, 0x30, 0x32, 0x30, 0x30 });
        }
        finally
        {
            listener.Stop();
            await Task.WhenAny(serverTask, Task.Delay(500));
        }
    }

    /// <summary>
    /// When the listener closes the connection without sending a response —
    /// the classic "framing-mismatch" failure mode — the injetor must surface
    /// a friendly diagnostic instead of the cryptic "Connection closed before
    /// reading full frame" or "Message cannot be null or empty".
    /// </summary>
    [Fact]
    public async Task InjectDirect_ReturnsHelpfulError_WhenResponseIsEmpty()
    {
        using var listener = new System.Net.Sockets.TcpListener(System.Net.IPAddress.Loopback, 0);
        listener.Start();
        var port = ((System.Net.IPEndPoint)listener.LocalEndpoint).Port;

        // Server: accept, read a few bytes, close immediately without replying.
        var serverTask = Task.Run(async () =>
        {
            using var client = await listener.AcceptTcpClientAsync();
            using var stream = client.GetStream();
            var buf = new byte[64];
            try { _ = await stream.ReadAsync(buf); }
            catch { /* fine */ }
            // Close without writing — simulates a listener with mismatched framing.
        });

        try
        {
            var c = NewClient();
            var resp = await c.PostAsJsonAsync("/api/simulator/inject-direct", new
            {
                targetHost = "127.0.0.1",
                targetPort = port,
                // Valid ASCII wire so the controller doesn't bail on parse.
                message = "02004000000000000000164111111111111111",
                includeLengthPrefix = true,
            });

            resp.StatusCode.Should().Be(HttpStatusCode.OK);
            var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
            json.GetProperty("success").GetBoolean().Should().BeFalse();
            var err = json.GetProperty("error").GetString();
            err.Should().NotBeNullOrEmpty();
            // The old, cryptic surface is gone — the new one mentions the
            // actual likely cause (framing mismatch).
            err.Should().Contain("Length prefix");
            err.Should().NotContain("Message cannot be null or empty");
        }
        finally
        {
            listener.Stop();
            await Task.WhenAny(serverTask, Task.Delay(500));
        }
    }

    /// <summary>
    /// Un-framed mode requires the injetor to half-close its send side so the
    /// rebatedor's read-until-close drain sees EOF. Without this, both sides
    /// block: injetor waiting on a response, rebatedor waiting for the stream
    /// to end. The test mounts a listener that does the symmetric un-framed
    /// protocol — read until EOF, respond, half-close — and asserts the
    /// request/response completes successfully (i.e. no 30s timeout).
    /// </summary>
    [Fact]
    public async Task InjectDirect_HalfClosesConnection_WhenNoPrefixMode()
    {
        const string requestBody = "02004000000000000000164111111111111111"; // ASCII wire, 38 chars.
        var requestBytes = System.Text.Encoding.ASCII.GetBytes(requestBody);
        using var listener = new System.Net.Sockets.TcpListener(System.Net.IPAddress.Loopback, 0);
        listener.Start();
        var port = ((System.Net.IPEndPoint)listener.LocalEndpoint).Port;

        var receivedBytes = new TaskCompletionSource<byte[]>(TaskCreationOptions.RunContinuationsAsynchronously);
        var serverTask = Task.Run(async () =>
        {
            using var client = await listener.AcceptTcpClientAsync();
            using var stream = client.GetStream();
            // Read-until-close — mirrors what MessageFramer does with HeaderSize=0.
            using var ms = new MemoryStream();
            await stream.CopyToAsync(ms);
            receivedBytes.SetResult(ms.ToArray());
            // Respond un-framed and half-close so the injetor's CopyToAsync
            // returns. A real rebatedor would do this via WriteMessageAsync
            // + the using-block's dispose; we inline it here.
            var resp = System.Text.Encoding.ASCII.GetBytes("0210");
            await stream.WriteAsync(resp);
            client.Client.Shutdown(System.Net.Sockets.SocketShutdown.Send);
        });

        try
        {
            var c = NewClient();
            var resp = await c.PostAsJsonAsync("/api/simulator/inject-direct", new
            {
                targetHost = "127.0.0.1",
                targetPort = port,
                message = requestBody,
                includeLengthPrefix = false,
            });

            resp.StatusCode.Should().Be(HttpStatusCode.OK);
            var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
            json.GetProperty("success").GetBoolean().Should().BeTrue(
                "the half-close lets the rebatedor's drain end and the response flow back");

            // The listener received exactly the body bytes — no prefix, no extra.
            var wire = await receivedBytes.Task.WaitAsync(TimeSpan.FromSeconds(5));
            wire.Should().BeEquivalentTo(requestBytes);
        }
        finally
        {
            listener.Stop();
            await Task.WhenAny(serverTask, Task.Delay(500));
        }
    }

    /// <summary>
    /// Prefix-mode counterpart: the injetor does NOT half-close (sessions can be
    /// reused for multiple framed messages). We assert by observing that the
    /// listener's send side can complete a normal framed read after the request.
    /// </summary>
    [Fact]
    public async Task InjectDirect_DoesNotHalfClose_WhenPrefixMode()
    {
        const string requestBody = "02004000000000000000164111111111111111";
        using var listener = new System.Net.Sockets.TcpListener(System.Net.IPAddress.Loopback, 0);
        listener.Start();
        var port = ((System.Net.IPEndPoint)listener.LocalEndpoint).Port;

        var serverTask = Task.Run(async () =>
        {
            using var client = await listener.AcceptTcpClientAsync();
            using var stream = client.GetStream();
            // Standard framed read: 2-byte header, then body.
            // ReadExactlyAsync guarantees the framing bytes (CA2022).
            var header = new byte[2];
            await stream.ReadExactlyAsync(header.AsMemory(0, 2));
            var len = (header[0] << 8) | header[1];
            var body = new byte[len];
            var read = 0;
            while (read < len)
            {
                var n = await stream.ReadAsync(body, read, len - read);
                if (n <= 0) break;
                read += n;
            }
            // Send framed response.
            var resp = System.Text.Encoding.ASCII.GetBytes("0210");
            await stream.WriteAsync(new byte[] { (byte)(resp.Length >> 8), (byte)(resp.Length & 0xFF) });
            await stream.WriteAsync(resp);
        });

        try
        {
            var c = NewClient();
            var resp = await c.PostAsJsonAsync("/api/simulator/inject-direct", new
            {
                targetHost = "127.0.0.1",
                targetPort = port,
                message = requestBody,
                includeLengthPrefix = true,
            });

            resp.StatusCode.Should().Be(HttpStatusCode.OK);
            var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
            json.GetProperty("success").GetBoolean().Should().BeTrue();
            // The server task must have finished — it would block forever if
            // the injetor half-closed before the framed read had a chance.
            await serverTask.WaitAsync(TimeSpan.FromSeconds(5));
        }
        finally
        {
            listener.Stop();
        }
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
        using var listener = new System.Net.Sockets.TcpListener(System.Net.IPAddress.Loopback, 0);
        listener.Start();
        var port = ((System.Net.IPEndPoint)listener.LocalEndpoint).Port;

        var serverTask = Task.Run(async () =>
        {
            for (var i = 0; i < 2; i++)
            {
                using var client = await listener.AcceptTcpClientAsync();
                using var stream = client.GetStream();
                var header = new byte[2];
                // ReadExactlyAsync guarantees the framing bytes (CA2022).
                await stream.ReadExactlyAsync(header.AsMemory(0, 2));
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
                var match = body.GetProperty("requestFields").EnumerateArray()
                    .Where(f => f.GetProperty("bitNumber").GetInt32() == bit)
                    .Select(f => f.GetProperty("value").GetString())
                    .FirstOrDefault();
                return match ?? "";
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
