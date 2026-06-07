namespace Iso8583Toolkit.Simulator.Protocol;

/// <summary>
/// How the Issuer-role Rebatedor should construct Bit 55 in its responses.
/// </summary>
public enum EmvResponseMode
{
    /// <summary>
    /// Copy the incoming Bit 55 value verbatim into the response. No TLV
    /// parse, no key derivation — works with any payload, including networks
    /// that prepend a proprietary header to the TLV body. Default and safest.
    /// </summary>
    Echo,

    /// <summary>
    /// Skip the configured proprietary header, parse the TLV, extract ARQC
    /// (9F26) and ATC (9F36), derive ARPC with the configured (or workspace)
    /// IMK, and emit a response Bit 55 carrying tags 91 (ARPC) and 8A
    /// (Auth Response Code). Falls back to Echo when any step fails.
    /// </summary>
    GenerateArpc,
}

/// <summary>
/// Per-session settings for how the Issuer-role simulator handles Bit 55.
/// Defaults to <see cref="EmvResponseMode.Echo"/> — the safest behavior for
/// arbitrary payload shapes.
/// </summary>
public sealed record EmvResponseConfig
{
    public EmvResponseMode Mode { get; init; } = EmvResponseMode.Echo;

    /// <summary>
    /// Number of bytes at the START of Bit 55 that are NOT part of the TLV
    /// body (proprietary header inserted by some acquirer networks). Skipped
    /// before the TLV parse runs. Only used when <see cref="Mode"/> is
    /// <see cref="EmvResponseMode.GenerateArpc"/>.
    /// </summary>
    public int ProprietaryHeaderBytes { get; init; } = 0;

    /// <summary>
    /// Override for the IMK used to derive ARPC. When null, the session falls
    /// back to <see cref="SessionConfig.IssuerMasterKey"/>; if that's also
    /// null, the response degrades to Echo.
    /// </summary>
    public string? ImkOverride { get; init; }

    /// <summary>
    /// Card brand for the ARPC derivation method (Visa/Elo → Method1,
    /// Mastercard → Method2). Defaults to Visa.
    /// </summary>
    public string Brand { get; init; } = "Visa";

    public static EmvResponseConfig Default => new();
}
