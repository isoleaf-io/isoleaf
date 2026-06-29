namespace Iso8583Toolkit.Iso20022.Pix.Flow;

/// <summary>
/// One message in a Pix message flow — origin actor, target actor, full XML.
/// <paramref name="ViaActor"/> renders the SPI hop for interbank messages
/// (pacs.008/pacs.002/pacs.004) so the diagram shows the BCB in the middle
/// even though the wire-level message logically goes end-to-end.
/// <paramref name="IsRelay"/> marks a "repasse" segment — the SPI handing
/// a previously-delivered message to the next PSP — so the diagram can
/// draw the arrow with a dashed stroke.
/// </summary>
public sealed record PixFlowStep(
    int StepId,
    string MessageType,
    string Label,
    string FromActor,
    string ToActor,
    string Xml,
    string? ViaActor = null,
    bool IsRelay = false);

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
    string? CdtrAcctId,
    /// <summary>
    /// Mandate id (pain.012 — Pix Automático). Propagates across every
    /// step of the mandate flow so a user-provided MndtId in step 1
    /// ripples to the remaining 5 hops.
    /// </summary>
    string? MndtId,
    /// <summary>
    /// Mandate request id (pain.009 — Pix Automático). The PSP
    /// Recebedor mints this once when it asks for authorisation; the
    /// pain.012 acceptance echoes it back under <c>OrgnlMndt</c>.
    /// </summary>
    string? MndtReqId,
    /// <summary>
    /// Occurrences/Frequency sequence type (pain.009 / pain.012). Most
    /// Pix Automático mandates use <c>RCUR</c>; the value must match
    /// across the request and the acceptance.
    /// </summary>
    string? SeqTp,
    /// <summary>
    /// Service level code (e.g. <c>SRDE</c> for Pix Automático). Lives
    /// under <c>SvcLvl/Cd</c> and must agree between pain.009 and pain.012.
    /// </summary>
    string? SvcLvlCd);
