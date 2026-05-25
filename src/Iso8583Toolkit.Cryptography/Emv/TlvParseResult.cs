using Iso8583Toolkit.Cryptography.Tlv;

namespace Iso8583Toolkit.Cryptography.Emv;

public sealed record TlvParseResult
{
    public required List<TlvTag> Tags { get; init; }
    public string? Arqc { get; init; }
    public string? CryptogramType { get; init; }
    public string? Atc { get; init; }
    public string? AuthResponseCode { get; init; }
    public bool HasArqc => !string.IsNullOrEmpty(Arqc);
    public bool HasIssuerAuthData => Tags.Any(t => t.Tag.Equals("91", StringComparison.OrdinalIgnoreCase));
}
