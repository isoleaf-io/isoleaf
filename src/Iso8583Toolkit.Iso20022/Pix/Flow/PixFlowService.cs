using System.Xml.Linq;
using Iso8583Toolkit.Iso20022.Builder;

namespace Iso8583Toolkit.Iso20022.Pix.Flow;

/// <summary>
/// Orchestrates multi-message Pix flows. Generates each step via
/// <see cref="BuilderService"/>, then propagates the original IDs
/// (MsgId, EndToEndId, TxId, UETR) from the first step into every
/// downstream message so the rendered XML is internally consistent —
/// e.g. the <c>OrgnlEndToEndId</c> in the pacs.002 status report
/// matches the <c>PmtId/EndToEndId</c> from the pacs.008 that
/// triggered it.
///
/// User-supplied overrides bypass generation for that step and are
/// pinned as-is; consistency is then validated against the anchor
/// (first step) and any mismatch surfaces as a <see cref="PixFlowAlert"/>.
/// Stateless, safe as a singleton.
/// </summary>
public sealed class PixFlowService
{
    private readonly BuilderService _builder;

    /// <summary>Step blueprint inside a flow definition.</summary>
    private sealed record FlowStepDef(
        int StepId,
        string MessageType,
        string ScenarioId,
        string Label,
        string FromActor,
        string ToActor,
        string? ViaActor = null,
        Func<string, string>? PostProcess = null);

    private sealed record FlowDefinition(IReadOnlyList<FlowStepDef> Steps);

    private static readonly Dictionary<string, FlowDefinition> Flows =
        new(StringComparer.OrdinalIgnoreCase)
        {
            // Actor wiring follows the SPI/BCB arrangement: every
            // interbank message hops through the BCB ("repasse"), even
            // though the wire-level pacs.* carries the same payload
            // end-to-end. The diagram renders that hop with a dashed
            // arrow when ViaActor is set.
            ["pix-transfer"] = new(
            [
                new(1, "pacs.008.001.13", "pix-credit-transfer",
                    "Iniciação interbancária", "PSP Pagador", "PSP Recebedor",
                    ViaActor: "SPI/BCB"),
                new(2, "pacs.002.001.11", "pix-status-report",
                    "Status de liquidação", "PSP Recebedor", "PSP Pagador",
                    ViaActor: "SPI/BCB"),
                new(3, "camt.054.001.13", "pix-credit-notification",
                    "Notificação ao recebedor", "PSP Recebedor", "Recebedor"),
            ]),
            ["pix-transfer-with-return"] = new(
            [
                new(1, "pacs.008.001.13", "pix-credit-transfer",
                    "Iniciação interbancária", "PSP Pagador", "PSP Recebedor",
                    ViaActor: "SPI/BCB"),
                new(2, "pacs.002.001.11", "pix-status-report",
                    "Status de liquidação", "PSP Recebedor", "PSP Pagador",
                    ViaActor: "SPI/BCB"),
                new(3, "camt.054.001.13", "pix-credit-notification",
                    "Notificação ao recebedor", "PSP Recebedor", "Recebedor"),
                new(4, "pacs.004.001.10", "pix-return",
                    "Devolução solicitada", "PSP Recebedor", "PSP Pagador",
                    ViaActor: "SPI/BCB"),
                new(5, "pacs.002.001.11", "pix-status-report",
                    "Confirmação da devolução", "PSP Pagador", "PSP Recebedor",
                    ViaActor: "SPI/BCB"),
            ]),
            ["pix-open-finance"] = new(
            [
                new(1, "pain.001.001.12", "pix-initiation",
                    "Iniciação via Open Finance", "Pagador", "PSP Pagador"),
                new(2, "pacs.008.001.13", "pix-credit-transfer",
                    "Pix interbancário", "PSP Pagador", "PSP Recebedor",
                    ViaActor: "SPI/BCB"),
                new(3, "pacs.002.001.11", "pix-status-report",
                    "Status de liquidação", "PSP Recebedor", "PSP Pagador",
                    ViaActor: "SPI/BCB"),
                new(4, "camt.054.001.13", "pix-credit-notification",
                    "Notificação ao recebedor", "PSP Recebedor", "Recebedor"),
            ]),
            ["pix-rejected"] = new(
            [
                new(1, "pacs.008.001.13", "pix-credit-transfer",
                    "Iniciação interbancária", "PSP Pagador", "PSP Recebedor",
                    ViaActor: "SPI/BCB"),
                // SPI rejects in front — message never reaches the receiver,
                // so the rejection bounces straight back without ViaActor.
                new(2, "pacs.002.001.11", "pix-status-report",
                    "Rejeição", "SPI/BCB", "PSP Pagador",
                    PostProcess: ReplaceTxStatusWithRjct),
            ]),
        };

