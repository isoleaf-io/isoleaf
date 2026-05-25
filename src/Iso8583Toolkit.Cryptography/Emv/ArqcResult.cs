using Iso8583Toolkit.Cryptography.Tlv;

namespace Iso8583Toolkit.Cryptography.Emv;

public sealed record ArqcResult
{
    public required string CalculatedArqc { get; init; }
    public required string ReceivedArqc { get; init; }
    public bool IsValid => string.Equals(CalculatedArqc, ReceivedArqc, StringComparison.OrdinalIgnoreCase);
    public required List<TlvTag> Tags { get; init; }
    public required string Profile { get; init; }
    public required string SessionKey { get; init; }
}
