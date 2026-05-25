using Iso8583Toolkit.Cryptography.Emv;
using Iso8583Toolkit.Cryptography.Tlv;

namespace Iso8583Toolkit.Api.DTOs;

// ── Requests ────────────────────────────────────────────────────────────────

public sealed record ParseBit55Request(string HexBit55, int HeaderBytes = 0);

public sealed record ValidateArqcRequest(
    string HexBit55,
    string IssuerMasterKey,
    string Pan,
    string PanSequenceNumber,
    string Profile);

public sealed record GenerateArqcRequest(
    string IssuerMasterKey,
    string Pan,
    string PanSequenceNumber,
    string Atc,
    string AmountAuthorized,
    string AmountOther,
    string TerminalCountryCode,
    string Tvr,
    string CurrencyCode,
    string TransactionDate,
    string TransactionType,
    string UnpredictableNumber,
    string Aip,
    string Iad,
    string Profile);

public sealed record GenerateArpcRequest(
    string Arqc,
    string IssuerMasterKey,
    string Pan,
    string PanSequenceNumber,
    string Atc,
    string AuthResponseCode,
    string? Csu,
    string Profile,
    string Method);

public sealed record BuildBit55ResponseRequest(
    string Arpc,
    string AuthResponseCode,
    string? IssuerAuthCode = null,
    string? IssuerScript71 = null,
    string? IssuerScript72 = null);

public sealed record FullFlowRequest(
    string HexBit55Request,
    string IssuerMasterKey,
    string Pan,
    string PanSequenceNumber,
    string AuthResponseCode,
    string Profile,
    string? IssuerScript71 = null,
    string? IssuerScript72 = null,
    string? IssuerAuthCode = null);

// ── Responses ───────────────────────────────────────────────────────────────

public sealed record TlvTagResponse(
    string Tag,
    string Name,
    int Length,
    string Value,
    string Description);

public sealed record ParseBit55Response(
    bool Success,
    List<TlvTagResponse> Tags,
    string? Arqc,
    string? CryptogramType,
    string? Atc,
    string? AuthResponseCode,
    bool HasArqc,
    bool HasIssuerAuthData,
    bool IsComplete,
    string? ParseError,
    int ParsedBytes,
    int TotalBytes,
    string? UnparsedHex,
    int? ErrorAtByte,
    List<string> Warnings,
    string? HeaderHex);

public sealed record ValidateArqcResponse(
    bool IsValid,
    string CalculatedArqc,
    string ReceivedArqc,
    List<TlvTagResponse> Tags,
    string Profile,
    string SessionKey);

public sealed record GenerateArqcResponse(
    string Arqc,
    string SessionKey,
    string IccMasterKey,
    string TransactionData,
    string Profile);

public sealed record GenerateArpcResponse(
    string Arpc,
    string Method,
    string SessionKey);

public sealed record BuildBit55ResponseResponse(
    string HexBit55,
    List<TlvTagResponse> Tags);

public sealed record FullFlowResponse(
    ValidateArqcResponse ArqcValidation,
    string Arpc,
    string HexBit55Response,
    List<TlvTagResponse> ResponseTags,
    string FlowSummary);
