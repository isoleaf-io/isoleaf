using System.Diagnostics;
using System.Net.Sockets;
using System.Text;
using Iso8583Toolkit.Agent.Hubs;
using Iso8583Toolkit.IsoCore.Domain.Exceptions;
using Iso8583Toolkit.IsoCore.Layouts;
using Iso8583Toolkit.IsoCore.Parsing;
using Iso8583Toolkit.Simulator.Protocol;
using Iso8583Toolkit.Simulator.Framing;
using Iso8583Toolkit.Simulator.Logging;
using Iso8583Toolkit.Simulator.Responder;
using Iso8583Toolkit.Simulator.Sessions;
using Microsoft.AspNetCore.SignalR;

namespace Iso8583Toolkit.Agent.Services;

/// <summary>
/// Handles ISO 8583 message processing for a single TCP connection.
/// Appends every message to the injected <see cref="IMessageLog"/> (audit
/// trail) and reads/mutates session state via <see cref="ISessionStore"/>.
/// Emits real-time events through <see cref="SimulatorHub"/>.
/// </summary>
public sealed class IsoSessionHandler
{
    private readonly ILogger _logger;
    private readonly SessionConfig _config;
    private readonly IMessageLog _log;
    private readonly ISessionStore _sessions;
    private readonly IHubContext<SimulatorHub> _hub;
    private readonly IsoParser _parser = new();
    private readonly AutoResponder _responder = new();
    private readonly IMessageFramer _framer;
    private readonly IsoLayout _layout = IsoLayout.Default();

    public IsoSessionHandler(
        ILogger logger,
        SessionConfig config,
        IMessageLog log,
        ISessionStore sessions,
        IHubContext<SimulatorHub> hub)
    {
        _logger = logger;
        _config = config;
        _log = log;
        _sessions = sessions;
        _hub = hub;
        _framer = new LengthPrefixMessageFramer(config.HeaderSize);
    }

    /// <summary>
    /// Strips CR/LF from a string before sending it to the logger. The MTI
    /// and other ISO-wire-derived strings logged below are technically
    /// parsed bytes from an untrusted peer, so we defend against log forging
    /// (CWE-117) even though they SHOULD be 4 ASCII digits in practice.
    /// </summary>
    private static string Safe(string? s) =>
        s?.Replace("\r", "\\r").Replace("\n", "\\n") ?? "";

