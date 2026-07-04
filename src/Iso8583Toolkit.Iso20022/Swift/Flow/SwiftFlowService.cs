using System.Globalization;
using System.Xml.Linq;
using Iso8583Toolkit.Iso20022.Builder;
using Iso8583Toolkit.Iso20022.Pix.Flow;
using Iso8583Toolkit.Iso20022.TestData;
using Iso8583Toolkit.Iso20022.Validation;

namespace Iso8583Toolkit.Iso20022.Swift.Flow;

/// <summary>
/// Sprint 9.3 — orchestrates multi-message SWIFT CBPR+ flows (both the
/// MX/ISO 20022 tracks and the legacy MT tracks) into the same shape
/// as <see cref="PixFlowService"/>. XML steps are rendered by the
/// existing <see cref="BuilderService"/> + CBPR+ scenarios; MT steps
/// are hand-assembled block strings so the visualizer can compare the
/// two worlds side-by-side.
///
/// Reuses <see cref="PixFlowResult"/> / <see cref="PixFlowStep"/> /
/// <see cref="PixFlowAlert"/> so the frontend only needs one type map.
/// Stateless, safe as a singleton.
/// </summary>
public sealed class SwiftFlowService
{
    // Fixed actor labels — the wire-level messages logically go
    // originator → beneficiary, but every CBPR+/legacy MT hop lands at
    // SWIFT (a "correspondent" leg) before the counterparty picks it up,
    // so we render that middle node explicitly.
    private const string Originator = "Banco Originador";
    private const string Correspondent = "SWIFT/Correspondente";
    private const string Intermediary = "Banco Intermediário";
    private const string Beneficiary = "Banco Beneficiário";

    private readonly BuilderService _builder;
    private readonly PaymentTestDataGenerator _generator;
    // Concrete pacs / camt versions we render. Resolved from
    // SchemaRegistry at construction so the catalogue always tracks the
    // newest embedded XSD; the previous hand-picked strings
    // ("camt.056.001.08", "pacs.028.001.03") were never actually shipped
    // in Schemas/ and blew up BuilderService with an "unknown message
    // type" error the moment the user picked cbpr-cancellation.
    private readonly string _pacs008;
    private readonly string _pacs009;
    private readonly string _pacs002;
    private readonly string _pacs004;
    private readonly string _pacs028;
    private readonly string _camt056;
    private readonly Dictionary<string, IReadOnlyList<MxStepDef>> _mxFlows;

    public SwiftFlowService(
        BuilderService builder,
        SchemaRegistry schemaRegistry,
        PaymentTestDataGenerator generator)
    {
        ArgumentNullException.ThrowIfNull(builder);
        ArgumentNullException.ThrowIfNull(schemaRegistry);
        ArgumentNullException.ThrowIfNull(generator);
        _builder = builder;
        _generator = generator;

        _pacs008 = ResolveLatestVersion(schemaRegistry, "pacs.008");
        _pacs009 = ResolveLatestVersion(schemaRegistry, "pacs.009");
        _pacs002 = ResolveLatestVersion(schemaRegistry, "pacs.002");
        _pacs004 = ResolveLatestVersion(schemaRegistry, "pacs.004");
        _pacs028 = ResolveLatestVersion(schemaRegistry, "pacs.028");
        _camt056 = ResolveLatestVersion(schemaRegistry, "camt.056");

        _mxFlows = BuildMxFlows();
    }

