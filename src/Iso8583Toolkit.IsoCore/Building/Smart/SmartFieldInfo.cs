namespace Iso8583Toolkit.IsoCore.Building.Smart;

public enum SmartFieldOrigin
{
    Generated,
    Custom,
    Derived
}

public sealed record SmartFieldInfo(
    int BitNumber,
    string Name,
    string Value,
    string MaskedValue,
    SmartFieldOrigin Origin,
    string? Rule = null);