    public async Task HandleRebatedorAsync(TcpClient client, CancellationToken ct)
    {
        using var stream = client.GetStream();
        var remoteEp = client.Client.RemoteEndPoint?.ToString() ?? "unknown";

        // HeaderSize=0 (un-framed mode) follows the "1 connect = 1 message"
        // convention used by POS terminals: read everything until the peer
        // closes, process it once, and exit. Looping would block forever on
        // the next CopyToAsync since the peer already closed.
        var oneShot = _config.HeaderSize == 0;

        try
        {
            while (!ct.IsCancellationRequested && client.Connected)
            {
                var framedBytes = await _framer.ReadMessageAsync(stream, ct);
                if (framedBytes is null) break;

                await ProcessOneMessageAsync(stream, framedBytes, ct);

                if (oneShot) break;
            }
        }
        // lgtm[cs/empty-catch-block] cancellation is the normal shutdown path
        catch (OperationCanceledException) { }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Connection error from {Remote}", remoteEp);
            await SimulatorHubEvents.Error(_hub, _config.SessionId, ex.Message);
        }
    }

    /// <summary>
    /// Single-message pipeline: TPDU policy → parse → optional respond.
    /// Exposed (internal) for unit testing the TpduMode behavior without a TCP socket.
    /// </summary>
    internal async Task<MessageLogEntry?> ProcessOneMessageAsync(
        NetworkStream? stream, byte[] framedBytes, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        var modeName = _config.TpduMode.ToString();

        // ── Step 1: detect TPDU on the wire ────────────────────────────────
        var inboundHasTpdu = TpduBuilder.HasTpdu(framedBytes);
        string? incomingTpduHex = inboundHasTpdu
            ? Convert.ToHexString(framedBytes.AsSpan(0, 5))
            : null;

        // ── Step 2: apply TpduMode ─────────────────────────────────────────
        if (_config.TpduMode == TpduMode.Required && !inboundHasTpdu)
        {
            // Reject before parse — log + emit hub error, do NOT respond.
            var rejectedEntry = new MessageLogEntry
            {
                SessionId = _config.SessionId,
                Direction = MessageDirection.Received,
                AsciiMessage = Encoding.ASCII.GetString(framedBytes),
                BinaryHexMessage = Convert.ToHexString(framedBytes),
                Tpdu = null,
                TpduPresent = false,
                TpduMode = modeName,
                DecodedFields = [],
                HasErrors = true,
                Rejected = true,
                ErrorCode = "TPDU_REQUIRED",
                ValidationSummary = "Message rejected: TPDU required for this session",
                ProcessingMs = sw.ElapsedMilliseconds,
            };
            _log.LogMessage(rejectedEntry);
            IncrementSession("rejected");
            await SimulatorHubEvents.MessageReceived(_hub, rejectedEntry);
            await SimulatorHubEvents.Error(_hub, _config.SessionId,
                "TPDU_REQUIRED: message rejected — this session requires a TPDU prefix");
            return rejectedEntry;
        }

        // Strip mode drops any inbound TPDU so it never bleeds into the parsed message.
        var stripInbound = _config.TpduMode == TpduMode.Strip;
        var sliceTpdu = inboundHasTpdu && !stripInbound;

        byte[] tpdu = sliceTpdu ? framedBytes[..5] : [];
        var messageBytes = (inboundHasTpdu /* always strip on parse path */) ? framedBytes[5..] : framedBytes;

        // ── Step 3: parse ──────────────────────────────────────────────────
        // Latin1 preserves bytes 0x00..0xFF as-is (one byte = one char), avoiding
        // the corruption ASCII would cause for TPDU bytes (0x60-0x6F) and any
        // non-printable bytes on the wire. The parser expects this 1:1 mapping.
        var binaryHex = Convert.ToHexString(messageBytes);
        var asciiView = Encoding.Latin1.GetString(messageBytes);
        var (request, wasBinaryHex, parseError) = TryParse(messageBytes, asciiView, binaryHex);
        _logger.LogInformation(
            "Parse attempt: bytes={Len} mode={Mode} result={Result} mti={Mti}",
            messageBytes.Length, wasBinaryHex ? "binary-hex" : "ascii",
            request is null ? "fail" : "ok", Safe(request?.Mti ?? "-"));

        var inEntry = new MessageLogEntry
        {
            SessionId = _config.SessionId,
            Direction = MessageDirection.Received,
            AsciiMessage = asciiView,
            BinaryHexMessage = binaryHex,
            Tpdu = stripInbound ? null : incomingTpduHex,
            TpduPresent = inboundHasTpdu && !stripInbound,
            TpduMode = modeName,
            DecodedMti = request?.Mti,
            DecodedFields = request is null ? [] : DecodedFromMessage(request),
            HasErrors = parseError is not null,
            ValidationSummary = parseError,
            ProcessingMs = sw.ElapsedMilliseconds,
        };
        _log.LogMessage(inEntry);
        IncrementSession(parseError is null ? "received" : "rejected");
        await SimulatorHubEvents.MessageReceived(_hub, inEntry);

        if (!_config.AutoRespond || request is null) return inEntry;

        // ── Step 4: respond, honoring TpduMode for the outbound side ──────
        try
        {
            // Resolve unknown-MTI policy before building the response so we can
            // log/emit explicit feedback when the simulator chooses to stay silent.
            var rules = _config.Rules ?? new ResponseRules();
            var resolution = AutoResponder.ResolveResponseMti(request.Mti, rules, _config);
            var mtiWasUnmapped = !rules.MtiResponseMap.ContainsKey(request.Mti);

            _logger.LogInformation(
                "AutoResponder: requestMti={Mti} mapped={Mapped} policy={Policy} responseMti={Response} action={Action}",
                Safe(request.Mti), !mtiWasUnmapped, _config.UnknownMtiResponse,
                Safe(resolution.ResponseMti ?? "<null>"), Safe(resolution.ActionDescription ?? "-"));

            if (resolution.ResponseMti is null)
            {
                _logger.LogWarning(
                    "AutoResponder did not produce a response for MTI={Mti}: {Reason}",
                    Safe(request.Mti), Safe(resolution.ActionDescription));

                // Policy says don't answer (Reject, undirivable Derive, missing Custom).
                var rejected = new MessageLogEntry
                {
                    SessionId = _config.SessionId,
                    Direction = MessageDirection.Received,
                    AsciiMessage = asciiView,
                    BinaryHexMessage = binaryHex,
                    Tpdu = stripInbound ? null : incomingTpduHex,
                    TpduPresent = inboundHasTpdu && !stripInbound,
                    TpduMode = modeName,
                    DecodedMti = request.Mti,
                    DecodedFields = DecodedFromMessage(request),
                    HasErrors = true,
                    Rejected = true,
                    ErrorCode = "UNKNOWN_MTI",
                    UnknownMtiAction = resolution.ActionDescription,
                    ValidationSummary = resolution.ActionDescription,
                    ProcessingMs = sw.ElapsedMilliseconds,
                };
                _log.LogMessage(rejected);
                IncrementSession("rejected");
                await SimulatorHubEvents.MessageReceived(_hub, rejected);
                await SimulatorHubEvents.Error(_hub, _config.SessionId,
                    $"UNKNOWN_MTI: {request.Mti} — {resolution.ActionDescription}");
                return rejected;
            }

            // Build + serialise the response — wrap in an inner try so a failure
            // here (e.g. weird field values that BuildResponseHex can't echo back)
            // doesn't silently kill the connection. We send a minimal error frame
            // (MTI flipped + RC=96) so the remote sees a real response instead of
            // EOF/timeout.
            // Refresh the EMV config from the live session record so the
            // frontend's PATCH endpoint affects the NEXT message without
            // requiring session restart. Other fields on _config are static
            // for the connection's lifetime.
            var liveSession = _sessions.GetSession(_config.SessionId);
            var effectiveConfig = liveSession is null
                ? _config
                : _config with { EmvResponse = liveSession.EmvResponse };

            string responseHex;
            try
            {
                var built = _responder.BuildResponseHex(request, effectiveConfig, _layout);
                if (built is null) return inEntry;
                responseHex = built;
            }
            catch (Exception buildEx)
            {
                _logger.LogError(buildEx,
                    "Response build failed for MTI={Mti} — sending minimal error response (RC=96)",
                    Safe(request.Mti));
                responseHex = BuildMinimalErrorResponseHex(ResponseMti(request.Mti), "96");
            }

            // BuildResponseHex always emits an ASCII wire (printable digits + hex bitmap
            // + raw field values). When the inbound was binary-hex we mirror by encoding
            // each ASCII byte as two hex chars — this is the inverse of how the wire was
            // received. `Convert.FromHexString` on the ASCII wire directly would crash on
            // any non-hex byte (auth code, merchant name, etc).
            byte[] responseBytes;
            if (wasBinaryHex)
            {
                var asciiBytes = Encoding.ASCII.GetBytes(responseHex);
                responseBytes = Encoding.ASCII.GetBytes(Convert.ToHexString(asciiBytes));
            }
            else
            {
                responseBytes = Encoding.ASCII.GetBytes(responseHex);
            }

            var outboundUseTpdu = _config.EffectiveUseTpdu(inboundHasTpdu);
            string? outboundTpduHex = null;

            if (outboundUseTpdu)
            {
                // Required: inbound TPDU is guaranteed (we'd have rejected otherwise).
                // Optional: inbound had TPDU (otherwise EffectiveUseTpdu returned false).
                // Auto: respect whatever the legacy heuristic picked.
                var tpduBytes = tpdu.Length == 5
                    ? InvertedTpduBytes(tpdu)
                    : Convert.FromHexString(TpduBuilder.GenerateAuto());
                outboundTpduHex = Convert.ToHexString(tpduBytes);

                var combined = new byte[5 + responseBytes.Length];
                Buffer.BlockCopy(tpduBytes, 0, combined, 0, 5);
                Buffer.BlockCopy(responseBytes, 0, combined, 5, responseBytes.Length);
                responseBytes = combined;
            }

            if (stream is not null)
                await _framer.WriteMessageAsync(stream, responseBytes, ct);

            var outEntry = new MessageLogEntry
            {
                SessionId = _config.SessionId,
                Direction = MessageDirection.Sent,
                AsciiMessage = responseHex,
                BinaryHexMessage = Convert.ToHexString(responseBytes),
                Tpdu = outboundTpduHex,
                TpduPresent = outboundTpduHex is not null,
                TpduMode = modeName,
                DecodedMti = resolution.ResponseMti,
                // Only annotate the outbound entry when the request MTI required
                // policy-driven resolution (Derive/Echo/Custom). Plain map hits stay clean.
                UnknownMtiAction = mtiWasUnmapped ? resolution.ActionDescription : null,
                ProcessingMs = sw.ElapsedMilliseconds,
            };
            _log.LogMessage(outEntry);
            await SimulatorHubEvents.MessageSent(_hub, outEntry);
            return outEntry;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing message");
            await SimulatorHubEvents.Error(_hub, _config.SessionId, ex.Message);
            return inEntry;
        }
    }

    private static byte[] InvertedTpduBytes(byte[] tpdu)
    {
        // dest ↔ src swap (id byte preserved).
        var inv = new byte[5];
        inv[0] = tpdu[0];
        inv[1] = tpdu[3];
        inv[2] = tpdu[4];
        inv[3] = tpdu[1];
        inv[4] = tpdu[2];
        return inv;
    }

    private static string ResponseMti(string requestMti)
    {
        if (requestMti.Length != 4) return requestMti;
        var chars = requestMti.ToCharArray();
        if (char.IsAsciiDigit(chars[2])) chars[2] = (char)(chars[2] + 1);
        return new string(chars);
    }

    /// <summary>
    /// Last-resort response when the full <see cref="AutoResponder.BuildResponseHex"/>
    /// pipeline blows up — typically because the inbound message has field
    /// values the responder can't echo back into the layout (e.g. binary TLV
    /// in Bit 55 that the responder tries to re-serialise as ASCII). The
    /// minimal wire is MTI + bitmap-with-only-bit-39 + the supplied error
    /// RC, hand-rolled so it can't itself fail.
    /// Exposed (internal) so unit tests can pin the wire shape without
    /// running the whole TCP pipeline.
    /// </summary>
    internal static string BuildMinimalErrorResponseHex(string responseMti, string errorRc)
    {
        if (string.IsNullOrEmpty(responseMti) || responseMti.Length != 4)
            responseMti = "9999"; // last-ditch fallback
        if (string.IsNullOrEmpty(errorRc) || errorRc.Length != 2)
            errorRc = "96";

        // Bit 39 → 1-based; bitmap byte index = (39-1)/8 = 4; bit-in-byte
        // (MSB first) = 7 - ((39-1) % 8) = 1 → bit mask 0x02.
        var bitmap = new byte[8];
        bitmap[4] = 0x02;
        var bitmapHex = Convert.ToHexString(bitmap); // "0000000002000000"

        return responseMti + bitmapHex + errorRc;
    }

    private void IncrementSession(string kind)
    {
        var s = _sessions.GetSession(_config.SessionId);
        if (s is null) return;
        if (kind == "received") s.MessagesProcessed++;
        else s.MessagesRejected++;
    }

    private static List<DecodedField> DecodedFromMessage(IsoCore.Domain.IsoMessage msg) =>
        msg.Fields.Values
            .OrderBy(f => f.BitNumber)
            .Select(f => new DecodedField(
                f.BitNumber,
                f.Definition.Name,
                f.RawValue,
                MaskField(f.BitNumber, f.RawValue)))
            .ToList();

    private static string MaskField(int bit, string value) => bit switch
    {
        2 when value.Length > 10 => value[..6] + new string('*', value.Length - 10) + value[^4..],
        35 when value.Length > 10 => value[..6] + "****" + value[^4..],
        52 => "****************",
        _ => value,
    };

    /// <summary>
    /// Auto-detects the wire format and parses accordingly. Two candidate decodings:
    ///   - Binary-hex wire: every byte is an ASCII hex digit, and when the byte
    ///     stream is reinterpreted as a hex string and decoded, the first 4 bytes
    ///     form a valid MTI. The parser takes the hex *string* (asciiView) directly.
    ///   - ASCII wire: bytes are the printable wire characters (MTI/bitmap/values).
    ///     The parser also takes the Latin-1 string view.
    /// We prefer binary-hex when the heuristic recognises it; the recursive MTI check
    /// guards against false positives where a plain ASCII wire happens to start with
    /// 4 digits (and would otherwise be confused with a binary-hex stream).
    /// </summary>
    private (IsoCore.Domain.IsoMessage? msg, bool wasBinaryHex, string? error) TryParse(
        byte[] rawBytes, string asciiView, string binaryHex)
    {
        _ = binaryHex; // unused — kept in signature for backward-compat with the older shape.

        if (LooksLikeBinaryHex(rawBytes))
        {
            // asciiView is the hex *string* — exactly what ParseFromBinaryHex expects.
            try { return (_parser.ParseFromBinaryHex(asciiView, _layout), true, null); }
            catch (IsoParseException) { /* fall through to ASCII */ }
            catch (ArgumentException) { /* not valid hex — ignore */ }
        }

        // Plain ASCII wire.
        try { return (_parser.ParseFromHex(asciiView, _layout), false, null); }
        catch (IsoParseException ex) { return (null, false, ex.Message); }
    }

    /// <summary>
    /// Returns <c>true</c> when the byte stream looks like the binary-hex wire format:
    /// every byte is an ASCII hex digit AND interpreting the first 8 bytes as a hex
    /// string decodes to a valid 4-digit MTI.
    /// </summary>
    private static bool LooksLikeBinaryHex(byte[] data)
    {
        if (data.Length < 8 || (data.Length & 1) != 0) return false;

        for (var i = 0; i < data.Length; i++)
        {
            if (!char.IsAsciiHexDigit((char)data[i])) return false;
        }

        try
        {
            var headHex = Encoding.ASCII.GetString(data, 0, 8);
            var mti = Encoding.ASCII.GetString(Convert.FromHexString(headHex));
            if (MtiParser.IsValid(mti)) return true;

            // TPDU heuristic: 5 bytes = 10 hex chars, MTI at hex offset 10..18.
            if (data.Length >= 18)
            {
                var firstByteHex = Encoding.ASCII.GetString(data, 0, 2);
                var firstByte = Convert.FromHexString(firstByteHex)[0];
                var looksLikeTpdu = (firstByte >= 0x60 && firstByte <= 0x6F)
                                    || firstByte < 0x20
                                    || firstByte >= 0x7F;
                if (looksLikeTpdu)
                {
                    var afterTpduHex = Encoding.ASCII.GetString(data, 10, 8);
                    var mtiAfter = Encoding.ASCII.GetString(Convert.FromHexString(afterTpduHex));
                    if (MtiParser.IsValid(mtiAfter)) return true;
                }
            }
            return false;
        }
        catch
        {
            return false;
        }
    }
}