    /// <summary>
    /// Picks the newest embedded XSD whose <c>MessageType</c> matches the
    /// family prefix. Ordinal descending sort works because ISO 20022
    /// version suffixes are zero-padded (<c>001.09</c> &lt; <c>001.13</c>).
    /// </summary>
    private static string ResolveLatestVersion(SchemaRegistry registry, string prefix)
    {
        var latest = registry.ListSupportedTypes()
            .Where(t => t.MessageType.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(t => t.MessageType, StringComparer.Ordinal)
            .FirstOrDefault()
            ?? throw new InvalidOperationException(
                $"No XSD found for prefix '{prefix}'. "
                + "Ensure the XSD is embedded in the project.");
        return latest.MessageType;
    }

    /// <summary>Blueprint of an MX step — rendered via BuilderService.</summary>
    private sealed record MxStepDef(
        int StepId,
        string MessageType,
        string ScenarioId,
        string Label,
        string FromActor,
        string ToActor,
        bool IsRelay = false);

    /// <summary>Blueprint of an MT step — rendered from a template + fake data.</summary>
    private sealed record MtStepDef(
        int StepId,
        string MessageType,     // "MT103", "MT202COV", "MT910"
        string Label,
        string FromActor,
        string ToActor,
        bool IsRelay = false);

    // ── Flow catalogue ────────────────────────────────────────────────

    private Dictionary<string, IReadOnlyList<MxStepDef>> BuildMxFlows() =>
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["cbpr-direct-payment"] =
            [
                new(1, _pacs008, "cbpr-direct-payment",
                    "Customer Credit Transfer", Originator, Correspondent),
                new(2, _pacs008, "cbpr-direct-payment",
                    "Repasse", Correspondent, Beneficiary, IsRelay: true),
                new(3, _pacs002, "cbpr-status-report",
                    "Payment Status Report", Beneficiary, Correspondent),
                new(4, _pacs002, "cbpr-status-report",
                    "Repasse", Correspondent, Originator, IsRelay: true),
            ],
            ["cbpr-cover-payment"] =
            [
                new(1, _pacs008, "cbpr-direct-payment",
                    "Customer Credit Transfer (underlying)", Originator, Correspondent),
                new(2, _pacs009, "cbpr-cover-payment",
                    "FI Credit Transfer (cover)", Originator, Correspondent),
                new(3, _pacs009, "cbpr-cover-payment",
                    "Repasse", Correspondent, Intermediary, IsRelay: true),
                new(4, _pacs009, "cbpr-cover-payment",
                    "Repasse", Intermediary, Beneficiary, IsRelay: true),
                new(5, _pacs002, "cbpr-status-report",
                    "Payment Status Report", Beneficiary, Correspondent),
                new(6, _pacs002, "cbpr-status-report",
                    "Repasse", Correspondent, Originator, IsRelay: true),
            ],
            ["cbpr-return"] =
            [
                new(1, _pacs008, "cbpr-direct-payment",
                    "Original Payment", Originator, Correspondent),
                new(2, _pacs004, "cbpr-return",
                    "Payment Return", Beneficiary, Correspondent),
                new(3, _pacs004, "cbpr-return",
                    "Repasse", Correspondent, Originator, IsRelay: true),
                new(4, _pacs002, "cbpr-status-report",
                    "Return Status Report", Originator, Correspondent),
            ],
            ["cbpr-cancellation"] =
            [
                new(1, _pacs008, "cbpr-direct-payment",
                    "Original Payment", Originator, Correspondent),
                new(2, _camt056, "cbpr-cancellation",
                    "Cancellation Request", Originator, Correspondent),
                new(3, _camt056, "cbpr-cancellation",
                    "Repasse", Correspondent, Beneficiary, IsRelay: true),
                new(4, _pacs002, "cbpr-status-report",
                    "Cancellation Status", Beneficiary, Correspondent),
                new(5, _pacs002, "cbpr-status-report",
                    "Repasse", Correspondent, Originator, IsRelay: true),
            ],
            ["cbpr-status-inquiry"] =
            [
                new(1, _pacs008, "cbpr-direct-payment",
                    "Original Payment", Originator, Correspondent),
                new(2, _pacs028, "cbpr-status-request",
                    "Payment Status Request", Originator, Correspondent),
                new(3, _pacs028, "cbpr-status-request",
                    "Repasse", Correspondent, Beneficiary, IsRelay: true),
                new(4, _pacs002, "cbpr-status-report",
                    "Status Report", Beneficiary, Correspondent),
                new(5, _pacs002, "cbpr-status-report",
                    "Repasse", Correspondent, Originator, IsRelay: true),
            ],
        };

