using Iso8583Toolkit.Application.DTOs;
using Iso8583Toolkit.Cryptography.Emv;
using Iso8583Toolkit.Cryptography.Tlv;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

// Both namespaces define a TlvParseResult: Emv adds Arqc/ATC/etc convenience props on top of
// the raw tag list, while Tlv carries the partial-parse diagnostics. Disambiguate at type-use.
using EmvParseResult = Iso8583Toolkit.Cryptography.Emv.TlvParseResult;
using TlvParseResult = Iso8583Toolkit.Cryptography.Tlv.TlvParseResult;

namespace Iso8583Toolkit.Backend.Controllers;

[ApiController]
[Route("api/emv")]
public sealed class EmvController : ControllerBase
{
    private readonly EmvCryptoService _service;

    public EmvController(EmvCryptoService service) => _service = service;

    [HttpPost("parse-bit55")]
    [EndpointSummary("Parse the BER-TLV bytes of an ISO 8583 Bit 55 (EMV data)")]
    [EndpointDescription("Returns each tag, its decoded value, plus convenience fields extracted from the EMV set (ARQC, ATC, Cryptogram Information Data, Auth Response Code). Failures inside the TLV stream produce a partial result with `isComplete=false` and a `parseError` — the UI can still render whatever was parsed up to the failure byte.")]
    [ProducesResponseType(typeof(ParseBit55Response), StatusCodes.Status200OK)]
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
            // Only input-shape errors (empty / non-hex / odd length) are 400s — structural
            // problems flow through the partial result so the UI can render what was parsed.
            return BadRequest(new { error = ex.Message });
        }

        return Ok(BuildParseResponse(partial));
    }

    [HttpPost("validate-arqc")]
    [EndpointSummary("Validate an ARQC against the issuer's expected value")]
    [EndpointDescription("Parses the Bit 55 payload to extract the transaction data, derives the expected ARQC from the supplied Issuer Master Key + PAN + PSN, and returns both the calculated and received values plus an `isValid` flag. Used by issuer hosts and integration testers.")]
    [ProducesResponseType(typeof(ValidateArqcResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult ValidateArqc([FromBody] ValidateArqcRequest request)
    {
        if (!Enum.TryParse<EmvProfile>(request.Profile, ignoreCase: true, out var profile))
            return BadRequest(new { error = $"Unknown profile '{request.Profile}'." });
        try
        {
            var parsed = _service.ParseBit55(request.HexBit55);
            var input = BuildArqcInput(parsed, request.IssuerMasterKey, request.Pan, request.PanSequenceNumber, profile);
            var result = _service.CalculateAndValidateArqc(request.HexBit55, input);
            return Ok(new ValidateArqcResponse(result.IsValid, result.CalculatedArqc, result.ReceivedArqc,
                MapTags(result.Tags), result.Profile, result.SessionKey));
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("generate-arqc")]
    [EndpointSummary("Compute the Application Request Cryptogram (ARQC) for a transaction")]
    [EndpointDescription("Derives the ICC Master Key from the IMK/PAN/PSN, then the Session Key per the brand profile, then runs the transaction data through DES/3DES to produce the 8-byte ARQC (returned as 16 hex chars). The response also exposes intermediate values (ICC MK, Session Key, transaction data MAC input) for debugging cryptogram mismatches.")]
    [ProducesResponseType(typeof(GenerateArqcResponse), StatusCodes.Status200OK)]
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
            return Ok(new GenerateArqcResponse(arqc,
                Convert.ToHexString(sessionKey),
                Convert.ToHexString(iccMk),
                Convert.ToHexString(txnData),
                profile.ToString()));
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("generate-arpc")]
    [EndpointSummary("Compute the Application Response Cryptogram (ARPC) — the issuer's reply to a card's ARQC")]
    [EndpointDescription("Supports both Method 1 (default for Visa / Elo / proprietary schemes) and Method 2 (Mastercard CSU-based). Returns the 8-byte ARPC plus the derived Session Key for traceability. Used by the issuer host to give the chip a verifiable \"Auth response accepted/rejected\" message.")]
    [ProducesResponseType(typeof(GenerateArpcResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult GenerateArpc([FromBody] GenerateArpcRequest request)
    {
        if (!Enum.TryParse<EmvProfile>(request.Profile, ignoreCase: true, out var profile))
            return BadRequest(new { error = $"Unknown profile '{request.Profile}'." });
        if (!Enum.TryParse<ArpcMethod>(request.Method, ignoreCase: true, out var method))
            return BadRequest(new { error = $"Unknown method '{request.Method}'." });
        try
        {
            var input = new ArpcInput(request.Arqc, request.IssuerMasterKey, request.Pan,
                request.PanSequenceNumber, request.Atc, request.AuthResponseCode,
                request.Csu, profile, method);
            var arpc = _service.GenerateArpc(input);
            var imk = Convert.FromHexString(request.IssuerMasterKey);
            var iccMk = SessionKeyDerivation.DeriveMasterKey(request.Pan, request.PanSequenceNumber, imk);
            var sessionKey = SessionKeyDerivation.DeriveSessionKey(iccMk, Convert.FromHexString(request.Atc), profile);
            return Ok(new GenerateArpcResponse(arpc, method.ToString(), Convert.ToHexString(sessionKey)));
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("build-response-bit55")]
    [EndpointSummary("Assemble an issuer-response Bit 55 (BER-TLV) payload")]
    [EndpointDescription("Packs the ARPC, Authorization Response Code and optional Issuer Scripts (71/72) and Issuer Auth Code into the BER-TLV bytes the chip expects in the response message. Returns the hex bytes and the list of tags that were emitted.")]
    [ProducesResponseType(typeof(BuildBit55ResponseResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult BuildResponse([FromBody] BuildBit55ResponseRequest request)
    {
        try
        {
            var (hex, tags) = _service.BuildBit55ResponseWithTags(
                request.Arpc, request.AuthResponseCode,
                request.IssuerScript71, request.IssuerScript72, request.IssuerAuthCode);
            return Ok(new BuildBit55ResponseResponse(hex, MapTags(tags)));
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("full-flow")]
    [EndpointSummary("Run the complete issuer flow: parse → validate ARQC → generate ARPC → build Bit 55 response")]
    [EndpointDescription("Convenience endpoint that chains `parse-bit55`, `validate-arqc`, `generate-arpc` (Method 1 for Visa/Elo, Method 2 for Mastercard) and `build-response-bit55` into a single call. Returns every intermediate result plus a human-readable summary for the UI's Full-Flow tab.")]
    [ProducesResponseType(typeof(FullFlowResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public IActionResult FullFlow([FromBody] FullFlowRequest request)
    {
        if (!Enum.TryParse<EmvProfile>(request.Profile, ignoreCase: true, out var profile))
            return BadRequest(new { error = $"Unknown profile '{request.Profile}'." });
        try
        {
            var parsed = _service.ParseBit55(request.HexBit55Request);
            var arqcInput = BuildArqcInput(parsed, request.IssuerMasterKey, request.Pan, request.PanSequenceNumber, profile);
            var arqcResult = _service.CalculateAndValidateArqc(request.HexBit55Request, arqcInput);

            var arpcMethod = profile == EmvProfile.Mastercard ? ArpcMethod.Method2 : ArpcMethod.Method1;
            var arpcInput = new ArpcInput(
                arqcResult.IsValid ? arqcResult.ReceivedArqc : arqcResult.CalculatedArqc,
                request.IssuerMasterKey, request.Pan, request.PanSequenceNumber,
                arqcInput.Atc, request.AuthResponseCode, null, profile, arpcMethod);
            var arpc = _service.GenerateArpc(arpcInput);

            var (hexResp, respTags) = _service.BuildBit55ResponseWithTags(
                arpc, request.AuthResponseCode,
                request.IssuerScript71, request.IssuerScript72, request.IssuerAuthCode);

            var summary = arqcResult.IsValid
                ? $"ARQC valid -> ARPC calculated ({arpcMethod}) -> Bit 55 response built"
                : $"ARQC INVALID -> ARPC calculated anyway -> Bit 55 response built";

            return Ok(new FullFlowResponse(
                new ValidateArqcResponse(arqcResult.IsValid, arqcResult.CalculatedArqc,
                    arqcResult.ReceivedArqc, MapTags(arqcResult.Tags), arqcResult.Profile, arqcResult.SessionKey),
                arpc, hexResp, MapTags(respTags), summary));
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    private static ArqcInput BuildArqcInput(EmvParseResult parsed, string imk, string pan, string psn, EmvProfile profile)
    {
        string Get(string tag, int padLen = 0)
        {
            var t = parsed.Tags.FirstOrDefault(x => x.Tag.Equals(tag, StringComparison.OrdinalIgnoreCase));
            var v = t?.Value ?? "";
            if (padLen > 0 && v.Length < padLen) v = v.PadLeft(padLen, '0');
            return v;
        }

        return new ArqcInput(imk, pan, psn,
            Get("9F36", 4), Get("9F02", 12), Get("9F03", 12),
            Get("9F1A", 4), Get("95", 10), Get("5F2A", 4),
            Get("9A", 6), Get("9C", 2), Get("9F37", 8),
            Get("82", 4), Get("9F10"), profile);
    }

    private static List<TlvTagResponse> MapTags(List<TlvTag> tags) =>
        tags.Select(t => new TlvTagResponse(t.Tag, t.Name, t.Length, t.Value, t.Description)).ToList();

    private static ParseBit55Response BuildParseResponse(TlvParseResult partial)
    {
        // Derive the EMV-aware convenience fields (ARQC, ATC, etc) from whatever tags were parsed.
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