    public PixFlowService(BuilderService builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        _builder = builder;
    }

    public IReadOnlyList<string> SupportedFlows => Flows.Keys.ToList();

    /// <summary>
    /// Generates all steps for the requested Pix flow, applying optional per-step XML overrides.
    /// </summary>
    /// <exception cref="ArgumentException">When <paramref name="flowType"/> isn't registered.</exception>
    public PixFlowResult GenerateFlow(
        string flowType,
        IReadOnlyDictionary<int, string>? overrides = null)
    {
        if (!Flows.TryGetValue(flowType, out var def))
            throw new ArgumentException(
                $"Unknown flow type: '{flowType}'. Supported: {string.Join(", ", Flows.Keys)}",
                nameof(flowType));

        overrides ??= new Dictionary<int, string>();
        var rawSteps = new List<PixFlowStep>(def.Steps.Count);

        foreach (var sd in def.Steps)
        {
            string xml;
            if (overrides.TryGetValue(sd.StepId, out var ovr) && !string.IsNullOrWhiteSpace(ovr))
            {
                xml = ovr.Trim();
            }
            else
            {
                var build = _builder.Build(sd.MessageType, sd.ScenarioId);
                xml = build.Xml;
                if (sd.PostProcess is not null) xml = sd.PostProcess(xml);
            }
            rawSteps.Add(new PixFlowStep(
                sd.StepId, sd.MessageType, sd.Label, sd.FromActor, sd.ToActor, xml,
                ViaActor: sd.ViaActor));
        }

        // Anchor = first step. Every other generated step pulls its
        // OrgnlMsgId / OrgnlEndToEndId / OrgnlTxId / OrgnlUETR from there
        // so the flow reads as one logical transaction.
        var anchor = ExtractAnchor(rawSteps[0].Xml);

        var propagatedSteps = new List<PixFlowStep>(rawSteps.Count);
        for (var i = 0; i < rawSteps.Count; i++)
        {
            var s = rawSteps[i];
            // Skip step 1 (anchor itself) and any user-supplied override
            // — overrides are pinned as-is; mismatches surface as alerts.
            if (i == 0 || overrides.ContainsKey(s.StepId))
            {
                propagatedSteps.Add(s);
                continue;
            }
            propagatedSteps.Add(s with { Xml = PropagateIntoXml(s.Xml, anchor) });
        }

        var alerts = ValidateFlowConsistency(propagatedSteps);
        return new PixFlowResult(flowType, propagatedSteps, alerts);
    }

    /// <summary>
    /// Checks every non-anchor step's <c>Orgnl*</c> + nested <c>Refs/EndToEndId</c>
    /// against the anchor and emits a <see cref="PixFlowAlert"/> for each
    /// mismatch. Empty/null fields are not alerts — only positive
    /// disagreements (both sides populated but different).
    /// </summary>
    public IReadOnlyList<PixFlowAlert> ValidateFlowConsistency(IReadOnlyList<PixFlowStep> steps)
    {
        if (steps.Count == 0) return [];
        var anchor = ExtractAnchor(steps[0].Xml);
        var alerts = new List<PixFlowAlert>();

        for (var i = 1; i < steps.Count; i++)
        {
            var doc = ParseSafe(steps[i].Xml);
            if (doc is null) continue;

            CompareField(doc, "OrgnlMsgId", anchor.MsgId, steps[i].StepId, "error", alerts);
            CompareField(doc, "OrgnlEndToEndId", anchor.EndToEndId, steps[i].StepId, "error", alerts);
            if (anchor.TxId is not null)
                CompareField(doc, "OrgnlTxId", anchor.TxId, steps[i].StepId, "warning", alerts);
            if (anchor.UETR is not null)
                CompareField(doc, "OrgnlUETR", anchor.UETR, steps[i].StepId, "warning", alerts);

            // camt.054 doesn't carry Orgnl* — it has Refs/EndToEndId that
            // mirrors the original. Validate inside that subtree only so
            // we don't accidentally compare the pacs.008's own PmtId.
            foreach (var refs in doc.Descendants().Where(e => e.Name.LocalName == "Refs"))
            {
                foreach (var e2e in refs.Descendants()
                    .Where(e => e.Name.LocalName == "EndToEndId")
                    .Where(e => !string.IsNullOrEmpty(e.Value)
                             && !string.Equals(e.Value, anchor.EndToEndId, StringComparison.Ordinal)))
                {
                    alerts.Add(new PixFlowAlert(
                        steps[i].StepId, "EndToEndId (Refs)",
                        anchor.EndToEndId, e2e.Value, "error"));
                }
            }
        }
        return alerts;
    }

