using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Iso8583Toolkit.Iso20022.Pix;

/// <summary>
/// Decode, generate and analyse Pix Copia-e-Cola payloads (EMV-MPM with the
/// BCB extensions). Stateless, safe as a singleton.
///
/// Payload format is EMV's TLV: every field is <c>ID(2)</c> + <c>Length(2)</c>
/// + <c>Value(Length)</c>, concatenated. The CRC field (ID 63) sits at the
/// end and covers everything up to and including its own <c>"6304"</c>
/// header — see <see cref="ComputeCrc16"/>.
/// </summary>
public sealed class PixQrCodeService
{
    private const string GuiPix = "br.gov.bcb.pix";

    // Top-level EMV field labels used to render the decode table; subfield
    // labels for the merchant-account (26) and additional-data (62)
    // groups live in their own lookup tables.
    private static readonly Dictionary<string, string> FieldNames = new()
    {
        ["00"] = "Payload Format Indicator",
        ["01"] = "Point of Initiation Method",
        ["26"] = "Merchant Account Information (Pix)",
        ["52"] = "Merchant Category Code",
        ["53"] = "Transaction Currency",
        ["54"] = "Transaction Amount",
        ["58"] = "Country Code",
        ["59"] = "Merchant Name",
        ["60"] = "Merchant City",
        ["62"] = "Additional Data Field Template",
        ["63"] = "CRC16",
    };

    private static readonly Dictionary<string, string> MerchantAccountSubNames = new()
    {
        ["00"] = "GUI (br.gov.bcb.pix)",
        ["01"] = "Pix Key",
        ["02"] = "Description",
        ["25"] = "URL (Dynamic)",
    };

    private static readonly Dictionary<string, string> AdditionalDataSubNames = new()
    {
        ["05"] = "TXID",
    };

    // Cache of compiled regexes — these run on every key analysis from the
    // frontend live-typing handler, so initialising once is worth it.
    private static readonly Regex EvpUuid =
        new(@"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89ab][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
            RegexOptions.Compiled);
    private static readonly Regex Email =
        new(@"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$", RegexOptions.Compiled);
    private static readonly Regex BrazilPhone =
        new(@"^\+55\d{10,11}$", RegexOptions.Compiled);
    private static readonly Regex Digits11 = new(@"^\d{11}$", RegexOptions.Compiled);
    private static readonly Regex Digits14 = new(@"^\d{14}$", RegexOptions.Compiled);
    private static readonly Regex Alnum14 = new(@"^[A-Za-z0-9]{14}$", RegexOptions.Compiled);
    private static readonly Regex TxIdShape = new(@"^[A-Za-z0-9]+$", RegexOptions.Compiled);

    // ---- 1. Decode ---------------------------------------------------------

