using System.Text;
using FluentAssertions;
using Iso8583Toolkit.Agent.Services;
using Iso8583Toolkit.IsoCore.Building;
using Iso8583Toolkit.IsoCore.Layouts;
using Iso8583Toolkit.IsoCore.Parsing;

namespace Iso8583Toolkit.Agent.Tests;

public sealed class InjectVariationServiceTests
{
    private static readonly IsoLayout Layout = IsoLayout.Default();
    private static readonly IsoParser Parser = new(Layout);

    private static byte[] BuildAsciiWire()
    {
        // Minimal valid wire with all the fields the variation service may touch
        // (4 amount, 7 datetime, 11 stan, 12 time, 13 date, 37 rrn) so the
        // "apply only when present" guard doesn't strip our changes.
        var hex = new IsoMessageBuilder()
            .WithMti("0200")
            .WithLayout(Layout)
            .WithField(4, "000000010000")
            .WithField(7, "0101000000")
            .WithField(11, "000001")
            .WithField(12, "000000")
            .WithField(13, "0101")
            .WithField(37, "AAAAAAAAAAAA")
            .BuildHex();
        return Encoding.ASCII.GetBytes(hex);
    }

    [Fact]
    public void Apply_VaryIdentifiers_UpdatesDateTimeAndStan()
    {
        var input = BuildAsciiWire();

        var first = InjectVariationService.Apply(input, wasHexEncoded: false,
            varyIdentifiers: true, varyAmount: false,
            amountMin: 0, amountMax: 0);
        var second = InjectVariationService.Apply(input, wasHexEncoded: false,
            varyIdentifiers: true, varyAmount: false,
            amountMin: 0, amountMax: 0);

        var msg1 = Parser.ParseFromHex(Encoding.ASCII.GetString(first));
        var msg2 = Parser.ParseFromHex(Encoding.ASCII.GetString(second));

        // STAN must change between successive calls — the central guarantee.
        msg1.GetFieldValue(11).Should().NotBe(msg2.GetFieldValue(11));
        // RRN must be 12 uppercase alphanumeric chars (NOT the seed "AAAAAA..."
        // — verified by checking it changed at least once across both calls).
        var rrn1 = msg1.GetFieldValue(37)!;
        var rrn2 = msg2.GetFieldValue(37)!;
        rrn1.Should().MatchRegex("^[0-9A-Z]{12}$");
        rrn2.Should().MatchRegex("^[0-9A-Z]{12}$");
        (rrn1 == rrn2).Should().BeFalse("two random 12-char RRNs colliding is astronomically unlikely");
        // Bit 7 must match an MMDDHHMMSS pattern (10 digits).
        msg1.GetFieldValue(7).Should().MatchRegex(@"^\d{10}$");
        // Bit 12 / Bit 13 must keep their widths.
        msg1.GetFieldValue(12).Should().HaveLength(6);
        msg1.GetFieldValue(13).Should().HaveLength(4);
    }

    [Fact]
    public void Apply_VaryAmount_AmountWithinRange()
    {
        var input = BuildAsciiWire();
        const long min = 5_00;   // R$ 5,00
        const long max = 10_00;  // R$ 10,00

        // Run many times to make sure the random pick respects bounds.
        for (var i = 0; i < 50; i++)
        {
            var output = InjectVariationService.Apply(input, wasHexEncoded: false,
                varyIdentifiers: false, varyAmount: true,
                amountMin: min, amountMax: max);
            var msg = Parser.ParseFromHex(Encoding.ASCII.GetString(output));
            var amount = long.Parse(msg.GetFieldValue(4)!);
            amount.Should().BeGreaterThanOrEqualTo(min);
            amount.Should().BeLessThanOrEqualTo(max);
        }
    }

    [Fact]
    public void Apply_VaryIdentifiers_StanIncrementsAcrossCalls()
    {
        // Regression for the user-reported bug "STAN igual em mensagens consecutivas".
        // Five back-to-back calls should produce five distinct STAN values.
        var input = BuildAsciiWire();
        var stans = new HashSet<string>();

        for (var i = 0; i < 5; i++)
        {
            var bytes = InjectVariationService.Apply(input, wasHexEncoded: false,
                varyIdentifiers: true, varyAmount: false,
                amountMin: 0, amountMax: 0);
            var msg = Parser.ParseFromHex(Encoding.ASCII.GetString(bytes));
            stans.Add(msg.GetFieldValue(11)!);
        }

        stans.Should().HaveCount(5, "the STAN counter must increment between calls");
    }

    [Fact]
    public void Apply_VaryIdentifiers_FieldAbsent_LeavesOtherFieldsUnchanged()
    {
        // Messages without Bit 11 must not crash — and other identifiers that
        // ARE present must still be refreshed.
        var hex = new IsoMessageBuilder()
            .WithMti("0200")
            .WithLayout(Layout)
            // Note: no Bit 11.
            .WithField(4, "000000010000")
            .WithField(7, "0101000000")
            .WithField(37, "AAAAAAAAAAAA")
            .BuildHex();
        var input = Encoding.ASCII.GetBytes(hex);

        var output = InjectVariationService.Apply(input, wasHexEncoded: false,
            varyIdentifiers: true, varyAmount: false,
            amountMin: 0, amountMax: 0);
        var msg = Parser.ParseFromHex(Encoding.ASCII.GetString(output));

        msg.Fields.ContainsKey(11).Should().BeFalse("variation must not add fields the bitmap doesn't carry");
        msg.GetFieldValue(7).Should().MatchRegex(@"^\d{10}$");
        msg.GetFieldValue(37).Should().MatchRegex("^[0-9A-Z]{12}$");
    }

    [Fact]
    public void Apply_NoFlags_MessageUnchanged()
    {
        var input = BuildAsciiWire();

        var output = InjectVariationService.Apply(input, wasHexEncoded: false,
            varyIdentifiers: false, varyAmount: false,
            amountMin: 100, amountMax: 50_000);

        // Same reference contract: with both flags off we short-circuit and return
        // the exact same byte array — no parsing, no re-serialisation.
        output.Should().BeSameAs(input);
    }
}
