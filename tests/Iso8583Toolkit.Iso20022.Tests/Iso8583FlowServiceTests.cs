using FluentAssertions;
using Iso8583Toolkit.Iso20022.Iso8583.Flow;
using Iso8583Toolkit.Iso20022.TestData;

namespace Iso8583Toolkit.Iso20022.Tests;

public class Iso8583FlowServiceTests
{
    private static readonly PaymentTestDataGenerator Fixtures = new();
    private static readonly Iso8583FlowService Service = new(Fixtures);

    [Fact]
    public void GenerateFlow_CreditPurchase_SixStepsWithProcessingCode003000()
    {
        var result = Service.GenerateFlow("iso8583-credit-purchase");

        result.Steps.Should().HaveCount(6);
        result.Steps[0].MessageType.Should().Be("0100");
        result.Steps[0].ContentType.Should().Be("iso8583");
        result.Alerts.Should().BeEmpty();

        // Bit-03 lives after MTI (4) + primary bitmap (16) + bit-02
        // (LLVAR PAN). For the credit-purchase flow, TPDU (10) + MTI (4)
        // + bitmap (16) + LLVAR-02 (2 length + 16 pan) = 48; bit-03
        // starts at index 48.
        var pcode = ExtractField3(result.Steps[0].Xml, tpduPresent: true);
        pcode.Should().Be("003000");
    }

    [Fact]
    public void GenerateFlow_Withdrawal_UsesMti0200()
    {
        var result = Service.GenerateFlow("iso8583-withdrawal");

        result.Steps.Should().HaveCount(6);
        result.Steps[0].MessageType.Should().Be("0200");
        result.Steps[3].MessageType.Should().Be("0210");
        result.Steps.Should().OnlyContain(s => s.ContentType == "iso8583");
    }

    [Fact]
    public void GenerateFlow_Reversal_ProducesTwelveStepsCoveringAuthAndReversal()
    {
        // The reversal flow is now the full auth+reversal round-trip:
        //   Steps 1-6:  0100/0110 authorization
        //   Steps 7-12: 0400/0410 reversal
        var result = Service.GenerateFlow("iso8583-reversal");

        result.Steps.Should().HaveCount(12);
        result.Steps[0].MessageType.Should().Be("0100");
        result.Steps[6].MessageType.Should().Be("0400");
        result.Steps[11].MessageType.Should().Be("0410");
    }

    [Fact]
    public void GenerateFlow_StandIn_HasTimeoutStepAndAdviceHop()
    {
        // Stand-in ceremony: 3 request hops → issuer timeout →
        // stand-in approval → 2 client legs → advice + advice-ack.
        var result = Service.GenerateFlow("iso8583-stand-in");

        result.Steps.Should().HaveCount(8);

        var timeout = result.Steps.Single(s => s.StepId == 4);
        timeout.ContentType.Should().Be("timeout");
        timeout.MessageType.Should().Be("TIMEOUT");
        timeout.Xml.Should().BeEmpty();

        var advice = result.Steps.Single(s => s.StepId == 7);
        advice.MessageType.Should().Be("0120");
        advice.FromActor.Should().Be("Card Network");
        advice.ToActor.Should().Be("Issuer");
        advice.Note.Should().NotBeNullOrEmpty();

        // Step 5's stand-in approval note lands verbatim on PixFlowStep.Note
        // so the frontend can surface it under the label.
        result.Steps.Single(s => s.StepId == 5).Note.Should().Contain("stand-in");
    }

    [Fact]
    public void GenerateFlow_BalanceInquiry_UsesProcessingCode310000()
    {
        var result = Service.GenerateFlow("iso8583-balance-inquiry");

        result.Steps.Should().HaveCount(6);
        var pcode = ExtractField3(result.Steps[0].Xml, tpduPresent: true);
        pcode.Should().Be("310000");
    }

