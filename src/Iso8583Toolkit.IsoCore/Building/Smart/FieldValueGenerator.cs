using System.Security.Cryptography;
using System.Text;
using Iso8583Toolkit.Cryptography.Emv;

namespace Iso8583Toolkit.IsoCore.Building.Smart;

/// <summary>
/// Generates realistic field values for ISO 8583 messages based on
/// transaction profile and context. Stateful: keeps a STAN counter.
/// </summary>
public sealed class FieldValueGenerator
{
    private readonly EmvCryptoService _emvCryptoService;
    private int _stan;

    /// <summary>
    /// Becomes <c>false</c> when the most recent bit 55 generation derived the
    /// ARQC cryptographically from a configured IMK. Defaults to <c>true</c>
    /// because random/simulated cryptograms are the fallback path.
    /// </summary>
    public bool LastArqcWasSimulated { get; private set; } = true;

    public FieldValueGenerator(EmvCryptoService? emvCryptoService = null)
    {
        _emvCryptoService = emvCryptoService ?? new EmvCryptoService();
    }

    // ── MCC list (subset of common public codes) ────────────────────────────
    private static readonly string[] MccsPool =
    [
        "5411", // Grocery
        "5541", // Gas station
        "5812", // Restaurants
        "5912", // Drug stores
        "5999", // Misc retail
        "7011", // Hotels
        "4111", // Transit
        "5311", // Department stores
        "5691", // Clothing
        "5732"  // Electronics
    ];

    /// <summary>
    /// Generates the value for a single bit given the current context.
    /// Returns null if the generator does not handle the bit.
    /// </summary>
    public string? Generate(int bit, SmartFieldContext ctx)
    {
        return bit switch
        {
            2  => ctx.Pan,
            3  => GenerateProcessingCode(ctx),
            4  => ctx.Amount ?? GenerateRandomAmount(),
            7  => DateTime.UtcNow.ToString("MMddHHmmss"),
            11 => NextStan(),
            12 => DateTime.Now.ToString("HHmmss"),
            13 => DateTime.Now.ToString("MMdd"),
            14 => ctx.Expiry,
            18 => MccsPool[Random.Shared.Next(MccsPool.Length)],
            19 => ctx.CountryCode,
            22 => GetPosEntryMode(ctx.Channel),
            24 => "001",
            25 => ctx.Channel is TransactionChannel.CNP ? "59" : "00",
            32 => ctx.AcquiringId ?? "000001",
            35 => ctx.Track2,
            37 => GenerateRrn(),
            38 => GenerateAuthCode(),
            39 => "00",
            41 => ctx.TerminalId ?? GenerateAlphaNum(8),
            42 => ctx.MerchantId ?? GenerateAlphaNum(15),
            43 => "LOJA SIMULADOR          SAO PAULO   SPBR",
            49 => ctx.CurrencyCode,
            52 => GeneratePinBlock(ctx.Pan),
            55 => ctx.EmvData ?? GenerateEmvData(ctx),
            60 => "00000000",   // private field placeholder
            61 => "00000000",   // private field placeholder
            70 => "301",
            90 => GenerateOriginalData(ctx),
            _  => null
        };
    }

    // ── Processing code ─────────────────────────────────────────────────────
    // Bit 3 structure: [txCode 2] [fromAccount 2] [toAccount 2]
    //   txCode      00=purchase, 01=cash withdrawal, 20=refund
    //   fromAccount 00=default, 20=savings/checking, 30=credit, 40=voucher
    //   toAccount   00=default, 20=savings/checking (used by cash withdrawal)

    private static string GenerateProcessingCode(SmartFieldContext ctx)
    {
        var tx = ctx.TransactionType;
        var txCode = tx switch
        {
            TransactionType.Saque => "01",
            TransactionType.Devolucao => "20",
            _ => "00",
        };
        var fromAccount = tx switch
        {
            TransactionType.Debito => "20",
            TransactionType.Saque => "20",
            TransactionType.Credito => "30",
            TransactionType.PreAutorizacao => "30",
            TransactionType.Devolucao => "30",
            TransactionType.Voucher => "40",
            _ => "00",
        };
        var toAccount = tx switch
        {
            TransactionType.Saque => "20",
            _ => "00",
        };
        return $"{txCode}{fromAccount}{toAccount}";
    }

