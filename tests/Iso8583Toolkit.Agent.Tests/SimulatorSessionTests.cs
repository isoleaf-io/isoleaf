using FluentAssertions;
using Iso8583Toolkit.Agent.Hubs;
using Iso8583Toolkit.Agent.Models;
using Iso8583Toolkit.Agent.Services;
using Iso8583Toolkit.IsoCore.Building;
using Iso8583Toolkit.IsoCore.Layouts;
using Iso8583Toolkit.Simulator.Protocol;
using Microsoft.Extensions.Logging.Abstractions;
using System.Text;

// Reuses the internal NullHubContext<T> defined in TpduModeTests.cs (same assembly).
namespace Iso8583Toolkit.Integration.Tests;

/// <summary>
/// Behaviour around SessionConfig modes (Rebatedor / Injetor) and the wire-format
/// auto-detect inside IsoSessionHandler. MTIs and PANs below are invented.
/// </summary>
public sealed class SimulatorSessionTests
{
    private static readonly IsoLayout Layout = IsoLayout.Default();

    [Fact]
    public void SessionConfig_Injetor_AcceptsTargetHostAndPort()
    {
        var cfg = new SessionConfig
        {
            Mode = SimulatorMode.Injetor,
            TargetHost = "10.0.0.1",
            TargetPort = 7777,
        };

        cfg.TargetHost.Should().Be("10.0.0.1");
        cfg.TargetPort.Should().Be(7777);
        cfg.Mode.Should().Be(SimulatorMode.Injetor);
    }

    [Fact]
    public void SessionConfig_Rebatedor_DefaultsHaveNoTargetEndpoint()
    {
        var cfg = new SessionConfig { Mode = SimulatorMode.Rebatedor, TcpPort = 9000 };

        cfg.TargetHost.Should().BeNull();
        cfg.TargetPort.Should().BeNull();
        cfg.TcpPort.Should().Be(9000);
    }

    // ── Wire-format auto-detect (BUG 3) ────────────────────────────────────

    private static IsoSessionHandler MakeHandler(SessionConfig cfg)
    {
        var store = new LocalSessionStore();
        store.AddSession(new SimulatorSession
        {
            SessionId = cfg.SessionId,
            TcpPort = cfg.TcpPort,
            Mode = cfg.Mode,
            Role = cfg.Role,
            Status = SessionStatus.Active,
        });
        // Reuse the NullHubContext defined alongside TpduModeTests — it is internal
        // to the test assembly so both files can share it.
        var hub = new NullHubContext<SimulatorHub>();
        return new IsoSessionHandler(NullLogger.Instance, cfg, store, hub);
    }

    private static byte[] FrameAscii(string asciiWire)
    {
        return Encoding.ASCII.GetBytes(asciiWire);
    }

    private static string BuildAsciiWire(string mti)
    {
        // Minimal valid wire: MTI + tiny bitmap covering bit 3 + a value.
        return new IsoMessageBuilder()
            .WithMti(mti)
            .WithLayout(Layout)
            .WithField(3, "000000")
            .WithField(11, "000001")
            .BuildHex();
    }

    [Fact]
    public async Task IsoSessionHandler_AsciiWire_ParsesAndResponds()
    {
        var cfg = new SessionConfig
        {
            SessionId = "ascii-test",
            Mode = SimulatorMode.Rebatedor,
            UnknownMtiResponse = UnknownMtiResponse.Derive,
        };
        var handler = MakeHandler(cfg);
        var frame = FrameAscii(BuildAsciiWire("0200"));

        // Pass a null stream so the handler runs through parse + respond without writing TCP.
        var entry = await handler.ProcessOneMessageAsync(null, frame, default);

        entry.Should().NotBeNull();
        entry!.DecodedMti.Should().Be("0210"); // standard map hit
    }

    [Fact]
    public async Task IsoSessionHandler_BinaryHex_ParsesAndResponds()
    {
        var cfg = new SessionConfig
        {
            SessionId = "binhex-test",
            Mode = SimulatorMode.Rebatedor,
            UnknownMtiResponse = UnknownMtiResponse.Derive,
        };
        var handler = MakeHandler(cfg);

        // BuildBinaryHex returns the binary-hex string; the bytes on the wire ARE
        // those hex characters (one ASCII byte per hex char).
        var binaryHex = new IsoMessageBuilder()
            .WithMti("0200")
            .WithLayout(Layout)
            .WithField(3, "000000")
            .WithField(11, "000002")
            .BuildBinaryHex();
        var frame = Encoding.ASCII.GetBytes(binaryHex);

        var entry = await handler.ProcessOneMessageAsync(null, frame, default);

        entry.Should().NotBeNull();
        entry!.DecodedMti.Should().Be("0210");
    }
}
