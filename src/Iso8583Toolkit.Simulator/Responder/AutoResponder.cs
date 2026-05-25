using Iso8583Toolkit.IsoCore.Building;
using Iso8583Toolkit.IsoCore.Domain;
using Iso8583Toolkit.IsoCore.Layouts;
using Iso8583Toolkit.Simulator.Protocol;

namespace Iso8583Toolkit.Simulator.Responder;

public sealed class AutoResponder
{
    // Default echo fields (role-agnostic baseline). Role-specific overrides come
    // from SimulatorRoleProfile.EchoFields when SessionConfig.Role is set.
    private static readonly int[] DefaultEchoFields = [2, 3, 4, 7, 11, 12, 13, 14, 18, 22, 23, 25, 32, 35, 37, 41, 42, 43, 49];

    /// <summary>
    /// Outcome of the unknown-MTI resolution. <see cref="ResponseMti"/> is <c>null</c>
    /// when the configured policy says "don't respond" (Reject / unresolved Derive /
    /// Custom without a value); otherwise it holds the MTI the response should carry,
    /// and <see cref="ActionDescription"/> is a short human-readable tag for the log.
    /// </summary>
    public readonly record struct UnknownMtiResolution(string? ResponseMti, string? ActionDescription);

    /// <summary>
    /// Builds an automatic response message for a received ISO request.
    /// Returns <c>null</c> when the configured <see cref="SessionConfig.UnknownMtiResponse"/>
    /// instructs the simulator to stay silent (Reject, or a derivation that didn't apply).
    /// </summary>
    public IsoMessage? BuildResponse(IsoMessage request, SessionConfig config, IsoLayout layout, bool arqcValid = true)
    {
        var rules = config.Rules ?? new ResponseRules();

        // 1. Determine response MTI (honoring UnknownMtiResponse policy).
        var resolution = ResolveResponseMti(request.Mti, rules, config);
        if (resolution.ResponseMti is null)
            return null;

        // 2. Build response
        var builder = new IsoMessageBuilder()
            .WithMti(resolution.ResponseMti)
            .WithLayout(layout);

        // 3. Copy echo fields from request (role-driven)
        var echoFields = SimulatorRoleProfile.EchoFields(config.Role);
        foreach (var bit in echoFields)
        {
            var value = request.GetFieldValue(bit);
            if (value is not null)
                builder.WithField(bit, value);
        }

        // 4. Evaluate conditional rules to determine RC
        var responseCode = EvaluateRules(request, config, rules, arqcValid);

        // 5. Set bit 39 (Response Code)
        builder.WithField(39, responseCode);

        // 6. Generate Authorization Code if approved
        if (ResponseCodeHelper.IsApproved(responseCode))
            builder.WithField(38, ResponseCodeHelper.GenerateAuthCode());

        // 7. Apply field overrides
        foreach (var (bit, value) in rules.FieldOverrides)
        {
            if (bit != 39) // Don't override RC from rules evaluation
                builder.WithField(bit, value);
        }

        return builder.Build();
    }

    /// <summary>
    /// Builds a response and serializes it to hex wire format. Returns <c>null</c>
    /// when <see cref="BuildResponse"/> declined to produce a response.
    /// </summary>
    public string? BuildResponseHex(IsoMessage request, SessionConfig config, IsoLayout layout, bool arqcValid = true)
    {
        var response = BuildResponse(request, config, layout, arqcValid);
        if (response is null) return null;

        var builder = new IsoMessageBuilder()
            .WithMti(response.Mti)
            .WithLayout(layout);

        foreach (var field in response.Fields.Values)
            builder.WithField(field.BitNumber, field.RawValue);

        return builder.BuildHex();
    }

    /// <summary>
    /// Resolves the response MTI for a given request, applying the session's
    /// <see cref="UnknownMtiResponse"/> policy when the MTI is not in the map.
    /// Exposed (internal) so the session handler can describe the action in the log.
    /// </summary>
    public static UnknownMtiResolution ResolveResponseMti(string requestMti, ResponseRules rules, SessionConfig config)
    {
        if (rules.MtiResponseMap.TryGetValue(requestMti, out var mapped))
            return new UnknownMtiResolution(mapped, null);

        switch (config.UnknownMtiResponse)
        {
            case UnknownMtiResponse.Reject:
                return new UnknownMtiResolution(null, "Rejected — MTI not in response map");

            case UnknownMtiResponse.Derive:
                var derived = DeriveMtiResponse(requestMti);
                return derived is null
                    ? new UnknownMtiResolution(null, $"Rejected — MTI {requestMti} not derivable")
                    : new UnknownMtiResolution(derived, $"Derived:{derived}");

            case UnknownMtiResponse.Echo:
                return new UnknownMtiResolution(requestMti, "Echoed");

            case UnknownMtiResponse.Custom:
                if (string.IsNullOrWhiteSpace(config.UnknownMtiCustomValue))
                    return new UnknownMtiResolution(null, "Rejected — Custom MTI not configured");
                return new UnknownMtiResolution(config.UnknownMtiCustomValue, $"Custom:{config.UnknownMtiCustomValue}");

            default:
                return new UnknownMtiResolution(null, "Rejected — unknown policy");
        }
    }

    /// <summary>
    /// Derives a response MTI by incrementing the function digit per ISO 8583:
    /// 0→1 (request→response), 2→3 (advice→advice response), 4→5 (notification→notification response).
    /// Returns <c>null</c> when the input isn't a 4-digit numeric MTI or the function digit
    /// already denotes a response/unmappable category.
    /// </summary>
    public static string? DeriveMtiResponse(string mti)
    {
        if (mti is null || mti.Length != 4) return null;
        for (var i = 0; i < 4; i++)
            if (!char.IsDigit(mti[i])) return null;

        var derived = mti[2] switch
        {
            '0' => '1',
            '2' => '3',
            '4' => '5',
            _ => '\0',
        };
        if (derived == '\0') return null;

        return $"{mti[..2]}{derived}{mti[3]}";
    }

    private static string EvaluateRules(IsoMessage request, SessionConfig config, ResponseRules rules, bool arqcValid)
    {
        // If ARQC validation failed, decline
        if (config.ValidateArqc && !arqcValid)
            return "05";

        // Evaluate conditional rules (first match wins)
        foreach (var rule in rules.ConditionalRules)
        {
            var fieldValue = request.GetFieldValue(rule.BitNumber);
            if (fieldValue is null) continue;

            if (EvaluateCondition(fieldValue, rule.Operator, rule.Value))
                return rule.ResponseCode;
        }

        // Check field overrides for bit 39
        if (rules.FieldOverrides.TryGetValue(39, out var overrideRc))
            return overrideRc;

        // Default response code
        return config.DefaultResponseCode ?? "00";
    }

    private static bool EvaluateCondition(string fieldValue, string op, string ruleValue) =>
        op.ToLowerInvariant() switch
        {
            "equals" => string.Equals(fieldValue, ruleValue, StringComparison.OrdinalIgnoreCase),
            "contains" => fieldValue.Contains(ruleValue, StringComparison.OrdinalIgnoreCase),
            "greaterthan" => long.TryParse(fieldValue, out var fv) && long.TryParse(ruleValue, out var rv) && fv > rv,
            "lessthan" => long.TryParse(fieldValue, out var fv2) && long.TryParse(ruleValue, out var rv2) && fv2 < rv2,
            _ => false
        };
}