    // ---- internals ---------------------------------------------------------

    private static AnchorIds ExtractAnchor(string xml)
    {
        var doc = ParseSafe(xml)
            ?? throw new InvalidOperationException("Anchor step is not valid XML.");

        // IntrBkSttlmAmt (pacs.008/pacs.009) or InstdAmt (pain.001) carries
        // the headline value + currency. Prefer the interbank settlement
        // amount; fall back to InstdAmt when the anchor is a pain.001.
        var amtEl = doc.Descendants()
            .FirstOrDefault(e => e.Name.LocalName is "IntrBkSttlmAmt" or "InstdAmt"
                              && !e.HasElements);
        var amount = amtEl?.Value;
        var ccy = amtEl?.Attributes()
            .FirstOrDefault(a => a.Name.LocalName == "Ccy")?.Value;

        // Names + creditor account from the underlying credit-transfer block.
        var dbtrNm = doc.Descendants()
            .FirstOrDefault(e => e.Name.LocalName == "Nm"
                              && e.Parent?.Name.LocalName == "Dbtr")?.Value;
        var cdtrNm = doc.Descendants()
            .FirstOrDefault(e => e.Name.LocalName == "Nm"
                              && e.Parent?.Name.LocalName == "Cdtr")?.Value;
        var cdtrAcctId = doc.Descendants()
            .Where(e => e.Name.LocalName == "Id" && !e.HasElements
                     && e.Ancestors().Any(a => a.Name.LocalName == "CdtrAcct"))
            .Select(e => e.Value)
            .FirstOrDefault();

        return new AnchorIds(
            MsgId: FirstValue(doc, "MsgId") ?? string.Empty,
            EndToEndId: FirstValue(doc, "EndToEndId") ?? string.Empty,
            TxId: FirstValue(doc, "TxId"),
            UETR: FirstValue(doc, "UETR"),
            Amount: amount,
            Ccy: ccy,
            DbtrNm: dbtrNm,
            CdtrNm: cdtrNm,
            CdtrAcctId: cdtrAcctId);
    }

    private static string PropagateIntoXml(string xml, AnchorIds anchor)
    {
        var doc = ParseSafe(xml);
        if (doc is null) return xml;

        var rootChild = doc.Root?.Elements().FirstOrDefault()?.Name.LocalName;
        var isCamt054 = rootChild == "BkToCstmrDbtCdtNtfctn";

        foreach (var el in doc.Descendants().Where(e => !e.HasElements))
        {
            switch (el.Name.LocalName)
            {
                case "OrgnlMsgId":
                    if (!string.IsNullOrEmpty(anchor.MsgId)) el.Value = anchor.MsgId;
                    break;
                case "OrgnlEndToEndId":
                    if (!string.IsNullOrEmpty(anchor.EndToEndId)) el.Value = anchor.EndToEndId;
                    break;
                case "OrgnlTxId":
                    if (anchor.TxId is not null) el.Value = anchor.TxId;
                    break;
                case "OrgnlUETR":
                    if (anchor.UETR is not null) el.Value = anchor.UETR;
                    break;
                case "EndToEndId":
                    // For camt.054 the original EndToEndId is mirrored
                    // under Refs/EndToEndId. Only update when nested
                    // under Refs so we don't touch a fresh PmtId in some
                    // downstream pacs.008-like body.
                    if (!string.IsNullOrEmpty(anchor.EndToEndId)
                        && el.Ancestors().Any(a => a.Name.LocalName == "Refs"))
                        el.Value = anchor.EndToEndId;
                    break;
            }
        }

        if (isCamt054)
            PropagateAmountAndAccountIntoCamt054(doc, anchor);

        return doc.ToString(SaveOptions.None);
    }

