using System.Xml.Linq;

namespace Iso8583Toolkit.Iso20022.Services.Summary.Extractors;

public sealed class Camt054Extractor : SummaryExtractorBase
{
    public override IReadOnlyList<string> SupportedPrefixes => ["camt.054"];
    protected override string OperationName => "Bank-to-Customer Debit/Credit Notification";

    protected override List<SummaryFieldResult> ExtractFields(XDocument doc, XNamespace ns)
    {
        var root = doc.Root?.Element(ns + "BkToCstmrDbtCdtNtfctn");
        var ntfctn = root?.Element(ns + "Ntfctn");
        var ntry = ntfctn?.Element(ns + "Ntry");
        var amtEl = ntry?.Element(ns + "Amt");
        var acct = ntfctn?.Element(ns + "Acct");

        // End-to-end id lives at NtryDtls/TxDtls/Refs/EndToEndId, not as a
        // direct entry child — walked inline to keep Get() shallow.
        var txDtls = ntry
            ?.Element(ns + "NtryDtls")
            ?.Element(ns + "TxDtls");
        var e2eId = txDtls?.Element(ns + "Refs")?.Element(ns + "EndToEndId")?.Value;
        var rmtInf = txDtls?.Element(ns + "RmtInf")?.Element(ns + "Ustrd")?.Value;

        var bookgDt = ntry?.Element(ns + "BookgDt");
        var bookgDate = bookgDt?.Element(ns + "DtTm")?.Value
                     ?? bookgDt?.Element(ns + "Dt")?.Value;

        return
        [
            // Required — a notification is defined by amount + direction +
            // booking status.
            new("Valor",              amtEl?.Value),
            new("Moeda",              amtEl?.Attribute("Ccy")?.Value),
            new("Indicador D/C",      Get(ntry, "CdtDbtInd")),
            new("Status",             Get(ntry, "Sts", "Cd")),

            // Optional — id, account, booking date and references enrich the
            // row but aren't always present.
            new("Notification ID",    Get(ntfctn, "Id"),
                                      IsRequiredForConfidence: false),
            new("Conta",              Get(acct, "Id", "IBAN")
                                   ?? Get(acct, "Id", "Othr", "Id"),
                                      IsRequiredForConfidence: false),
            new("Data lançamento",    bookgDate,
                                      IsRequiredForConfidence: false),
            new("End-to-end ID",      e2eId,
                                      IsRequiredForConfidence: false),
            new("Remessa",            rmtInf,
                                      IsRequiredForConfidence: false),
        ];
    }
}
