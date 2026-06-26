using System.Xml.Linq;

namespace Iso8583Toolkit.Iso20022.Services.Summary.Extractors;

public sealed class Camt056Extractor : SummaryExtractorBase
{
    public override IReadOnlyList<string> SupportedPrefixes => ["camt.056"];
    protected override string OperationName => "FI-to-FI Payment Cancellation Request";

    protected override List<SummaryFieldResult> ExtractFields(XDocument doc, XNamespace ns)
    {
        var root = doc.Root?.Element(ns + "FIToFIPmtCxlReq");
        var assgnmt = root?.Element(ns + "Assgnmt");
        var undrlyg = root?.Element(ns + "Undrlyg");
        var txInf = undrlyg?.Element(ns + "TxInf");

        return
        [
            // Required — a cancellation request must say who's asking,
            // who's being asked, which payment, and why.
            new("Assignment ID",       Get(assgnmt, "Id")),
            new("De (BIC)",            Get(assgnmt, "Assgnr", "Agt", "FinInstnId", "BICFI")),
            new("Para (BIC)",          Get(assgnmt, "Assgne", "Agt", "FinInstnId", "BICFI")),
            new("End-to-end original", Get(txInf, "OrgnlEndToEndId")),
            new("Motivo cancelamento", Get(txInf, "CxlRsnInf", "Rsn", "Cd")),

            // Optional — group-level references and free-text context.
            new("UETR original",       Get(txInf, "OrgnlUETR"),
                                       IsRequiredForConfidence: false),
            new("Msg original",        Get(txInf, "OrgnlGrpInf", "OrgnlMsgId"),
                                       IsRequiredForConfidence: false),
            new("Info adicional",      Get(txInf, "CxlRsnInf", "AddtlInf"),
                                       IsRequiredForConfidence: false),
        ];
    }
}
