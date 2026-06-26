using System.Xml.Linq;

namespace Iso8583Toolkit.Iso20022.Services.Summary.Extractors;

public sealed class Pain002Extractor : SummaryExtractorBase
{
    public override IReadOnlyList<string> SupportedPrefixes => ["pain.002"];
    protected override string OperationName => "Customer Payment Status Report";

    protected override List<SummaryFieldResult> ExtractFields(XDocument doc, XNamespace ns)
    {
        var root = doc.Root?.Element(ns + "CstmrPmtStsRpt");
        var hdr = root?.Element(ns + "GrpHdr");
        var orig = root?.Element(ns + "OrgnlGrpInfAndSts");
        var tx = root?.Element(ns + "OrgnlPmtInfAndSts")
                    ?.Element(ns + "TxInfAndSts");

        return
        [
            // Required — a status report points at an original message and
            // carries a status (group- or tx-level).
            new("Msg ID",              Get(hdr, "MsgId")),
            new("Msg original",        Get(orig, "OrgnlMsgId")),
            new("Status",              Get(orig, "GrpSts")
                                    ?? Get(tx, "TxSts")),

            // Optional — reasons and per-tx references travel only with
            // partial/rejected reports.
            new("Motivo",              Get(tx, "StsRsnInf", "Rsn", "Cd"),
                                       IsRequiredForConfidence: false),
            new("End-to-end original", Get(tx, "OrgnlEndToEndId"),
                                       IsRequiredForConfidence: false),
            new("Info adicional",      Get(tx, "StsRsnInf", "AddtlInf"),
                                       IsRequiredForConfidence: false),
        ];
    }
}
