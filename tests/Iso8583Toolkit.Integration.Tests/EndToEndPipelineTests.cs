using System.Diagnostics;
using FluentAssertions;
using Iso8583Toolkit.IsoCore.Building;
using Iso8583Toolkit.IsoCore.Building.Smart;
using Iso8583Toolkit.IsoCore.Domain;
using Iso8583Toolkit.IsoCore.Parsing;
using Iso8583Toolkit.Simulator.Protocol;

namespace Iso8583Toolkit.Integration.Tests;

/// <summary>
/// Shared report collector — disposed after all scenario tests complete,
/// at which point it emits the consolidated report to the console.
/// </summary>
public sealed class EndToEndReportFixture : IDisposable
{
    public readonly List<(string Name, List<string> Lines, bool Passed)> Reports = [];
    public readonly Stopwatch Watch = Stopwatch.StartNew();
    public int AssertionCount;

    public void Dispose()
    {
        var total = Reports.Count;
        if (total == 0) return;
        var passed = Reports.Count(r => r.Passed);
        var elapsed = Watch.ElapsedMilliseconds;

        const int width = 66;
        string Border(char l, char r, char f) => l + new string(f, width - 2) + r;
        string Wrap(string t)
        {
            var inner = width - 4;
            if (t.Length > inner) t = t[..inner];
            return "║ " + t.PadRight(inner) + " ║";
        }

        Console.WriteLine();
        Console.WriteLine(Border('╔', '╗', '═'));
        Console.WriteLine(Wrap("ISO 8583 TOOLKIT — END-TO-END TEST REPORT"));
        Console.WriteLine(Border('╠', '╣', '═'));
        foreach (var r in Reports.OrderBy(x => x.Name))
        {
            Console.WriteLine(Wrap($"{(r.Passed ? "✓" : "✗")} {r.Name}"));
            foreach (var line in r.Lines)
                Console.WriteLine(Wrap($"    • {line}"));
            Console.WriteLine(Border('╠', '╣', '═'));
        }
        Console.WriteLine(Wrap("RESUMO FINAL"));
        Console.WriteLine(Wrap($"  Cenários testados: {total}"));
        Console.WriteLine(Wrap($"  Aprovados:         {passed}/{total}"));
        Console.WriteLine(Wrap($"  Assertions:        {AssertionCount}"));
        Console.WriteLine(Wrap($"  Tempo total:       {elapsed}ms"));
        Console.WriteLine(Border('╚', '╝', '═'));
    }
}

/// <summary>
/// End-to-end pipeline tests: Smart Builder → Parse → Simulator → Parse response → Validate.
/// The platform self-tests its own message flow across the main MTIs.
/// </summary>
public sealed class EndToEndPipelineTests : IClassFixture<EndToEndReportFixture>
{
    private readonly EndToEndTestHelper _h = new();
    private readonly EndToEndReportFixture _fx;

    public EndToEndPipelineTests(EndToEndReportFixture fx) => _fx = fx;

    private void Track(string name, List<string> lines, bool passed) =>
        _fx.Reports.Add((name, lines, passed));

    private void Count(int n = 1) => Interlocked.Add(ref _fx.AssertionCount, n);

    // ── Scenario 1 ──────────────────────────────────────────────────────────

