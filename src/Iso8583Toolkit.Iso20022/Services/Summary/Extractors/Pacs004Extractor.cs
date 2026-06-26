using System.Xml.Linq;

namespace Iso8583Toolkit.Iso20022.Services.Summary.Extractors;

public sealed class Pacs004Extractor : SummaryExtractorBase
{
    public override IReadOnlyList<string> SupportedPrefixes => ["pacs.004"];
    protected override string OperationName => "Payment Return";

    protected override List<SummaryFieldResult> ExtractFields(XDocument doc, XNamespace ns)
    {
        var root = doc.Root?.Element(ns + "PmtRtr");
        var hdr = root?.Element(ns + "GrpHdr");
        var tx = root?.Element(ns + "TxInf");
        var amt = tx?.Element(ns + "RtrdIntrBkSttlmAmt");

        return
        [
            // Required — a return is meaningless without amount, original
            // end-to-end id, and the reason code.
            new("Valor devolvido",      amt?.Value),
            new("Moeda",                amt?.Attribute("Ccy")?.Value),
            new("End-to-end original",  Get(tx, "OrgnlEndToEndId")),
            new("Motivo da devolução",  Get(tx, "RtrRsnInf", "Rsn", "Cd")),

            // Optional — useful detail but absent on legit returns too.
            new("Return ID",            Get(tx, "RtrId"),
                                        IsRequiredForConfidence: false),
            new("Msg original",         Get(tx, "OrgnlGrpInf", "OrgnlMsgId"),
                                        IsRequiredForConfidence: false),
            new("Tipo msg original",    Get(tx, "OrgnlGrpInf", "OrgnlMsgNmId"),
                                        IsRequiredForConfidence: false),
            new("UETR original",        Get(tx, "OrgnlUETR"),
                                        IsRequiredForConfidence: false),
            new("Data liquidação",      Get(hdr, "IntrBkSttlmDt")
                                     ?? Get(tx,  "IntrBkSttlmDt"),
                                        IsRequiredForConfidence: false),
            new("Info adicional",       Get(tx, "RtrRsnInf", "AddtlInf"),
                                        IsRequiredForConfidence: false),
        ];
    }
}
