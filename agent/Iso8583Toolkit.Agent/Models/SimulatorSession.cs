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
}
