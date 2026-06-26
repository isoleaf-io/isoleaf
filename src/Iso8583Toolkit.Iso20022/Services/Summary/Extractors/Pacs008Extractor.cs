using System.Xml.Linq;

namespace Iso8583Toolkit.Iso20022.Services.Summary.Extractors;

public sealed class Pacs008Extractor : SummaryExtractorBase
{
    public override IReadOnlyList<string> SupportedPrefixes => ["pacs.008"];
    protected override string OperationName => "FI-to-FI Customer Credit Transfer";

    protected override List<SummaryFieldResult> ExtractFields(XDocument doc, XNamespace ns)
    {
        var root = doc.Root?.Element(ns + "FIToFICstmrCdtTrf");
        var hdr  = root?.Element(ns + "GrpHdr");
        var tx   = root?.Element(ns + "CdtTrfTxInf");

        // IntrBkSttlmAmt is special: text content is the amount, Ccy is an
        // attribute. Resolve the element once and pull both off it.
        var amtEl = tx?.Element(ns + "IntrBkSttlmAmt");

        return
        [
            // Required for confidence — pacs.008 isn't meaningful without
            // amount, payer, payee, both banks and the end-to-end id.
            new("Valor",              amtEl?.Value),
            new("Moeda",              amtEl?.Attribute("Ccy")?.Value),
            new("Devedor",            Get(tx, "Dbtr", "Nm")),
            new("BIC banco devedor",  Get(tx, "DbtrAgt", "FinInstnId", "BICFI")),
            new("Credor",             Get(tx, "Cdtr", "Nm")),
            new("BIC banco credor",   Get(tx, "CdtrAgt", "FinInstnId", "BICFI")),
            new("End-to-end ID",      Get(tx, "PmtId", "EndToEndId")),

            // Optional — surfaced when present but absence shouldn't drop
            // the badge to "partial" on an otherwise-valid message.
            new("Data de liquidação", Get(hdr, "IntrBkSttlmDt")
                                   ?? Get(tx,  "IntrBkSttlmDt"),
                                      IsRequiredForConfidence: false),
            new("IBAN/conta devedor", Get(tx, "DbtrAcct", "Id", "IBAN")
                                   ?? Get(tx, "DbtrAcct", "Id", "Othr", "Id"),
                                      IsRequiredForConfidence: false),
            new("IBAN/conta credor",  Get(tx, "CdtrAcct", "Id", "IBAN")
                                   ?? Get(tx, "CdtrAcct", "Id", "Othr", "Id"),
                                      IsRequiredForConfidence: false),
            new("Transaction ID",     Get(tx, "PmtId", "TxId"),
                                      IsRequiredForConfidence: false),
            new("Instruction ID",     Get(tx, "PmtId", "InstrId"),
                                      IsRequiredForConfidence: false),
        ];
    }
}