    [Fact]
    public void Scenario1_0200_CreditoChipOnline_VisaAcquirer_FullPipeline()
    {
        var lines = new List<string>();
        var passed = false;
        try
        {
            var build = _h.BuildMessage("0200", SmartRole.Adquirente, SmartBrand.Visa,
                TransactionType.Credito, TransactionChannel.Chip);
            build.Success.Should().BeTrue(build.Error ?? ""); Count();
            lines.Add($"Smart Build: 0200 gerado com {build.Fields!.Count} campos");

            // Field presence
            EndToEndTestHelper.AssertField(build.ToIsoAscii(_h), 2); Count();
            EndToEndTestHelper.AssertField(build.ToIsoAscii(_h), 22, "051"); Count();
            EndToEndTestHelper.AssertField(build.ToIsoAscii(_h), 35); Count();
            EndToEndTestHelper.AssertFieldAbsent(build.ToIsoAscii(_h), 52); Count();
            EndToEndTestHelper.AssertField(build.ToIsoAscii(_h), 55); Count();
            EndToEndTestHelper.AssertField(build.ToIsoAscii(_h), 49, "986"); Count();

            // PAN passes Luhn
            EndToEndTestHelper.PassesLuhn(build.GeneratedPan!).Should().BeTrue(); Count();

            // Track 2 starts with PAN
            var track2 = build.ToIsoAscii(_h).GetFieldValue(35);
            track2!.Should().StartWith(build.GeneratedPan!); Count();

            // EMV tag 9F26 (ARQC) + 9F27 = 80
            var emv = build.ToIsoAscii(_h).GetFieldValue(55);
            emv!.Should().Contain("9F2608"); Count();
            emv.Should().Contain("9F270180"); Count();
            var arqc = emv.Substring(emv.IndexOf("9F2608") + 6, 16);
            lines.Add($"Bit 55 EMV: ARQC={arqc}");

            // Round-trip: parse ASCII then parse BinaryHex
            var parsedAscii = _h.ParseAscii(build.Message!);
            parsedAscii.Mti.Should().Be("0200"); Count();
            lines.Add($"Parse ASCII: {parsedAscii.Fields.Count}/{build.Fields.Count} campos corretos");

            var parsedBin = _h.ParseBinaryHex(build.BinaryHexMessage!);
            parsedBin.Mti.Should().Be("0200"); Count();
            parsedBin.GetActiveBits().Should().BeEquivalentTo(parsedAscii.GetActiveBits()); Count();
            lines.Add("Parse BinaryHex: round-trip perfeito");

            // Simulate
            var (req, resp) = _h.SimulateRoundTrip(build, EndToEndTestHelper.AdquirenteConfig());
            resp.Mti.Should().Be("0210"); Count();
            resp.GetFieldValue(39).Should().Be("00"); Count();
            resp.GetFieldValue(38).Should().NotBeNullOrEmpty(); Count();
            resp.GetFieldValue(38)!.Length.Should().Be(6); Count();
            lines.Add($"AutoResponder: 0210 RC=00 AuthCode={resp.GetFieldValue(38)}");

            int[] echoes = [3, 4, 7, 11, 12, 13, 37, 41, 42];
            EndToEndTestHelper.AssertEchoFields(req, resp, echoes); Count(echoes.Length);
            lines.Add($"Echo fields: {echoes.Length}/{echoes.Length} campos verificados");

            passed = true;
        }
        finally
        {
            Track("Cenário 1: 0200 Crédito Chip Visa", lines, passed);
        }
    }

    // ── Scenario 2 ──────────────────────────────────────────────────────────

    [Fact]
    public void Scenario2_0200_DebitoChipOnline_EloAcquirer_WithPinAndTpdu()
    {
        var lines = new List<string>();
        var passed = false;
        try
        {
            var build = _h.BuildMessage("0200", SmartRole.Adquirente, SmartBrand.Elo,
                TransactionType.Debito, TransactionChannel.Chip);
            build.Success.Should().BeTrue(build.Error ?? ""); Count();
            lines.Add($"Smart Build: 0200 gerado com {build.Fields!.Count} campos + TPDU");

            var parsed = _h.ParseAscii(build.Message!);
            EndToEndTestHelper.AssertField(parsed, 52); Count();
            parsed.GetFieldValue(52)!.Length.Should().Be(16); Count();
            parsed.GetFieldValue(52)!.Should().MatchRegex("^[A-F0-9]{16}$"); Count();
            EndToEndTestHelper.AssertField(parsed, 55); Count();
            EndToEndTestHelper.AssertField(parsed, 19); Count();
            lines.Add($"Bit 52 PIN Block: {parsed.GetFieldValue(52)} (16 hex chars)");
            lines.Add("Bit 55 EMV presente");
            lines.Add($"Bit 19 Country Code: {parsed.GetFieldValue(19)} (Elo adquirente)");

            build.Tpdu.Should().NotBeNullOrEmpty("Elo acquirer requires TPDU"); Count();
            build.Tpdu!.Length.Should().Be(10); Count();
            lines.Add($"TPDU: {build.Tpdu}");

            var (req, resp) = _h.SimulateRoundTrip(build, EndToEndTestHelper.AdquirenteConfig());
            resp.Mti.Should().Be("0210"); Count();
            resp.GetFieldValue(39).Should().Be("00"); Count();
            lines.Add($"AutoResponder: 0210 RC=00 AuthCode={resp.GetFieldValue(38)}");

            int[] echoes = [3, 4, 7, 11, 12, 13, 32, 37, 41, 42];
            EndToEndTestHelper.AssertEchoFields(req, resp, echoes); Count(echoes.Length);
            lines.Add($"Echo fields: {echoes.Length}/{echoes.Length} campos verificados");

            passed = true;
        }
        finally
        {
            Track("Cenário 2: 0200 Débito Chip Elo (PIN + TPDU)", lines, passed);
        }
    }

