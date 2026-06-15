using Iso8583Toolkit.IsoCore.Building;
using Iso8583Toolkit.IsoCore.Domain;
using Iso8583Toolkit.IsoCore.Layouts;
using Iso8583Toolkit.Simulator.Protocol;

namespace Iso8583Toolkit.Simulator.Responder;

public sealed class AutoResponder
{
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

        // 4. Evaluate conditional rules to determine RC. When the Issuer
        // session has GenerateArpc + ValidateArqc enabled, run the real
        // ARQC check here so EvaluateRules can return RC=05 for invalid
        // cryptograms — caller's `arqcValid` argument acts as the upper
        // bound (a caller that already knows the ARQC is invalid wins).
        var effectiveArqcValid = arqcValid;
        var emvCfg = config.EmvResponse ?? EmvResponseConfig.Default;
        if (effectiveArqcValid && emvCfg.Mode == EmvResponseMode.GenerateArpc && emvCfg.ValidateArqc)
        {
            effectiveArqcValid = TryValidateArqc(request, emvCfg, config);
        }
        var responseCode = EvaluateRules(request, config, rules, effectiveArqcValid);

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

        // 8. Bit 55 handling — Echo or GenerateArpc per EmvResponse config.
        // Issuer-role echo list above intentionally omits Bit 55 because the
        // shape depends on policy; we set it here. Echo (default) copies the
        // request value verbatim; GenerateArpc tries the full crypto path
        // and falls back to Echo on any failure.
        var requestBit55 = request.GetFieldValue(55);
        if (requestBit55 is not null)
        {
            // emvCfg was already resolved above when validating ARQC.
            var responseBit55 = emvCfg.Mode == EmvResponseMode.GenerateArpc
                ? TryGenerateArpcBit55(request, requestBit55, emvCfg, config, responseCode)
                ?? requestBit55  // fallback to echo
                : requestBit55;
            builder.WithField(55, responseBit55);
        }

