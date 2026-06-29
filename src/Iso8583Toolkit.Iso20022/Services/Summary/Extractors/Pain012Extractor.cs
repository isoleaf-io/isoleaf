using System.Xml.Linq;

namespace Iso8583Toolkit.Iso20022.Services.Summary.Extractors;

/// <summary>
/// pain.012 — MandateAcceptanceReport. The response side of the Pix
/// Automático mandate flow: the payee's PSP returns this to confirm or
/// reject the mandate the payer's PSP requested via
/// <see cref="Pain009Extractor"/> (pain.009 MandateInitiationRequest).
///
/// XSD root: <c>MndtAccptncRpt</c>; the acceptance result lives at
/// <c>UndrlygAccptncDtls/AccptncRslt/Accptd</c>. The full mandate body
/// (creditor, debtor, SvcLvl = "SRDE", SeqTp FRST/RCUR/FNAL/OOFF, first
/// collection date) travels inside the choice arm
/// <c>OrgnlMndt/OrgnlMndt</c> (Mandate16) — the Pix scenario pins that
/// arm so the body shows up in the rendered XML.
/// </summary>
public sealed class Pain012Extractor : SummaryExtractorBase
{
    public override IReadOnlyList<string> SupportedPrefixes => ["pain.012"];
    protected override string OperationName => "Mandate Acceptance Report (Pix Automático)";

    protected override List<SummaryFieldResult> ExtractFields(XDocument doc, XNamespace ns)
    {
        var root = doc.Root?.Element(ns + "MndtAccptncRpt");
        var hdr = root?.Element(ns + "GrpHdr");
        var details = root?.Element(ns + "UndrlygAccptncDtls");
        var orgnlMndtChoice = details?.Element(ns + "OrgnlMndt");
        // OriginalMandate8Choice arms: OrgnlMndtId (simple ref) OR
        // OrgnlMndt (full Mandate16 body). Prefer the full body when
        // present; fall back to the ref-only arm otherwise.
        var mndt = orgnlMndtChoice?.Element(ns + "OrgnlMndt");

        return
        [
            // Required — every acceptance report must say "who" and "did
            // it pass?". MndtId is required (either path).
            new("Message ID",      Get(hdr, "MsgId")),
            new("Data de criação", Get(hdr, "CreDtTm")),
            new("Aceito",          Get(details, "AccptncRslt", "Accptd")),
            new("Mandate ID",      Get(mndt, "MndtId")
                                ?? Get(orgnlMndtChoice, "OrgnlMndtId")),

            // Optional — only present when the full OrgnlMndt body is
            // included (Pix Automático scenario forces it; other senders
            // may ship only OrgnlMndtId).
            new("Service Level",   Get(mndt, "Tp", "SvcLvl", "Cd"),
                                   IsRequiredForConfidence: false),
            new("Sequence Type",   Get(mndt, "Ocrncs", "SeqTp"),
                                   IsRequiredForConfidence: false),
            new("Data início",     Get(mndt, "FrstColltnDt"),
                                   IsRequiredForConfidence: false),
            new("Credor",          Get(mndt, "Cdtr", "Nm"),
                                   IsRequiredForConfidence: false),
            new("Devedor",         Get(mndt, "Dbtr", "Nm"),
                                   IsRequiredForConfidence: false),
            new("Valor máximo",    Get(mndt, "MaxAmt"),
                                   IsRequiredForConfidence: false),
        ];
    }
}
