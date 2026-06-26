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
            // Required — a customer initiation needs id, payer, payee, amount.
            new("Message ID",         Get(hdr, "MsgId")),
            new("Data de criação",    Get(hdr, "CreDtTm")),
            new("Nº de transações",   Get(hdr, "NbOfTxs")),
            new("Devedor",            Get(pmt, "Dbtr", "Nm")),
            new("Credor",             Get(tx,  "Cdtr", "Nm")),
            new("Valor",              Get(tx,  "Amt", "InstdAmt")),
            new("End-to-end ID",      Get(tx,  "PmtId", "EndToEndId")),

            // Optional — settable but not load-bearing for "full" badge.
            new("Valor total",        Get(hdr, "CtrlSum"),
                                      IsRequiredForConfidence: false),
            new("IBAN/conta devedor", Get(pmt, "DbtrAcct", "Id", "IBAN")
                                   ?? Get(pmt, "DbtrAcct", "Id", "Othr", "Id"),
                                      IsRequiredForConfidence: false),
            new("Moeda",              Get(pmt, "PmtTpInf", "SvcLvl", "Cd"),
                                      IsRequiredForConfidence: false),
            new("Remittance info",    Get(tx,  "RmtInf", "Ustrd"),
                                      IsRequiredForConfidence: false),
        ];
    }
}
