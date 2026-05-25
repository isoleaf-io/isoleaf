namespace Iso8583Toolkit.Cryptography.Emv;

public sealed record ArpcInput(
    string Arqc,
    string IccMasterKey,
    string Pan,
    string PanSequenceNumber,
    string Atc,
    string AuthResponseCode,
    string? Csu,
    EmvProfile Profile,
    ArpcMethod Method);

public enum ArpcMethod
{
    Method1,
    Method2
}