    // ── POS Entry Mode ──────────────────────────────────────────────────────

    public static string GetPosEntryMode(TransactionChannel channel) =>
        channel switch
        {
            TransactionChannel.Presencial => "010",
            TransactionChannel.Tarja      => "021",
            TransactionChannel.Chip       => "051",
            TransactionChannel.Contactless => "071",
            TransactionChannel.CNP        => "010",
            TransactionChannel.Fallback   => "801",
            _ => "010"
        };

    // ── STAN ────────────────────────────────────────────────────────────────

    private string NextStan() =>
        Interlocked.Increment(ref _stan).ToString("D6");

    // ── Random generators ───────────────────────────────────────────────────

    private static string GenerateRandomAmount()
    {
        var cents = Random.Shared.Next(1000, 50001); // R$10.00 - R$500.00
        return cents.ToString("D12");
    }

    private static string GenerateRrn()
    {
        Span<char> buf = stackalloc char[12];
        const string chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        for (var i = 0; i < 12; i++)
            buf[i] = chars[Random.Shared.Next(chars.Length)];
        return new string(buf);
    }

    private static string GenerateAuthCode()
    {
        Span<char> buf = stackalloc char[6];
        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        for (var i = 0; i < 6; i++)
            buf[i] = chars[Random.Shared.Next(chars.Length)];
        return new string(buf);
    }

    private static string GenerateAlphaNum(int length)
    {
        Span<char> buf = stackalloc char[length];
        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        for (var i = 0; i < buf.Length; i++)
            buf[i] = chars[Random.Shared.Next(chars.Length)];
        return new string(buf);
    }

    // ── PIN Block (ISO-0 format) ────────────────────────────────────────────

    public static string GeneratePinBlock(string pan)
    {
        var pin = Random.Shared.Next(0, 10000).ToString("D4");
        return CalculatePinBlock(pin, pan);
    }

    /// <summary>
    /// Calculates ISO-0 (Format 0) PIN Block = XOR(PINField, PANField).
    /// PINField  = 0{len}{PIN}{F-padding to 16 chars}
    /// PANField  = 0000{PAN[3..14]}0 (rightmost 12 digits excl check digit, zero-padded)
    /// Result encrypted with a simulated ZPK (3DES).
    /// </summary>
    internal static string CalculatePinBlock(string pin, string pan)
    {
        // PIN Field: 0 + length + PIN + F padding
        var pinField = $"0{pin.Length}{pin}".PadRight(16, 'F');

        // PAN Field: 0000 + 12 rightmost digits excluding check digit
        var panRight12 = pan.Length >= 13
            ? pan.Substring(pan.Length - 13, 12)
            : pan.PadLeft(13, '0').Substring(1, 12);
        var panField = $"0000{panRight12}";

        // XOR
        var pinBytes = Convert.FromHexString(pinField);
        var panBytes = Convert.FromHexString(panField);
        var clearBlock = new byte[8];
        for (var i = 0; i < 8; i++)
            clearBlock[i] = (byte)(pinBytes[i] ^ panBytes[i]);

        // Encrypt with simulated ZPK (test key)
        var zpk = Convert.FromHexString("0123456789ABCDEFFEDCBA98765432100123456789ABCDEF");
        using var des = System.Security.Cryptography.TripleDES.Create();
        des.Key = zpk;
        des.Mode = CipherMode.ECB;
        des.Padding = PaddingMode.None;
        var encrypted = des.CreateEncryptor().TransformFinalBlock(clearBlock, 0, 8);
        return Convert.ToHexString(encrypted);
    }

    // ── EMV TLV (bit 55) ────────────────────────────────────────────────────

    private static int _atcCounter;

