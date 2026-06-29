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
        bool IsRelay = false,
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
            // Pix Automático — per BCB's "Guia de Implementação do Pix
            // Automático", the mandate flow is INITIATED BY THE PAYEE's
            // PSP (not the payer, as in transactional Pix). The PSP
            // Recebedor sends pain.009 to ask for authorisation; the
            // PSP Pagador answers with pain.012 carrying the user's
            // decision.
            //   • Steps 1–2: pain.009 PSP Recebedor → (SPI repasse) → PSP Pagador
            //   • Steps 3–4: pain.012 PSP Pagador → (SPI repasse) → PSP Recebedor
            //   • Steps 5–6: internal notifications from each PSP to its
            //                client (rendered as pain.012; the format the
            //                BCB recommends for client-facing acceptance).
            // MndtId is the anchor cross-reference field and travels
            // unchanged across every hop (PropagateIntoXml updates MndtId
            // under both <Mndt> and <OrgnlMndt>).
            ["pix-automatico"] = new(
            [
                new(1, "pain.009.001.07", "pix-automatico-initiation",
                    "Solicitação de mandato", "PSP Recebedor", "SPI/BCB"),
                new(2, "pain.009.001.07", "pix-automatico-initiation",
                    "Repasse ao PSP Pagador", "SPI/BCB", "PSP Pagador",
                    IsRelay: true),
                new(3, "pain.012.001.07", "pix-automatico-mandate",
                    "Confirmação/Rejeição do mandato", "PSP Pagador", "SPI/BCB"),
                new(4, "pain.012.001.07", "pix-automatico-mandate",
                    "Notificação ao PSP Recebedor", "SPI/BCB", "PSP Recebedor",
                    IsRelay: true),
                new(5, "pain.012.001.07", "pix-automatico-mandate",
                    "Notificação ao pagador", "PSP Pagador", "Pagador"),
                new(6, "pain.012.001.07", "pix-automatico-mandate",
                    "Notificação ao recebedor", "PSP Recebedor", "Recebedor"),
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
                ViaActor: sd.ViaActor,
                IsRelay: sd.IsRelay));
        }

        // Anchor selection: if the user provided overrides, pick the
        // override whose message type is the most ID-rich (pacs.008 > 009 >
        // pain.001 > pain.012 > pacs.004 > pacs.002). That step's IDs
        // become the source of truth and propagate BOTH backward and
        // forward — fixing the Open Finance case where overriding the
        // pacs.008 (step 2) used to leave the pain.001 (step 1) with a
        // stale, unrelated EndToEndId.
        var anchorIdx = FindAnchorStepIndex(rawSteps, overrides);
        var anchor = ExtractAnchor(rawSteps[anchorIdx].Xml);

        var propagatedSteps = new List<PixFlowStep>(rawSteps.Count);
        for (var i = 0; i < rawSteps.Count; i++)
        {
            var s = rawSteps[i];
            // Skip the anchor itself and any user-supplied override
            // — overrides are pinned as-is; mismatches surface as alerts.
            if (i == anchorIdx || overrides.ContainsKey(s.StepId))
            {
                propagatedSteps.Add(s);
                continue;
            }
            propagatedSteps.Add(s with { Xml = PropagateIntoXml(s.Xml, anchor) });
        }

        var alerts = ValidateAgainstAnchor(propagatedSteps, anchorIdx);
        return new PixFlowResult(flowType, propagatedSteps, alerts);
    }

    /// <summary>
    /// Picks the index of the step whose XML is the most authoritative
    /// source of cross-reference ids. When the user supplies one or
    /// more overrides, prefer them in this order
    /// (pacs.008 → pacs.009 → pain.001 → pain.012 → pacs.004 → pacs.002);
    /// otherwise fall back to step 0.
    /// </summary>
    private static int FindAnchorStepIndex(
        IReadOnlyList<PixFlowStep> steps,
        IReadOnlyDictionary<int, string> overrides)
    {
        if (overrides.Count == 0) return 0;
        string[] preference = ["pacs.008", "pacs.009", "pain.001", "pain.012", "pacs.004", "pacs.002"];
        foreach (var pref in preference)
        {
            for (var i = 0; i < steps.Count; i++)
            {
                if (overrides.ContainsKey(steps[i].StepId)
                    && steps[i].MessageType.StartsWith(pref, StringComparison.OrdinalIgnoreCase))
                    return i;
            }
        }
        // Catch-all: first overridden step in document order.
        for (var i = 0; i < steps.Count; i++)
            if (overrides.ContainsKey(steps[i].StepId)) return i;
        return 0;
    }

    /// <summary>
    /// Checks every non-anchor step's <c>Orgnl*</c> + nested <c>Refs/EndToEndId</c>
    /// against the anchor and emits a <see cref="PixFlowAlert"/> for each
    /// mismatch. Empty/null fields are not alerts — only positive
    /// disagreements (both sides populated but different).
    /// </summary>
    public IReadOnlyList<PixFlowAlert> ValidateFlowConsistency(IReadOnlyList<PixFlowStep> steps)
        => steps.Count == 0 ? [] : ValidateAgainstAnchor(steps, anchorIndex: 0);

    /// <summary>
    /// Same as <see cref="ValidateFlowConsistency"/> but anchored on a
    /// caller-specified step — used by <see cref="GenerateFlow"/> when an
    /// override moves the anchor away from step 0.
    /// </summary>
    private static IReadOnlyList<PixFlowAlert> ValidateAgainstAnchor(
        IReadOnlyList<PixFlowStep> steps, int anchorIndex)
    {
        if (steps.Count == 0) return [];
        var anchor = ExtractAnchor(steps[anchorIndex].Xml);
        var alerts = new List<PixFlowAlert>();

        for (var i = 0; i < steps.Count; i++)
        {
            if (i == anchorIndex) continue;
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

        // IntrBkSttlmAmt (pacs.008/pacs.009), InstdAmt (pain.001) or
        // MaxAmt (pain.009 — Pix Automático) carries the headline value
        // + currency. Prefer the interbank settlement amount; fall back
        // to InstdAmt for pain.001 and MaxAmt for the mandate request.
        var amtEl = doc.Descendants()
            .FirstOrDefault(e => e.Name.LocalName is "IntrBkSttlmAmt" or "InstdAmt" or "MaxAmt"
                              && !e.HasElements);
        var amount = amtEl?.Value;
        var ccy = amtEl?.Attributes()
            .FirstOrDefault(a => a.Name.LocalName == "Ccy")?.Value;

        // Names + creditor account from the underlying credit-transfer
        // block — also covers pain.009/pain.012 where Cdtr/Nm and Dbtr/Nm
        // live under <Mndt> / <OrgnlMndt> with the same parent local-name.
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

        // Mandate ids and Pix Automático specifics. MndtId is the
        // headline cross-reference; MndtReqId is the request handle
        // that the pain.012 must echo back under OrgnlMndt; SeqTp and
        // SvcLvlCd must agree on both sides of the mandate exchange.
        var mndtId = FirstValue(doc, "MndtId");
        var mndtReqId = FirstValue(doc, "MndtReqId");
        var seqTp = doc.Descendants()
            .FirstOrDefault(e => e.Name.LocalName == "SeqTp"
                              && !e.HasElements
                              && e.Parent?.Name.LocalName == "Ocrncs")?.Value;
        var svcLvlCd = doc.Descendants()
            .FirstOrDefault(e => e.Name.LocalName == "Cd"
                              && !e.HasElements
                              && e.Parent?.Name.LocalName == "SvcLvl")?.Value;

        return new AnchorIds(
            MsgId: FirstValue(doc, "MsgId") ?? string.Empty,
            EndToEndId: FirstValue(doc, "EndToEndId") ?? string.Empty,
            TxId: FirstValue(doc, "TxId"),
            UETR: FirstValue(doc, "UETR"),
            Amount: amount,
            Ccy: ccy,
            DbtrNm: dbtrNm,
            CdtrNm: cdtrNm,
            CdtrAcctId: cdtrAcctId,
            MndtId: mndtId,
            MndtReqId: mndtReqId,
            SeqTp: seqTp,
            SvcLvlCd: svcLvlCd);
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
                    // Two propagation targets:
                    //  • Refs/EndToEndId in camt.054 (mirror of original)
                    //  • PmtId/EndToEndId in pain.001, pacs.008 and pacs.009
                    //    when THIS step isn't the anchor (back-propagation
                    //    case: anchor is the pacs.008 override and the
                    //    upstream pain.001 needs to adopt that EndToEndId).
                    if (!string.IsNullOrEmpty(anchor.EndToEndId)
                        && (el.Ancestors().Any(a => a.Name.LocalName == "Refs")
                            || el.Parent?.Name.LocalName == "PmtId"))
                        el.Value = anchor.EndToEndId;
                    break;
                case "MndtId":
                    // Pix Automático: same MndtId across every hop.
                    if (!string.IsNullOrEmpty(anchor.MndtId)
                        && el.Parent?.Name.LocalName is "OrgnlMndt" or "Mndt")
                        el.Value = anchor.MndtId;
                    break;
                case "MndtReqId":
                    // pain.009 request id is echoed by pain.012's OrgnlMndt.
                    if (!string.IsNullOrEmpty(anchor.MndtReqId)
                        && el.Parent?.Name.LocalName is "OrgnlMndt" or "Mndt"
                                                       or "MndtAccptncRpt" or "MndtInitnReq")
                        el.Value = anchor.MndtReqId;
                    break;
                case "SeqTp":
                    if (!string.IsNullOrEmpty(anchor.SeqTp)
                        && el.Parent?.Name.LocalName == "Ocrncs")
                        el.Value = anchor.SeqTp;
                    break;
                case "Cd":
                    // SvcLvl/Cd — must agree between pain.009 and pain.012.
                    if (!string.IsNullOrEmpty(anchor.SvcLvlCd)
                        && el.Parent?.Name.LocalName == "SvcLvl")
                        el.Value = anchor.SvcLvlCd;
                    break;
                case "MaxAmt":
                    // pain.009 → pain.012: mirror amount + @Ccy so a
                    // user-supplied value in the mandate request carries
                    // into the acceptance report.
                    if (!string.IsNullOrEmpty(anchor.Amount))
                    {
                        el.Value = anchor.Amount;
                        if (!string.IsNullOrEmpty(anchor.Ccy))
                        {
                            var ccyAttr = el.Attributes()
                                .FirstOrDefault(a => a.Name.LocalName == "Ccy");
                            if (ccyAttr is not null) ccyAttr.Value = anchor.Ccy;
                            else el.SetAttributeValue("Ccy", anchor.Ccy);
                        }
                    }
                    break;
                case "Nm":
                    // Cross-message creditor/debtor name propagation.
                    // Covers pain.009 → pain.012 (Mndt/Cdtr/Nm into
                    // OrgnlMndt/Cdtr/Nm), pacs.008 → camt.054 RltdPties,
                    // and pain.001 → pacs.008 when the anchor moves
                    // forward via override.
                    if (el.Parent?.Name.LocalName == "Cdtr"
                        && !string.IsNullOrEmpty(anchor.CdtrNm))
                        el.Value = anchor.CdtrNm;
                    else if (el.Parent?.Name.LocalName == "Dbtr"
                        && !string.IsNullOrEmpty(anchor.DbtrNm))
                        el.Value = anchor.DbtrNm;
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

        // Cdtr/Nm + Dbtr/Nm under RltdPties are now covered by the
        // generic Nm-by-parent rule in PropagateIntoXml — no special
        // case needed here.
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
