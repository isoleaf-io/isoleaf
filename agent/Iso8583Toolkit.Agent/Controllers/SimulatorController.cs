using System.Net.Sockets;
using System.Text;
using Iso8583Toolkit.Agent.Hubs;
using Iso8583Toolkit.Agent.Models;
using Iso8583Toolkit.Agent.Services;
using Iso8583Toolkit.Simulator.Protocol;
using Microsoft.AspNetCore.Mvc;

namespace Iso8583Toolkit.Agent.Controllers;

[ApiController]
[Route("api/simulator")]
public sealed class SimulatorController : ControllerBase
{
    private readonly LocalSessionStore _store;
    private readonly TcpSessionManager _manager;
    private readonly IHostApplicationLifetime _lifetime;
    private readonly ILogger<SimulatorController> _logger;

    public SimulatorController(
        LocalSessionStore store, TcpSessionManager manager,
        IHostApplicationLifetime lifetime, ILogger<SimulatorController> logger)
    {
        _store = store;
        _manager = manager;
        _lifetime = lifetime;
        _logger = logger;
    }

    [HttpGet("sessions")]
    public IActionResult ListSessions() => Ok(_store.GetActiveSessions());

    [HttpPost("sessions")]
    public async Task<IActionResult> StartSession([FromBody] StartSessionRequest request)
    {
        var config = request.Config ?? new SessionConfig();
        try
        {
            var session = await _manager.StartSessionAsync(config, _lifetime.ApplicationStopping);
            return Ok(session);
        }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    [HttpGet("sessions/{id}")]
    public IActionResult GetSession(string id)
    {
        var s = _store.GetSession(id);
        return s is null ? NotFound() : Ok(s);
    }

    [HttpDelete("sessions/{id}")]
    public async Task<IActionResult> StopSession(string id)
    {
        await _manager.StopSessionAsync(id);
        return NoContent();
    }

    /// <summary>
    /// Updates the Issuer-role Bit-55 handling for a running session. The
    /// next inbound message will use the new config — no restart needed.
    /// </summary>
    [HttpPut("sessions/{id}/emv-config")]
    public IActionResult UpdateEmvConfig(string id, [FromBody] EmvResponseConfig config)
    {
        var session = _store.GetSession(id);
        if (session is null) return NotFound(new { error = $"Session '{id}' not found." });
        session.EmvResponse = config ?? EmvResponseConfig.Default;
        return Ok(new { sessionId = id, emvResponse = session.EmvResponse });
    }

    [HttpPost("sessions/{id}/inject")]
    public async Task<IActionResult> Inject(string id, [FromBody] InjectMessageRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.HexMessage))
            return BadRequest(new { error = "HexMessage is required." });

        var session = _store.GetSession(id);
        if (session is null) return NotFound(new { error = $"Session '{id}' not found." });

