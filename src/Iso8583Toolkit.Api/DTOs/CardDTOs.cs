using Iso8583Toolkit.Cards.Brands;

namespace Iso8583Toolkit.Api.DTOs;

// ── Requests ────────────────────────────────────────────────────────────────

public sealed record GenerateCardRequest(
    string Brand,
    string? CardholderName = null,
    string? Expiry = null);

public sealed record ValidatePanRequest(string Pan);

public sealed record DetectBrandRequest(string Pan);

// ── Responses ───────────────────────────────────────────────────────────────

public sealed record VirtualCardResponse(
    string Pan,
    string PanMasked,
    string CardholderName,
    string Expiry,
    string ExpiryFormatted,
    string ServiceCode,
    string Cvv,
    string Cvv2,
    string Track1,
    string Track2,
    string Brand,
    DateTime GeneratedAt);

public sealed record ValidatePanResponse(
    bool IsValid,
    string Brand,
    int PanLength);

public sealed record DetectBrandResponse(
    string Brand,
    string? BinRange);

public sealed record BrandSummary(
    string Name,
    List<BinRangeDto> BinRanges);

public sealed record BinRangeDto(
    string Start,
    string End,
    int PanLength);