    // ── Scenario 3 ──────────────────────────────────────────────────────────

    [Fact]
    public void Scenario3_0100_CreditoTarja_Mastercard_PreAuth()
    {
        var lines = new List<string>();
        var passed = false;
        try
        {
            var build = _h.BuildMessage("0100", SmartRole.Adquirente, SmartBrand.Mastercard,
                TransactionType.Credito, TransactionChannel.Tarja);
            build.Success.Should().BeTrue(build.Error ?? ""); Count();
            lines.Add($"Smart Build: 0100 gerado com {build.Fields!.Count} campos");

            var parsed = _h.ParseAscii(build.Message!);
            EndToEndTestHelper.AssertField(parsed, 35); Count();
            EndToEndTestHelper.AssertFieldAbsent(parsed, 55); Count();
            EndToEndTestHelper.AssertFieldAbsent(parsed, 52); Count();
            EndToEndTestHelper.AssertField(parsed, 22, "021"); Count();
            lines.Add("Bit 35 Track 2 presente; 52/55 ausentes; Bit 22 = 021 (tarja)");

            var (req, resp) = _h.SimulateRoundTrip(build, EndToEndTestHelper.AdquirenteConfig());
            resp.Mti.Should().Be("0110"); Count();
            resp.GetFieldValue(39).Should().Be("00"); Count();
            lines.Add($"AutoResponder: 0110 RC=00 AuthCode={resp.GetFieldValue(38)}");

            int[] echoes = [2, 3, 4, 7, 11, 12, 13, 35, 37, 41, 42];
            EndToEndTestHelper.AssertEchoFields(req, resp, echoes); Count(echoes.Length);
            lines.Add($"Echo fields: {echoes.Length}/{echoes.Length} campos verificados");

            passed = true;
        }
        finally
        {
            Track("Cenário 3: 0100 Crédito Tarja Mastercard", lines, passed);
        }
    }

    // ── Scenario 4 ──────────────────────────────────────────────────────────

    [Fact]
    public void Scenario4_0200_CardNotPresent_Visa()
    {
        var lines = new List<string>();
        var passed = false;
        try
        {
            var build = _h.BuildMessage("0200", SmartRole.Adquirente, SmartBrand.Visa,
                TransactionType.Credito, TransactionChannel.CNP);
            build.Success.Should().BeTrue(build.Error ?? ""); Count();
            lines.Add($"Smart Build: 0200 CNP gerado com {build.Fields!.Count} campos");

            var parsed = _h.ParseAscii(build.Message!);
            EndToEndTestHelper.AssertFieldAbsent(parsed, 35); Count();
            EndToEndTestHelper.AssertFieldAbsent(parsed, 52); Count();
            EndToEndTestHelper.AssertFieldAbsent(parsed, 55); Count();
            EndToEndTestHelper.AssertField(parsed, 22, "010"); Count();
            EndToEndTestHelper.AssertField(parsed, 25, "59"); Count();
            lines.Add("Bits 35/52/55 ausentes; Bit 22=010 (manual); Bit 25=59 (POS CNP)");

            var (req, resp) = _h.SimulateRoundTrip(build, EndToEndTestHelper.AdquirenteConfig());
            resp.Mti.Should().Be("0210"); Count();
            resp.GetFieldValue(39).Should().Be("00"); Count();
            EndToEndTestHelper.AssertFieldAbsent(resp, 55); Count();
            lines.Add($"AutoResponder: 0210 RC=00 sem bit 55");

            passed = true;
        }
        finally
        {
            Track("Cenário 4: 0200 CNP Visa", lines, passed);
        }
    }

    // ── Scenario 5 ──────────────────────────────────────────────────────────