        try
        {
            var bytes = Encoding.ASCII.GetBytes(request.HexMessage);
            var lenPrefix = new[] { (byte)((bytes.Length >> 8) & 0xFF), (byte)(bytes.Length & 0xFF) };

            if (session.Mode == SimulatorMode.Injetor)
            {
                // Injetor: write into the live outbound connection that was established
                // when the session was started — the read loop will surface any reply.
                var client = _manager.GetInjetorClient(id);
                if (client is null || !client.Connected)
                    return BadRequest(new { error = "Injetor session has no live outbound connection." });
                var stream = client.GetStream();
                await stream.WriteAsync(lenPrefix);
                await stream.WriteAsync(bytes);
                return Accepted(new { sessionId = id, injected = bytes.Length, mode = "Injetor" });
            }

            // Rebatedor: legacy loopback path — opens a one-shot connection into the
            // local listener so users can fire test messages without a real terminal.
            using var loopback = new TcpClient();
            await loopback.ConnectAsync("127.0.0.1", session.TcpPort);
            using var loopbackStream = loopback.GetStream();
            await loopbackStream.WriteAsync(lenPrefix);
            await loopbackStream.WriteAsync(bytes);
            return Accepted(new { sessionId = id, injected = bytes.Length, mode = "Rebatedor (loopback)" });
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    /// <summary>
    /// Fire-and-await: one TCP connect, one frame out, one frame back, close.
    /// Used by the InjectorPanel for both single-shot and continuous load scenarios.
    /// </summary>
    [HttpPost("inject-direct")]
    public async Task<IActionResult> InjectDirect([FromBody] InjectDirectRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(new InjectDirectResponse(Success: false, Error: "Message is required."));
        if (string.IsNullOrWhiteSpace(request.TargetHost))
            return BadRequest(new InjectDirectResponse(Success: false, Error: "TargetHost is required."));
        if (request.TargetPort <= 0 || request.TargetPort >= 65536)
            return BadRequest(new InjectDirectResponse(Success: false, Error: "TargetPort must be in 1..65535."));

        // TargetHost comes straight from the HTTP request body — strip CR/LF
        // before logging to defend against log forging (CWE-117).
        var safeTargetHost = request.TargetHost?.Replace("\r", "\\r").Replace("\n", "\\n") ?? "";
        _logger.LogInformation(
            "InjectDirect called: VaryIdentifiers={VaryId}, VaryAmount={VaryAmt}, MessageLength={Len}, Target={Host}:{Port}",
            request.VaryIdentifiers, request.VaryAmount, request.Message?.Length ?? 0,
            safeTargetHost, request.TargetPort);

        var sw = System.Diagnostics.Stopwatch.StartNew();
        var rawMsg = request.Message!.Trim();

        // If the user pasted a wire that already starts with a length prefix
        // (e.g. "0171303230..."), strip it before parsing — otherwise the
        // prefix bytes leak into the body and the receiver fails on the MTI.
        // The detected prefix is echoed back to the UI so the user can see
        // what was found.
        var (msg, detectedPrefix) = Iso8583Toolkit.IsoCore.Parsing.IsoWireHelper.StripLengthPrefix(rawMsg);

        // Convert the message to bytes. We accept ASCII wire or binary-hex.
        // The heuristic "every char is hex" is ambiguous — most ASCII wires are
        // also all-hex (numeric MTI + hex bitmap + numeric fields). So we
        // disambiguate by *parsing* both ways and trusting the one that succeeds:
        //   1. Try the ASCII-wire path first (most common, includes simulator builder output).
        //   2. Only if that fails AND the input looks hex, treat it as binary-hex.
        byte[] bodyBytes;
        bool wasHexEncoded;
        try
        {
            // ASCII wire is the safe default — preserves the original byte layout.
            _ = new Iso8583Toolkit.IsoCore.Parsing.IsoParser().ParseFromHex(msg);
            bodyBytes = Encoding.ASCII.GetBytes(msg);
            wasHexEncoded = false;
        }
        catch
        {
            // ASCII path didn't parse — try binary-hex if the input is a clean hex string.
            if (Iso8583Toolkit.IsoCore.Parsing.IsoWireHelper.IsBinaryHex(msg))
            {
                try { bodyBytes = Convert.FromHexString(msg); }
                catch (FormatException ex)
                {
                    return Ok(new InjectDirectResponse(Success: false, Error: $"Invalid hex: {ex.Message}"));
                }
                wasHexEncoded = true;
            }
            else
            {
                // Best-effort: send as ASCII anyway so the remote can complain
                // with a real error rather than us silently bailing.
                bodyBytes = Encoding.ASCII.GetBytes(msg);
                wasHexEncoded = false;
            }
        }

        // Apply per-send variations (refresh STAN/timestamps, randomise amount) if requested.
        // Best-effort: parse + mutate + re-serialise. If parsing fails the original bytes flow through.
        if (request.VaryIdentifiers || request.VaryAmount)
        {
            bodyBytes = InjectVariationService.Apply(
                bodyBytes,
                wasHexEncoded,
                request.VaryIdentifiers,
                request.VaryAmount,
                request.AmountMin,
                request.AmountMax,
                layout: null,
                logger: _logger);
        }

        // Capture the request-as-sent (after variations) so the UI can show the
        // STAN/RRN/timestamps that actually went on the wire. This is what proves
        // the variation flag was effective end-to-end.
        var requestBodyBytes = bodyBytes;

        // Optional TPDU prefix — 5 raw bytes prepended on the wire.
        if (request.IncludeTpdu)
        {
            try
            {
                var tpduHex = string.IsNullOrWhiteSpace(request.TpduOverride)
                    ? Iso8583Toolkit.Simulator.Protocol.TpduBuilder.GenerateAuto()
                    : request.TpduOverride!;
                var tpduBytes = Convert.FromHexString(tpduHex);
                if (tpduBytes.Length != 5)
                    return Ok(new InjectDirectResponse(Success: false, Error: "TPDU must be exactly 5 bytes (10 hex chars)."));
                var combined = new byte[tpduBytes.Length + bodyBytes.Length];
                Buffer.BlockCopy(tpduBytes, 0, combined, 0, tpduBytes.Length);
                Buffer.BlockCopy(bodyBytes, 0, combined, tpduBytes.Length, bodyBytes.Length);
                bodyBytes = combined;
            }
            catch (FormatException ex)
            {
                return Ok(new InjectDirectResponse(Success: false, Error: $"Invalid TPDU hex: {ex.Message}"));
            }
        }

        // 2-byte big-endian length prefix is the framing most rebatedores use.
        // Optional — the InjectorPanel exposes this via a UI toggle so users
        // can test receivers that expect un-framed bytes too.
        var lenPrefix = request.IncludeLengthPrefix
            ? new[] { (byte)((bodyBytes.Length >> 8) & 0xFF), (byte)(bodyBytes.Length & 0xFF) }
            : null;

        try
        {
            using var client = new TcpClient();
            using var connectCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            try
            {
                await client.ConnectAsync(request.TargetHost, request.TargetPort, connectCts.Token);
            }
            catch (OperationCanceledException)
            {
                return Ok(new InjectDirectResponse(Success: false, Error: "Connection timeout (5s)."));
            }
            catch (SocketException ex)
            {
                return Ok(new InjectDirectResponse(
                    Success: false,
                    Error: $"Connection refused to {request.TargetHost}:{request.TargetPort} ({ex.SocketErrorCode})."));
            }

            using var stream = client.GetStream();
            if (lenPrefix is not null)
                await stream.WriteAsync(lenPrefix);
            await stream.WriteAsync(bodyBytes);

            // Un-framed mode: half-close the send side so the rebatedor's
            // read-until-close drain sees EOF and knows the message is over.
            // Without this both sides deadlock — the injetor waits for a
            // response, the rebatedor waits for the connection to close.
            // We can still read the response on the receive half-channel.
            if (!request.IncludeLengthPrefix)
                client.Client.Shutdown(System.Net.Sockets.SocketShutdown.Send);

            using var readCts = new CancellationTokenSource(TimeSpan.FromSeconds(30));
            byte[] respBody;
            try
            {
                // The response is framed iff the request was — symmetric framing
                // is the convention. When un-framed, the rebatedor signals end of
                // message by closing its own send side, so we drain to EOF.
                respBody = request.IncludeLengthPrefix
                    ? await ReadFramedAsync(stream, readCts.Token)
                    : await ReadUntilCloseAsync(stream, readCts.Token);
            }
            catch (OperationCanceledException)
            {
                return Ok(new InjectDirectResponse(Success: false, Error: "Response timeout (30s)."));
            }
            catch (IOException ex) when (ex.Message.Contains("Connection closed", StringComparison.Ordinal))
            {
                // The peer closed mid-frame — most common cause is a mismatch
                // between Injetor's IncludeLengthPrefix and Rebatedor's
                // HeaderSize. The old surfacing was "Message cannot be null or
                // empty" later on; that hid the real cause.
                return Ok(new InjectDirectResponse(Success: false,
                    Error: BuildFramingMismatchError(request.IncludeLengthPrefix)));
            }

            if (respBody.Length == 0)
            {
                // Un-framed mode + peer closed without writing anything.
                return Ok(new InjectDirectResponse(Success: false,
                    Error: BuildFramingMismatchError(request.IncludeLengthPrefix)));
            }

            sw.Stop();
            var respHex = Convert.ToHexString(respBody);
            var responseAscii = Encoding.Latin1.GetString(respBody);

            // Best-effort parse of the response — failure is non-fatal, we still return the raw bytes.
            string? respMti = null, respRc = null, parseError = null;
            List<InjectDirectFieldDto> fields = new();
            try
            {
                // Strip a TPDU prefix if present so the parser sees the ISO message.
                var parseInput = responseAscii;
                if (respBody.Length >= 14 && respBody[0] is >= 0x60 and <= 0x6F)
                    parseInput = Encoding.Latin1.GetString(respBody, 5, respBody.Length - 5);

                var parser = new Iso8583Toolkit.IsoCore.Parsing.IsoParser();
                var msgParsed = parser.ParseFromHex(parseInput);
                respMti = msgParsed.Mti;
                respRc = msgParsed.GetFieldValue(39);
                fields = msgParsed.Fields.Values
                    .OrderBy(f => f.BitNumber)
                    .Select(f => new InjectDirectFieldDto(f.BitNumber, f.Definition.Name, f.RawValue))
                    .ToList();
            }
            catch (Exception ex)
            {
                parseError = $"Could not parse response: {ex.Message}";
            }

            // Best-effort parse of the request that just went out, so the UI can
            // display the STAN/RRN/timestamps that actually went on the wire.
            string? reqMti = null;
            List<InjectDirectFieldDto>? requestFields = null;
            try
            {
                var reqParser = new Iso8583Toolkit.IsoCore.Parsing.IsoParser();
                var reqString = wasHexEncoded
                    ? Encoding.Latin1.GetString(requestBodyBytes)
                    : Encoding.Latin1.GetString(requestBodyBytes);
                var reqParsed = wasHexEncoded
                    ? reqParser.ParseFromBinaryHex(reqString)
                    : reqParser.ParseFromHex(reqString);
                reqMti = reqParsed.Mti;
                requestFields = reqParsed.Fields.Values
                    .OrderBy(f => f.BitNumber)
                    .Select(f => new InjectDirectFieldDto(f.BitNumber, f.Definition.Name, f.RawValue))
                    .ToList();
            }
            catch { /* couldn't parse outgoing — UI just won't show request fields. */ }

            return Ok(new InjectDirectResponse(
                Success: true,
                ResponseHex: respHex,
                Mti: respMti,
                ResponseCode: respRc,
                ProcessingMs: sw.ElapsedMilliseconds,
                Fields: fields,
                Error: parseError,
                RequestHex: Convert.ToHexString(requestBodyBytes),
                RequestFields: requestFields,
                RequestMti: reqMti,
                DetectedLengthPrefix: detectedPrefix is null
                    ? null
                    : new DetectedLengthPrefixDto(
                        detectedPrefix.Hex,
                        detectedPrefix.ExpectedLength,
                        detectedPrefix.ActualLength,
                        detectedPrefix.Match)));
        }
        catch (Exception ex)
        {
            return Ok(new InjectDirectResponse(Success: false, Error: ex.Message));
        }
    }


    private static async Task<byte[]> ReadFramedAsync(NetworkStream stream, CancellationToken ct)
    {
        // Read the 2-byte length header.
        var header = new byte[2];
        await ReadExactAsync(stream, header, ct);
        var len = (header[0] << 8) | header[1];
        if (len <= 0 || len > 65535)
            throw new InvalidOperationException($"Invalid frame length {len}.");
        var body = new byte[len];
        await ReadExactAsync(stream, body, ct);
        return body;
    }

    /// <summary>
    /// Un-framed mode counterpart: drain the stream until the peer half-closes
    /// its send side. Used when <c>IncludeLengthPrefix=false</c> and the
    /// rebatedor responds without a length prefix.
    /// </summary>
    private static async Task<byte[]> ReadUntilCloseAsync(NetworkStream stream, CancellationToken ct)
    {
        using var ms = new MemoryStream();
        await stream.CopyToAsync(ms, ct);
        return ms.ToArray();
    }

    /// <summary>
    /// Friendly diagnostic for the most common cause of an empty/closed
    /// response: the Injetor and Rebatedor disagreeing on framing. Exposed
    /// (internal) so it can be unit-tested without standing up a TCP listener.
    /// </summary>
    internal static string BuildFramingMismatchError(bool injectorIncludeLengthPrefix)
    {
        var injectorMode = injectorIncludeLengthPrefix ? "ON" : "OFF";
        var expectedListenerMode = injectorIncludeLengthPrefix
            ? "HeaderSize=2 (Expect length prefix ON)"
            : "HeaderSize=0 (Expect length prefix OFF)";
        return $"Empty response — check Length prefix settings match between Injetor and Listener. " +
               $"Injetor: IncludeLengthPrefix={injectorMode}; Listener must be: {expectedListenerMode}.";
    }

    private static async Task ReadExactAsync(NetworkStream stream, byte[] buffer, CancellationToken ct)
    {
        var read = 0;
        while (read < buffer.Length)
        {
            var n = await stream.ReadAsync(buffer.AsMemory(read), ct);
            if (n <= 0) throw new IOException("Connection closed before reading full frame.");
            read += n;
        }
    }

    [HttpGet("log")]
    public IActionResult GetLog([FromQuery] int limit = 100) => Ok(_store.GetLog(null, limit));

    [HttpGet("log/{sessionId}")]
    public IActionResult GetLogBySession(string sessionId, [FromQuery] int limit = 100) =>
        Ok(_store.GetLog(sessionId, limit));

    [HttpDelete("log")]
    public IActionResult ClearLog() { _store.ClearLog(); return NoContent(); }
}

public sealed record StartSessionRequest(SessionConfig? Config = null);
public sealed record InjectMessageRequest(string HexMessage);

/// <summary>
/// Stateless injection: open a TCP connection, send one ISO 8583 message,
/// read the reply, close. Used by the InjectorPanel — no persistent session.
/// </summary>
public sealed record InjectDirectRequest(
    string TargetHost,
    int TargetPort,
    string Message,
    bool IncludeTpdu = false,
    string? TpduOverride = null,
    bool VaryIdentifiers = false,
    bool VaryAmount = false,
    // Amounts are in cents — the UI presents reais but converts on submit.
    long AmountMin = 100,
    long AmountMax = 50_000,
    // When true, prepend a 2-byte big-endian length prefix to the TCP frame
    // (the framing most rebatedores use). Default true preserves the existing
    // behavior for any callers that don't set it explicitly.
    bool IncludeLengthPrefix = true);

public sealed record InjectDirectFieldDto(int BitNumber, string Name, string Value);

public sealed record InjectDirectResponse(
    bool Success,
    string? ResponseHex = null,
    string? Mti = null,
    string? ResponseCode = null,
    long ProcessingMs = 0,
    List<InjectDirectFieldDto>? Fields = null,
    string? Error = null,
    /// <summary>Hex of the bytes actually sent (after any variations applied).</summary>
    string? RequestHex = null,
    /// <summary>Decoded fields of the bytes actually sent — lets the UI prove
    /// the variation flags refreshed STAN/timestamps/RRN on the wire.</summary>
    List<InjectDirectFieldDto>? RequestFields = null,
    /// <summary>MTI of the request (after variations).</summary>
    string? RequestMti = null,
    /// <summary>
    /// 2-byte length prefix that was detected at the start of the user's
    /// input wire and stripped before sending. Null when no plausible prefix
    /// was present. Useful for the UI to show "we noticed your wire already
    /// had a prefix and stripped it for you".
    /// </summary>
    DetectedLengthPrefixDto? DetectedLengthPrefix = null);

public sealed record DetectedLengthPrefixDto(
    string Hex,
    int ExpectedLength,
    int ActualLength,
    bool Match);
