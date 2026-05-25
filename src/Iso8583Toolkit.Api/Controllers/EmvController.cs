using Iso8583Toolkit.Api.DTOs;
using Iso8583Toolkit.Cryptography.Emv;
using Iso8583Toolkit.Cryptography.Tlv;
using Microsoft.AspNetCore.Mvc;

using EmvParseResult = Iso8583Toolkit.Cryptography.Emv.TlvParseResult;
using TlvParseResult = Iso8583Toolkit.Cryptography.Tlv.TlvParseResult;

namespace Iso8583Toolkit.Api.Controllers;

[ApiController]
[Route("api/emv")]
public sealed class EmvController : ControllerBase
{
    private readonly EmvCryptoService _service = new();

    [HttpPost("parse-bit55")]
    [ProducesResponseType<ParseBit55Response>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult ParseBit55([FromBody] ParseBit55Request request)
    {
        if (string.IsNullOrWhiteSpace(request.HexBit55))
            return BadRequest(new { error = "HexBit55 is required." });

        TlvParseResult partial;
        try
        {
            partial = TlvParser.ParsePartial(request.HexBit55, request.HeaderBytes);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }

        return Ok(MapParseResult(partial));
    }

    [HttpPost("validate-arqc")]
    [ProducesResponseType<ValidateArqcResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult ValidateArqc([FromBody] ValidateArqcRequest request)
    {
        if (!Enum.TryParse<EmvProfile>(request.Profile, ignoreCase: true, out var profile))
            return BadRequest(new { error = $"Unknown profile '{request.Profile}'. Available: Visa, Mastercard, Elo" });

        try
        {
            var parsed = _service.ParseBit55(request.HexBit55);
            var input = BuildArqcInputFromTags(parsed, request.IssuerMasterKey, request.Pan,
                request.PanSequenceNumber, profile);
            var result = _service.CalculateAndValidateArqc(request.HexBit55, input);

            return Ok(new ValidateArqcResponse(
                result.IsValid,
                result.CalculatedArqc,
                result.ReceivedArqc,
                MapTags(result.Tags),
                result.Profile,
                result.SessionKey));
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("generate-arqc")]
    [ProducesResponseType<GenerateArqcResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult GenerateArqc([FromBody] GenerateArqcRequest request)
    {
        if (!Enum.TryParse<EmvProfile>(request.Profile, ignoreCase: true, out var profile))
            return BadRequest(new { error = $"Unknown profile '{request.Profile}'." });

        try
        {
            var input = new ArqcInput(
                request.IssuerMasterKey, request.Pan, request.PanSequenceNumber,
                request.Atc, request.AmountAuthorized, request.AmountOther,
                request.TerminalCountryCode, request.Tvr, request.CurrencyCode,
                request.TransactionDate, request.TransactionType, request.UnpredictableNumber,
                request.Aip, request.Iad, profile);

            var arqc = _service.GenerateArqc(input);
            var sessionKey = ArqcCalculator.DeriveSessionKey(input);
            var iccMk = ArqcCalculator.DeriveIccMasterKey(input);
            var txnData = ArqcCalculator.BuildTransactionData(input);

            return Ok(new GenerateArqcResponse(
                arqc,
                Convert.ToHexString(sessionKey),
                Convert.ToHexString(iccMk),
                Convert.ToHexString(txnData),
                profile.ToString()));
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("generate-arpc")]
    [ProducesResponseType<GenerateArpcResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult GenerateArpc([FromBody] GenerateArpcRequest request)
    {
        if (!Enum.TryParse<EmvProfile>(request.Profile, ignoreCase: true, out var profile))
            return BadRequest(new { error = $"Unknown profile '{request.Profile}'." });

        if (!Enum.TryParse<ArpcMethod>(request.Method, ignoreCase: true, out var method))
            return BadRequest(new { error = $"Unknown method '{request.Method}'. Available: Method1, Method2" });

        try
        {
            var input = new ArpcInput(
                request.Arqc, request.IssuerMasterKey, request.Pan,
                request.PanSequenceNumber, request.Atc, request.AuthResponseCode,
                request.Csu, profile, method);

            var arpc = _service.GenerateArpc(input);

            var issuerMasterKey = Convert.FromHexString(request.IssuerMasterKey);
            var iccMk = SessionKeyDerivation.DeriveMasterKey(request.Pan, request.PanSequenceNumber, issuerMasterKey);
            var atcBytes = Convert.FromHexString(request.Atc);
            var sessionKey = SessionKeyDerivation.DeriveSessionKey(iccMk, atcBytes, profile);

            return Ok(new GenerateArpcResponse(
                arpc,
                method.ToString(),
                Convert.ToHexString(sessionKey)));
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("build-response-bit55")]
    [ProducesResponseType<BuildBit55ResponseResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult BuildResponseBit55([FromBody] BuildBit55ResponseRequest request)
    {
        try
        {
            var (hex, tags) = _service.BuildBit55ResponseWithTags(
                request.Arpc,
                request.AuthResponseCode,
                request.IssuerScript71,
                request.IssuerScript72,
                request.IssuerAuthCode);

            return Ok(new BuildBit55ResponseResponse(hex, MapTags(tags)));
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("full-flow")]
    [ProducesResponseType<FullFlowResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult FullFlow([FromBody] FullFlowRequest request)
    {
        if (!Enum.TryParse<EmvProfile>(request.Profile, ignoreCase: true, out var profile))
            return BadRequest(new { error = $"Unknown profile '{request.Profile}'." });

        try
        {
            // Step 1: Parse Bit 55 and extract tags
            var parsed = _service.ParseBit55(request.HexBit55Request);

            // Step 2: Build ARQC input from parsed tags
            var arqcInput = BuildArqcInputFromTags(parsed, request.IssuerMasterKey,
                request.Pan, request.PanSequenceNumber, profile);

            // Step 3: Validate ARQC
            var arqcResult = _service.CalculateAndValidateArqc(request.HexBit55Request, arqcInput);

            // Step 4: Generate ARPC (Method 1 for Visa/Elo, Method 2 for Mastercard)
            var arpcMethod = profile == EmvProfile.Mastercard ? ArpcMethod.Method2 : ArpcMethod.Method1;
            var arpcInput = new ArpcInput(
                arqcResult.IsValid ? arqcResult.ReceivedArqc : arqcResult.CalculatedArqc,
                request.IssuerMasterKey, request.Pan, request.PanSequenceNumber,
                arqcInput.Atc, request.AuthResponseCode, null, profile, arpcMethod);
            var arpc = _service.GenerateArpc(arpcInput);

            // Step 5: Build response Bit 55
            var (hexResponse, responseTags) = _service.BuildBit55ResponseWithTags(
                arpc, request.AuthResponseCode,
                request.IssuerScript71, request.IssuerScript72, request.IssuerAuthCode);

            var summary = arqcResult.IsValid
                ? $"ARQC valid -> ARPC calculated ({arpcMethod}) -> Bit 55 response built"
                : $"ARQC INVALID (expected {arqcResult.CalculatedArqc}, received {arqcResult.ReceivedArqc}) -> ARPC calculated anyway -> Bit 55 response built";

            return Ok(new FullFlowResponse(
                new ValidateArqcResponse(
                    arqcResult.IsValid,
                    arqcResult.CalculatedArqc,
                    arqcResult.ReceivedArqc,
                    MapTags(arqcResult.Tags),
                    arqcResult.Profile,
                    arqcResult.SessionKey),
                arpc,
                hexResponse,
                MapTags(responseTags),
                summary));
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static ArqcInput BuildArqcInputFromTags(
        EmvParseResult parsed, string issuerMasterKey, string pan, string psn, EmvProfile profile)
    {
        string GetTag(string tag, int expectedHexLen = 0)
        {
            var t = parsed.Tags.FirstOrDefault(x =>
                x.Tag.Equals(tag, StringComparison.OrdinalIgnoreCase));
            var val = t?.Value ?? "";
            if (expectedHexLen > 0 && val.Length < expectedHexLen)
                val = val.PadLeft(expectedHexLen, '0');
            return val;
        }

        return new ArqcInput(
            IccMasterKey: issuerMasterKey,
            Pan: pan,
            PanSequenceNumber: psn,
            Atc: GetTag("9F36", 4),
            AmountAuthorized: GetTag("9F02", 12),
            AmountOther: GetTag("9F03", 12),
            TerminalCountryCode: GetTag("9F1A", 4),
            Tvr: GetTag("95", 10),
            CurrencyCode: GetTag("5F2A", 4),
            TransactionDate: GetTag("9A", 6),
            TransactionType: GetTag("9C", 2),
            UnpredictableNumber: GetTag("9F37", 8),
            Aip: GetTag("82", 4),
            Iad: GetTag("9F10"),
            Profile: profile);
    }

    private static List<TlvTagResponse> MapTags(List<TlvTag> tags) =>
        tags.Select(t => new TlvTagResponse(t.Tag, t.Name, t.Length, t.Value, t.Description)).ToList();

    private static ParseBit55Response MapParseResult(TlvParseResult partial)
    {
        var arqc = partial.Tags.FirstOrDefault(t => t.Tag.Equals("9F26", StringComparison.OrdinalIgnoreCase))?.Value;
        var cidValue = partial.Tags.FirstOrDefault(t => t.Tag.Equals("9F27", StringComparison.OrdinalIgnoreCase))?.Value;
        var atc = partial.Tags.FirstOrDefault(t => t.Tag.Equals("9F36", StringComparison.OrdinalIgnoreCase))?.Value;
        var arc = partial.Tags.FirstOrDefault(t => t.Tag.Equals("8A", StringComparison.OrdinalIgnoreCase))?.Value;
        var hasIssuerAuthData = partial.Tags.Any(t => t.Tag.Equals("91", StringComparison.OrdinalIgnoreCase));
        var cryptogramType = cidValue is not null ? EmvTagRegistry.InterpretCryptogramType(cidValue) : null;

        return new ParseBit55Response(
            Success: true,
            Tags: MapTags(partial.Tags),
            Arqc: arqc,
            CryptogramType: cryptogramType,
            Atc: atc,
            AuthResponseCode: arc,
            HasArqc: !string.IsNullOrEmpty(arqc),
            HasIssuerAuthData: hasIssuerAuthData,
            IsComplete: partial.IsComplete,
            ParseError: partial.ParseError,
            ParsedBytes: partial.ParsedBytes,
            TotalBytes: partial.TotalBytes,
            UnparsedHex: partial.UnparsedHex,
            ErrorAtByte: partial.ErrorAtByte,
            Warnings: partial.Warnings,
            HeaderHex: partial.HeaderHex);
    }
}
