namespace Iso8583Toolkit.IsoCore.Building.Smart;

/// <summary>
/// Role the message sender plays in the transaction leg.
/// Maps to <c>Iso8583Toolkit.Simulator.Protocol.SimulatorRole</c> at the API layer.
/// </summary>
public enum SmartRole
{
    Adquirente,
    Bandeira,
    Emissor,
    Autorizador
}
