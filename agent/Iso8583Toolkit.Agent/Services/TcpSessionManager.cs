using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using Iso8583Toolkit.Agent.Hubs;
using Iso8583Toolkit.Agent.Models;
using Iso8583Toolkit.Simulator.Protocol;
using Microsoft.AspNetCore.SignalR;

namespace Iso8583Toolkit.Agent.Services;

/// <summary>
/// Owns local TCP listener sessions and bridges them to the in-memory store
/// + SignalR hub for real-time UI updates. Standalone — no broker required.
/// </summary>
public sealed class TcpSessionManager
{
    private readonly ILogger<TcpSessionManager> _logger;
    private readonly LocalSessionStore _store;
    private readonly IHubContext<SimulatorHub> _hub;
    private readonly ConcurrentDictionary<string, ActiveSession> _sessions = new();

    public TcpSessionManager(
        ILogger<TcpSessionManager> logger,
        LocalSessionStore store,
        IHubContext<SimulatorHub> hub)
    {
        _logger = logger;
        _store = store;
        _hub = hub;
    }

    /// <summary>Spawns the TCP listener loop in the background and returns immediately.</summary>
    public async Task<SimulatorSession> StartSessionAsync(SessionConfig config, CancellationToken ct)
    {
        if (_sessions.ContainsKey(config.SessionId))
            throw new InvalidOperationException($"Session '{config.SessionId}' is already running.");

        // Validate mode-specific config up front so the user gets a clear error
        // instead of a low-level socket exception.
        if (config.Mode == SimulatorMode.Injetor)
        {
            if (string.IsNullOrWhiteSpace(config.TargetHost))
                throw new InvalidOperationException("Injetor mode requires TargetHost.");
            if (config.TargetPort is null or <= 0)
                throw new InvalidOperationException("Injetor mode requires TargetPort.");
        }

        var session = new SimulatorSession
        {
            SessionId = config.SessionId,
            TcpPort = config.TcpPort,
            Mode = config.Mode,
            Role = config.Role,
            LayoutName = config.LayoutName,
            DefaultResponseCode = config.DefaultResponseCode ?? "00",
            ValidateArqc = config.ValidateArqc,
            AutoRespond = config.AutoRespond,
            TargetHost = config.TargetHost,
            TargetPort = config.TargetPort,
            HeaderSize = config.HeaderSize,
            EmvResponse = config.EmvResponse,
            Status = SessionStatus.Starting
        };
        _store.AddSession(session);

        var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);

        if (config.Mode == SimulatorMode.Injetor)
        {
            // Outbound: connect to the configured remote endpoint and keep the
            // stream open. The /inject endpoint pulls bytes through this client.
            var client = new TcpClient();
            var active = new ActiveSession(config, Listener: null, Client: client, cts);
            if (!_sessions.TryAdd(config.SessionId, active))
                throw new InvalidOperationException($"Session '{config.SessionId}' already exists.");

            try
            {
                await client.ConnectAsync(config.TargetHost!, config.TargetPort!.Value, cts.Token);
                session.Status = SessionStatus.Active;
            }
            catch (Exception ex)
            {
                session.Status = SessionStatus.Error;
                session.LastError = ex.Message;
                _sessions.TryRemove(config.SessionId, out _);
                client.Dispose();
                throw new InvalidOperationException(
                    $"Failed to connect to {config.TargetHost}:{config.TargetPort}: {ex.Message}", ex);
            }

            // Spawn a passive reader so any response from the remote ends up in the log.
            _ = Task.Run(() => InjetorReadLoop(active, session, cts.Token), cts.Token);

            _ = SimulatorHubEvents.SessionStarted(_hub, session);
            return session;
        }

        // Rebatedor: local listener.
        var listener = new TcpListener(IPAddress.Any, config.TcpPort);
        var listenActive = new ActiveSession(config, Listener: listener, Client: null, cts);

        if (!_sessions.TryAdd(config.SessionId, listenActive))
            throw new InvalidOperationException($"Session '{config.SessionId}' already exists.");

