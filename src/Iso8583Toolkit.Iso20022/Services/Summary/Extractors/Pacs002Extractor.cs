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
            new("Message ID",      Get(hdr,  "MsgId")),
            new("Data de criação", Get(hdr,  "CreDtTm")),
            new("Original Msg ID", Get(root, "OrgnlGrpInfAndSts", "OrgnlMsgId")),
            new("Status",          Get(info, "TxSts")),
            new("Reason code",     Get(info, "StsRsnInf", "Rsn", "Cd")),
            new("Reason info",     Get(info, "StsRsnInf", "AddtlInf")),
            new("End-to-end ID",   Get(info, "OrgnlEndToEndId")),
            new("Transaction ID",  Get(info, "OrgnlTxId")),
        ];
    }
}
