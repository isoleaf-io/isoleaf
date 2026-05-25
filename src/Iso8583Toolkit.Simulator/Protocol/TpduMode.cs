namespace Iso8583Toolkit.Simulator.Protocol;

/// <summary>
/// Controls how the simulator handles TPDU prefixes on incoming and outgoing
/// messages, independent of <see cref="SimulatorRole"/>.
/// </summary>
public enum TpduMode
{
    /// <summary>Falls back to the per-role default (legacy behavior).</summary>
    Auto,

    /// <summary>TPDU must be present — messages without it are rejected with
    /// <c>TPDU_REQUIRED</c> and logged.</summary>
    Required,

    /// <summary>Accept with or without TPDU; response mirrors the inbound format
    /// (TPDU back if TPDU in; no TPDU if none).</summary>
    Optional,

    /// <summary>Strip any TPDU from inbound and never emit TPDU on outbound.</summary>
    Strip,
}
