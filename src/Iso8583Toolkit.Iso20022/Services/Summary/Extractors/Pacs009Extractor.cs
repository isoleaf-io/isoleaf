using System.Xml.Linq;

namespace Iso8583Toolkit.Iso20022.Services.Summary.Extractors;

public sealed class Pacs009Extractor : SummaryExtractorBase
{
    public override IReadOnlyList<string> SupportedPrefixes => ["pacs.009"];
    protected override string OperationName => "Financial Institution Credit Transfer";

    protected override List<SummaryFieldResult> ExtractFields(XDocument doc, XNamespace ns)
    {
        var root = doc.Root?.Element(ns + "FICdtTrf");
        var hdr = root?.Element(ns + "GrpHdr");
        var tx = root?.Element(ns + "CdtTrfTxInf");
        var amt = tx?.Element(ns + "IntrBkSttlmAmt");

        return
        [
            // Required — FI-to-FI transfers must carry amount, end-to-end,
            // UETR and both institutions' BICs.
            new("Valor",                amt?.Value),
            new("Moeda",                amt?.Attribute("Ccy")?.Value),
            new("End-to-end ID",        Get(tx, "PmtId", "EndToEndId")),
            new("UETR",                 Get(tx, "PmtId", "UETR")),
            new("BIC banco devedor",    Get(tx, "Dbtr", "FinInstnId", "BICFI")),
            new("BIC banco credor",     Get(tx, "Cdtr", "FinInstnId", "BICFI")),

            // Optional metadata that may or may not be present.
            new("Data liquidação",      Get(hdr, "IntrBkSttlmDt")
                                     ?? Get(tx,  "IntrBkSttlmDt"),
                                        IsRequiredForConfidence: false),
            new("Método liquidação",    Get(hdr, "SttlmInf", "SttlmMtd"),
                                        IsRequiredForConfidence: false),
            new("Instruction ID",       Get(tx, "PmtId", "InstrId"),
                                        IsRequiredForConfidence: false),
        ];
    }
}
