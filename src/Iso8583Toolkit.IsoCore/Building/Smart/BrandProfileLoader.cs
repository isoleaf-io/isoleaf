using System.Text.Json;
using System.Text.Json.Serialization;

namespace Iso8583Toolkit.IsoCore.Building.Smart;

/// <summary>
/// Loads <see cref="BrandProfile"/> from embedded defaults or user-supplied JSON files.
/// </summary>
public sealed class BrandProfileLoader
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, true) }
    };

    private readonly Dictionary<SmartBrand, BrandProfile> _cache = new();

    /// <summary>Loads profile by brand. Falls back to Default when not found.</summary>
    public BrandProfile Load(SmartBrand brand)
    {
        if (_cache.TryGetValue(brand, out var cached))
            return cached;

        var profile = brand switch
        {
            SmartBrand.Elo => BuildElo(),
            SmartBrand.Visa => BuildVisa(),
            SmartBrand.Mastercard => BuildMastercard(),
            _ => BuildDefault()
        };

        _cache[brand] = profile;
        return profile;
    }

    public BrandProfile GetDefault() => Load(SmartBrand.Default);

    /// <summary>Loads a profile from a JSON file, merging with defaults.</summary>
    public BrandProfile LoadFromJson(string json)
    {
        var profile = JsonSerializer.Deserialize<BrandProfile>(json, JsonOpts);
        return profile ?? BuildDefault();
    }

    /// <summary>Serializes a profile to JSON for export.</summary>
    public static string ToJson(BrandProfile profile) =>
        JsonSerializer.Serialize(profile, new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
        });

    public IReadOnlyDictionary<SmartBrand, BrandProfile> GetAll()
    {
        foreach (var b in new[] { SmartBrand.Default, SmartBrand.Visa, SmartBrand.Mastercard, SmartBrand.Elo })
            Load(b);
        return _cache;
    }

    // ── Hardcoded profiles ──────────────────────────────────────────────────

    private static BrandProfile BuildDefault() => new()
    {
        BrandName = "Default",
        MandatoryBitsByMtiAndRole = new()
        {
            // Adquirente sends terminal/merchant identifiers (41/42/43).
            ["0100:Adquirente"] = [2, 3, 4, 7, 11, 12, 13, 14, 18, 22, 25, 37, 41, 42, 43, 49],
            ["0200:Adquirente"] = [2, 3, 4, 7, 11, 12, 13, 18, 22, 25, 35, 37, 41, 42, 43, 49],
            ["0400:Adquirente"] = [2, 3, 4, 7, 11, 12, 13, 37, 41, 42, 49],
            ["0800:Adquirente"] = [7, 11, 70],
            ["0810:Adquirente"] = [7, 11, 39, 70],

            // Bandeira forwards transaction data to the issuer but strips
            // acquirer-specific terminal/merchant identifiers (41/42/43).
            ["0100:Bandeira"] = [2, 3, 4, 7, 11, 12, 13, 14, 22, 25, 37, 49],
            ["0200:Bandeira"] = [2, 3, 4, 7, 11, 12, 13, 14, 22, 25, 37, 49],
            ["0400:Bandeira"] = [2, 3, 4, 7, 11, 12, 13, 37, 49],
            ["0800:Bandeira"] = [7, 11, 70],
            ["0810:Bandeira"] = [7, 11, 39, 70],

            // Emissor receives a thin set; same shape as Bandeira on inbound.
            ["0100:Emissor"] = [2, 3, 4, 7, 11, 12, 13, 14, 22, 25, 37, 49],
            ["0200:Emissor"] = [2, 3, 4, 7, 11, 12, 13, 22, 25, 35, 37, 49],
            ["0400:Emissor"] = [2, 3, 4, 7, 11, 12, 13, 37, 49],
            // Emissor responses: echo + Auth Code (38) + Response Code (39).
            ["0110:Emissor"] = [2, 3, 4, 7, 11, 12, 13, 38, 39, 49],
            ["0210:Emissor"] = [2, 3, 4, 7, 11, 12, 13, 38, 39, 49],
            ["0410:Emissor"] = [2, 3, 4, 7, 11, 39, 49],

            // Bandeira relays issuer responses back to the acquirer.
            ["0110:Bandeira"] = [2, 3, 4, 7, 11, 12, 13, 38, 39, 49],
            ["0210:Bandeira"] = [2, 3, 4, 7, 11, 12, 13, 38, 39, 49],
            ["0410:Bandeira"] = [2, 3, 4, 7, 11, 39, 49],

            // Adquirente receives the issuer's response back (echo + RC + auth code).
            ["0110:Adquirente"] = [2, 3, 4, 7, 11, 12, 13, 38, 39, 41, 42, 49],
            ["0210:Adquirente"] = [2, 3, 4, 7, 11, 12, 13, 38, 39, 41, 42, 49],
            ["0410:Adquirente"] = [2, 3, 4, 7, 11, 39, 41, 42, 49],
        },
        RequiresTpduAdquirenteToBrand = false,
        RequiresTpduBrandToIssuer = false,
        DefaultCurrencyCode = "986",
        DefaultCountryCode = "076"
    };

    private static BrandProfile BuildElo()
    {
        var profile = BuildDefault();
        profile.BrandName = "Elo";
        profile.RequiresTpduAdquirenteToBrand = true;
        profile.RequiresTpduBrandToIssuer = false;

        // Elo Adquirente: country code, acquirer ID, private fields.
        profile.MandatoryBitsByMtiAndRole["0100:Adquirente"] =
            [.. profile.MandatoryBitsByMtiAndRole["0100:Adquirente"], 19, 32, 61];
        profile.MandatoryBitsByMtiAndRole["0200:Adquirente"] =
            [.. profile.MandatoryBitsByMtiAndRole["0200:Adquirente"], 19, 32, 60, 61];

        // Elo Bandeira: forwards acquirer ID (32) so the issuer can identify origin.
        profile.MandatoryBitsByMtiAndRole["0100:Bandeira"] =
            [.. profile.MandatoryBitsByMtiAndRole["0100:Bandeira"], 19, 32];
        profile.MandatoryBitsByMtiAndRole["0200:Bandeira"] =
            [.. profile.MandatoryBitsByMtiAndRole["0200:Bandeira"], 19, 32];

        // Elo Emissor inbound: bit 19 mandatory (was conditional on Default).
        profile.MandatoryBitsByMtiAndRole["0100:Emissor"] =
            [.. profile.MandatoryBitsByMtiAndRole["0100:Emissor"], 19];
        profile.MandatoryBitsByMtiAndRole["0200:Emissor"] =
            [.. profile.MandatoryBitsByMtiAndRole["0200:Emissor"], 19];

        return profile;
    }

    private static BrandProfile BuildVisa()
    {
        var profile = BuildDefault();
        profile.BrandName = "Visa";
        profile.RequiresTpduAdquirenteToBrand = false;
        return profile;
    }

    private static BrandProfile BuildMastercard()
    {
        var profile = BuildDefault();
        profile.BrandName = "Mastercard";
        profile.RequiresTpduAdquirenteToBrand = false;
        return profile;
    }
}