        return builder.Build();
    }

    /// <summary>
    /// Validates the inbound ARQC against what we'd derive from the request
    /// fields + configured IMK. Returns true (valid) when:
    ///   • the validation succeeds, OR
    ///   • any precondition is missing (no IMK, missing TLV tags, etc.) —
    ///     the lenient behavior keeps the simulator usable for partial
    ///     setups; users who want strict validation just need to configure
    ///     a real IMK.
    /// </summary>
    private static bool TryValidateArqc(IsoMessage request, EmvResponseConfig emvCfg, SessionConfig sessionCfg)
    {
        try
        {
            var bit55 = request.GetFieldValue(55);
            if (bit55 is null) return true;

            var trimmed = bit55.AsSpan(emvCfg.ProprietaryHeaderBytes * 2);
            if (trimmed.Length < 4) return true;

            var tags = Cryptography.Tlv.TlvParser.Parse(trimmed.ToString());
            var arqcReceived = tags.FirstOrDefault(t => t.Tag == "9F26")?.Value;
            var atc          = tags.FirstOrDefault(t => t.Tag == "9F36")?.Value;
            var amountAuth   = tags.FirstOrDefault(t => t.Tag == "9F02")?.Value;
            var amountOther  = tags.FirstOrDefault(t => t.Tag == "9F03")?.Value;
            var terminalCc   = tags.FirstOrDefault(t => t.Tag == "9F1A")?.Value;
            var tvr          = tags.FirstOrDefault(t => t.Tag == "95")?.Value;
            var currencyCode = tags.FirstOrDefault(t => t.Tag == "5F2A")?.Value;
            var txDate       = tags.FirstOrDefault(t => t.Tag == "9A")?.Value;
            var txType       = tags.FirstOrDefault(t => t.Tag == "9C")?.Value;
            var un           = tags.FirstOrDefault(t => t.Tag == "9F37")?.Value;
            var aip          = tags.FirstOrDefault(t => t.Tag == "82")?.Value;
            var iad          = tags.FirstOrDefault(t => t.Tag == "9F10")?.Value ?? "";

            if (arqcReceived is null || atc is null || amountAuth is null || amountOther is null
                || terminalCc is null || tvr is null || currencyCode is null || txDate is null
                || txType is null || un is null || aip is null)
                return true; // can't validate; treat as valid

            var pan = request.GetFieldValue(2);
            var psn = request.GetFieldValue(23) ?? "00";
            if (pan is null) return true;

            var imk = string.IsNullOrEmpty(emvCfg.ImkOverride)
                ? sessionCfg.IssuerMasterKey
                : emvCfg.ImkOverride;
            if (string.IsNullOrEmpty(imk)) return true;

            var arqcInput = new Cryptography.Emv.ArqcInput(
                IccMasterKey: imk,
                Pan: pan,
                PanSequenceNumber: psn,
                Atc: atc,
                AmountAuthorized: amountAuth,
                AmountOther: amountOther,
                TerminalCountryCode: terminalCc,
                Tvr: tvr,
                CurrencyCode: currencyCode,
                TransactionDate: txDate,
                TransactionType: txType,
                UnpredictableNumber: un,
                Aip: aip,
                Iad: iad,
                Profile: Cryptography.Emv.EmvProfile.Visa);

            var expected = Cryptography.Emv.ArqcCalculator.CalculateArqc(arqcInput);
            return string.Equals(expected, arqcReceived, StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return true; // any failure → lenient
        }
    }

    /// <summary>
    /// Attempts the GenerateArpc pipeline: skip proprietary header, parse TLV,
    /// extract ARQC/ATC, derive ARPC, build response Bit 55 (tag 91 + 8A).
    /// Returns <c>null</c> if any required input is missing or the crypto
    /// step throws — caller should then fall back to echo.
    /// </summary>
    private static string? TryGenerateArpcBit55(
        IsoMessage request, string bit55Hex, EmvResponseConfig emvCfg,
        SessionConfig sessionCfg, string responseCode)
    {
        try
        {
            var trimmed = bit55Hex.AsSpan(emvCfg.ProprietaryHeaderBytes * 2);
            if (trimmed.Length < 4) return null;

            var tags = Cryptography.Tlv.TlvParser.Parse(trimmed.ToString());
            var arqc = tags.FirstOrDefault(t => t.Tag == "9F26")?.Value;
            var atc  = tags.FirstOrDefault(t => t.Tag == "9F36")?.Value;
            if (arqc is null || atc is null) return null;

            var pan = request.GetFieldValue(2);
            var psn = request.GetFieldValue(23) ?? "00";
            if (pan is null) return null;

            var imk = string.IsNullOrEmpty(emvCfg.ImkOverride)
                ? sessionCfg.IssuerMasterKey
                : emvCfg.ImkOverride;
            if (string.IsNullOrEmpty(imk)) return null;

            // The field named `IccMasterKey` on ArpcInput actually receives
            // the IMK — the calculator derives the ICC key internally using
            // PAN + PSN. Confusing name but verified at the implementation.
            var method = emvCfg.Brand?.Equals("Mastercard", StringComparison.OrdinalIgnoreCase) == true
                ? Cryptography.Emv.ArpcMethod.Method2
                : Cryptography.Emv.ArpcMethod.Method1;

            var arpcInput = new Cryptography.Emv.ArpcInput(
                Arqc: arqc,
                IccMasterKey: imk,
                Pan: pan,
                PanSequenceNumber: psn,
                Atc: atc,
                AuthResponseCode: responseCode,
                Csu: null,
                Profile: Cryptography.Emv.EmvProfile.Visa, // informational
                Method: method);

            var arpc = Cryptography.Emv.ArpcCalculator.CalculateArpc(arpcInput);
            return new Cryptography.Emv.EmvCryptoService()
                .BuildBit55Response(arpc, responseCode);
        }
        catch
        {
            // Any failure → caller falls back to echo.
            return null;
        }
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
        // If ARQC validation failed, decline. Either source counts:
        //   • SessionConfig.ValidateArqc — legacy/global toggle.
        //   • EmvResponse.ValidateArqc — new per-session knob inside the
        //     EMV config modal (only meaningful with GenerateArpc).
        var emvCfg = config.EmvResponse ?? EmvResponseConfig.Default;
        var shouldValidate = config.ValidateArqc
            || (emvCfg.Mode == EmvResponseMode.GenerateArpc && emvCfg.ValidateArqc);
        if (shouldValidate && !arqcValid)
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
