namespace Iso8583Toolkit.Simulator.Protocol;

public enum SimulatorMessageType
{
    // Session control
    AgentRegister,
    AgentRegistered,
    AgentHeartbeat,
    AgentHeartbeatAck,
    AgentDisconnect,

    // Panel → Agent commands
    StartSession,
    StopSession,
    InjectMessage,
    UpdateConfig,

    // Agent → Broker → Panel events
    SessionStarted,
    SessionStopped,
    ConnectionAccepted,
    ConnectionClosed,
    MessageReceived,
    MessageSent,
    ValidationResult,
    Error
}