    public PixDecodeResult Decode(string payload)
    {
        var p = (payload ?? string.Empty).Trim();
        var warnings = new List<string>();
        var fields = ParseTopLevel(p);
        var rows = new List<PixField>();

        string? pixKey = null;
        string? merchantName = null;
        string? merchantCity = null;
        string? amount = null;
        string? txId = null;
        var qrType = "static";

        foreach (var f in fields)
        {
            var name = FieldNames.GetValueOrDefault(f.Id, $"Field {f.Id}");
            string? description = null;
            var sub = new List<PixField>();

            switch (f.Id)
            {
                case "01":
                    qrType = f.Value == "12" ? "dynamic" : "static";
                    description = qrType == "dynamic" ? "Dynamic (single-use)" : "Static (reusable)";
                    break;
                case "26":
                    foreach (var s in ParseTopLevel(f.Value))
                    {
                        var subName = MerchantAccountSubNames.GetValueOrDefault(s.Id, $"Subfield {s.Id}");
                        sub.Add(new PixField(s.Id, subName, s.Value, null, []));
                        if (s.Id == "01") pixKey = s.Value;
                    }
                    break;
                case "52": description = MapMcc(f.Value); break;
                case "53": description = f.Value == "986" ? "BRL (Brazilian Real)" : "ISO 4217 numeric"; break;
                case "54": amount = f.Value; description = "Amount in BRL"; break;
                case "58": description = f.Value == "BR" ? "Brazil" : "ISO 3166-1 alpha-2"; break;
                case "59": merchantName = f.Value; break;
                case "60": merchantCity = f.Value; break;
                case "62":
                    foreach (var s in ParseTopLevel(f.Value))
                    {
                        var subName = AdditionalDataSubNames.GetValueOrDefault(s.Id, $"Subfield {s.Id}");
                        sub.Add(new PixField(s.Id, subName, s.Value, null, []));
                        if (s.Id == "05") txId = s.Value;
                    }
                    break;
            }
            rows.Add(new PixField(f.Id, name, f.Value, description, sub));
        }

        // CRC must cover the payload up to and including the literal "6304"
        // (ID + Length of the CRC field itself). Anchor on the LAST "6304"
        // so trailing content doesn't move the cut point.
        string? providedCrc = null;
        string? expectedCrc = null;
        var crcValid = false;
        var crcMarker = p.LastIndexOf("6304", StringComparison.Ordinal);
        if (crcMarker >= 0 && crcMarker + 8 == p.Length)
        {
            providedCrc = p[(crcMarker + 4)..];
            expectedCrc = ComputeCrc16(p[..(crcMarker + 4)]);
            crcValid = string.Equals(expectedCrc, providedCrc, StringComparison.OrdinalIgnoreCase);
            if (!crcValid)
                warnings.Add($"CRC inválido (esperado {expectedCrc}, recebido {providedCrc}).");
        }
        else
        {
            warnings.Add("Campo CRC (ID 63) ausente ou mal posicionado.");
        }

        if (pixKey is null) warnings.Add("Chave Pix (ID 26.01) ausente.");
        if (string.IsNullOrEmpty(merchantName)) warnings.Add("Nome do recebedor (ID 59) ausente.");
        if (string.IsNullOrEmpty(merchantCity)) warnings.Add("Cidade (ID 60) ausente.");

        var pixKeyType = pixKey is null ? null : AnalyzePixKey(pixKey).KeyType;

        return new PixDecodeResult(
            Payload: p,
            QrType: qrType,
            PixKey: pixKey,
            PixKeyType: pixKeyType,
            MerchantName: merchantName,
            MerchantCity: merchantCity,
            Amount: amount,
            TxId: txId,
            CrcValid: crcValid,
            ExpectedCrc: expectedCrc,
            ProvidedCrc: providedCrc,
            Fields: rows,
            Warnings: warnings);
    }

    // ---- 2. Generate -------------------------------------------------------

    public string Generate(PixGenerateRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (string.IsNullOrWhiteSpace(request.PixKey))
            throw new ArgumentException("Pix key is required.", nameof(request));
        if (string.IsNullOrWhiteSpace(request.MerchantName))
            throw new ArgumentException("Merchant name is required.", nameof(request));
        if (string.IsNullOrWhiteSpace(request.MerchantCity))
            throw new ArgumentException("Merchant city is required.", nameof(request));

        var sb = new StringBuilder();
        AppendField(sb, "00", "01");
        AppendField(sb, "01", request.SingleUse ? "12" : "11");

        // Subfields of ID 26 (Merchant Account Info — Pix).
        var merchantAccount = new StringBuilder();
        AppendField(merchantAccount, "00", GuiPix);
        AppendField(merchantAccount, "01", request.PixKey.Trim());
        if (!string.IsNullOrWhiteSpace(request.Description))
            AppendField(merchantAccount, "02", request.Description.Trim());
        AppendField(sb, "26", merchantAccount.ToString());

        AppendField(sb, "52", "0000");
        AppendField(sb, "53", "986");
        if (request.Amount.HasValue)
            AppendField(sb, "54", request.Amount.Value.ToString("0.00", CultureInfo.InvariantCulture));
        AppendField(sb, "58", "BR");
        AppendField(sb, "59", Normalize(request.MerchantName, 25));
        AppendField(sb, "60", Normalize(request.MerchantCity, 15));

        // Subfields of ID 62 (Additional Data — TXID). "***" is the EMV
        // sentinel for "no TXID assigned yet".
        var additional = new StringBuilder();
        AppendField(additional, "05", string.IsNullOrWhiteSpace(request.TxId) ? "***" : request.TxId.Trim());
        AppendField(sb, "62", additional.ToString());

        sb.Append("6304");
        sb.Append(ComputeCrc16(sb.ToString()));
        return sb.ToString();
    }

    // ---- 3. GenerateTxId ---------------------------------------------------

