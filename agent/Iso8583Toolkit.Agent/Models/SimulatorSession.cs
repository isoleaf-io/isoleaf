using Iso8583Toolkit.Simulator.Protocol;

namespace Iso8583Toolkit.Agent.Models;

public enum SessionStatus { Starting, Active, Stopped, Error }

public sealed record SimulatorSession
{
    public required string SessionId { get; init; }
    public required int TcpPort { get; init; }
    public required SimulatorMode Mode { get; init; }
    public required SimulatorRole Role { get; init; }
    public string LayoutName { get; init; } = "default";
    public string DefaultResponseCode { get; init; } = "00";
    public bool ValidateArqc { get; init; }
    public bool AutoRespond { get; init; } = true;
    public SessionStatus Status { get; set; } = SessionStatus.Starting;
    public DateTime StartedAt { get; init; } = DateTime.UtcNow;
    public DateTime? StoppedAt { get; set; }
    public int MessagesProcessed { get; set; }
    public int MessagesRejected { get; set; }
    public string? LastError { get; set; }

    /// <summary>Remote host for Injetor sessions; null for Rebatedor.</summary>
    public string? TargetHost { get; init; }
    /// <summary>Remote port for Injetor sessions; null for Rebatedor.</summary>
    public int? TargetPort { get; init; }

    /// <summary>
    /// Framing on the wire. 2 = standard 2-byte big-endian length prefix
    /// (default), 0 = un-framed (1 connect = 1 message — used for POS
    /// terminals with proprietary protocols).
    /// </summary>
    public int HeaderSize { get; init; } = 2;

    /// <summary>
    /// How the Issuer-role simulator handles Bit 55 in responses. Settable
    /// so the frontend can update it on a running session without recreating.
    /// </summary>
    public EmvResponseConfig EmvResponse { get; set; } = EmvResponseConfig.Default;
}
