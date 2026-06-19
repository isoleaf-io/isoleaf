using System.Xml.Linq;

namespace Iso8583Toolkit.Iso20022.Services.Summary.Extractors;

public sealed class Pain001Extractor : SummaryExtractorBase
{
    public override IReadOnlyList<string> SupportedPrefixes => ["pain.001"];
    protected override string OperationName => "Customer Credit Transfer Initiation";

    protected override List<SummaryFieldResult> ExtractFields(XDocument doc, XNamespace ns)
    {
        var root = doc.Root?.Element(ns + "CstmrCdtTrfInitn");
        var hdr  = root?.Element(ns + "GrpHdr");
        var pmt  = root?.Element(ns + "PmtInf");
        var tx   = pmt?.Element(ns + "CdtTrfTxInf");

        return
        [
            new("Message ID",         Get(hdr, "MsgId")),
            new("Data de criação",    Get(hdr, "CreDtTm")),
            new("Nº de transações",   Get(hdr, "NbOfTxs")),
            new("Valor total",        Get(hdr, "CtrlSum")),
            new("Devedor",            Get(pmt, "Dbtr", "Nm")),
            new("IBAN/conta devedor", Get(pmt, "DbtrAcct", "Id", "IBAN")
                                   ?? Get(pmt, "DbtrAcct", "Id", "Othr", "Id")),
            new("Moeda",              Get(pmt, "PmtTpInf", "SvcLvl", "Cd")),
            new("Credor",             Get(tx,  "Cdtr", "Nm")),
            new("Valor",              Get(tx,  "Amt", "InstdAmt")),
            new("End-to-end ID",      Get(tx,  "PmtId", "EndToEndId")),
            new("Remittance info",    Get(tx,  "RmtInf", "Ustrd")),
        ];
    }
}
