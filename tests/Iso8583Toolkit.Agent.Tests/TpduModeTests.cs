using System.Text;
using FluentAssertions;
using Iso8583Toolkit.Agent.Services;
using Iso8583Toolkit.Simulator.Logging;
using Iso8583Toolkit.IsoCore.Building;
using Iso8583Toolkit.IsoCore.Layouts;
using Iso8583Toolkit.Simulator.Protocol;
using Iso8583Toolkit.Simulator.Sessions;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace Iso8583Toolkit.Integration.Tests;

/// <summary>
/// Exercises the TPDU policy matrix: how IsoSessionHandler treats each
/// <see cref="TpduMode"/> on inbound and outbound.
/// </summary>
public sealed class TpduModeTests
{
    private static readonly IsoLayout Layout = IsoLayout.Default();
    private static readonly ILogger Logger = NullLogger.Instance;

    private static byte[] AsciiBody(string mti = "0200")
    {
        // Minimal valid ASCII-wire message: MTI + primary bitmap (bits 3,4,11) + small fields.
        var hex = new IsoMessageBuilder()
            .WithMti(mti)
            .WithLayout(Layout)
            .WithField(3, "000000")
            .WithField(4, "000000001000")
            .WithField(11, "000001")
            .BuildHex();
        return Encoding.ASCII.GetBytes(hex);
    }

    private static byte[] WithTpdu(string tpduHex, byte[] body)
    {
        var tpdu = Convert.FromHexString(tpduHex);
        var combined = new byte[tpdu.Length + body.Length];
        Buffer.BlockCopy(tpdu, 0, combined, 0, tpdu.Length);
        Buffer.BlockCopy(body, 0, combined, tpdu.Length, body.Length);
        return combined;
    }

    private static (IsoSessionHandler handler, InMemoryMessageLog store) Build(SessionConfig config)
    {
        var store = new InMemoryMessageLog();
        var sessions = new InMemorySessionStore();
        sessions.AddSession(new SimulatorSession
        {
            SessionId = config.SessionId,
            TcpPort = config.TcpPort,
            Mode = config.Mode,
            Role = config.Role,
        });
        var hub = new NullHubContext<Iso8583Toolkit.Agent.Hubs.SimulatorHub>();
        var handler = new IsoSessionHandler(Logger, config, store, sessions, hub);
        return (handler, store);
    }

    private static MessageLogEntry? LastEntry(InMemoryMessageLog store, MessageDirection direction)
    {
        var entries = store.GetLog(limit: 100).ToList();
        return entries.FirstOrDefault(e => e.Direction == direction);
    }

    // ── TpduBuilder helpers ─────────────────────────────────────────────────

    [Fact]
    public void HasTpdu_WithValidTpduPrefix_ReturnsTrue()
    {
        var bytes = WithTpdu("6072921327", AsciiBody());
        TpduBuilder.HasTpdu(bytes).Should().BeTrue();
    }

    [Fact]
    public void HasTpdu_StartsWithMti_ReturnsFalse()
    {
        TpduBuilder.HasTpdu(AsciiBody()).Should().BeFalse();
    }

    [Fact]
    public void InvertTpdu_SwapsDestAndSource_KeepsId()
    {
        TpduBuilder.InvertTpdu("6072921327").Should().Be("6013277292");
    }

    // ── TpduMode.Optional ───────────────────────────────────────────────────

    [Fact]
    public async Task Optional_WithTpdu_ProcessesAndRespondsWithInvertedTpdu()
    {
        var config = new SessionConfig { TpduMode = TpduMode.Optional, AutoRespond = true };
        var (handler, store) = Build(config);

        var inbound = WithTpdu("6072921327", AsciiBody());
        await handler.ProcessOneMessageAsync(null, inbound, CancellationToken.None);

        var received = LastEntry(store, MessageDirection.Received)!;
        var sent = LastEntry(store, MessageDirection.Sent)!;
        received.TpduPresent.Should().BeTrue();
        received.Tpdu.Should().Be("6072921327");
        sent.TpduPresent.Should().BeTrue();
        sent.Tpdu.Should().Be("6013277292"); // dest/src swapped
    }

    [Fact]
    public async Task Optional_WithoutTpdu_ProcessesAndRespondsWithoutTpdu()
    {
        var config = new SessionConfig { TpduMode = TpduMode.Optional, AutoRespond = true };
        var (handler, store) = Build(config);

        await handler.ProcessOneMessageAsync(null, AsciiBody(), CancellationToken.None);

        LastEntry(store, MessageDirection.Received)!.TpduPresent.Should().BeFalse();
        LastEntry(store, MessageDirection.Sent)!.TpduPresent.Should().BeFalse();
    }

