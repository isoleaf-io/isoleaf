using FluentAssertions;
using Iso8583Toolkit.IsoCore.Building;
using Iso8583Toolkit.IsoCore.Layouts;
using Iso8583Toolkit.IsoCore.Parsing;
using Iso8583Toolkit.Simulator.Protocol;
using Iso8583Toolkit.Simulator.Responder;

namespace Iso8583Toolkit.Integration.Tests;

public sealed class AutoResponderTests
{
    private readonly AutoResponder _responder = new();
    private readonly IsoLayout _layout = IsoLayout.Default();
    private readonly IsoParser _parser = new();

    private IsoCore.Domain.IsoMessage BuildRequest(string mti = "0200", string amount = "000000001000")
    {
        var hex = new IsoMessageBuilder()
            .WithMti(mti)
            .WithLayout(_layout)
            .WithField(2, "4111111111111111")
            .WithField(3, "000000")
            .WithField(4, amount)
            .WithField(11, "000001")
            .WithField(12, "143000")
            .WithField(13, "0414")
            .WithField(41, "TERM0001")
            .WithField(42, "MERCHANT0000001")
            .BuildHex();

        return _parser.ParseFromHex(hex);
    }

    private static SessionConfig DefaultConfig(string rc = "00") => new()
    {
        DefaultResponseCode = rc,
        AutoRespond = true
    };

    // ── MTI mapping ─────────────────────────────────────────────────────────

    [Fact]
    public void BuildResponse_0200_Returns0210()
    {
        var request = BuildRequest("0200");
        var response = _responder.BuildResponse(request, DefaultConfig(), _layout);

        response.Mti.Should().Be("0210");
    }

    [Fact]
    public void BuildResponse_0100_Returns0110()
    {
        var request = BuildRequest("0100");
        var response = _responder.BuildResponse(request, DefaultConfig(), _layout);

        response.Mti.Should().Be("0110");
    }

    [Fact]
    public void BuildResponse_0800_Returns0810()
    {
        var hex = new IsoMessageBuilder()
            .WithMti("0800")
            .WithLayout(_layout)
            .WithField(11, "000001")
            .WithField(70, "301")
            .BuildHex();

        var request = _parser.ParseFromHex(hex);
        var response = _responder.BuildResponse(request, DefaultConfig(), _layout);

        response.Mti.Should().Be("0810");
    }

    // ── Response code ───────────────────────────────────────────────────────

    [Fact]
    public void BuildResponse_DefaultRC00_SetsBit39To00()
    {
        var request = BuildRequest();
        var response = _responder.BuildResponse(request, DefaultConfig("00"), _layout);

        response.GetFieldValue(39).Should().Be("00");
    }

    [Fact]
    public void BuildResponse_DefaultRC05_SetsBit39To05()
    {
        var request = BuildRequest();
        var response = _responder.BuildResponse(request, DefaultConfig("05"), _layout);

        response.GetFieldValue(39).Should().Be("05");
    }

    // ── Authorization code ──────────────────────────────────────────────────

    [Fact]
    public void BuildResponse_Approved_GeneratesBit38()
    {
        var request = BuildRequest();
        var response = _responder.BuildResponse(request, DefaultConfig("00"), _layout);

        var authCode = response.GetFieldValue(38);
        authCode.Should().NotBeNull();
        authCode.Should().HaveLength(6);
    }

    [Fact]
    public void BuildResponse_Declined_NoBit38()
    {
        var request = BuildRequest();
        var response = _responder.BuildResponse(request, DefaultConfig("05"), _layout);

        response.GetFieldValue(38).Should().BeNull();
    }

    // ── Echo fields ─────────────────────────────────────────────────────────

    [Fact]
    public void BuildResponse_EchoFields_CopiedFromRequest()
    {
        var request = BuildRequest();
        var response = _responder.BuildResponse(request, DefaultConfig(), _layout);

        response.GetFieldValue(2).Should().Be("4111111111111111");
        response.GetFieldValue(3).Should().Be("000000");
        response.GetFieldValue(4).Should().Be("000000001000");
        response.GetFieldValue(11).Should().Be("000001");
        response.GetFieldValue(41).Should().Be("TERM0001");
        response.GetFieldValue(42).Should().Be("MERCHANT0000001");
    }

    // ── Conditional rules ───────────────────────────────────────────────────

