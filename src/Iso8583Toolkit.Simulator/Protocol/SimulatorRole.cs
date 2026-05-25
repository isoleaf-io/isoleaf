namespace Iso8583Toolkit.Simulator.Protocol;

/// <summary>
/// Role the simulator impersonates in a financial transaction leg. Each leg has
/// different expectations for TPDU presence and which bits are echoed/added on
/// the response.
///
/// Transactional legs covered:
///   Terminal → Adquirente → Bandeira → Emissor (authorization)
///                                  ↘ Autorizador (external processor)
/// </summary>
public enum SimulatorRole
{
    /// <summary>
    /// Acts as the acquirer. Receives from terminals/POS (no TPDU typically).
    /// Echoes most terminal fields back on response.
    /// </summary>
    Adquirente,

    /// <summary>
    /// Acts as the network/brand (Visa, Mastercard, Elo). Receives from
    /// acquirers — TPDU often present. Strips merchant-only fields on forward.
    /// </summary>
    Bandeira,

    /// <summary>
    /// Acts as the issuer. Receives from networks — TPDU typically present.
    /// Responds with auth decision; strips terminal-specific fields.
    /// </summary>
    Emissor,

    /// <summary>
    /// External processor receiving from a network on behalf of an issuer.
    /// Similar to <see cref="Emissor"/> but may include additional clearing fields.
    /// </summary>
    Autorizador
}

/// <summary>
/// Role-specific defaults: which fields to echo on response and whether TPDU
/// framing is expected. Used as defaults when the SessionConfig does not
/// override them explicitly.
/// </summary>
public static class SimulatorRoleProfile
{
    // Common baseline (amount, STAN, datetime, ref, card data, etc.)
    private static readonly int[] CommonEcho =
        [2, 3, 4, 7, 11, 12, 13, 14, 18, 22, 23, 25, 32, 35, 37, 41, 42, 43, 49];

    public static bool DefaultUseTpdu(SimulatorRole role) => role switch
    {
        SimulatorRole.Adquirente => false, // terminals usually don't send TPDU
        SimulatorRole.Bandeira => true,    // networks commonly use TPDU
        SimulatorRole.Emissor => true,
        SimulatorRole.Autorizador => true,
        _ => false
    };

    /// <summary>
    /// Fields that should be echoed from request to response for the given role.
    /// </summary>
    public static int[] EchoFields(SimulatorRole role) => role switch
    {
        // Adquirente talks to terminals: echo everything including terminal/merchant
        SimulatorRole.Adquirente => CommonEcho,

        // Bandeira: drops terminal-specific 41/42/43 (often re-injected by issuer side),
        // keeps card and financial data
        SimulatorRole.Bandeira =>
            [2, 3, 4, 7, 11, 12, 13, 14, 18, 22, 23, 25, 32, 35, 37, 49],

        // Emissor: responds with minimal set — issuer only needs to echo what
        // the acquirer correlates on (STAN, datetime, amount, PAN, reference)
        SimulatorRole.Emissor =>
            [2, 3, 4, 7, 11, 12, 13, 14, 32, 37, 49],

        // External authorizer: similar to issuer but keeps terminal id for
        // clearing correlation
        SimulatorRole.Autorizador =>
            [2, 3, 4, 7, 11, 12, 13, 14, 32, 37, 41, 49],

        _ => CommonEcho
    };
}
