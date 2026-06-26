using System.Xml.Linq;

namespace Iso8583Toolkit.Iso20022.Services.Summary.Extractors;

public sealed class Pacs028Extractor : SummaryExtractorBase
{
    public override IReadOnlyList<string> SupportedPrefixes => ["pacs.028"];
    protected override string OperationName => "Payment Status Request";

    protected override List<SummaryFieldResult> ExtractFields(XDocument doc, XNamespace ns)
    {
        var root = doc.Root?.Element(ns + "FIToFIPmtStsReq");
        var hdr = root?.Element(ns + "GrpHdr");
        var grp = root?.Element(ns + "OrgnlGrpInf");
        var tx = root?.Element(ns + "TxInf");

        return
        [
            // Required — a status request points back at the original
            // message; without those references it can't be resolved.
            new("Msg ID",                Get(hdr, "MsgId")),
            new("Msg original",          Get(grp, "OrgnlMsgId")),
            new("Tipo msg original",     Get(grp, "OrgnlMsgNmId")),

            // Optional — transaction-level references narrow the query but
            // aren't required at the group level.
            new("End-to-end original",   Get(tx, "OrgnlEndToEndId"),
                                         IsRequiredForConfidence: false),
            new("UETR original",         Get(tx, "OrgnlUETR"),
                                         IsRequiredForConfidence: false),
            new("Transaction ID orig.",  Get(tx, "OrgnlTxId"),
                                         IsRequiredForConfidence: false),
        ];
    }
}