    [Fact]
    public void BuildResponse_ConditionalRule_AmountGreaterThan_AppliesRC51()
    {
        var config = new SessionConfig
        {
            DefaultResponseCode = "00",
            Rules = new ResponseRules
            {
                ConditionalRules =
                [
                    new ConditionalRule(4, "GreaterThan", "000000500000", "51")
                ]
            }
        };

        // Amount = 10000.00 (> 5000.00 threshold)
        var request = BuildRequest(amount: "000001000000");
        var response = _responder.BuildResponse(request, config, _layout);

        response.GetFieldValue(39).Should().Be("51");
    }

    [Fact]
    public void BuildResponse_ConditionalRule_AmountBelowThreshold_ApprovesWith00()
    {
        var config = new SessionConfig
        {
            DefaultResponseCode = "00",
            Rules = new ResponseRules
            {
                ConditionalRules =
                [
                    new ConditionalRule(4, "GreaterThan", "000000500000", "51")
                ]
            }
        };

        // Amount = 10.00 (< 5000.00 threshold)
        var request = BuildRequest(amount: "000000001000");
        var response = _responder.BuildResponse(request, config, _layout);

        response.GetFieldValue(39).Should().Be("00");
    }

    [Fact]
    public void BuildResponse_ConditionalRule_Equals_Matches()
    {
        var config = new SessionConfig
        {
            DefaultResponseCode = "00",
            Rules = new ResponseRules
            {
                ConditionalRules =
                [
                    new ConditionalRule(3, "Equals", "010000", "57")
                ]
            }
        };

        var hex = new IsoMessageBuilder()
            .WithMti("0200")
            .WithLayout(_layout)
            .WithField(3, "010000")
            .WithField(4, "000000001000")
            .WithField(11, "000001")
            .BuildHex();

        var request = _parser.ParseFromHex(hex);
        var response = _responder.BuildResponse(request, config, _layout);

        response.GetFieldValue(39).Should().Be("57");
    }

    // ── ARQC validation ─────────────────────────────────────────────────────

    [Fact]
    public void BuildResponse_ArqcInvalid_ForcesRC05()
    {
        var config = new SessionConfig
        {
            DefaultResponseCode = "00",
            ValidateArqc = true
        };

        var request = BuildRequest();
        var response = _responder.BuildResponse(request, config, _layout, arqcValid: false);

        response.GetFieldValue(39).Should().Be("05");
    }

    [Fact]
    public void BuildResponse_ArqcValid_UsesDefaultRC()
    {
        var config = new SessionConfig
        {
            DefaultResponseCode = "00",
            ValidateArqc = true
        };

        var request = BuildRequest();
        var response = _responder.BuildResponse(request, config, _layout, arqcValid: true);

        response.GetFieldValue(39).Should().Be("00");
    }

    // ── ResponseCodeHelper ──────────────────────────────────────────────────

    [Theory]
    [InlineData("00", true)]
    [InlineData("08", true)]
    [InlineData("10", true)]
    [InlineData("85", true)]
    [InlineData("05", false)]
    [InlineData("51", false)]
    [InlineData("91", false)]
    public void IsApproved_ReturnsCorrectResult(string rc, bool expected)
    {
        ResponseCodeHelper.IsApproved(rc).Should().Be(expected);
    }

    [Theory]
    [InlineData("00", "Approved")]
    [InlineData("05", "Do not honor")]
    [InlineData("51", "Insufficient funds")]
    [InlineData("91", "Authorization system or issuer system inoperative")]
    public void GetDescription_ReturnsKnownDescription(string rc, string expected)
    {
        ResponseCodeHelper.GetDescription(rc).Should().Be(expected);
    }

    [Fact]
    public void GenerateAuthCode_Returns6Chars()
    {
        var code = ResponseCodeHelper.GenerateAuthCode();
        code.Should().HaveLength(6);
        code.Should().MatchRegex("^[A-Z0-9]{6}$");
    }

    // ── BuildResponseHex ────────────────────────────────────────────────────

    [Fact]
    public void BuildResponseHex_ProducesParseableMessage()
    {
        var request = BuildRequest();
        var responseHex = _responder.BuildResponseHex(request, DefaultConfig(), _layout);

        var parsed = _parser.ParseFromHex(responseHex);
        parsed.Mti.Should().Be("0210");
        parsed.GetFieldValue(39).Should().Be("00");
    }
}
