using System.Xml.Linq;

namespace Iso8583Toolkit.Iso20022.Services.Summary.Extractors;

/// <summary>
/// pain.009 — MandateInitiationRequest. The originating side of the Pix
/// Automático mandate flow: the payer's PSP submits this to ask the
/// payee's PSP to authorise recurring debits. Confirmation comes back
/// via pain.012 (MandateAcceptanceReport) — see
/// <see cref="Pain012Extractor"/>.
///
/// XSD root: <c>MndtInitnReq</c>; mandate body lives under
/// <c>MndtInitnReq/Mndt</c> (Mandate19 in v07; same shape across
/// .04 → .07). Note that the XSD's only required mandate fields are
/// <c>MndtReqId</c>, <c>TrckgInd</c>, <c>Cdtr</c>, <c>Dbtr</c> and
/// <c>DbtrAgt</c> — everything else is opt-in via overrides.
/// </summary>
public sealed class Pain009Extractor : SummaryExtractorBase
{
    public override IReadOnlyList<string> SupportedPrefixes => ["pain.009"];
    protected override string OperationName => "Mandate Initiation Request (Pix Automático)";

    protected override List<SummaryFieldResult> ExtractFields(XDocument doc, XNamespace ns)
    {
        var root = doc.Root?.Element(ns + "MndtInitnReq");
        var hdr = root?.Element(ns + "GrpHdr");
        var mndt = root?.Element(ns + "Mndt");

        return
        [
            // Required for confidence — header + the XSD-mandatory mandate
            // bits + the two parties (creditor / debtor names).
            new("Message ID",      Get(hdr,  "MsgId")),
            new("Data de criação", Get(hdr,  "CreDtTm")),
            new("Mandate Req ID",  Get(mndt, "MndtReqId")),
            new("Credor",          Get(mndt, "Cdtr", "Nm")),
            new("Devedor",         Get(mndt, "Dbtr", "Nm")),

            // Optional — only present when the Pix Automático scenario
            // forces them via AdditionalMandatoryXPaths (or when the
            // upstream sender chose to include them).
            new("Mandate ID",      Get(mndt, "MndtId"),
                                   IsRequiredForConfidence: false),
            new("Service Level",   Get(mndt, "Tp", "SvcLvl", "Cd"),
                                   IsRequiredForConfidence: false),
            new("Sequence Type",   Get(mndt, "Ocrncs", "SeqTp"),
                                   IsRequiredForConfidence: false),
            new("Valor máximo",    Get(mndt, "MaxAmt"),
                                   IsRequiredForConfidence: false),
            new("Tracking",        Get(mndt, "TrckgInd"),
                                   IsRequiredForConfidence: false),
        ];
    }
}
