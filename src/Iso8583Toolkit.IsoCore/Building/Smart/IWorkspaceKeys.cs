namespace Iso8583Toolkit.IsoCore.Building.Smart;

/// <summary>
/// Cryptographic keys configured at the workspace level that the Smart Builder
/// can use to generate cryptographically real field values (e.g. ARQC at bit 55).
/// Kept as an interface so IsoCore does not depend on Agent.Models.WorkspaceConfig.
/// </summary>
public interface IWorkspaceKeys
{
    /// <summary>Issuer Master Key for AC (ARQC/ARPC) — 16 bytes / 32 hex chars.</summary>
    string? Imk { get; }

    /// <summary>Zone PIN Key for PIN block encryption — 16/24 bytes hex.</summary>
    string? Zpk { get; }
}
