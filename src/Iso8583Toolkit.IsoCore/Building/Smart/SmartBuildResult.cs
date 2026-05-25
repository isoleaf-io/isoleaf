namespace Iso8583Toolkit.IsoCore.Building.Smart;

public sealed record SmartBuildResult
{
    public bool Success { get; init; }
    public string? Error { get; init; }
    public string? Message { get; init; }
    public string? BinaryHexMessage { get; init; }
    public string? Tpdu { get; init; }
    public string? Bitmap { get; init; }
    public List<int>? ActiveBits { get; init; }
    public List<SmartFieldInfo>? Fields { get; init; }
    public string? GeneratedPan { get; init; }
    public string? GeneratedPin { get; init; }
    public string? ProfileUsed { get; init; }
    public string[]? AppliedRules { get; init; }

    /// <summary>
    /// <c>true</c> when bit 55 was generated with a random ARQC (no IMK configured).
    /// <c>false</c> when the ARQC was derived cryptographically from a workspace IMK.
    /// Defaults to <c>true</c> so callers that don't read it stay safe.
    /// Stays <c>true</c> when bit 55 is absent from the message — the value is only
    /// meaningful when <c>ActiveBits</c> contains 55.
    /// </summary>
    public bool ArqcIsSimulated { get; init; } = true;

    public static SmartBuildResult Fail(string error) => new() { Success = false, Error = error };
}
