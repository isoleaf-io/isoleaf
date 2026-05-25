namespace Iso8583Toolkit.IsoCore.Building.Smart;

/// <summary>
/// Defines per-brand rules: mandatory bits per MTI/Role, TPDU requirements,
/// and country/currency defaults. Loadable from JSON for extensibility.
/// </summary>
public sealed class BrandProfile
{
    public string BrandName { get; set; } = "Default";

    /// <summary>
    /// Key: "{MTI}:{Role}" e.g. "0100:Adquirente".
    /// Value: list of mandatory bit numbers.
    /// </summary>
    public Dictionary<string, List<int>> MandatoryBitsByMtiAndRole { get; set; } = new();

    /// <summary>
    /// Context-dependent bits added by rules (chip, debit, etc.).
    /// Key: "{MTI}:{Role}". Value: list of conditional bit numbers.
    /// </summary>
    public Dictionary<string, List<int>> ConditionalBitsByMtiAndRole { get; set; } = new();

    public bool RequiresTpduAdquirenteToBrand { get; set; }
    public bool RequiresTpduBrandToIssuer { get; set; }
    public string DefaultCurrencyCode { get; set; } = "986";
    public string DefaultCountryCode { get; set; } = "076";
    public List<string> SupportedMtis { get; set; } = ["0100", "0110", "0200", "0210", "0400", "0410", "0800", "0810"];
}
