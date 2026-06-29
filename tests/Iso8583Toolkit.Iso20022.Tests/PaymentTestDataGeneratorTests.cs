using FluentAssertions;
using Iso8583Toolkit.Iso20022.TestData;

namespace Iso8583Toolkit.Iso20022.Tests;

public class PaymentTestDataGeneratorTests
{
    // Reuse a single non-seeded generator; nothing here asserts specific
    // values, only structural/format invariants.
    private static readonly PaymentTestDataGenerator Gen = new();

    [Fact]
    public void GenerateCpf_HasElevenDigitsAndPassesMod11()
    {
        var cpf = Gen.GenerateCpf();

        cpf.Should().HaveLength(11);
        cpf.Should().MatchRegex("^[0-9]{11}$");

        // Brazilian CPF check digit algorithm (mod 11, weights 10..2 / 11..2).
        var digits = cpf.Select(c => c - '0').ToArray();

        int Check(int upTo, int startWeight)
        {
            var sum = 0;
            for (var i = 0; i < upTo; i++) sum += digits[i] * (startWeight - i);
            var rem = sum % 11;
            return rem < 2 ? 0 : 11 - rem;
        }

        digits[9].Should().Be(Check(9, 10), "first CPF check digit must satisfy mod-11");
        digits[10].Should().Be(Check(10, 11), "second CPF check digit must satisfy mod-11");
    }

    [Fact]
    public void GenerateCnpj_HasFourteenDigitsAndPassesMod11()
    {
        var cnpj = Gen.GenerateCnpj();

        cnpj.Should().HaveLength(14);
        cnpj.Should().MatchRegex("^[0-9]{14}$");

        var digits = cnpj.Select(c => c - '0').ToArray();

        int CheckCnpj(int upTo)
        {
            var sum = 0;
            var weight = upTo == 12 ? 5 : 6;
            for (var i = 0; i < upTo; i++)
            {
                sum += digits[i] * weight;
                weight = weight == 2 ? 9 : weight - 1;
            }
            var rem = sum % 11;
            return rem < 2 ? 0 : 11 - rem;
        }

        digits[12].Should().Be(CheckCnpj(12), "first CNPJ check digit must satisfy mod-11");
        digits[13].Should().Be(CheckCnpj(13), "second CNPJ check digit must satisfy mod-11");
    }

    [Fact]
    public void GeneratePerson_BrazilianLocale_PhoneHasPixPlus55Prefix()
    {
        var person = Gen.GeneratePerson("pt_BR");

        person.Phone.Should().NotBeNullOrEmpty();
        person.Phone!.Should().StartWith("+55");
        // BCB phone format: +55 + 2-digit DDD + leading 9 + 8 digits = 14 chars.
        person.Phone.Should().HaveLength(14);
        person.Phone.Should().MatchRegex(@"^\+55\d{11}$");
    }

    [Fact]
    public void GeneratePerson_NonBrazilianLocale_OmitsPhone()
    {
        // Pix phones only make sense for the brazilian-pix ecosystem.
        // German persons (used by the SEPA scenarios) must come back
        // without a phone so we don't accidentally suggest a +55 number
        // as a SEPA contact.
        var person = Gen.GeneratePerson("de");

        person.Name.Should().NotBeNullOrEmpty();
        person.Cpf.Should().HaveLength(11); // CPF is always generated
        person.Phone.Should().BeNull();
    }
}
