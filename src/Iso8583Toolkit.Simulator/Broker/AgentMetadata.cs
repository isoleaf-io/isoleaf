namespace Iso8583Toolkit.Simulator.Broker;

public sealed record AgentMetadata(
    string AgentVersion,
    string OperatingSystem,
    string Hostname,
    string IpAddress);