    [Fact]
    public void GenerateFlow_BalanceInquiry_RequestOmitsField4_ResponseCarriesField54()
    {
        // Balance inquiry has no amount to authorize — bit-4 is
        // absent on the request bitmap and the balance travels back
        // in bit-54 on the response.
        var result = Service.GenerateFlow("iso8583-balance-inquiry");

        var request = ParsePrimaryBitmap(result.Steps[0].Xml, tpduPresent: true);
        request.Should().NotContain(4, "bit-4 (Amount) must be omitted on balance-inquiry requests");

        var response = ParsePrimaryBitmap(result.Steps[3].Xml, tpduPresent: false);
        response.Should().Contain(54, "bit-54 (Account Balance) must be present on balance-inquiry responses");
    }

    [Fact]
    public void GenerateFlow_TpduPresentOnAcquirerLegsAndStrippedForIssuer()
    {
        // Steps 1/2 (Terminal↔Acquirer/Brand) and 5/6 (Brand↔Acquirer↔
        // Terminal) carry the TPDU routing header; steps 3/4 (Brand↔
        // Issuer) do not — the brand strips it before forwarding and
        // reattaches it on the response leg.
        var result = Service.GenerateFlow("iso8583-credit-purchase");

        result.Steps.Single(s => s.StepId == 1).IsRelayWithTpdu.Should().BeTrue();
        result.Steps.Single(s => s.StepId == 2).IsRelayWithTpdu.Should().BeTrue();
        result.Steps.Single(s => s.StepId == 3).IsRelayWithTpdu.Should().BeFalse();
        result.Steps.Single(s => s.StepId == 4).IsRelayWithTpdu.Should().BeFalse();
        result.Steps.Single(s => s.StepId == 5).IsRelayWithTpdu.Should().BeTrue();
        result.Steps.Single(s => s.StepId == 6).IsRelayWithTpdu.Should().BeTrue();
    }

    /// <summary>
    /// Slices bit-3 out of an ASCII-wire ISO 8583 message. The current
    /// authorization/withdrawal envelopes always emit bit-2 (LLVAR PAN)
    /// followed immediately by bit-3 (fixed 6 chars).
    /// </summary>
    private static string ExtractField3(string wire, bool tpduPresent)
    {
        var offset = tpduPresent ? 10 : 0; // TPDU is 10 hex chars
        offset += 4 + 16;                  // MTI + primary bitmap
        // Bit-02 is LLVAR — 2 length chars + N pan chars.
        var panLen = int.Parse(wire.Substring(offset, 2));
        offset += 2 + panLen;
        return wire.Substring(offset, 6);
    }

    /// <summary>
    /// Returns the set of bits flagged as present in the primary (and
    /// secondary, when signalled) bitmap of an ASCII-wire message.
    /// </summary>
    private static ISet<int> ParsePrimaryBitmap(string wire, bool tpduPresent)
    {
        var offset = tpduPresent ? 10 : 0;
        offset += 4; // skip MTI
        var present = new HashSet<int>();
        // Primary bitmap: 16 hex chars → 64 bits, bit 1 = leftmost.
        var primary = wire.Substring(offset, 16);
        for (var i = 0; i < primary.Length; i++)
        {
            var nibble = Convert.ToInt32(primary[i].ToString(), 16);
            for (var b = 0; b < 4; b++)
                if ((nibble & (1 << (3 - b))) != 0)
                    present.Add(i * 4 + b + 1);
        }
        // Secondary bitmap is signalled by bit-1; parse it too so bits
        // 65..128 (e.g. field 128 MAC) also surface if the envelope
        // ever needs them.
        if (present.Contains(1))
        {
            var secondary = wire.Substring(offset + 16, 16);
            for (var i = 0; i < secondary.Length; i++)
            {
                var nibble = Convert.ToInt32(secondary[i].ToString(), 16);
                for (var b = 0; b < 4; b++)
                    if ((nibble & (1 << (3 - b))) != 0)
                        present.Add(64 + i * 4 + b + 1);
            }
        }
        return present;
    }
}