        try
        {
            listener.Start();
            session.Status = SessionStatus.Active;
        }
        catch (SocketException ex)
        {
            session.Status = SessionStatus.Error;
            session.LastError = ex.Message;
            _sessions.TryRemove(config.SessionId, out _);
            throw new InvalidOperationException(
                $"Failed to bind TCP port {config.TcpPort}: {ex.Message}", ex);
        }

        _ = Task.Run(() => AcceptLoop(listenActive, session, cts.Token), cts.Token);

        _ = SimulatorHubEvents.SessionStarted(_hub, session);
        return session;
    }

    /// <summary>Returns the live outbound TCP client for an Injetor session, or null when not applicable.</summary>
    public TcpClient? GetInjetorClient(string sessionId) =>
        _sessions.TryGetValue(sessionId, out var s) ? s.Client : null;

    public async Task StopSessionAsync(string sessionId)
    {
        if (_sessions.TryRemove(sessionId, out var session))
        {
            await session.Cts.CancelAsync();
            // Dispose calls Stop internally and releases the socket handle —
            // covers the IDisposable contract CodeQL expects.
            session.Listener?.Dispose();
            session.Client?.Dispose();
        }

        var s = _store.GetSession(sessionId);
        if (s is not null)
        {
            s.Status = SessionStatus.Stopped;
            s.StoppedAt = DateTime.UtcNow;
            await SimulatorHubEvents.SessionStopped(_hub, s);
        }
        _store.RemoveSession(sessionId);
    }

    public bool IsSessionActive(string sessionId) => _sessions.ContainsKey(sessionId);

    public IEnumerable<string> GetActiveSessionIds() => _sessions.Keys;

    private async Task AcceptLoop(ActiveSession active, SimulatorSession session, CancellationToken ct)
    {
        try
        {
            while (!ct.IsCancellationRequested)
            {
                // Cannot use `using var` here: the client's lifetime extends
                // into the Task.Run lambda below, which owns disposal in its
                // own finally block (line ~178). lgtm[cs/local-not-disposed]
                TcpClient client;
                try
                {
                    client = await active.Listener!.AcceptTcpClientAsync(ct);
                }
                catch (OperationCanceledException) { break; }
                catch (SocketException ex) when (ex.SocketErrorCode == SocketError.OperationAborted) { break; }

                _logger.LogInformation("Client connected from {Remote}", client.Client.RemoteEndPoint);
                var handler = new IsoSessionHandler(_logger, active.Config, _store, _hub);

                _ = Task.Run(async () =>
                {
                    try
                    {
                        if (active.Config.Mode == SimulatorMode.Rebatedor)
                            await handler.HandleRebatedorAsync(client, ct);
                    }
                    catch (Exception ex) { _logger.LogError(ex, "Handler error"); }
                    finally { client.Dispose(); }
                }, ct);
            }
        }
        finally
        {
            active.Listener?.Dispose();
            session.Status = SessionStatus.Stopped;
            session.StoppedAt = DateTime.UtcNow;
        }
    }

    /// <summary>
    /// Passive read loop for an Injetor connection — drains the outbound TCP stream
    /// so responses from the remote system are surfaced via <see cref="IsoSessionHandler"/>
    /// (parsing + hub events). Bytes injected via /inject are written by the controller.
    /// </summary>
    private async Task InjetorReadLoop(ActiveSession active, SimulatorSession session, CancellationToken ct)
    {
        try
        {
            var handler = new IsoSessionHandler(_logger, active.Config, _store, _hub);
            // The handler's HandleRebatedorAsync is a generic "frame + parse + emit" loop;
            // for the Injetor we reuse it to read replies from the remote socket.
            await handler.HandleRebatedorAsync(active.Client!, ct);
        }
        // lgtm[cs/empty-catch-block] cancellation is the normal shutdown path
        catch (OperationCanceledException) { }
        catch (Exception ex) { _logger.LogError(ex, "Injetor read loop error"); }
        finally
        {
            session.Status = SessionStatus.Stopped;
            session.StoppedAt = DateTime.UtcNow;
        }
    }

    private sealed record ActiveSession(
        SessionConfig Config,
        TcpListener? Listener,
        TcpClient? Client,
        CancellationTokenSource Cts);
}
