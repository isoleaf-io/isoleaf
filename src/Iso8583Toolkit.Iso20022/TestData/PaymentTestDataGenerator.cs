using System.Globalization;
using System.Linq;
using System.Text;
using Bogus;

namespace Iso8583Toolkit.Iso20022.TestData;

public sealed record PersonData(string Name, string Cpf, string Email, string? Phone);
public sealed record CompanyData(string Name, string Cnpj);
public sealed record PixKeyData(string KeyType, string Value);

/// <summary>
/// Centralises fake-but-realistic payment fixtures (names, BICs, CPF/CNPJ,
/// Pix keys, amounts) used by the Builder scenarios, the Pix Flow
/// Visualizer and the <c>/api/test-data</c> endpoint family.
///
/// Each supported locale has its own <see cref="Faker"/> so names/cities
/// match the ecosystem (Brazilian Pix → pt_BR, SEPA/T2 → de, CBPR+ → en).
/// Pass a <c>seed</c> in tests for reproducibility; production callers
/// leave it null so each agent run produces fresh data.
/// </summary>
public sealed class PaymentTestDataGenerator
{
    private static readonly string[] SupportedLocales = ["pt_BR", "de", "en", "fr"];

    private static readonly string[] BrazilianBics =
    [
        "BRASBRRJXXX", "ITAUBRSPXXX", "BBDEBRSPXXX", "CEFXBRSPXXX",
        "NUBKBRSPXXX", "INTEBRSPXXX", "C6CEBRSPXXX", "PAGUBRSPXXX",
    ];

    private static readonly string[] EuropeanBics =
    [
        "BNPAFRPPXXX", "DEUTDEDBXXX", "HSBCGB2LXXX",
        "CHASUS33XXX", "SOGEFRPPXXX", "CITIUS33XXX",
    ];

    // ANATEL DDDs in active use (excludes reserved/unassigned codes).
    private static readonly int[] BrazilianDdds =
    [
        11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28,
        31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48,
        49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71,
        73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91,
        92, 93, 94, 95, 96, 97, 98, 99,
    ];

    private readonly Dictionary<string, Faker> _fakers;
    private readonly Randomizer _random;

    public PaymentTestDataGenerator(int? seed = null)
    {
        _fakers = new Dictionary<string, Faker>(StringComparer.OrdinalIgnoreCase);
        foreach (var locale in SupportedLocales)
        {
            var faker = new Faker(locale);
            if (seed is int s) faker.Random = new Randomizer(s);
            _fakers[locale] = faker;
        }
        _random = seed is int rs ? new Randomizer(rs) : new Randomizer();
    }

    public PersonData GeneratePerson(string locale = "pt_BR")
    {
        var faker = ResolveFaker(locale);
        var first = faker.Name.FirstName();
        var last = faker.Name.LastName();
        var name = $"{first} {last}";
        var email = faker.Internet.Email(first, last);
        var phone = locale.Equals("pt_BR", StringComparison.OrdinalIgnoreCase)
            ? GenerateBrazilianMobilePhone()
            : null;
        return new PersonData(name, GenerateCpf(), email, phone);
    }

    public CompanyData GenerateCompany(string locale = "pt_BR")
    {
        var faker = ResolveFaker(locale);
        var name = faker.Company.CompanyName();
        return new CompanyData(name, GenerateCnpj());
    }

    /// <summary>
    /// Pix-compatible city name — Latin1 ASCII fold, upper-case, truncated
    /// to the 15-char limit imposed by the BCB EMV-MPM tag 60.
    /// </summary>
    public string GenerateCity(string locale = "pt_BR")
    {
        var faker = ResolveFaker(locale);
        var raw = faker.Address.City();
        var normalized = StripDiacritics(raw).ToUpperInvariant();
        return normalized.Length > 15 ? normalized[..15] : normalized;
    }

    public string GenerateAmount()
    {
        // Pick a "round-ish" cents value so the rendered XML reads
        // naturally — strict random would give .73, .42 etc. on every run.
        var integerPart = _random.Number(10, 9999);
        decimal[] centsOptions = [0m, 0.50m, 0.99m, 0.90m, 0.75m, 0.25m];
        var cents = _random.ArrayElement(centsOptions);
        var total = integerPart + cents;
        return total.ToString("F2", CultureInfo.InvariantCulture);
    }

    public string GenerateBrazilianBic() => _random.ArrayElement(BrazilianBics);

    public string GenerateEuropeanBic() => _random.ArrayElement(EuropeanBics);

    public PixKeyData GeneratePixKey()
    {
        // Per BCB Resolução 322/2023, CNPJ is being phased out of the
        // Pix key registry — we omit it from the generator entirely.
        var roll = _random.Number(1, 100);
        return roll switch
        {
            <= 30 => new PixKeyData("EMAIL", _fakers["pt_BR"].Internet.Email()),
            <= 60 => new PixKeyData("PHONE", GenerateBrazilianMobilePhone()),
            <= 85 => new PixKeyData("CPF", GenerateCpf()),
            _ => new PixKeyData("EVP", Guid.NewGuid().ToString()),
        };
    }

    public string GenerateCpf()
    {
        Span<int> digits = stackalloc int[11];
        for (var i = 0; i < 9; i++) digits[i] = _random.Number(0, 9);
        digits[9] = Mod11Check(digits[..9], start: 10);
        digits[10] = Mod11Check(digits[..10], start: 11);
        return new string(digits.ToArray().Select(d => (char)('0' + d)).ToArray());
    }

    public string GenerateCnpj()
    {
        Span<int> digits = stackalloc int[14];
        for (var i = 0; i < 12; i++) digits[i] = _random.Number(0, 9);
        // CNPJ weights cycle 5..2 then 9..2 — feed them via Mod11CheckCnpj.
        digits[12] = Mod11CheckCnpj(digits[..12]);
        digits[13] = Mod11CheckCnpj(digits[..13]);
        return new string(digits.ToArray().Select(d => (char)('0' + d)).ToArray());
    }

    private Faker ResolveFaker(string locale) =>
        _fakers.TryGetValue(locale, out var f) ? f : _fakers["pt_BR"];

    private string GenerateBrazilianMobilePhone()
    {
        var ddd = _random.ArrayElement(BrazilianDdds.Select(d => d.ToString()).ToArray());
        Span<int> rest = stackalloc int[8];
        for (var i = 0; i < 8; i++) rest[i] = _random.Number(0, 9);
        var rest8 = new string(rest.ToArray().Select(d => (char)('0' + d)).ToArray());
        return $"+55{ddd}9{rest8}";
    }

    private static int Mod11Check(ReadOnlySpan<int> digits, int start)
    {
        var sum = 0;
        var weight = start;
        for (var i = 0; i < digits.Length; i++, weight--) sum += digits[i] * weight;
        var rem = sum % 11;
        return rem < 2 ? 0 : 11 - rem;
    }

    private static int Mod11CheckCnpj(ReadOnlySpan<int> digits)
    {
        // CNPJ weighting starts at 5 for the first 12 digits and wraps to
        // 9..2 for the 13-digit check (i.e. weight position resets at 9
        // once it goes below 2).
        var sum = 0;
        var weight = digits.Length == 12 ? 5 : 6;
        for (var i = 0; i < digits.Length; i++)
        {
            sum += digits[i] * weight;
            weight = weight == 2 ? 9 : weight - 1;
        }
        var rem = sum % 11;
        return rem < 2 ? 0 : 11 - rem;
    }

    private static string StripDiacritics(string input)
    {
        var normalized = input.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);
        foreach (var ch in normalized.Where(ch => CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark))
        {
            sb.Append(ch);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }
}
