namespace Iso8583Toolkit.Iso20022.Pix.Flow;

/// <summary>
/// One message in a message flow — origin actor, target actor, and the
/// full payload as text. Reused across the Pix (Sprint 7.3) and the
/// SWIFT CBPR+ (Sprint 9.3) visualizers.
/// <para><paramref name="ViaActor"/> renders the SPI/correspondent hop
/// for interbank messages so the diagram shows the intermediary in the
/// middle even though the wire-level message logically goes end-to-end.
/// <paramref name="IsRelay"/> marks a "repasse" segment — the SPI or
/// correspondent handing a previously-delivered message to the next
/// participant — so the diagram can draw the arrow with a dashed stroke.
/// <paramref name="ContentType"/> is <c>"xml"</c> for ISO 20022 MX
/// steps and <c>"mt"</c> for legacy SWIFT MT (blocks 1..5 raw text) so
/// the frontend can pick the right renderer and downstream Parser link.</para>
/// </summary>
public sealed record PixFlowStep(
    int StepId,
    string MessageType,
    string Label,
    string FromActor,
    string ToActor,
    string Xml,
    string? ViaActor = null,
    bool IsRelay = false,
    string ContentType = "xml",
    // Sprint 9.4 — ISO 8583 hops carry a TPDU header (5-byte destination
    // + source address) up to the point where the card brand strips it
    // before forwarding to the issuer. When true, the frontend renders
    // a "TPDU" badge over the arrow so the analyst can spot the routing
    // header at a glance.
    bool IsRelayWithTpdu = false,
    // Sprint 9.4-revision — extra one-liner context surfaced under the
    // label, e.g. "Cash dispensed after positive response" on the last
    // withdrawal leg or "Card Network approved via stand-in rules"
    // on the stand-in approval hop.
    string? Note = null);

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