    [Fact]
    public void Scenario5_0400_Reversal_CreditoChip_Visa()
    {
        var lines = new List<string>();
        var passed = false;
        try
        {
            var build = _h.BuildMessage("0400", SmartRole.Adquirente, SmartBrand.Visa,
                TransactionType.Credito, TransactionChannel.Chip, isReversal: true);
            build.Success.Should().BeTrue(build.Error ?? ""); Count();

            var parsed = _h.ParseAscii(build.Message!);
            parsed.Mti.Should().Be("0400"); Count();
            EndToEndTestHelper.AssertField(parsed, 90); Count();
            build.AppliedRules.Should().Contain("Reversal→Bit90Added"); Count();
            lines.Add($"Smart Build: 0400 com bit 90={parsed.GetFieldValue(90)}");
            lines.Add("AppliedRules contém Reversal→Bit90Added");

            var (req, resp) = _h.SimulateRoundTrip(build, EndToEndTestHelper.AdquirenteConfig());
            resp.Mti.Should().Be("0410"); Count();
            resp.GetFieldValue(39).Should().Be("00"); Count();
            lines.Add($"AutoResponder: 0410 RC=00 AuthCode={resp.GetFieldValue(38)}");

            int[] echoes = [2, 3, 4, 7, 11, 37, 41, 42];
            EndToEndTestHelper.AssertEchoFields(req, resp, echoes); Count(echoes.Length);
            lines.Add($"Echo fields: {echoes.Length}/{echoes.Length} campos verificados");

            passed = true;
        }
        finally
        {
            Track("Cenário 5: 0400 Reversão crédito chip Visa", lines, passed);
        }
    }

    // ── Scenario 6 ──────────────────────────────────────────────────────────

    [Fact]
    public void Scenario6_0800_EchoTest_NetworkManagement()
    {
        var lines = new List<string>();
        var passed = false;
        try
        {
            var build = _h.BuildMessage("0800", SmartRole.Adquirente, SmartBrand.Default,
                TransactionType.Credito, TransactionChannel.Presencial);
            build.Success.Should().BeTrue(build.Error ?? ""); Count();

            var parsed = _h.ParseAscii(build.Message!);
            parsed.Mti.Should().Be("0800"); Count();
            EndToEndTestHelper.AssertField(parsed, 7); Count();
            EndToEndTestHelper.AssertField(parsed, 11); Count();
            EndToEndTestHelper.AssertField(parsed, 70, "301"); Count();
            EndToEndTestHelper.AssertFieldAbsent(parsed, 2); Count();
            EndToEndTestHelper.AssertFieldAbsent(parsed, 35); Count();
            EndToEndTestHelper.AssertFieldAbsent(parsed, 55); Count();
            lines.Add("Smart Build: 0800 com bits 7, 11, 70=301 somente (sem PAN/Track2/EMV)");

            // bit 70 not in default echo list → inject via FieldOverrides
            var config = EndToEndTestHelper.AdquirenteConfig(
                fieldOverrides: new Dictionary<int, string> { [70] = "301" });
            var (req, resp) = _h.SimulateRoundTrip(build, config);
            resp.Mti.Should().Be("0810"); Count();
            resp.GetFieldValue(39).Should().Be("00"); Count();
            resp.GetFieldValue(70).Should().Be("301"); Count();
            lines.Add("AutoResponder: 0810 RC=00 Bit 70=301");

            passed = true;
        }
        finally
        {
            Track("Cenário 6: 0800 Echo Test (network mgmt)", lines, passed);
        }
    }

    // ── Scenario 7 ──────────────────────────────────────────────────────────

    [Fact]
    public void Scenario7_0200_DebitoChip_CustomPan_EloDetection()
    {
        var lines = new List<string>();
        var passed = false;
        try
        {
            const string customPan = "6362970000000005"; // Elo BIN 636297
            var build = _h.BuildMessage("0200", SmartRole.Adquirente, SmartBrand.Auto,
                TransactionType.Debito, TransactionChannel.Chip,
                customFields: new() { [2] = customPan });
            build.Success.Should().BeTrue(build.Error ?? ""); Count();

            build.ProfileUsed.Should().Be("Elo"); Count();
            build.AppliedRules.Should().Contain("CustomPAN→BrandDetected"); Count();
            lines.Add($"Brand auto-detected: {build.ProfileUsed} (from BIN {customPan[..6]})");

            var parsed = _h.ParseAscii(build.Message!);
            EndToEndTestHelper.AssertField(parsed, 2, customPan); Count();
            parsed.GetFieldValue(35)!.Should().StartWith(customPan + "="); Count();
            EndToEndTestHelper.AssertField(parsed, 52); Count();
            lines.Add($"Bit 2 (Custom)={customPan}");
            lines.Add($"Bit 35 (Derived) começa com '{customPan}='");
            lines.Add($"Bit 52 (Generated) PIN block {parsed.GetFieldValue(52)!.Length} chars");

            var bit2Info = build.Fields!.First(f => f.BitNumber == 2);
            bit2Info.Origin.Should().Be(SmartFieldOrigin.Custom); Count();
            var bit35Info = build.Fields!.First(f => f.BitNumber == 35);
            bit35Info.Origin.Should().Be(SmartFieldOrigin.Derived); Count();
            var bit52Info = build.Fields!.First(f => f.BitNumber == 52);
            bit52Info.Origin.Should().Be(SmartFieldOrigin.Generated); Count();
            lines.Add("SmartFieldOrigin: bit 2=Custom, bit 35=Derived, bit 52=Generated");

            passed = true;
        }
        finally
        {
            Track("Cenário 7: 0200 Débito Chip Custom PAN (Elo auto-detect)", lines, passed);
        }
    }

