namespace Iso8583Toolkit.Iso20022.Pix;

/// <summary>One decoded EMV TLV field from a Pix payload.</summary>
public sealed record PixField(
    string Id,
    string Name,
    string Value,
    string? Description,
    IReadOnlyList<PixField> SubFields);

/// <summary>Full Decode result: extracted values + every parsed field + CRC/warnings.</summary>
public sealed record PixDecodeResult(
    string Payload,
    /// <summary>"static" (POI=11) or "dynamic" (POI=12).</summary>
    string QrType,
    string? PixKey,
    /// <summary>"EVP"/"EMAIL"/"PHONE"/"CPF"/"CNPJ"/"UNKNOWN" — derived from <see cref="PixKey"/>.</summary>
    string? PixKeyType,
    string? MerchantName,
    string? MerchantCity,
    string? Amount,
    string? TxId,
    bool CrcValid,
    string? ExpectedCrc,
    string? ProvidedCrc,
    IReadOnlyList<PixField> Fields,
    IReadOnlyList<string> Warnings);

/// <summary>Input for the Generate endpoint.</summary>
public sealed record PixGenerateRequest(
    string PixKey,
    string MerchantName,
    string MerchantCity,
    decimal? Amount = null,
    string? TxId = null,
    string? Description = null,
    /// <summary>When true, sets POI Method to 12 (dynamic / single-use).</summary>
    bool SingleUse = false);

public sealed record PixTxIdValidationResult(
    bool IsValid,
    IReadOnlyList<string> Errors);

public sealed record PixKeyAnalysis(
    string Key,
    /// <summary>"EVP" | "EMAIL" | "PHONE" | "CPF" | "CNPJ" | "UNKNOWN".</summary>
    string KeyType,
    IReadOnlyList<string> Warnings);
