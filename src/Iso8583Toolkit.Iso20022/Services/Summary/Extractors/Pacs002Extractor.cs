using System.Xml.Linq;

namespace Iso8583Toolkit.Iso20022.Services.Summary.Extractors;

public sealed class Pacs002Extractor : SummaryExtractorBase
{
    public override IReadOnlyList<string> SupportedPrefixes => ["pacs.002"];
    protected override string OperationName => "FI-to-FI Payment Status Report";

    protected override List<SummaryFieldResult> ExtractFields(XDocument doc, XNamespace ns)
    {
        var root = doc.Root?.Element(ns + "FIToFIPmtStsRpt");
        var hdr  = root?.Element(ns + "GrpHdr");
        var info = root?.Element(ns + "TxInfAndSts");

        return
        [
            // Required — every status report carries these.
            new("Message ID",      Get(hdr,  "MsgId")),
            new("Data de criação", Get(hdr,  "CreDtTm")),
            new("Status",          Get(info, "TxSts")),

            // Optional — only populated for rejections / when the original
            // identifiers travel back with the report.
            new("Original Msg ID", Get(root, "OrgnlGrpInfAndSts", "OrgnlMsgId"),
                                   IsRequiredForConfidence: false),
            new("Reason code",     Get(info, "StsRsnInf", "Rsn", "Cd"),
                                   IsRequiredForConfidence: false),
            new("Reason info",     Get(info, "StsRsnInf", "AddtlInf"),
                                   IsRequiredForConfidence: false),
            new("End-to-end ID",   Get(info, "OrgnlEndToEndId"),
                                   IsRequiredForConfidence: false),
            new("Transaction ID",  Get(info, "OrgnlTxId"),
                                   IsRequiredForConfidence: false),
        ];
    }
}
