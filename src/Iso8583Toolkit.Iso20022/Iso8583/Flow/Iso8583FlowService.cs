using System.Globalization;
using Iso8583Toolkit.Iso20022.Pix.Flow;
using Iso8583Toolkit.Iso20022.TestData;
using Iso8583Toolkit.IsoCore.Building;
using Iso8583Toolkit.IsoCore.Parsing;

namespace Iso8583Toolkit.Iso20022.Iso8583.Flow;

/// <summary>
/// Sprint 9.4 — orchestrates card-payment flows for the Flow Visualizer.
/// Steps carry the raw ISO 8583 ASCII wire string (not XML) inside the
/// shared <see cref="PixFlowStep.Xml"/> slot; the frontend picks the
/// right renderer via <see cref="PixFlowStep.ContentType"/> = "iso8583".
///
/// <para>Actor arrangement mirrors the acquiring rails: Terminal/PDV →
/// Adquirente → Bandeira → Emissor. TPDU (5-byte routing header) is
/// present on the acquirer/brand hops and stripped by the brand before
/// forwarding to the issuer; the response returns without TPDU up to
/// the brand which reattaches it for the acquirer-facing leg.</para>
/// </summary>
public sealed class Iso8583FlowService
{
    // Actor labels stay in English to match the rest of the ISOLeaf UI
    // catalogue — the frontend's ACTOR_ORDER_BY_PROTOCOL["iso8583"] list
    // reads these verbatim from the wire response, so any change here
    // must land on both sides together.
    private const string Terminal = "Terminal/POS";
    private const string Acquirer = "Acquirer";
    private const string Brand = "Card Network";
    private const string Issuer = "Issuer";

    private readonly PaymentTestDataGenerator _generator;

    public Iso8583FlowService(PaymentTestDataGenerator generator)
    {
        ArgumentNullException.ThrowIfNull(generator);
        _generator = generator;
    }

    /// <summary>
    /// Step blueprint — MTI, actors and TPDU marker per hop.
    /// <paramref name="IsTimeout"/> flags the stand-in "issuer went silent"
    /// segment: the frontend renders it as a dashed red arrow, no
    /// clickable payload. <paramref name="Note"/> lands verbatim on
    /// <see cref="PixFlowStep.Note"/> for the UI to surface under the
    /// step label.
    /// </summary>
    private sealed record IsoStepDef(
        int StepId,
        string Mti,
        string Label,
        string FromActor,
        string ToActor,
        bool HasTpdu,
        bool IsTimeout = false,
        string? Note = null);

    /// <summary>Flow definition — steps + acquirer-envelope tweaks.</summary>
    private sealed record IsoFlowDef(
        string DisplayLabel,
        // Field-3 processing code that discriminates credit purchase
        // (003000), debit purchase (002000), withdrawal (012000),
        // balance inquiry (310000) etc. Applied on the request MTIs.
        string ProcessingCode,
        // POS entry mode (bit 22) — 051 = chip, 021 = PIN keyboard.
        string PosEntryMode,
        // Debit tracks require an encrypted PIN block in bit 52.
        bool RequiresPin,
        // Balance inquiry omits bit-4 (there's no transaction amount to
        // authorize) and returns the balance in bit-54 on the response.
        bool IsBalanceInquiry,
        IReadOnlyList<IsoStepDef> Steps);

    // ── Reusable step sequences ───────────────────────────────────────

    // 0100/0110 authorization round-trip (used by credit/debit/balance).
    private static readonly IReadOnlyList<IsoStepDef> AuthorizationSteps =
    [
        new(1, "0100", "Authorization Request", Terminal, Acquirer, HasTpdu: true),
        new(2, "0100", "Authorization Request (forward)", Acquirer, Brand, HasTpdu: true),
        new(3, "0100", "Authorization Request (issuer)", Brand, Issuer, HasTpdu: false),
        new(4, "0110", "Authorization Response (issuer)", Issuer, Brand, HasTpdu: false),
        new(5, "0110", "Authorization Response (forward)", Brand, Acquirer, HasTpdu: true),
        new(6, "0110", "Authorization Response", Acquirer, Terminal, HasTpdu: true),
    ];

    // 0200/0210 financial-transaction round-trip (used by withdrawal —
    // atomic settle-and-cash-out, so 0200 instead of 0100).
    private static readonly IReadOnlyList<IsoStepDef> WithdrawalSteps =
    [
        new(1, "0200", "Financial Transaction Request", Terminal, Acquirer, HasTpdu: true),
        new(2, "0200", "Financial Transaction Request (forward)", Acquirer, Brand, HasTpdu: true),
        new(3, "0200", "Financial Transaction Request (issuer)", Brand, Issuer, HasTpdu: false),
        new(4, "0210", "Financial Transaction Response (issuer)", Issuer, Brand, HasTpdu: false),
        new(5, "0210", "Financial Transaction Response (forward)", Brand, Acquirer, HasTpdu: true),
        new(6, "0210", "Financial Transaction Response", Acquirer, Terminal, HasTpdu: true,
            Note: "Cash dispensed after positive response"),
    ];

