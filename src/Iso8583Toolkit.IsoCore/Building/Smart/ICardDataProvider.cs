namespace Iso8583Toolkit.IsoCore.Building.Smart;

/// <summary>
/// Abstraction so SmartIsoBuilder can generate PANs and Track 2 without
/// directly referencing Iso8583Toolkit.Cards. Implemented in the API layer.
/// </summary>
public interface ICardDataProvider
{
    string GeneratePan(SmartBrand brand);
    SmartBrand DetectBrand(string pan);
    string GenerateTrack2(string pan, string expiry, string serviceCode, string cvv);
    string GenerateCvv(string pan, string expiry, string serviceCode);
    string GenerateExpiry();
}
