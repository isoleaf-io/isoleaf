namespace Iso8583Toolkit.Cryptography.Tlv;

public sealed record TlvTag(
    string Tag,
    string Name,
    int Length,
    string Value,
    string Description,
    bool IsPrimitive,
    bool IsConstructed)
{
    public List<TlvTag>? Children { get; init; }
}