    // 12-step reversal: full 0100/0110 authorization block followed by
    // the 0400/0410 reversal round-trip.
    private static readonly IReadOnlyList<IsoStepDef> ReversalSteps =
    [
        new(1, "0100", "Original Authorization Request", Terminal, Acquirer, HasTpdu: true),
        new(2, "0100", "Original Authorization Request (forward)", Acquirer, Brand, HasTpdu: true),
        new(3, "0100", "Original Authorization Request (issuer)", Brand, Issuer, HasTpdu: false),
        new(4, "0110", "Original Authorization Response (issuer)", Issuer, Brand, HasTpdu: false),
        new(5, "0110", "Original Authorization Response (forward)", Brand, Acquirer, HasTpdu: true),
        new(6, "0110", "Original Authorization Response", Acquirer, Terminal, HasTpdu: true),
        new(7, "0400", "Reversal Request", Terminal, Acquirer, HasTpdu: true),
        new(8, "0400", "Reversal Request (forward)", Acquirer, Brand, HasTpdu: true),
        new(9, "0400", "Reversal Request (issuer)", Brand, Issuer, HasTpdu: false),
        new(10, "0410", "Reversal Response (issuer)", Issuer, Brand, HasTpdu: false),
        new(11, "0410", "Reversal Response (forward)", Brand, Acquirer, HasTpdu: true),
        new(12, "0410", "Reversal Response", Acquirer, Terminal, HasTpdu: true),
    ];

    // Stand-in: request reaches the issuer, issuer never responds
    // (step 4 = timeout), the Card Network approves via its stand-in
    // rules (steps 5–6) and then notifies the issuer post-hoc through
    // an advice/response pair (steps 7–8).
    private static readonly IReadOnlyList<IsoStepDef> StandInSteps =
    [
        new(1, "0100", "Authorization Request", Terminal, Acquirer, HasTpdu: true),
        new(2, "0100", "Authorization Request (forward)", Acquirer, Brand, HasTpdu: true),
        new(3, "0100", "Authorization Request (issuer)", Brand, Issuer, HasTpdu: false),
        new(4, "TIMEOUT", "Issuer timeout — no response", Issuer, Brand, HasTpdu: false,
            IsTimeout: true),
        new(5, "0110", "Authorization Response (stand-in approval)", Brand, Acquirer, HasTpdu: true,
            Note: "Card Network approved via stand-in rules"),
        new(6, "0110", "Authorization Response", Acquirer, Terminal, HasTpdu: true),
        new(7, "0120", "Authorization Advice (stand-in notification)", Brand, Issuer, HasTpdu: false,
            Note: "Card Network notifies Issuer of stand-in approval"),
        new(8, "0130", "Authorization Advice Response", Issuer, Brand, HasTpdu: false),
    ];

    // Balance inquiry — same wire round-trip as authorization but with
    // a distinct processing code and label prefix.
    private static readonly IReadOnlyList<IsoStepDef> BalanceInquirySteps =
    [
        new(1, "0100", "Balance Inquiry Request", Terminal, Acquirer, HasTpdu: true),
        new(2, "0100", "Balance Inquiry Request (forward)", Acquirer, Brand, HasTpdu: true),
        new(3, "0100", "Balance Inquiry Request (issuer)", Brand, Issuer, HasTpdu: false),
        new(4, "0110", "Balance Inquiry Response (issuer)", Issuer, Brand, HasTpdu: false),
        new(5, "0110", "Balance Inquiry Response (forward)", Brand, Acquirer, HasTpdu: true),
        new(6, "0110", "Balance Inquiry Response", Acquirer, Terminal, HasTpdu: true),
    ];