    /// <summary>
    /// Generates bit 55 TLV. When the workspace has an IMK configured,
    /// the 9F26 cryptogram is derived via 3DES per EMV; otherwise a random
    /// ARQC is used (the legacy simulated path).
    /// </summary>
    public string GenerateEmvData(SmartFieldContext ctx)
    {
        var imk = ctx.Workspace?.Imk;
        if (!string.IsNullOrWhiteSpace(imk) && imk.Length == 32 && IsHexString(imk))
        {
            try
            {
                var tlv = GenerateRealEmv(ctx, imk!);
                LastArqcWasSimulated = false;
                return tlv;
            }
            catch
            {
                // Fall back to simulated if any unexpected input invalidates derivation.
            }
        }
        LastArqcWasSimulated = true;
        return GenerateSimulatedEmv(ctx);
    }

    private string GenerateRealEmv(SmartFieldContext ctx, string imk)
    {
        var atcInt = Interlocked.Increment(ref _atcCounter);
        var atc = atcInt.ToString("X4").PadLeft(4, '0');
        var amount = (ctx.Amount ?? "000000001000").PadLeft(12, '0');
        var currency = ctx.CurrencyCode.PadLeft(4, '0');
        var date = DateTime.UtcNow.ToString("yyMMdd");
        var txType = "00";
        var un = RandomHex(8);
        var aip = "1800";
        var iad = "0706010A03A40000";
        var tvr = "0000000000";
        var termCountry = ctx.CountryCode.PadLeft(4, '0');

        var profile = ctx.Brand switch
        {
            SmartBrand.Mastercard => EmvProfile.Mastercard,
            SmartBrand.Elo => EmvProfile.Elo,
            _ => EmvProfile.Visa,
        };

        var input = new ArqcInput(
            IccMasterKey: imk,
            Pan: ctx.Pan,
            PanSequenceNumber: "00",
            Atc: atc,
            AmountAuthorized: amount,
            AmountOther: "000000000000",
            TerminalCountryCode: termCountry,
            Tvr: tvr,
            CurrencyCode: currency,
            TransactionDate: date,
            TransactionType: txType,
            UnpredictableNumber: un,
            Aip: aip,
            Iad: iad,
            Profile: profile);

        var arqc = _emvCryptoService.GenerateArqc(input);
        return BuildEmvTlv(arqc, atc, un, amount, currency, date, txType, tvr, aip, iad, termCountry);
    }

    private static string BuildEmvTlv(
        string arqc, string atc, string un, string amount, string currency,
        string date, string txType, string tvr, string aip, string iad, string termCountry)
    {
        var sb = new StringBuilder(256);
        AppendTag(sb, "9F26", arqc);            // ARQC (8 bytes)
        AppendTag(sb, "9F27", "80");            // CID — ARQC
        AppendTag(sb, "9F10", iad);             // IAD
        AppendTag(sb, "9F37", un);              // Unpredictable Number
        AppendTag(sb, "9F36", atc);             // ATC
        AppendTag(sb, "95",   tvr);             // TVR
        AppendTag(sb, "9A",   date);            // Transaction Date
        AppendTag(sb, "9C",   txType);          // Transaction Type
        AppendTag(sb, "9F02", amount);          // Amount Authorized
        AppendTag(sb, "5F2A", currency);        // Currency Code
        AppendTag(sb, "82",   aip);             // AIP
        AppendTag(sb, "9F1A", termCountry);     // Terminal Country Code
        AppendTag(sb, "9F33", "E0B8C8");        // Terminal Capabilities
        AppendTag(sb, "9F35", "22");            // Terminal Type
        AppendTag(sb, "9F34", "420300");        // CVM Results
        return sb.ToString();
    }

