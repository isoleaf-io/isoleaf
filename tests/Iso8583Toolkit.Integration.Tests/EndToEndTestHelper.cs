using FluentAssertions;
using Iso8583Toolkit.Application.Services;
using Iso8583Toolkit.IsoCore.Building.Smart;
using Iso8583Toolkit.IsoCore.Domain;
using Iso8583Toolkit.IsoCore.Layouts;
using Iso8583Toolkit.IsoCore.Parsing;
using Iso8583Toolkit.IsoCore.Validation;
using Iso8583Toolkit.Simulator.Protocol;
using Iso8583Toolkit.Simulator.Responder;

namespace Iso8583Toolkit.Integration.Tests;

/// <summary>
/// Shared utilities for end-to-end pipeline tests: Smart build → parse → simulate → parse response.
/// </summary>
internal sealed class EndToEndTestHelper
{
    private readonly SmartIsoBuilder _builder = new(new CardDataProvider());
    private readonly IsoParser _parser = new();
    private readonly AutoResponder _responder = new();
    private readonly IsoMessageValidator _validator = new();
    private readonly IsoLayout _layout = IsoLayout.Default();

    public IsoLayout Layout => _layout;

    public SmartBuildResult BuildMessage(
        string mti,
        SmartRole role,
        SmartBrand brand = SmartBrand.Auto,
        TransactionType txType = TransactionType.Credito,
        TransactionChannel channel = TransactionChannel.Chip,
        bool isReversal = false,
        Dictionary<int, string>? customFields = null)
    {
        var profile = new TransactionProfile
        {
            Mti = mti,
            Role = role,
            Brand = brand,
            TransactionType = txType,
            Channel = channel,
            IsReversal = isReversal,
            CustomFields = customFields
        };
        return _builder.Build(profile);
    }

    public IsoMessage ParseAscii(string asciiMessage) => _parser.ParseFromAscii(asciiMessage);

    public IsoMessage ParseBinaryHex(string binaryHex) => _parser.ParseFromBinaryHex(binaryHex);

    /// <summary>
    /// Invokes the AutoResponder to simulate the counterparty's response,
    /// then returns the parsed request and response as IsoMessage instances.
    /// </summary>
    public (IsoMessage request, IsoMessage response) SimulateRoundTrip(
        SmartBuildResult build, SessionConfig config)
    {
        build.Success.Should().BeTrue(build.Error ?? "");
        var request = _parser.ParseFromAscii(build.Message!);
        var response = _responder.BuildResponse(request, config, _layout);
        return (request, response);
    }

    public ValidationResult Validate(IsoMessage msg, int[]? requiredBits = null) =>
        _validator.Validate(msg, _layout, requiredBits);

    /// <summary>Asserts that every echo bit has identical values in request and response.</summary>
    public static void AssertEchoFields(IsoMessage request, IsoMessage response, int[] echoFields)
    {
        foreach (var bit in echoFields)
        {
            var reqVal = request.GetFieldValue(bit);
            if (reqVal is null) continue; // request didn't send it → response can't echo
            response.GetFieldValue(bit).Should().Be(reqVal,
                $"bit {bit} should echo request value");
        }
    }

    public static void AssertField(IsoMessage msg, int bit, string? expectedValue = null)
    {
        msg.HasField(bit).Should().BeTrue($"bit {bit} must be present");
        if (expectedValue is not null)
            msg.GetFieldValue(bit).Should().Be(expectedValue,
                $"bit {bit} should equal '{expectedValue}'");
    }

    public static void AssertFieldAbsent(IsoMessage msg, int bit) =>
        msg.HasField(bit).Should().BeFalse($"bit {bit} must be absent");

    // ── Session configs ─────────────────────────────────────────────────────

    public static SessionConfig AdquirenteConfig(
        string defaultRc = "00",
        Dictionary<int, string>? fieldOverrides = null) => new()
    {
        Mode = SimulatorMode.Rebatedor,
        Role = SimulatorRole.Adquirente,
        LayoutName = "default",
        DefaultResponseCode = defaultRc,
        AutoRespond = true,
        ValidateArqc = false,
        Rules = new ResponseRules
        {
            MtiResponseMap = new()
            {
                ["0100"] = "0110",
                ["0200"] = "0210",
                ["0400"] = "0410",
                ["0800"] = "0810"
            },
            FieldOverrides = fieldOverrides ?? new Dictionary<int, string>()
        }
    };

    // ── Luhn ────────────────────────────────────────────────────────────────

    public static bool PassesLuhn(string pan)
    {
        var sum = 0;
        var alt = false;
        for (var i = pan.Length - 1; i >= 0; i--)
        {
            if (!char.IsDigit(pan[i])) return false;
            var d = pan[i] - '0';
            if (alt) { d *= 2; if (d > 9) d -= 9; }
            sum += d;
            alt = !alt;
        }
        return sum % 10 == 0;
    }
}