    private static readonly Dictionary<string, IsoFlowDef> Flows =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["iso8583-credit-purchase"] =
                new("Compra Crédito",       "003000", "051", false, false, AuthorizationSteps),
            ["iso8583-debit-purchase"] =
                new("Compra Débito (PIN online)", "002000", "021", true,  false, AuthorizationSteps),
            ["iso8583-withdrawal"] =
                new("Saque",                "012000", "051", true,  false, WithdrawalSteps),
            ["iso8583-reversal"] =
                new("Reversão",             "003000", "051", false, false, ReversalSteps),
            ["iso8583-stand-in"] =
                new("Stand-in (Advice)",    "003000", "051", false, false, StandInSteps),
            ["iso8583-balance-inquiry"] =
                new("Consulta de Saldo",    "310000", "051", false, true,  BalanceInquirySteps),
        };

    public IReadOnlyList<string> SupportedFlows => Flows.Keys.ToList();

    /// <summary>
    /// Renders every step of the requested flow. Per-step overrides
    /// replace the auto-generated ISO 8583 wire string; the MTI of the
    /// override is validated against the step's expected MTI and any
    /// mismatch surfaces as a <see cref="PixFlowAlert"/> without
    /// blocking the run.
    /// </summary>
    public PixFlowResult GenerateFlow(
        string flowType,
        IReadOnlyDictionary<int, string>? overrides = null)
    {
        if (!Flows.TryGetValue(flowType, out var def))
            throw new ArgumentException(
                $"Unknown flow type: '{flowType}'. Supported: {string.Join(", ", Flows.Keys)}",
                nameof(flowType));

        overrides ??= new Dictionary<int, string>();
        // Single "envelope" of fake data so every step in the flow uses
        // the same PAN / STAN / amount — the visualizer reads as one
        // transaction end-to-end.
        var env = BuildEnvelope(def);

        var steps = new List<PixFlowStep>(def.Steps.Count);
        var alerts = new List<PixFlowAlert>();
        foreach (var sd in def.Steps)
        {
            // Timeout hops have no wire — they're a UX-only marker for
            // "issuer stopped responding" in the stand-in flow. Skip
            // wire generation and override validation entirely.
            if (sd.IsTimeout)
            {
                steps.Add(new PixFlowStep(
                    StepId: sd.StepId,
                    MessageType: sd.Mti,
                    Label: sd.Label,
                    FromActor: sd.FromActor,
                    ToActor: sd.ToActor,
                    Xml: string.Empty,
                    ContentType: "timeout",
                    IsRelayWithTpdu: false,
                    Note: sd.Note));
                continue;
            }

            string wire;
            if (overrides.TryGetValue(sd.StepId, out var ovr) && !string.IsNullOrWhiteSpace(ovr))
            {
                wire = ovr.Trim();
                var overrideMti = ExtractMti(wire, sd.HasTpdu);
                if (overrideMti is not null
                    && !string.Equals(overrideMti, sd.Mti, StringComparison.Ordinal))
                {
                    alerts.Add(new PixFlowAlert(
                        sd.StepId, "MTI", sd.Mti, overrideMti, "warning"));
                }
            }
            else
            {
                wire = BuildStepWire(sd, def, env);
            }

            steps.Add(new PixFlowStep(
                StepId: sd.StepId,
                MessageType: sd.Mti,
                Label: sd.Label,
                FromActor: sd.FromActor,
                ToActor: sd.ToActor,
                Xml: wire,
                ContentType: "iso8583",
                IsRelayWithTpdu: sd.HasTpdu,
                Note: sd.Note));
        }

        return new PixFlowResult(flowType, steps, alerts);
    }

    // ── Wire generation ────────────────────────────────────────────────

    private sealed record IsoEnvelope(
        string Pan, string Amount, string ExpiryYymm, string Nsu,
        string TerminalId, string MerchantId, string ProcessingCode,
        string PosEntryMode, string TransmissionDateTime,
        string LocalTime, string LocalDate,
        string RetrievalRefNum, string AuthCode, string PinBlock, string Tpdu,
        string AccountBalance);

    private IsoEnvelope BuildEnvelope(IsoFlowDef def)
    {
        // ISO 8583 PANs are 16-19 digits — trim from two chained CPFs
        // so the placeholder looks like a real BIN + 12-digit body.
        var panSeed = _generator.GenerateCpf() + _generator.GenerateCpf();
        var pan = ("4111" + panSeed).Substring(0, 16);
        var amount = _generator.GenerateAmount().Replace(".", "").PadLeft(12, '0');
        var stan = ((int)(DateTime.UtcNow.Ticks % 999999)).ToString("D6", CultureInfo.InvariantCulture);
        // CPFs are 11 digits — chain two to safely slice 15 chars for
        // the merchant id (Substring(0,15) on a single CPF would overflow).
        var terminalId = _generator.GenerateCpf().Substring(0, 8);
        var merchantSeed = _generator.GenerateCpf() + _generator.GenerateCpf();
        var merchantId = merchantSeed.Substring(0, 15);
        var now = DateTime.UtcNow;
        return new IsoEnvelope(
            Pan: pan,
            Amount: amount,
            ExpiryYymm: now.AddYears(3).ToString("yyMM", CultureInfo.InvariantCulture),
            Nsu: stan,
            TerminalId: terminalId,
            MerchantId: merchantId,
            ProcessingCode: def.ProcessingCode,
            PosEntryMode: def.PosEntryMode,
            TransmissionDateTime: now.ToString("MMddHHmmss", CultureInfo.InvariantCulture),
            LocalTime: now.ToString("HHmmss", CultureInfo.InvariantCulture),
            LocalDate: now.ToString("MMdd", CultureInfo.InvariantCulture),
            RetrievalRefNum: now.ToString("yyyyMMddHHmm", CultureInfo.InvariantCulture),
            AuthCode: "123456",
            // 8 bytes / 16 hex chars — placeholder encrypted PIN block
            // for debit tracks (bit 52). The visualizer doesn't verify it.
            PinBlock: "A1B2C3D4E5F60718",
            Tpdu: "6000010000",
            // Bit-54 payload for balance inquiries. Layout (SPEC-ish):
            //   AccountType(2) + AmountType(2) + Currency(3) + Sign(1)
            //   + Amount(12) — e.g. "10", "01" ledger balance, "986" BRL,
            //   "C" credit, 12-digit padded value in cents.
            AccountBalance: "1001986C" + _generator.GenerateAmount()
                .Replace(".", "").PadLeft(12, '0'));
    }

    private static string BuildStepWire(IsoStepDef sd, IsoFlowDef def, IsoEnvelope env)
    {
        // Requests populate the full acquiring envelope; responses only
        // carry the reference block + result-relevant fields so the
        // wire size roughly matches what a real switch would emit.
        var builder = new IsoMessageBuilder()
            .WithMti(sd.Mti)
            .WithField(2, env.Pan)
            .WithField(3, env.ProcessingCode);
        // Balance inquiries have no transaction amount to authorize —
        // bit-4 is omitted on both request and response; the balance
        // itself travels back in bit-54 (see below).
        if (!def.IsBalanceInquiry)
            builder = builder.WithField(4, env.Amount);
        builder = builder
            .WithField(7, env.TransmissionDateTime)
            .WithField(11, env.Nsu)
            .WithField(12, env.LocalTime)
            .WithField(13, env.LocalDate)
            .WithField(22, env.PosEntryMode)
            .WithField(37, env.RetrievalRefNum)
            .WithField(41, env.TerminalId)
            .WithField(42, env.MerchantId)
            .WithField(49, "986"); // BRL

        // Debit tracks + withdrawal round-trips carry an encrypted PIN
        // block in bit 52 on the request MTIs (0100 / 0200). Real PIN
        // blocks are 16 hex chars (8 bytes); the value here is a fixed
        // placeholder — the visualizer never actually verifies PINs.
        var isRequest = sd.Mti is "0100" or "0200" or "0400";
        if (def.RequiresPin && isRequest)
            builder = builder.WithField(52, env.PinBlock);

        // Response MTIs tack on the issuer verdict + auth code so bit-38
        // and bit-39 land where analysts expect them. Covers approve
        // (0110/0210), reversal ack (0410) and advice ack (0130).
        if (sd.Mti is "0110" or "0210" or "0410" or "0130")
        {
            builder = builder
                .WithField(38, env.AuthCode)
                .WithField(39, "00"); // approved
        }

        // Balance inquiry response carries the account balance in bit-54.
        // Same 0110 MTI as an authorization, so guard on IsBalanceInquiry
        // + response side to avoid emitting it on non-inquiry approvals.
        if (def.IsBalanceInquiry && sd.Mti is "0110")
            builder = builder.WithField(54, env.AccountBalance);

        var wire = builder.BuildHex();
        // TPDU header is a 5-byte hex prefix in the Terminal↔Acquirer
        // and Brand↔Acquirer legs; the brand strips it before shipping
        // to the issuer, and the issuer's response returns without it.
        return sd.HasTpdu ? env.Tpdu + wire : wire;
    }

    /// <summary>
    /// Cheap MTI extractor for override validation — skips a leading
    /// TPDU (10 hex chars) when the step expects one, otherwise reads
    /// the first 4 chars. Returns null if the payload is too short.
    /// </summary>
    private static string? ExtractMti(string wire, bool expectsTpdu)
    {
        var trimmed = wire.Trim();
        var offset = 0;
        if (expectsTpdu && trimmed.Length >= 14
            && trimmed.Take(10).All(IsHex))
            offset = 10;
        if (trimmed.Length < offset + 4) return null;
        var mti = trimmed.Substring(offset, 4);
        return MtiParser.IsValid(mti) ? mti : null;
    }

    private static bool IsHex(char c) =>
        Uri.IsHexDigit(c);
}
