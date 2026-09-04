using Iso8583Toolkit.IsoCore.Building.Smart;

namespace Iso8583Toolkit.Backend.Models;

public sealed record WorkspaceConfig : IWorkspaceKeys
{
    public string AcquirerId { get; init; } = "000001";
    public string MerchantId { get; init; } = "MERCH00000000001";
    public string TerminalId { get; init; } = "TERM0001";
    public string MerchantName { get; init; } = "LOJA SIMULADOR";
    public string MerchantCity { get; init; } = "SAO PAULO";
    public string Mcc { get; init; } = "5999";
    public string OriginNii { get; init; } = "0001";
    public string DestinationNii { get; init; } = "0002";
    public Dictionary<string, string> ProcessingCodes { get; init; } = new()
    {
        ["Compra"] = "000000",
        ["Saque"] = "010000",
        ["Voucher"] = "170000",
        ["PreAutorizacao"] = "300000"
    };
    public string Zpk { get; init; } = "0123456789ABCDEFFEDCBA98765432100123456789ABCDEF";
    public string Imk { get; init; } = "0123456789ABCDEF0123456789ABCDEF";
    public string DefaultBrand { get; init; } = "Visa";
    public string DefaultCurrency { get; init; } = "986";
    public string DefaultCountry { get; init; } = "076";
    public string DefaultChannel { get; init; } = "Chip";
}
