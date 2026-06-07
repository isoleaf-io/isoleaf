using FluentAssertions;
using Iso8583Toolkit.IsoCore.Building;
using Iso8583Toolkit.IsoCore.Layouts;
using Iso8583Toolkit.Simulator.Protocol;
using Iso8583Toolkit.Simulator.Responder;
using Xunit;

namespace Iso8583Toolkit.Agent.Tests;

/// <summary>
/// Per-session EMV response config. Echo (default) must surface Bit 55
/// verbatim — even for payloads with a proprietary header that the TLV
/// parser would choke on. GenerateArpc tries the crypto path but always
/// falls back to Echo when any required input is missing, so the rebatedor
/// never crashes mid-response.
/// </summary>
public class EmvResponseConfigTests
{
    private static IsoLayout DefaultLayout => IsoLayout.Default();

    private static Iso8583Toolkit.IsoCore.Domain.IsoMessage BuildRequest(string bit55)
    {
        // Minimal 0200 with bit 2 + 11 + 55. Bit 2 is needed for the ARPC
        // path; bit 11 for STAN echo.
        var builder = new IsoMessageBuilder()
            .WithMti("0200")
            .WithLayout(DefaultLayout)
            .WithField(2, "4111111111111111")
            .WithField(11, "000001")
            .WithField(55, bit55);
        return builder.Build();
    }

    [Fact]
    public void EmvEcho_CopiesBit55Verbatim_EvenWithProprietaryHeader()
    {
        // Bit 55 with a leading proprietary 4-byte header (8 hex chars) that
        // the TLV parser would reject. Echo must surface it as-is.
        const string bit55 = "DEADBEEF" + "9F2608A1B2C3D4E5F607";
        var request = BuildRequest(bit55);
        var config = new SessionConfig
        {
            Role = SimulatorRole.Emissor,
            EmvResponse = new EmvResponseConfig { Mode = EmvResponseMode.Echo },
        };

        var response = new AutoResponder().BuildResponse(request, config, DefaultLayout);

        response.Should().NotBeNull();
        response!.GetFieldValue(55).Should().Be(bit55, "Echo mode must surface the raw value");
    }

    [Fact]
    public void EmvGenerateArpc_FallsBackToEcho_WhenImkUnavailable()
    {
        // GenerateArpc requested but no IMK configured → must fall back to
        // echo (rather than producing an empty/invalid Bit 55).
        const string bit55 = "9F2608A1B2C3D4E5F607" + "9F360200FF";
        var request = BuildRequest(bit55);
        var config = new SessionConfig
        {
            Role = SimulatorRole.Emissor,
            // IssuerMasterKey = null
            EmvResponse = new EmvResponseConfig
            {
                Mode = EmvResponseMode.GenerateArpc,
                ProprietaryHeaderBytes = 0,
                ImkOverride = null,
            },
        };

        var response = new AutoResponder().BuildResponse(request, config, DefaultLayout);

        response.Should().NotBeNull();
        response!.GetFieldValue(55).Should().Be(bit55, "no IMK → echo fallback");
    }

    [Fact]
    public void EmvGenerateArpc_SkipsProprietaryHeader_WhenConfigured()
    {
        // 4-byte proprietary header (8 hex chars) + valid TLV. The crypto
        // path will still fall back to echo (no IMK in this test), but the
        // PARSE inside TryGenerateArpcBit55 must use the post-skip slice —
        // a regression here would surface as an exception leaking out.
        const string header = "DEADBEEF"; // 4 bytes = 8 hex chars
        const string tlv    = "9F2608A1B2C3D4E5F607" + "9F360200FF";
        var bit55 = header + tlv;

        var request = BuildRequest(bit55);
        var config = new SessionConfig
        {
            Role = SimulatorRole.Emissor,
            EmvResponse = new EmvResponseConfig
            {
                Mode = EmvResponseMode.GenerateArpc,
                ProprietaryHeaderBytes = 4, // skip the "DEADBEEF" 4-byte header
            },
        };

        // Should not throw — and falls back to echo since no IMK.
        var response = new AutoResponder().BuildResponse(request, config, DefaultLayout);
        response.Should().NotBeNull();
        response!.GetFieldValue(55).Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void EmvResponseConfig_Default_IsEchoMode()
    {
        var defaults = EmvResponseConfig.Default;
        defaults.Mode.Should().Be(EmvResponseMode.Echo);
        defaults.ProprietaryHeaderBytes.Should().Be(0);
        defaults.ImkOverride.Should().BeNull();
        defaults.Brand.Should().Be("Visa");
    }

    [Fact]
    public void SessionConfig_Default_HasEchoEmvResponse()
    {
        var cfg = new SessionConfig();
        cfg.EmvResponse.Should().NotBeNull();
        cfg.EmvResponse.Mode.Should().Be(EmvResponseMode.Echo);
    }
}