    // ── TpduMode.Required ───────────────────────────────────────────────────

    [Fact]
    public async Task Required_WithTpdu_ProcessesNormally()
    {
        var config = new SessionConfig { TpduMode = TpduMode.Required, AutoRespond = true };
        var (handler, store) = Build(config);

        var inbound = WithTpdu("6072921327", AsciiBody());
        await handler.ProcessOneMessageAsync(null, inbound, CancellationToken.None);

        LastEntry(store, MessageDirection.Received)!.Rejected.Should().BeFalse();
        LastEntry(store, MessageDirection.Sent).Should().NotBeNull();
    }

    [Fact]
    public async Task Required_WithoutTpdu_RejectsAndDoesNotRespond()
    {
        var config = new SessionConfig { TpduMode = TpduMode.Required, AutoRespond = true };
        var (handler, store) = Build(config);

        await handler.ProcessOneMessageAsync(null, AsciiBody(), CancellationToken.None);

        var received = LastEntry(store, MessageDirection.Received)!;
        received.Rejected.Should().BeTrue();
        received.ErrorCode.Should().Be("TPDU_REQUIRED");
        received.HasErrors.Should().BeTrue();
        LastEntry(store, MessageDirection.Sent).Should().BeNull();
    }

    // ── TpduMode.Strip ──────────────────────────────────────────────────────

    [Fact]
    public async Task Strip_WithTpdu_ProcessesWithoutTpduResponseWithoutTpdu()
    {
        var config = new SessionConfig { TpduMode = TpduMode.Strip, AutoRespond = true };
        var (handler, store) = Build(config);

        var inbound = WithTpdu("6072921327", AsciiBody());
        await handler.ProcessOneMessageAsync(null, inbound, CancellationToken.None);

        var received = LastEntry(store, MessageDirection.Received)!;
        received.TpduPresent.Should().BeFalse();   // explicitly stripped
        received.Tpdu.Should().BeNull();
        LastEntry(store, MessageDirection.Sent)!.TpduPresent.Should().BeFalse();
    }

    [Fact]
    public async Task Strip_WithoutTpdu_ProcessesNormally()
    {
        var config = new SessionConfig { TpduMode = TpduMode.Strip, AutoRespond = true };
        var (handler, store) = Build(config);

        await handler.ProcessOneMessageAsync(null, AsciiBody(), CancellationToken.None);

        LastEntry(store, MessageDirection.Received)!.TpduPresent.Should().BeFalse();
        LastEntry(store, MessageDirection.Sent)!.TpduPresent.Should().BeFalse();
    }

    // ── TpduMode.Auto (legacy retrocompat) ──────────────────────────────────

    [Fact]
    public async Task Auto_AdquirenteRole_BehavesLikeOptional()
    {
        // Pre-existing Adquirente sessions historically had useTpdu=false default.
        var config = new SessionConfig
        {
            TpduMode = TpduMode.Auto,
            Role = SimulatorRole.Adquirente,
            AutoRespond = true,
        };
        var (handler, store) = Build(config);

        await handler.ProcessOneMessageAsync(null, AsciiBody(), CancellationToken.None);
        LastEntry(store, MessageDirection.Sent)!.TpduPresent.Should().BeFalse();
    }
}

/// <summary>
/// Minimal IHubContext stub for unit testing — drops every Send to /dev/null.
/// </summary>
internal sealed class NullHubContext<THub> : IHubContext<THub> where THub : Hub
{
    public IHubClients Clients { get; } = new NullHubClients();
    public IGroupManager Groups { get; } = new NullGroupManager();
}

internal sealed class NullHubClients : IHubClients
{
    public IClientProxy All { get; } = new NullClientProxy();
    public IClientProxy AllExcept(IReadOnlyList<string> excludedConnectionIds) => All;
    public IClientProxy Client(string connectionId) => All;
    public IClientProxy Clients(IReadOnlyList<string> connectionIds) => All;
    public IClientProxy Group(string groupName) => All;
    public IClientProxy GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds) => All;
    public IClientProxy Groups(IReadOnlyList<string> groupNames) => All;
    public IClientProxy User(string userId) => All;
    public IClientProxy Users(IReadOnlyList<string> userIds) => All;
}

internal sealed class NullClientProxy : IClientProxy
{
    public Task SendCoreAsync(string method, object?[] args, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;
}

internal sealed class NullGroupManager : IGroupManager
{
    public Task AddToGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default) => Task.CompletedTask;
    public Task RemoveFromGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default) => Task.CompletedTask;
}
