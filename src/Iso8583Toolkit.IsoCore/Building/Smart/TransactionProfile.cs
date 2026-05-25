namespace Iso8583Toolkit.IsoCore.Building.Smart;

/// <summary>
/// Describes everything the Smart ISO Builder needs to generate a realistic
/// ISO 8583 message: MTI, role, brand, channel, approval mode, etc.
/// </summary>
public sealed record TransactionProfile
{
    public string Mti { get; init; } = "0200";
    public SmartRole Role { get; init; } = SmartRole.Adquirente;
    public SmartBrand Brand { get; init; } = SmartBrand.Auto;
    public TransactionType TransactionType { get; init; } = TransactionType.Credito;
    public TransactionChannel Channel { get; init; } = TransactionChannel.Chip;
    public ApprovalMode ApprovalMode { get; init; } = ApprovalMode.Online;
    public int Installments { get; init; } = 1;
    public bool IsReversal { get; init; }
    public string? IssuerMasterKey { get; init; }
    public Dictionary<int, string>? CustomFields { get; init; }
    public string? OverrideTpdu { get; init; }

    /// <summary>Workspace-level crypto keys (IMK, ZPK) propagated to field generation.</summary>
    public IWorkspaceKeys? WorkspaceKeys { get; init; }
}