    private static bool IsHexString(string s)
    {
        foreach (var c in s)
        {
            var isHex = (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F') || (c >= 'a' && c <= 'f');
            if (!isHex) return false;
        }
        return true;
    }

    public static string GenerateSimulatedEmv(SmartFieldContext ctx)
    {
        var sb = new StringBuilder(256);
        var now = DateTime.UtcNow;

        // 9F26 - ARQC (8 bytes random)
        AppendTag(sb, "9F26", RandomHex(16));
        // 9F27 - Cryptogram Information Data (ARQC = 0x80)
        AppendTag(sb, "9F27", "80");
        // 9F10 - IAD (typical)
        AppendTag(sb, "9F10", "0706010A03A40000");
        // 9F37 - Unpredictable Number (4 bytes random)
        AppendTag(sb, "9F37", RandomHex(8));
        // 9F36 - ATC (sequential)
        var atc = Interlocked.Increment(ref _atcCounter);
        AppendTag(sb, "9F36", atc.ToString("X4"));
        // 95 - TVR (no errors)
        AppendTag(sb, "95", "0000000000");
        // 9A - Transaction Date
        AppendTag(sb, "9A", now.ToString("yyMMdd"));
        // 9C - Transaction Type (purchase)
        AppendTag(sb, "9C", "00");
        // 9F02 - Amount Authorized
        var amt = ctx.Amount ?? "000000001000";
        AppendTag(sb, "9F02", amt.PadLeft(12, '0'));
        // 5F2A - Transaction Currency Code
        AppendTag(sb, "5F2A", ctx.CurrencyCode.PadLeft(4, '0'));
        // 82 - AIP
        AppendTag(sb, "82", "1800");
        // 9F1A - Terminal Country Code
        AppendTag(sb, "9F1A", ctx.CountryCode.PadLeft(4, '0'));
        // 9F33 - Terminal Capabilities
        AppendTag(sb, "9F33", "E0B8C8");
        // 9F35 - Terminal Type
        AppendTag(sb, "9F35", "22");
        // 9F34 - CVM Results (PIN online + successful)
        AppendTag(sb, "9F34", "420300");

        return sb.ToString();
    }

    private static void AppendTag(StringBuilder sb, string tag, string hexValue)
    {
        sb.Append(tag);
        var byteLen = hexValue.Length / 2;
        sb.Append(byteLen.ToString("X2"));
        sb.Append(hexValue);
    }

    private static string RandomHex(int hexChars)
    {
        var bytes = new byte[hexChars / 2];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToHexString(bytes);
    }

    // ── Original data (bit 90) for reversals ────────────────────────────────

    private static string GenerateOriginalData(SmartFieldContext ctx)
    {
        var origMti = "0200";
        var origStan = "000001";
        var origDate = DateTime.UtcNow.ToString("MMddHHmmss");
        var origAcqId = (ctx.AcquiringId ?? "000001").PadLeft(11, '0');
        var origFwdId = "00000000000";
        return $"{origMti}{origStan}{origDate}{origAcqId}{origFwdId}";
    }
}

/// <summary>
/// Contextual data passed to the field value generator.
/// Pre-computed by SmartIsoBuilder before field generation.
/// </summary>
public sealed class SmartFieldContext
{
    public required string Pan { get; init; }
    public required string Expiry { get; init; }
    public required string Track2 { get; init; }
    public required string CurrencyCode { get; init; }
    public required string CountryCode { get; init; }
    public required TransactionType TransactionType { get; init; }
    public required TransactionChannel Channel { get; init; }
    public string? Amount { get; init; }
    public string? AcquiringId { get; init; }
    public string? TerminalId { get; init; }
    public string? MerchantId { get; init; }
    public string? EmvData { get; init; }
    public string? GeneratedPin { get; set; }

    /// <summary>Brand resolved by SmartIsoBuilder — used by Crypto fields like ARQC.</summary>
    public SmartBrand Brand { get; init; } = SmartBrand.Default;

    /// <summary>Optional workspace-level keys (IMK, ZPK). When <see cref="IWorkspaceKeys.Imk"/>
    /// is configured, bit 55 ARQC is cryptographically derived instead of random.</summary>
    public IWorkspaceKeys? Workspace { get; init; }
}
