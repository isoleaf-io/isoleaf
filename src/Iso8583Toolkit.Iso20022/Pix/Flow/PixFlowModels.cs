namespace Iso8583Toolkit.Iso20022.Pix.Flow;

/// <summary>
/// One message in a Pix message flow — origin actor, target actor, full XML.
/// <paramref name="ViaActor"/> renders the SPI hop for interbank messages
/// (pacs.008/pacs.002/pacs.004) so the diagram shows the BCB in the middle
/// even though the wire-level message logically goes end-to-end.
/// </summary>
public sealed record PixFlowStep(
    int StepId,
    string MessageType,
    string Label,
    string FromActor,
    string ToActor,
    string Xml,
    string? ViaActor = null);

/// <summary>
/// Cross-reference inconsistency between two steps. <paramref name="Severity"/>
/// is <c>"warning"</c> when the field is recoverable (e.g. mismatched optional
/// UETR) or <c>"error"</c> when it breaks reconciliation (e.g. mismatched
/// EndToEndId across statuses).
/// </summary>
public sealed record PixFlowAlert(
    int StepId,
    string Field,
    string? Expected,
    string? Found,
    string Severity);

public sealed record PixFlowResult(
    string FlowType,
    IReadOnlyList<PixFlowStep> Steps,
    IReadOnlyList<PixFlowAlert> Alerts);

/// <summary>
/// Anchor data read from the first step — drives propagation downstream.
/// Beyond the cross-reference ids, the amount + currency + creditor
/// account from a user-supplied pacs.008 override should ripple into the
/// camt.054 so the notification reads as the same transaction.
/// </summary>
internal sealed record AnchorIds(
    string MsgId,
    string EndToEndId,
    string? TxId,
    string? UETR,
    string? Amount,
    string? Ccy,
    string? DbtrNm,
    string? CdtrNm,
    string? CdtrAcctId);