    private static readonly Dictionary<string, IReadOnlyList<MtStepDef>> MtFlows =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["cbpr-mt-direct"] =
            [
                new(1, "MT103",
                    "Single Customer Credit Transfer", Originator, Correspondent),
                new(2, "MT910",
                    "Confirmation of Credit", Correspondent, Originator),
            ],
            ["cbpr-mt-cover"] =
            [
                new(1, "MT103",
                    "Customer Transfer (underlying)", Originator, Correspondent),
                new(2, "MT202COV",
                    "Financial Institution Transfer (cover)", Originator, Correspondent),
                new(3, "MT910",
                    "Confirmation of Credit", Correspondent, Originator),
            ],
        };

    public IReadOnlyList<string> SupportedFlows =>
        _mxFlows.Keys.Concat(MtFlows.Keys).ToList();

    // ── Public API ────────────────────────────────────────────────────

    /// <summary>
    /// Generates every step for the requested CBPR+ (MX or MT) flow,
    /// applying optional per-step overrides. The result is shaped
    /// identically to <see cref="PixFlowService.GenerateFlow"/> so the
    /// frontend can render either family through the same widget.
    /// </summary>
    /// <exception cref="ArgumentException">When <paramref name="flowType"/> isn't registered.</exception>
    public PixFlowResult GenerateFlow(
        string flowType,
        IReadOnlyDictionary<int, string>? overrides = null)
    {
        overrides ??= new Dictionary<int, string>();

        if (_mxFlows.TryGetValue(flowType, out var mxDef))
            return GenerateMxFlow(flowType, mxDef, overrides);
        if (MtFlows.TryGetValue(flowType, out var mtDef))
            return GenerateMtFlow(flowType, mtDef, overrides);

        throw new ArgumentException(
            $"Unknown flow type: '{flowType}'. Supported: {string.Join(", ", SupportedFlows)}",
            nameof(flowType));
    }

    // ── MX flow rendering ─────────────────────────────────────────────

    private PixFlowResult GenerateMxFlow(
        string flowType,
        IReadOnlyList<MxStepDef> steps,
        IReadOnlyDictionary<int, string> overrides)
    {
        var raw = new List<PixFlowStep>(steps.Count);
        foreach (var sd in steps)
        {
            string xml;
            if (overrides.TryGetValue(sd.StepId, out var ovr) && !string.IsNullOrWhiteSpace(ovr))
            {
                xml = ovr.Trim();
            }
            else
            {
                var built = _builder.Build(sd.MessageType, sd.ScenarioId);
                xml = built.Xml;
            }
            raw.Add(new PixFlowStep(
                sd.StepId, sd.MessageType, sd.Label, sd.FromActor, sd.ToActor, xml,
                IsRelay: sd.IsRelay,
                ContentType: "xml"));
        }

        // Anchor propagation: pull EndToEndId / MsgId / UETR from the
        // authoritative first step (or, when the user pinned a specific
        // step, that override) and rewrite the Orgnl* refs on every
        // downstream step so the flow is internally consistent.
        var anchorIdx = FindAnchorStepIndex(raw, overrides);
        var anchor = ExtractAnchor(raw[anchorIdx].Xml);

        var propagated = new List<PixFlowStep>(raw.Count);
        for (var i = 0; i < raw.Count; i++)
        {
            var s = raw[i];
            if (i == anchorIdx || overrides.ContainsKey(s.StepId))
            {
                propagated.Add(s);
                continue;
            }
            propagated.Add(s with { Xml = PropagateIntoXml(s.Xml, anchor) });
        }

        var alerts = ValidateAgainstAnchor(propagated, anchorIdx);
        return new PixFlowResult(flowType, propagated, alerts);
    }

    private static int FindAnchorStepIndex(
        IReadOnlyList<PixFlowStep> steps,
        IReadOnlyDictionary<int, string> overrides)
    {
        if (overrides.Count == 0) return 0;
        // Prefer the ID-richest override (pacs.008 > 009 > 004 > 002).
        string[] preference = ["pacs.008", "pacs.009", "pacs.004", "pacs.002", "camt.056", "pacs.028"];
        foreach (var pref in preference)
        {
            for (var i = 0; i < steps.Count; i++)
            {
                if (overrides.ContainsKey(steps[i].StepId)
                    && steps[i].MessageType.StartsWith(pref, StringComparison.OrdinalIgnoreCase))
                    return i;
            }
        }
        for (var i = 0; i < steps.Count; i++)
            if (overrides.ContainsKey(steps[i].StepId)) return i;
        return 0;
    }

    private static (string? EndToEndId, string? MsgId, string? Uetr) ExtractAnchor(string xml)
    {
        var doc = ParseSafe(xml);
        if (doc is null) return (null, null, null);
        return (
            FirstValue(doc, "EndToEndId"),
            FirstValue(doc, "MsgId"),
            FirstValue(doc, "UETR"));
    }

    private static string PropagateIntoXml(
        string xml,
        (string? EndToEndId, string? MsgId, string? Uetr) anchor)
    {
        var doc = ParseSafe(xml);
        if (doc is null) return xml;
        foreach (var el in doc.Descendants().Where(e => !e.HasElements).ToList())
        {
            switch (el.Name.LocalName)
            {
                case "OrgnlMsgId":
                    if (!string.IsNullOrEmpty(anchor.MsgId)) el.Value = anchor.MsgId;
                    break;
                case "OrgnlEndToEndId":
                    if (!string.IsNullOrEmpty(anchor.EndToEndId)) el.Value = anchor.EndToEndId;
                    break;
                case "OrgnlUETR":
                    if (!string.IsNullOrEmpty(anchor.Uetr)) el.Value = anchor.Uetr;
                    break;
                case "UETR":
                    // Only propagate onto UETR when a peer step carries
                    // the same field — pacs.009 / pacs.002 use it too.
                    if (!string.IsNullOrEmpty(anchor.Uetr)) el.Value = anchor.Uetr;
                    break;
            }
        }
        return doc.ToString(SaveOptions.None);
    }

    private static IReadOnlyList<PixFlowAlert> ValidateAgainstAnchor(
        IReadOnlyList<PixFlowStep> steps, int anchorIndex)
    {
        var alerts = new List<PixFlowAlert>();
        if (steps.Count == 0) return alerts;
        var anchor = ExtractAnchor(steps[anchorIndex].Xml);

        for (var i = 0; i < steps.Count; i++)
        {
            if (i == anchorIndex) continue;
            var doc = ParseSafe(steps[i].Xml);
            if (doc is null) continue;
            Compare(doc, "OrgnlMsgId", anchor.MsgId, steps[i].StepId, "error", alerts);
            Compare(doc, "OrgnlEndToEndId", anchor.EndToEndId, steps[i].StepId, "error", alerts);
            if (anchor.Uetr is not null)
                Compare(doc, "OrgnlUETR", anchor.Uetr, steps[i].StepId, "warning", alerts);
        }
        return alerts;
    }

    private static void Compare(
        XDocument doc, string localName, string? expected,
        int stepId, string severity, List<PixFlowAlert> alerts)
    {
        if (string.IsNullOrEmpty(expected)) return;
        var found = FirstValue(doc, localName);
        if (string.IsNullOrEmpty(found)) return;
        if (!string.Equals(found, expected, StringComparison.Ordinal))
            alerts.Add(new PixFlowAlert(stepId, localName, expected, found, severity));
    }

    private static string? FirstValue(XDocument doc, string localName)
    {
        var el = doc.Descendants().FirstOrDefault(e =>
            e.Name.LocalName == localName && !e.HasElements);
        return string.IsNullOrEmpty(el?.Value) ? null : el.Value;
    }

    private static XDocument? ParseSafe(string xml)
    {
        try { return XDocument.Parse(xml); }
        catch { return null; }
    }

    // ── MT flow rendering ─────────────────────────────────────────────

    private PixFlowResult GenerateMtFlow(
        string flowType,
        IReadOnlyList<MtStepDef> steps,
        IReadOnlyDictionary<int, string> overrides)
    {
        // One "envelope" of fake data drives every step in the flow so
        // MT103/MT202COV/MT910 all reference the same UETR, MsgId,
        // BICs and amount. That way the visualizer can highlight
        // consistency across the trio without any per-step propagation.
        var env = BuildMtEnvelope();

        var raw = new List<PixFlowStep>(steps.Count);
        foreach (var sd in steps)
        {
            string body;
            if (overrides.TryGetValue(sd.StepId, out var ovr) && !string.IsNullOrWhiteSpace(ovr))
            {
                body = ovr.Trim();
            }
            else
            {
                body = sd.MessageType switch
                {
                    "MT103" => BuildMt103(env),
                    "MT202COV" => BuildMt202Cov(env),
                    "MT910" => BuildMt910(env),
                    _ => $"{{4:\n:20:{env.MsgId}\n-}}",
                };
            }
            raw.Add(new PixFlowStep(
                sd.StepId, sd.MessageType, sd.Label, sd.FromActor, sd.ToActor, body,
                IsRelay: sd.IsRelay,
                ContentType: "mt"));
        }

        // No cross-step propagation for MT — every step already shares
        // the same envelope. Alerts also stay empty (there's no XSD to
        // validate against and Orgnl* fields don't exist in MT).
        return new PixFlowResult(flowType, raw, []);
    }

    private sealed record MtEnvelope(
        string Uetr, string MsgId, string RelatedRef, string SenderBic,
        string ReceiverBic, string DbtrBic, string CdtrBic, string DbtrNm,
        string CdtrNm, string DbtrAcct, string CdtrAcct, string Amount,
        string Ccy, string Date);

    private MtEnvelope BuildMtEnvelope()
    {
        var dbtr = _generator.GeneratePerson("en");
        var cdtr = _generator.GeneratePerson("en");
        var sender = _generator.GenerateEuropeanBic();
        string receiver;
        do { receiver = _generator.GenerateEuropeanBic(); } while (receiver == sender);
        var dbtrBic = _generator.GenerateEuropeanBic();
        var cdtrBic = _generator.GenerateEuropeanBic();
        return new MtEnvelope(
            Uetr: Guid.NewGuid().ToString(),
            MsgId: "REF" + DateTime.UtcNow.ToString("yyMMddHHmmss", CultureInfo.InvariantCulture),
            RelatedRef: "REL" + DateTime.UtcNow.ToString("yyMMddHHmmss", CultureInfo.InvariantCulture),
            SenderBic: sender,
            ReceiverBic: receiver,
            DbtrBic: dbtrBic,
            CdtrBic: cdtrBic,
            DbtrNm: dbtr.Name.ToUpperInvariant(),
            CdtrNm: cdtr.Name.ToUpperInvariant(),
            DbtrAcct: RandomDigits(9),
            CdtrAcct: "GB29NWBK" + RandomDigits(14),
            Amount: _generator.GenerateAmount().Replace('.', ','),
            Ccy: "USD",
            Date: DateTime.UtcNow.ToString("yyMMdd", CultureInfo.InvariantCulture));
    }

    private string RandomDigits(int length)
    {
        // A tiny helper so account numbers look like digits rather than
        // reusing a person's CPF (which would be jarring on a wire
        // transfer). PaymentTestDataGenerator's GenerateCnpj gives us a
        // 14-digit seed; we just slice/pad from a fresh CPF.
        var seed = _generator.GenerateCpf() + _generator.GenerateCpf();
        return seed[..Math.Min(length, seed.Length)];
    }

    // MT envelopes carry literal "{" / "}" chars, which fight with C#
    // raw-string interpolation delimiters. We just concatenate — the
    // MT format is line-oriented anyway, so the template stays readable.
    private static string BuildMt103(MtEnvelope env) =>
        "{1:F01" + env.SenderBic + "0000000000}"
        + "{2:I103" + env.ReceiverBic + "N}"
        + "{3:{121:" + env.Uetr + "}}"
        + "{4:\n"
        + ":20:" + env.MsgId + "\n"
        + ":23B:CRED\n"
        + ":32A:" + env.Date + env.Ccy + env.Amount + "\n"
        + ":50K:/" + env.DbtrAcct + "\n"
        + env.DbtrNm + "\n"
        + ":52A:" + env.DbtrBic + "\n"
        + ":57A:" + env.CdtrBic + "\n"
        + ":59:/" + env.CdtrAcct + "\n"
        + env.CdtrNm + "\n"
        + ":71A:SHA\n"
        + "-}";

    private static string BuildMt202Cov(MtEnvelope env) =>
        "{1:F01" + env.SenderBic + "0000000000}"
        + "{2:I202COV" + env.ReceiverBic + "N}"
        + "{3:{121:" + env.Uetr + "}}"
        + "{4:\n"
        + ":20:" + env.MsgId + "\n"
        + ":21:" + env.RelatedRef + "\n"
        + ":32A:" + env.Date + env.Ccy + env.Amount + "\n"
        + ":52A:" + env.DbtrBic + "\n"
        + ":57A:" + env.CdtrBic + "\n"
        + ":58A:" + env.CdtrBic + "\n"
        + ":50K:/" + env.DbtrAcct + "\n"
        + env.DbtrNm + "\n"
        + ":59:/" + env.CdtrAcct + "\n"
        + env.CdtrNm + "\n"
        + "-}";

    private static string BuildMt910(MtEnvelope env) =>
        "{1:F01" + env.ReceiverBic + "0000000000}"
        + "{2:I910" + env.SenderBic + "N}"
        + "{3:{121:" + env.Uetr + "}}"
        + "{4:\n"
        + ":20:" + env.MsgId + "\n"
        + ":21:" + env.RelatedRef + "\n"
        + ":25:" + env.CdtrAcct + "\n"
        + ":32A:" + env.Date + env.Ccy + env.Amount + "\n"
        + ":50A:" + env.DbtrBic + "\n"
        + ":52A:" + env.DbtrBic + "\n"
        + "-}";
}
