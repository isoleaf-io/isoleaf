namespace Iso8583Toolkit.Cryptography.Emv;

public sealed record ArqcInput(
    string IccMasterKey,
    string Pan,
    string PanSequenceNumber,
    string Atc,
    string AmountAuthorized,
    string AmountOther,
    string TerminalCountryCode,
    string Tvr,
    string CurrencyCode,
    string TransactionDate,
    string TransactionType,
    string UnpredictableNumber,
    string Aip,
    string Iad,
    EmvProfile Profile);
