using Iso8583Toolkit.Cryptography.Tlv;

namespace Iso8583Toolkit.Cryptography.Emv;

public sealed class EmvCryptoService
{
    /// <summary>
    /// Parses Bit 55 hex data, resolving tag names via the EMV registry.
    /// </summary>
    public TlvParseResult ParseBit55(string hexBit55)
    {
        var tags = TlvParser.Parse(hexBit55);

        var arqcTag = FindTag(tags, "9F26");
        var cidTag = FindTag(tags, "9F27");
        var atcTag = FindTag(tags, "9F36");
        var arcTag = FindTag(tags, "8A");

        return new TlvParseResult
        {
            Tags = tags,
            Arqc = arqcTag?.Value,
            CryptogramType = cidTag is not null
                ? EmvTagRegistry.InterpretCryptogramType(cidTag.Value)
                : null,
            Atc = atcTag?.Value,
            AuthResponseCode = arcTag?.Value
        };
    }

    /// <summary>
    /// Parses Bit 55, calculates expected ARQC, and compares with received 9F26.
    /// </summary>
    public ArqcResult CalculateAndValidateArqc(string hexBit55, ArqcInput input)
    {
        var parsed = ParseBit55(hexBit55);
        var calculatedArqc = ArqcCalculator.CalculateArqc(input);
        var sessionKey = ArqcCalculator.DeriveSessionKey(input);

        return new ArqcResult
        {
            CalculatedArqc = calculatedArqc,
            ReceivedArqc = parsed.Arqc ?? "",
            Tags = parsed.Tags,
            Profile = input.Profile.ToString(),
            SessionKey = Convert.ToHexString(sessionKey)
        };
    }

    /// <summary>
    /// Generates an ARQC for terminal simulation.
    /// </summary>
    public string GenerateArqc(ArqcInput input) =>
        ArqcCalculator.CalculateArqc(input);

    /// <summary>
    /// Generates an ARPC for issuer response.
    /// </summary>
    public string GenerateArpc(ArpcInput input) =>
        ArpcCalculator.CalculateArpc(input);

    /// <summary>
    /// Builds the value for tag 91 (Issuer Authentication Data).
    /// Format: ARPC (8 bytes) || IssuerAuthCode (0-8 bytes optional)
    /// </summary>
    public string BuildIssuerAuthData(string arpc, string? issuerAuthCode = null)
    {
        if (string.IsNullOrEmpty(issuerAuthCode))
            return arpc;

        return arpc + issuerAuthCode;
    }

    /// <summary>
    /// Builds a complete Bit 55 response for 0110/0210 messages.
    /// Contains tag 91, 8A, and optional scripts 71/72.
    /// </summary>
    public string BuildBit55Response(
        string arpc,
        string authResponseCode,
        string? issuerScript71 = null,
        string? issuerScript72 = null,
        string? issuerAuthCode = null)
    {
        var tags = new List<TlvTag>();

        // Tag 91: Issuer Authentication Data
        var issuerAuthData = BuildIssuerAuthData(arpc, issuerAuthCode);
        tags.Add(BuildTlvTag("91", issuerAuthData));

        // Tag 8A: Authorization Response Code
        tags.Add(BuildTlvTag("8A", authResponseCode));

        // Tag 71: Issuer Script Template 1 (optional)
        if (!string.IsNullOrEmpty(issuerScript71))
            tags.Add(BuildTlvTag("71", issuerScript71));

        // Tag 72: Issuer Script Template 2 (optional)
        if (!string.IsNullOrEmpty(issuerScript72))
            tags.Add(BuildTlvTag("72", issuerScript72));

        return TlvParser.ToHex(tags);
    }

    /// <summary>
    /// Builds the complete Bit 55 response and returns both hex and parsed tags.
    /// </summary>
    public (string HexBit55, List<TlvTag> Tags) BuildBit55ResponseWithTags(
        string arpc,
        string authResponseCode,
        string? issuerScript71 = null,
        string? issuerScript72 = null,
        string? issuerAuthCode = null)
    {
        var hex = BuildBit55Response(arpc, authResponseCode, issuerScript71, issuerScript72, issuerAuthCode);
        var tags = TlvParser.Parse(hex);
        return (hex, tags);
    }

    private static TlvTag BuildTlvTag(string tag, string value)
    {
        var info = EmvTagRegistry.GetInfo(tag);
        var valueBytes = Convert.FromHexString(value);
        var isConstructed = (Convert.FromHexString(tag[..2])[0] & 0x20) != 0;

        return new TlvTag(
            Tag: tag,
            Name: info?.Name ?? $"Unknown ({tag})",
            Length: valueBytes.Length,
            Value: value.ToUpperInvariant(),
            Description: info?.Description ?? "",
            IsPrimitive: !isConstructed,
            IsConstructed: isConstructed);
    }

    private static TlvTag? FindTag(List<TlvTag> tags, string tagId) =>
        tags.FirstOrDefault(t => t.Tag.Equals(tagId, StringComparison.OrdinalIgnoreCase));
}
