namespace Iso8583Toolkit.Simulator.Protocol;

/// <summary>
/// How the simulator should react when an inbound MTI is not present in
/// <see cref="ResponseRules.MtiResponseMap"/>. Default is <see cref="Derive"/>
/// so unknown MTIs get a best-effort response instead of leaving the terminal hanging.
/// </summary>
public enum UnknownMtiResponse
{
    /// <summary>No response is emitted. Caller observes a timeout.</summary>
    Reject,

    /// <summary>
    /// Derive a response MTI by incrementing the third (function) digit:
    /// 0 → 1 (Request → Response), 2 → 3 (Advice → Advice Response),
    /// 4 → 5 (Notification → Notification Response). Anything else (already a
    /// response, or non-numeric third digit) falls back to Reject.
    /// </summary>
    Derive,

    /// <summary>Respond with the same MTI received (debug / loopback).</summary>
    Echo,

    /// <summary>Use a fixed MTI provided in <see cref="SessionConfig.UnknownMtiCustomValue"/>.</summary>
    Custom,
}
