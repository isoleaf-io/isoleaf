namespace Iso8583Toolkit.Simulator.Logging;

public enum MessageDirection { Received, Sent }

/// <summary>
/// One entry in the simulator message log: raw bytes + decoded ISO 8583
/// fields + validation/error metadata. Emitted by IsoSessionHandler for
/// every message the simulator processes, and consumed by both the log
/// controller (batch fetch) and the SignalR hub (live push).
///
/// Lives in the Simulator library so the extracted <see cref="IMessageLog"/>
/// port can reference it without a host-side dependency.
/// </summary>
public sealed record MessageLogEntry
{
    public string EntryId { get; init; } = Guid.NewGuid().ToString();
    public required string SessionId { get; init; }
    public DateTime Timestamp { get; init; } = DateTime.UtcNow;
    public required MessageDirection Direction { get; init; }
    public required string AsciiMessage { get; init; }
    public string BinaryHexMessage { get; init; } = "";
    public string? Tpdu { get; init; }
    public bool TpduPresent { get; init; }
    /// <summary>Session's TPDU mode at the time the message was processed.</summary>
    public string? TpduMode { get; init; }
    public string? DecodedMti { get; init; }
    public List<DecodedField> DecodedFields { get; init; } = [];
    public string? ValidationSummary { get; init; }
    public bool HasErrors { get; init; }
    /// <summary>True when the message was rejected before parsing (e.g. TPDU policy).</summary>
    public bool Rejected { get; init; }
    /// <summary>Stable machine-readable code for the rejection reason (e.g. <c>TPDU_REQUIRED</c>).</summary>
    public string? ErrorCode { get; init; }

    /// <summary>
    /// Describes what the simulator did when the MTI was not in the response map.
    /// Examples: <c>Rejected — MTI not in response map</c>, <c>Derived:0210</c>,
    /// <c>Echoed</c>, <c>Custom:9999</c>. Only set when the request MTI was unmapped.
    /// </summary>
    public string? UnknownMtiAction { get; init; }

    public long ProcessingMs { get; init; }
}
