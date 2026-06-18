using System.Xml.Linq;

namespace Iso8583Toolkit.Iso20022.Services.Summary.Extractors;

public sealed class Camt053Extractor : SummaryExtractorBase
{
    public override IReadOnlyList<string> SupportedPrefixes => ["camt.053"];
    protected override string OperationName => "Bank-to-Customer Statement";

    protected override List<SummaryFieldResult> ExtractFields(XDocument doc, XNamespace ns)
    {
        var stmt = doc.Root?.Element(ns + "BkToCstmrStmt")?.Element(ns + "Stmt");

        // Statements typically carry multiple <Bal> elements distinguished by
        // an internal code. OPBD = opening booked, CLBD = closing booked.
        var openingBal = stmt?.Elements(ns + "Bal").FirstOrDefault(b => BalanceCode(b, ns) == "OPBD");
        var closingBal = stmt?.Elements(ns + "Bal").FirstOrDefault(b => BalanceCode(b, ns) == "CLBD");

        return
        [
            new("Statement ID",      Get(stmt, "Id")),
            new("Período (início)",  Get(stmt, "FrToDt", "FrDtTm")),
            new("Período (fim)",     Get(stmt, "FrToDt", "ToDtTm")),
            new("IBAN/conta",        Get(stmt, "Acct", "Id", "IBAN")
                                  ?? Get(stmt, "Acct", "Id", "Othr", "Id")),
            new("Titular",           Get(stmt, "Acct", "Ownr", "Nm")),
            new("Saldo abertura",    FormatBalance(openingBal, ns)),
            new("Saldo fechamento",  FormatBalance(closingBal, ns)),
            new("Nº de lançamentos", Get(stmt, "TxsSummry", "TtlNtries", "NbOfNtries")),
        ];
    }

    /// <summary>
    /// Walks every <c>&lt;Ntry&gt;</c> child of the statement and projects it
    /// into a flat record. Returns an empty list (never null) when no entries
    /// are present — keeps the consumer's contract simple.
    /// </summary>
    public List<StatementEntryResult> ExtractEntries(XDocument doc, XNamespace ns)
    {
        var stmt = doc.Root?.Element(ns + "BkToCstmrStmt")?.Element(ns + "Stmt");
        if (stmt == null) return [];

        return stmt.Elements(ns + "Ntry").Select(ntry =>
        {
            // Most useful per-entry metadata lives under NtryDtls/TxDtls. There
            // may be multiple TxDtls under one Ntry (a batched booking); we
            // pick the first one — UI shows one row per Ntry by design.
            var txDtls = ntry.Element(ns + "NtryDtls")?.Element(ns + "TxDtls");
            var amtEl = ntry.Element(ns + "Amt");

            return new StatementEntryResult(
                Amount:         amtEl?.Value,
                Currency:       amtEl?.Attribute("Ccy")?.Value,
                CreditDebitInd: ntry.Element(ns + "CdtDbtInd")?.Value,
                // Banks emit either an ISO date (Dt) or full timestamp (DtTm) —
                // accept either, prefer Dt because it renders better in tables.
                BookingDate:    ntry.Element(ns + "BookgDt")?.Element(ns + "Dt")?.Value
                             ?? ntry.Element(ns + "BookgDt")?.Element(ns + "DtTm")?.Value,
                ValueDate:      ntry.Element(ns + "ValDt")?.Element(ns + "Dt")?.Value,
                Status:         ntry.Element(ns + "Sts")?.Element(ns + "Cd")?.Value
                             ?? ntry.Element(ns + "Sts")?.Value,
                EndToEndId:     txDtls?.Element(ns + "Refs")?.Element(ns + "EndToEndId")?.Value,
                RemittanceInfo: txDtls?.Element(ns + "RmtInf")?.Element(ns + "Ustrd")?.Value);
        }).ToList();
    }

    private static string? BalanceCode(XElement bal, XNamespace ns) =>
        bal.Element(ns + "Tp")?.Element(ns + "CdOrPrtry")?.Element(ns + "Cd")?.Value;

    private static string? FormatBalance(XElement? bal, XNamespace ns)
    {
        if (bal == null) return null;
        var amt = bal.Element(ns + "Amt");
        if (amt?.Value == null) return null;
        // Statement balances are unsigned; the sign comes from the explicit
        // credit/debit indicator on the same element.
        var sign = bal.Element(ns + "CdtDbtInd")?.Value == "DBIT" ? "-" : "";
        var ccy = amt.Attribute("Ccy")?.Value ?? string.Empty;
        return $"{sign}{amt.Value} {ccy}".Trim();
    }
}

public sealed record StatementEntryResult(
    string? Amount,
    string? Currency,
    string? CreditDebitInd,
    string? BookingDate,
    string? ValueDate,
    string? Status,
    string? EndToEndId,
    string? RemittanceInfo);
