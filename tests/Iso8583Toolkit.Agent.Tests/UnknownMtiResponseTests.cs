using FluentAssertions;
using Iso8583Toolkit.IsoCore.Building;
using Iso8583Toolkit.IsoCore.Layouts;
using Iso8583Toolkit.IsoCore.Parsing;
using Iso8583Toolkit.Simulator.Protocol;
using Iso8583Toolkit.Simulator.Responder;

namespace Iso8583Toolkit.Agent.Tests;

/// <summary>
/// All MTI values in this file are invented placeholders chosen for the test scenarios.
/// They do not correspond to any real-world acquirer/issuer flow.
/// </summary>
public sealed class UnknownMtiResponseTests
{
    private static readonly IsoLayout Layout = IsoLayout.Default();
    private readonly AutoResponder _responder = new();
    private readonly IsoParser _parser = new();

    // ── DeriveMtiResponse — pure function tests ─────────────────────────────

    [Fact]
    public void DeriveMtiResponse_RequestMti_ReturnsResponseMti()
    {
        // Third digit '0' (Request) → '1' (Response). Invented prefix XX, suffix Y.
        AutoResponder.DeriveMtiResponse("3704").Should().Be("3714");
    }

    [Fact]
    public void DeriveMtiResponse_AlreadyResponseMti_ReturnsNull()
    {
        // Third digit '1' is already a response → no derivation possible.
        AutoResponder.DeriveMtiResponse("3714").Should().BeNull();
    }

    [Fact]
    public void DeriveMtiResponse_AdviceMti_ReturnsAdviceResponse()
    {
        // Third digit '2' (Advice) → '3' (Advice Response).
        AutoResponder.DeriveMtiResponse("3727").Should().Be("3737");
    }

    [Fact]
    public void DeriveMtiResponse_NotificationMti_Returns5InThirdDigit()
    {
        AutoResponder.DeriveMtiResponse("3743").Should().Be("3753");
    }

    [Fact]
    public void DeriveMtiResponse_NonNumeric_ReturnsNull()
    {
        AutoResponder.DeriveMtiResponse("AB04").Should().BeNull();
    }

    [Fact]
    public void DeriveMtiResponse_WrongLength_ReturnsNull()
    {
        AutoResponder.DeriveMtiResponse("370").Should().BeNull();
        AutoResponder.DeriveMtiResponse("37044").Should().BeNull();
    }

    // ── AutoResponder integration ───────────────────────────────────────────

    private static SessionConfig MakeConfig(UnknownMtiResponse policy, string? customValue = null) =>
        new()
        {
            SessionId = "test",
            UnknownMtiResponse = policy,
            UnknownMtiCustomValue = customValue,
            DefaultResponseCode = "00",
            // An empty rules object → MTI map is empty so every MTI hits the policy.
            Rules = new ResponseRules(),
        };

    private string BuildRequest(string mti)
    {
        // Build a minimal valid ISO 8583 request through the standard builder so the
        // resulting bytes can be parsed back into an IsoMessage for AutoResponder.
        var hex = new IsoMessageBuilder()
            .WithMti(mti)
            .WithLayout(Layout)
            .WithField(3, "000000")
            .WithField(11, "000001")
            .BuildHex();
        // Re-parse so we get an IsoMessage instance suitable for AutoResponder.
        return hex;
    }

    [Fact]
    public void AutoResponder_UnknownMti_Derive_ReturnsResponse()
    {
        var request = _parser.ParseFromHex(BuildRequest("3704"), Layout);
        var cfg = MakeConfig(UnknownMtiResponse.Derive);

        var response = _responder.BuildResponse(request, cfg, Layout);

        response.Should().NotBeNull();
        response!.Mti.Should().Be("3714");
    }

    [Fact]
    public void AutoResponder_UnknownMti_Reject_ReturnsNull()
    {
        var request = _parser.ParseFromHex(BuildRequest("3704"), Layout);
        var cfg = MakeConfig(UnknownMtiResponse.Reject);

        var response = _responder.BuildResponse(request, cfg, Layout);

        response.Should().BeNull();
    }

    [Fact]
    public void AutoResponder_UnknownMti_Echo_ReturnsSameMti()
    {
        var request = _parser.ParseFromHex(BuildRequest("3704"), Layout);
        var cfg = MakeConfig(UnknownMtiResponse.Echo);

        var response = _responder.BuildResponse(request, cfg, Layout);

        response.Should().NotBeNull();
        response!.Mti.Should().Be("3704");
    }

    [Fact]
    public void AutoResponder_UnknownMti_Custom_ReturnsCustomMti()
    {
        var request = _parser.ParseFromHex(BuildRequest("3704"), Layout);
        var cfg = MakeConfig(UnknownMtiResponse.Custom, customValue: "5599");

        var response = _responder.BuildResponse(request, cfg, Layout);

        response.Should().NotBeNull();
        response!.Mti.Should().Be("5599");
    }

    [Fact]
    public void AutoResponder_UnknownMti_Custom_NoValue_ReturnsNull()
    {
        var request = _parser.ParseFromHex(BuildRequest("3704"), Layout);
        var cfg = MakeConfig(UnknownMtiResponse.Custom, customValue: null);

        var response = _responder.BuildResponse(request, cfg, Layout);

        response.Should().BeNull();
    }

    [Fact]
    public void AutoResponder_UnknownMti_DeriveOnAlreadyResponseMti_ReturnsNull()
    {
        // Third digit is '1' already — not derivable, so Derive policy degrades to "no response".
        var request = _parser.ParseFromHex(BuildRequest("3714"), Layout);
        var cfg = MakeConfig(UnknownMtiResponse.Derive);

        var response = _responder.BuildResponse(request, cfg, Layout);

        response.Should().BeNull();
    }

    [Fact]
    public void AutoResponder_MtiInMap_AlwaysWinsRegardlessOfPolicy()
    {
        // Regression guard: explicit map entries must not be overridden by Reject.
        var request = _parser.ParseFromHex(BuildRequest("3704"), Layout);
        var rules = new ResponseRules();
        rules.MtiResponseMap["3704"] = "3719";
        var cfg = new SessionConfig
        {
            SessionId = "test",
            UnknownMtiResponse = UnknownMtiResponse.Reject,
            Rules = rules,
        };

        var response = _responder.BuildResponse(request, cfg, Layout);

        response.Should().NotBeNull();
        response!.Mti.Should().Be("3719");
    }
}