    // ── Scenario 8 ──────────────────────────────────────────────────────────

    [Fact]
    public void Scenario8_CrossValidation_ParseBuildRoundTrip_AllMtis()
    {
        var lines = new List<string>();
        var passed = false;
        try
        {
            var cases = new (string label, SmartBuildResult build)[]
            {
                ("0200 Visa Chip", _h.BuildMessage("0200", SmartRole.Adquirente, SmartBrand.Visa,
                    TransactionType.Credito, TransactionChannel.Chip)),
                ("0200 Elo Debit Chip", _h.BuildMessage("0200", SmartRole.Adquirente, SmartBrand.Elo,
                    TransactionType.Debito, TransactionChannel.Chip)),
                ("0100 MC Tarja", _h.BuildMessage("0100", SmartRole.Adquirente, SmartBrand.Mastercard,
                    TransactionType.Credito, TransactionChannel.Tarja)),
                ("0200 Visa CNP", _h.BuildMessage("0200", SmartRole.Adquirente, SmartBrand.Visa,
                    TransactionType.Credito, TransactionChannel.CNP)),
                ("0400 Visa Reversal", _h.BuildMessage("0400", SmartRole.Adquirente, SmartBrand.Visa,
                    TransactionType.Credito, TransactionChannel.Chip, isReversal: true)),
                ("0800 Echo", _h.BuildMessage("0800", SmartRole.Adquirente, SmartBrand.Default,
                    TransactionType.Credito, TransactionChannel.Presencial))
            };

            foreach (var (label, build) in cases)
            {
                build.Success.Should().BeTrue($"{label}: {build.Error}"); Count();

                // ASCII round-trip
                var msg1 = _h.ParseAscii(build.Message!);
                var rebuilt = RebuildFromParsed(msg1);
                var msg2 = _h.ParseAscii(rebuilt);

                msg2.Mti.Should().Be(msg1.Mti); Count();
                msg2.GetActiveBits().Should().BeEquivalentTo(msg1.GetActiveBits()); Count();
                foreach (var bit in msg1.Fields.Keys)
                {
                    msg2.GetFieldValue(bit).Should().Be(msg1.GetFieldValue(bit),
                        $"{label} bit {bit}"); Count();
                }

                // Validation
                var vr = _h.Validate(msg1);
                vr.IsValid.Should().BeTrue($"{label}: {string.Join(", ", vr.Errors.Select(e => e.Message))}"); Count();

                lines.Add($"{label}: round-trip OK ({msg1.Fields.Count} campos), Validator IsValid");
            }

            passed = true;
        }
        finally
        {
            Track("Cenário 8: Round-trip + Validator (6 cenários)", lines, passed);
        }
    }

    private string RebuildFromParsed(IsoMessage msg)
    {
        var b = new IsoMessageBuilder()
            .WithMti(msg.Mti)
            .WithLayout(_h.Layout);
        foreach (var f in msg.Fields.Values.OrderBy(f => f.BitNumber))
            b.WithField(f.BitNumber, f.RawValue);
        return b.BuildHex();
    }

}

internal static class SmartBuildResultExtensions
{
    /// <summary>Parses the ASCII wire message into IsoMessage (cached-ish helper).</summary>
    public static IsoMessage ToIsoAscii(this SmartBuildResult r, EndToEndTestHelper h) =>
        h.ParseAscii(r.Message!);
}