    public string GenerateTxId()
    {
        const string chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        var bytes = new byte[26];
        RandomNumberGenerator.Fill(bytes);
        var sb = new StringBuilder(26);
        foreach (var b in bytes) sb.Append(chars[b % chars.Length]);
        return sb.ToString();
    }

    // ---- 4. ValidateTxId ---------------------------------------------------

    public PixTxIdValidationResult ValidateTxId(string? txId)
    {
        var errors = new List<string>();
        if (string.IsNullOrEmpty(txId))
        {
            errors.Add("TXID é obrigatório.");
            return new PixTxIdValidationResult(false, errors);
        }
        if (txId.Length is < 26 or > 35)
            errors.Add("TXID deve ter entre 26 e 35 caracteres.");
        if (!TxIdShape.IsMatch(txId))
            errors.Add("TXID deve conter apenas letras e dígitos (sem espaços, hífens ou símbolos).");
        return new PixTxIdValidationResult(errors.Count == 0, errors);
    }

    // ---- 5. AnalyzePixKey --------------------------------------------------

    public PixKeyAnalysis AnalyzePixKey(string? key)
    {
        var k = key?.Trim() ?? string.Empty;
        if (k.Length == 0)
            return new PixKeyAnalysis(string.Empty, "UNKNOWN", ["Chave vazia."]);

        if (EvpUuid.IsMatch(k)) return new PixKeyAnalysis(k, "EVP", []);
        if (Email.IsMatch(k)) return new PixKeyAnalysis(k, "EMAIL", []);
        if (BrazilPhone.IsMatch(k)) return new PixKeyAnalysis(k, "PHONE", []);
        if (Digits11.IsMatch(k)) return new PixKeyAnalysis(k, "CPF", []);
        if (Digits14.IsMatch(k))
            return new PixKeyAnalysis(k, "CNPJ",
                ["A partir de 2026, CNPJ pode ser alfanumérico (Resolução BCB 322/2023)."]);
        if (Alnum14.IsMatch(k))
            return new PixKeyAnalysis(k, "CNPJ",
                ["CNPJ alfanumérico (Resolução BCB 322/2023)."]);
        return new PixKeyAnalysis(k, "UNKNOWN",
            ["Formato de chave não reconhecido. Esperado EVP (UUID), email, telefone (+55…), CPF ou CNPJ."]);
    }

    // ---- Internals ---------------------------------------------------------

    /// <summary>EMV TLV walk: stops on length-overruns instead of throwing.</summary>
    private static List<(string Id, string Value)> ParseTopLevel(string s)
    {
        var result = new List<(string, string)>();
        var i = 0;
        while (i + 4 <= s.Length)
        {
            var id = s.Substring(i, 2);
            if (!int.TryParse(s.AsSpan(i + 2, 2), NumberStyles.Integer, CultureInfo.InvariantCulture, out var len))
                break;
            if (i + 4 + len > s.Length) break;
            result.Add((id, s.Substring(i + 4, len)));
            i += 4 + len;
        }
        return result;
    }

    private static void AppendField(StringBuilder sb, string id, string value)
    {
        sb.Append(id);
        sb.Append(value.Length.ToString("D2", CultureInfo.InvariantCulture));
        sb.Append(value);
    }

    /// <summary>
    /// Strip diacritics, uppercase via invariant culture, truncate to the
    /// EMV cap (25 chars for merchant name, 15 for city). Pix QR readers
    /// reject non-ASCII payloads in those fields.
    /// </summary>
    private static string Normalize(string value, int maxLength)
    {
        var d = value.Trim().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(d.Length);
        foreach (var c in d)
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        var result = sb.ToString().Normalize(NormalizationForm.FormC).ToUpperInvariant();
        return result.Length > maxLength ? result[..maxLength] : result;
    }

    /// <summary>CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF, no reflection, no xor-out.</summary>
    public static string ComputeCrc16(string input)
    {
        var bytes = Encoding.UTF8.GetBytes(input);
        var crc = 0xFFFF;
        foreach (var b in bytes)
        {
            crc ^= b << 8;
            for (var i = 0; i < 8; i++)
                crc = (crc & 0x8000) != 0
                    ? ((crc << 1) ^ 0x1021) & 0xFFFF
                    : (crc << 1) & 0xFFFF;
        }
        return crc.ToString("X4", CultureInfo.InvariantCulture);
    }

    private static string MapMcc(string value) => value switch
    {
        "0000" => "Generic / unspecified",
        _ => $"MCC {value}",
    };
}