    /// <summary>
    /// camt.054-specific propagation: aligns the credit notification's
    /// <c>Ntry/Amt</c> + <c>@Ccy</c> with the anchor pacs.008, and copies
    /// the creditor account id from the anchor into the notification's
    /// <c>Ntfctn/Acct/Id/Othr/Id</c> so a user-supplied override on the
    /// pacs.008 ripples all the way to the receiver's notification.
    /// </summary>
    private static void PropagateAmountAndAccountIntoCamt054(XDocument doc, AnchorIds anchor)
    {
        var amtEl = doc.Descendants().FirstOrDefault(e =>
            e.Name.LocalName == "Amt"
            && e.Ancestors().Any(a => a.Name.LocalName == "Ntry"));
        if (amtEl is not null)
        {
            if (!string.IsNullOrEmpty(anchor.Amount)) amtEl.Value = anchor.Amount;
            if (!string.IsNullOrEmpty(anchor.Ccy))
            {
                var ccyAttr = amtEl.Attributes().FirstOrDefault(a => a.Name.LocalName == "Ccy");
                if (ccyAttr is not null) ccyAttr.Value = anchor.Ccy;
                else amtEl.SetAttributeValue("Ccy", anchor.Ccy);
            }
        }

        if (!string.IsNullOrEmpty(anchor.CdtrAcctId))
        {
            var acctOthr = doc.Descendants().FirstOrDefault(e =>
                e.Name.LocalName == "Id" && !e.HasElements
                && e.Parent?.Name.LocalName == "Othr"
                && e.Ancestors().Any(a => a.Name.LocalName == "Acct"
                                       && a.Parent?.Name.LocalName == "Ntfctn"));
            if (acctOthr is not null) acctOthr.Value = anchor.CdtrAcctId;
        }

        // Optional: if the camt.054 carries RltdPties under TxDtls (not
        // mandatory today but defensive against future scenario tweaks),
        // mirror Dbtr/Cdtr names too.
        if (!string.IsNullOrEmpty(anchor.DbtrNm))
        {
            var dbtrNm = doc.Descendants().FirstOrDefault(e =>
                e.Name.LocalName == "Nm"
                && e.Parent?.Name.LocalName == "Dbtr"
                && e.Ancestors().Any(a => a.Name.LocalName == "RltdPties"));
            if (dbtrNm is not null) dbtrNm.Value = anchor.DbtrNm;
        }
        if (!string.IsNullOrEmpty(anchor.CdtrNm))
        {
            var cdtrNm = doc.Descendants().FirstOrDefault(e =>
                e.Name.LocalName == "Nm"
                && e.Parent?.Name.LocalName == "Cdtr"
                && e.Ancestors().Any(a => a.Name.LocalName == "RltdPties"));
            if (cdtrNm is not null) cdtrNm.Value = anchor.CdtrNm;
        }
    }

    private static void CompareField(
        XDocument doc, string localName, string expected,
        int stepId, string severity, List<PixFlowAlert> alerts)
    {
        var found = FirstValue(doc, localName);
        if (string.IsNullOrEmpty(found) || string.IsNullOrEmpty(expected)) return;
        if (!string.Equals(found, expected, StringComparison.Ordinal))
            alerts.Add(new PixFlowAlert(stepId, localName, expected, found, severity));
    }

    private static string? FirstValue(XDocument doc, string localName)
    {
        var el = doc.Descendants().FirstOrDefault(e =>
            e.Name.LocalName == localName && !e.HasElements);
        return el is null || string.IsNullOrEmpty(el.Value) ? null : el.Value;
    }

    private static XDocument? ParseSafe(string xml)
    {
        try { return XDocument.Parse(xml); }
        catch { return null; }
    }

    private static string ReplaceTxStatusWithRjct(string xml) =>
        xml.Replace("<TxSts>ACCP</TxSts>", "<TxSts>RJCT</TxSts>", StringComparison.Ordinal);
}
