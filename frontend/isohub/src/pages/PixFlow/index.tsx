import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Copy, Edit3, Loader2, Workflow, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { MessageSummaryCard } from "@/components/Iso20022/MessageSummaryCard";
import { parseIso20022, type ParseResponse } from "@/api/iso20022";
import {
  generatePixFlow,
  type PixFlowResult,
  type PixFlowStep,
} from "@/api/pixFlow";
import { generateSwiftFlow } from "@/api/swiftFlow";
import { generateIso8583Flow } from "@/api/iso8583Flow";
import { FEATURES } from "@/config/features";

// Sprint 9.3+9.4 — unified visualizer for four protocol families. Each
// tab swaps the actor column layout, the available flows and the
// backend endpoint. MT/ISO 8583 payloads are rendered as raw text
// (no XSD → no MessageSummaryCard).
type FlowProtocol = "pix" | "cbpr-mx" | "cbpr-mt" | "iso8583";

// Column order per protocol. Absent actors are filtered out at render.
const ACTOR_ORDER_BY_PROTOCOL: Record<FlowProtocol, string[]> = {
  pix: [
    "Pagador",
    "PSP Pagador",
    "SPI/BCB",
    "PSP Recebedor",
    "Recebedor",
  ],
  "cbpr-mx": [
    "Banco Originador",
    "SWIFT/Correspondente",
    "Banco Intermediário",
    "Banco Beneficiário",
  ],
  "cbpr-mt": [
    "Banco Originador",
    "SWIFT/Correspondente",
    "Banco Beneficiário",
  ],
  iso8583: [
    "Terminal/POS",
    "Acquirer",
    "Card Network",
    "Issuer",
  ],
};

const FLOW_TYPES_BY_PROTOCOL: Record<
  FlowProtocol,
  ReadonlyArray<{ id: string; labelKey: string }>
> = {
  pix: [
    { id: "pix-transfer",             labelKey: "pix.flow.types.transfer" },
    { id: "pix-transfer-with-return", labelKey: "pix.flow.types.transferReturn" },
    { id: "pix-open-finance",         labelKey: "pix.flow.types.openFinance" },
    { id: "pix-rejected",             labelKey: "pix.flow.types.rejected" },
    { id: "pix-automatico",           labelKey: "pix.flow.types.automatico" },
  ],
  "cbpr-mx": [
    { id: "cbpr-direct-payment", labelKey: "flow.cbpr.direct" },
    { id: "cbpr-cover-payment",  labelKey: "flow.cbpr.cover" },
    { id: "cbpr-return",         labelKey: "flow.cbpr.return" },
    { id: "cbpr-cancellation",   labelKey: "flow.cbpr.cancellation" },
    { id: "cbpr-status-inquiry", labelKey: "flow.cbpr.statusInquiry" },
  ],
  "cbpr-mt": [
    { id: "cbpr-mt-direct", labelKey: "flow.cbprMt.direct" },
    { id: "cbpr-mt-cover",  labelKey: "flow.cbprMt.cover" },
  ],
  iso8583: [
    { id: "iso8583-credit-purchase",  labelKey: "flow.iso8583.creditPurchase" },
    { id: "iso8583-debit-purchase",   labelKey: "flow.iso8583.debitPurchase" },
    { id: "iso8583-withdrawal",       labelKey: "flow.iso8583.withdrawal" },
    { id: "iso8583-reversal",         labelKey: "flow.iso8583.reversal" },
    { id: "iso8583-stand-in",         labelKey: "flow.iso8583.standIn" },
    { id: "iso8583-balance-inquiry",  labelKey: "flow.iso8583.balanceInquiry" },
  ],
};

// Distinct hues per protocol family. Sprint 9.3 adds MT (purple),
// Sprint 9.4 adds ISO 8583 (dark green) so the card-payment track is
// visually distinct from the ISO 20022 messages — pacs blue, pain
// green, camt orange, MT roxo, ISO 8583 verde-escuro.
function familyColor(step: PixFlowStep): string {
  // Sprint 9.4-revision — stand-in timeouts render in red so the
  // "issuer stopped responding" segment jumps out visually.
  if (step.contentType === "timeout") return "#ef4444";
  if (step.contentType === "iso8583") return "#16a34a";
  if (step.contentType === "mt") return "#8b5cf6";
  const messageType = step.messageType;
  if (messageType.startsWith("pacs.")) return "#3b82f6";
  if (messageType.startsWith("pain.")) return "#22c55e";
  if (messageType.startsWith("camt.")) return "#f97316";
  return "#94a3b8";
}

// ISO 8583 actor names are English-only on the wire (backend contract)
// so the frontend translates them at render time. Non-ISO 8583 actors
// (Pix / SWIFT) fall through the map and render as-is.
const ISO8583_ACTOR_LABELS: Record<string, Record<string, string>> = {
  "Terminal/POS":  { pt: "Terminal/PDV", en: "Terminal/POS" },
  Acquirer:        { pt: "Adquirente",   en: "Acquirer" },
  "Card Network":  { pt: "Bandeira",     en: "Card Network" },
  Issuer:          { pt: "Emissor",      en: "Issuer" },
};

function useActorLabel() {
  const { i18n } = useTranslation();
  // i18n.language may be "pt-BR" / "en-US"; take just the language head.
  const lang = i18n.language?.split("-")[0] ?? "en";
  return (actor: string) =>
    ISO8583_ACTOR_LABELS[actor]?.[lang] ?? actor;
}

export default function FlowVisualizerPage() {
  const { t } = useTranslation();
  const [protocol, setProtocol] = useState<FlowProtocol>("pix");
  const availableFlows = FLOW_TYPES_BY_PROTOCOL[protocol];
  const actorOrder = ACTOR_ORDER_BY_PROTOCOL[protocol];
  const [flowType, setFlowType] = useState<string>(availableFlows[0].id);
  const [result, setResult] = useState<PixFlowResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [overrideTarget, setOverrideTarget] = useState<PixFlowStep | null>(null);

  // Reset flow selection + result when the protocol tab changes so the
  // dropdown doesn't hold a stale "pix-transfer" while the backend
  // switches to /api/swift/flow.
  useEffect(() => {
    setFlowType(availableFlows[0].id);
    setResult(null);
    setSelectedStepId(null);
    setOverrides({});
    setError(null);
  }, [protocol, availableFlows]);

  const generate = useCallback(
    async (nextOverrides: Record<number, string>) => {
      setLoading(true);
      setError(null);
      try {
        const fetcher =
          protocol === "pix" ? generatePixFlow
          : protocol === "iso8583" ? generateIso8583Flow
          : generateSwiftFlow;
        const r = await fetcher(
          flowType,
          Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined,
        );
        setResult(r);
        // Keep selection if the same step still exists.
        if (selectedStepId != null
            && !r.steps.some((s) => s.stepId === selectedStepId)) {
          setSelectedStepId(null);
        }
      } catch (e) {
        setError(formatErr(e));
      } finally {
        setLoading(false);
      }
    },
    [flowType, protocol, selectedStepId],
  );

  function handleGenerate() {
    setOverrides({});
    setSelectedStepId(null);
    generate({});
  }

  function handleOverrideConfirm(stepId: number, xml: string) {
    const next = { ...overrides, [stepId]: xml };
    setOverrides(next);
    setOverrideTarget(null);
    generate(next);
  }

  function handleOverrideClear(stepId: number) {
    const next = { ...overrides };
    delete next[stepId];
    setOverrides(next);
    generate(next);
  }

  const selectedStep = useMemo(
    () => result?.steps.find((s) => s.stepId === selectedStepId) ?? null,
    [result, selectedStepId],
  );

  const stepAlerts = useMemo(
    () => (selectedStep
      ? (result?.alerts ?? []).filter((a) => a.stepId === selectedStep.stepId)
      : []),
    [result, selectedStep],
  );

  return (
    <AppShell title={t("flow.title")} subtitle={t("flow.subtitle")}>
      <div className="space-y-4">
        {/* Persistent disclaimer — reminds analysts across every protocol
            tab that the payloads shown here are illustrative fixtures
            from the fake-data generator, not captures from a real network. */}
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg text-xs bg-warning-bg/40 border border-warning-text/40 text-warning-text">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{t("flow.exampleDisclaimer")}</span>
        </div>

        {/* Protocol tabs — Sprint 9.3. Each tab reloads the flow catalogue
            and swaps the backend endpoint (Pix vs SWIFT CBPR+). */}
        <div className="flex gap-2 flex-wrap">
          <ProtocolTab active={protocol === "pix"} onClick={() => setProtocol("pix")}
            label={`🇧🇷 ${t("flow.tabs.pix")}`} />
          <ProtocolTab active={protocol === "cbpr-mx"} onClick={() => setProtocol("cbpr-mx")}
            label={`⚡ ${t("flow.tabs.cbprMx")}`} />
          <ProtocolTab active={protocol === "cbpr-mt"} onClick={() => setProtocol("cbpr-mt")}
            label={`📄 ${t("flow.tabs.cbprMt")}`} />
          {/* Sprint 9.4 — ISO 8583 tab hidden behind its own flag so
              it stays off in production until it ships. */}
          {FEATURES.iso8583FlowVisualizer && (
            <ProtocolTab active={protocol === "iso8583"} onClick={() => setProtocol("iso8583")}
              label={`💳 ${t("flow.tabs.iso8583")}`} />
          )}
        </div>
        <Card>
          <CardBody>
            <div className="flex items-end gap-2 flex-wrap">
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] text-text-tertiary uppercase tracking-wide">
                  {t("pix.flow.selectFlow")}
                </span>
                <select
                  value={flowType}
                  onChange={(e) => setFlowType(e.target.value)}
                  data-testid="flow-type"
                  className="bg-bg-input border border-[var(--border)] rounded-md px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                >
                  {availableFlows.map((ft) => (
                    <option key={ft.id} value={ft.id}>{t(ft.labelKey)}</option>
                  ))}
                </select>
              </label>
              <Button
                onClick={handleGenerate}
                disabled={loading}
                data-testid="pix-flow-generate"
              >
                <Workflow size={13} />{" "}
                {loading ? t("common.loading") : t("pix.flow.generate")}
              </Button>
            </div>
            {error && <ErrorBanner message={error} />}
          </CardBody>
        </Card>

        {result && result.alerts.length > 0 && (
          <Card>
            <CardBody>
              <div className="flex items-start gap-2 text-xs">
                <AlertTriangle size={14} className="text-warning-text shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-warning-text">
                    {t("pix.flow.alertsTitle", { count: result.alerts.length })}
                  </div>
                  <ul className="list-disc list-inside text-text-secondary">
                    {result.alerts.map((a, i) => (
                      <li key={i}>
                        <span className="font-mono">Step {a.stepId}</span> ·{" "}
                        <span className="font-mono">{a.field}</span>{" "}
                        <Badge tone={a.severity === "error" ? "danger" : "warning"}>
                          {a.severity}
                        </Badge>
                        {" "}— esperado <code>{a.expected}</code>, encontrado <code>{a.found}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Row 1 — diagram in full width. Clicking a message no longer
            opens a side panel; it populates the row below. */}
        {result && (
          <Card>
            <CardHeader>
              <span className="text-sm font-semibold">
                {t("pix.flow.diagramTitle")}
              </span>
            </CardHeader>
            <CardBody>
              <SequenceDiagram
                steps={result.steps}
                actorOrder={actorOrder}
                selectedStepId={selectedStepId}
                onSelect={(s) => setSelectedStepId(s.stepId)}
              />
            </CardBody>
          </Card>
        )}

        {/* Row 2 — payload + parse summary. Parse summary is XML-only;
            MT steps show the raw block text alongside an "Abrir no Parser
            MT" button so the user can jump to the dedicated MT parser. */}
        {result && selectedStep && (
          <div
            key={selectedStep.stepId}
            className="pix-flow-fade-in grid grid-cols-1 lg:grid-cols-2 gap-4"
          >
            {selectedStep.contentType === "timeout" ? (
              // Timeout step has no wire payload — the left column
              // hosts the stand-in explanation and the right column
              // just carries the "Stand-in ativado" callout badge.
              <>
                <TimeoutExplainPanel step={selectedStep} />
                <TimeoutSidePanel />
              </>
            ) : (
              <>
                <XmlPanel
                  step={selectedStep}
                  alerts={stepAlerts}
                  hasOverride={overrides[selectedStep.stepId] != null}
                  onReplace={() => setOverrideTarget(selectedStep)}
                  onClearOverride={() => handleOverrideClear(selectedStep.stepId)}
                />
                {selectedStep.contentType === "mt"
                  ? <MtActionsPanel step={selectedStep} />
                  : selectedStep.contentType === "iso8583"
                  ? <Iso8583SummaryPanel step={selectedStep} />
                  : <ParsePanel step={selectedStep} />}
              </>
            )}
          </div>
        )}
      </div>

      {overrideTarget && (
        <OverrideDialog
          step={overrideTarget}
          initialXml={overrides[overrideTarget.stepId] ?? overrideTarget.xml}
          onCancel={() => setOverrideTarget(null)}
          onConfirm={(xml) => handleOverrideConfirm(overrideTarget.stepId, xml)}
        />
      )}
    </AppShell>
  );
}

// ---- Sequence diagram ------------------------------------------------------

function SequenceDiagram({
  steps,
  actorOrder,
  selectedStepId,
  onSelect,
}: {
  steps: PixFlowStep[];
  actorOrder: string[];
  selectedStepId: number | null;
  onSelect: (s: PixFlowStep) => void;
}) {
  const actorLabel = useActorLabel();
  // Pinned column order via prop — keeps the layout stable per protocol
  // (SPI, SWIFT correspondent, etc.) even when a given flow omits some
  // intermediate actor. ViaActor is also considered so interbank hops
  // show up even if no step has the intermediary as a direct endpoint.
  const actors = useMemo(() => {
    const present = new Set<string>();
    for (const s of steps) {
      present.add(s.fromActor);
      present.add(s.toActor);
      if (s.viaActor) present.add(s.viaActor);
    }
    return actorOrder.filter((a) => present.has(a));
  }, [steps, actorOrder]);

  // Rows-per-step: 2 when there's a via-hop (one row per arrow), 1 otherwise.
  const rowsPerStep = (s: PixFlowStep) => (s.viaActor ? 2 : 1);
  const totalRows = useMemo(
    () => steps.reduce((sum, s) => sum + rowsPerStep(s), 0),
    [steps],
  );

  const colWidth = 180;
  const rowHeight = 60;
  const headerHeight = 50;
  const padding = 20;
  const width = padding * 2 + actors.length * colWidth;
  const height = padding * 2 + headerHeight + totalRows * rowHeight + 10;

  const colX = (idx: number) => padding + idx * colWidth + colWidth / 2;

  return (
    // Sprint 9.7 — SVG scales to available width via viewBox. On mobile
    // (390–414px) the diagram (up to 5 actors × 180px = 940px + padding)
    // is zoomed out to fit instead of forcing horizontal scroll; on
    // desktop it renders at natural size up to the max width of the
    // container.
    <div className="w-full" data-testid="pix-flow-diagram-container">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMin meet"
        className="block w-full h-auto"
        data-testid="pix-flow-diagram-svg"
      >
        <defs>
          <marker
            id="pix-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
          </marker>
        </defs>

        {/* Actor headers + lifelines */}
        {actors.map((actor, i) => (
          <g key={actor}>
            <rect
              x={colX(i) - 70}
              y={padding}
              width={140}
              height={30}
              rx={4}
              className="fill-bg-secondary stroke-[var(--border)]"
              strokeWidth={1}
            />
            <text
              x={colX(i)}
              y={padding + 19}
              textAnchor="middle"
              className="fill-text-primary"
              fontSize={11}
              fontWeight={600}
            >
              {actorLabel(actor)}
            </text>
            <line
              x1={colX(i)}
              y1={padding + 32}
              x2={colX(i)}
              y2={height - padding}
              className="stroke-text-tertiary"
              strokeDasharray="4 3"
              strokeWidth={1}
            />
          </g>
        ))}

        {/* Messages — each step renders 1 arrow normally, or 2 when a
            ViaActor is set (e.g. PSP Pagador → SPI/BCB → PSP Recebedor).
            The repasse leg uses a dashed stroke so the hop reads as
            "same message, routed through the BCB". */}
        {(() => {
          const arrows: React.ReactNode[] = [];
          let rowCursor = 0;
          for (const s of steps) {
            const fromI = actors.indexOf(s.fromActor);
            const toI = actors.indexOf(s.toActor);
            const color = familyColor(s);
            const isSelected = s.stepId === selectedStepId;
            const baseY = padding + headerHeight + rowCursor * rowHeight + rowHeight / 2;

            if (s.viaActor && actors.indexOf(s.viaActor) >= 0) {
              const viaI = actors.indexOf(s.viaActor);
              const y1Pos = baseY;
              const y2Pos = baseY + rowHeight;
              arrows.push(
                <g key={`${s.stepId}-a`} onClick={() => onSelect(s)} style={{ cursor: "pointer" }}>
                  {renderArrow(colX(fromI), y1Pos, colX(viaI), y1Pos,
                    color, isSelected, s.messageType, s.label, false)}
                </g>,
                <g key={`${s.stepId}-b`} onClick={() => onSelect(s)} style={{ cursor: "pointer" }}>
                  {renderArrow(colX(viaI), y2Pos, colX(toI), y2Pos,
                    color, isSelected, s.messageType, "repasse", true)}
                </g>,
              );
              rowCursor += 2;
            } else {
              const x1 = colX(fromI);
              const x2 = colX(toI);
              // SPI "repasse" legs (steps marked IsRelay) render dashed
              // even when modelled as standalone steps (no ViaActor).
              // Timeout hops also render dashed regardless of relay flag.
              const isTimeout = s.contentType === "timeout";
              const dashed = s.isRelay === true || isTimeout;
              const arrowNode = x1 === x2
                ? renderSelfArrow(x1, baseY, color, isSelected, s.messageType)
                : renderArrow(x1, baseY, x2, baseY,
                    color, isSelected, isTimeout ? "⚠ Timeout" : s.messageType,
                    s.label, dashed,
                    s.isRelayWithTpdu === true);
              // Timeout hops are still clickable — the panel below
              // shows the stand-in explanation instead of the empty
              // wire, so the analyst can drill into why the issuer
              // dropped out of the flow.
              arrows.push(
                <g key={s.stepId} onClick={() => onSelect(s)}
                  style={{ cursor: "pointer" }}>{arrowNode}</g>,
              );
              rowCursor += 1;
            }
          }
          return arrows;
        })()}
      </svg>
    </div>
  );
}

// Shared arrow renderer — same look for forward and self-loop legs.
function renderArrow(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  isSelected: boolean,
  topLabel: string,
  bottomLabel: string,
  dashed: boolean,
  hasTpdu: boolean = false,
): React.ReactNode {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  return (
    <>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={isSelected ? 3 : 2}
        markerEnd="url(#pix-arrow)"
        strokeDasharray={dashed ? "6 4" : undefined}
        style={{ color }}
      />
      <rect
        x={midX - 60}
        y={midY - 20}
        width={120}
        height={15}
        rx={2}
        fill="var(--bg-primary)"
      />
      <text
        x={midX}
        y={midY - 9}
        textAnchor="middle"
        fontSize={10}
        fontWeight={600}
        fill={color}
      >
        {topLabel}
      </text>
      <text
        x={midX}
        y={midY + 14}
        textAnchor="middle"
        fontSize={9}
        className="fill-text-tertiary"
      >
        {bottomLabel}
      </text>
      {hasTpdu && (
        // Sprint 9.4 — pill above the top label marks ISO 8583 hops
        // that carry the TPDU routing header (5-byte prefix).
        <>
          <rect
            x={midX - 20}
            y={midY - 34}
            width={40}
            height={12}
            rx={6}
            fill="var(--bg-input)"
            stroke={color}
            strokeWidth={0.5}
          />
          <text
            x={midX}
            y={midY - 25}
            textAnchor="middle"
            fontSize={8}
            fontWeight={600}
            fill={color}
          >
            TPDU
          </text>
        </>
      )}
    </>
  );
}

// Self-arrow guard — every flow today goes between distinct actors, but a
// future scenario might loop on the same actor; render a small loop
// instead of a zero-length line.
function renderSelfArrow(
  x: number,
  y: number,
  color: string,
  isSelected: boolean,
  label: string,
): React.ReactNode {
  return (
    <>
      <path
        d={`M${x},${y} h30 v20 h-30`}
        fill="none"
        stroke={color}
        strokeWidth={isSelected ? 3 : 2}
        markerEnd="url(#pix-arrow)"
        style={{ color }}
      />
      <text x={x + 35} y={y - 4} fontSize={10} fill={color}>
        {label}
      </text>
    </>
  );
}

// ---- Side panel ------------------------------------------------------------

function XmlPanel({
  step,
  alerts,
  hasOverride,
  onReplace,
  onClearOverride,
}: {
  step: PixFlowStep;
  alerts: { field: string; severity: string; expected: string | null; found: string | null }[];
  hasOverride: boolean;
  onReplace: () => void;
  onClearOverride: () => void;
}) {
  const { t } = useTranslation();
  const actorLabel = useActorLabel();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(step.xml);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard rejection (Safari without https) — leave silent.
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 w-full">
          <span className="text-sm font-semibold">
            {t("pix.flow.stepTitle", { id: step.stepId })}
          </span>
          <Badge tone="accent">{step.messageType}</Badge>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap text-xs text-text-tertiary">
          {hasOverride && <Badge tone="warning">{t("pix.flow.overrideBadge")}</Badge>}
          <span>
            {actorLabel(step.fromActor)}
            {step.viaActor ? ` → ${actorLabel(step.viaActor)}` : ""}
            {" "}→ {actorLabel(step.toActor)}
          </span>
        </div>
        <p className="text-xs text-text-secondary">{step.label}</p>
        {step.note && (
          // Sprint 9.4-revision — one-liner context (stand-in approval,
          // cash-dispensed reminder, advice-notification, …) surfaced
          // right under the label so the analyst sees it without having
          // to expand the raw wire.
          <p className="text-[11px] text-warning-text">💡 {step.note}</p>
        )}

        {alerts.length > 0 && (
          <div className="rounded-md border border-warning-text/40 bg-warning-bg/30 p-2 text-[10px] space-y-1">
            {alerts.map((a, i) => (
              <div key={i} className="text-warning-text">
                ⚠ {a.field}: esperado <code>{a.expected}</code>, encontrado <code>{a.found}</code>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleCopy}
            data-testid="pix-flow-copy-xml"
          >
            <Copy size={13} /> {copied ? t("common.copied") : t("common.copy")}
          </Button>
          <Button variant="secondary" onClick={onReplace} data-testid="pix-flow-replace">
            <Edit3 size={13} />{" "}
            {step.contentType === "iso8583"
              ? t("flow.iso8583.replaceMessage")
              : t("pix.flow.replace")}
          </Button>
          {hasOverride && (
            <Button variant="secondary" onClick={onClearOverride}>
              <X size={13} /> {t("pix.flow.clearOverride")}
            </Button>
          )}
        </div>

        <textarea
          value={step.xml}
          readOnly
          className="w-full h-[360px] p-2 rounded-md bg-bg-input border border-[var(--border)] font-mono text-[10px] resize-none focus:outline-none"
          data-testid="pix-flow-step-xml"
        />
      </CardBody>
    </Card>
  );
}

function ParsePanel({ step }: { step: PixFlowStep }) {
  const { t } = useTranslation();
  // Auto-parse the step's XML through the standard ISO 20022 parser so the
  // user gets the same MessageSummaryCard they see on /iso20022/parser
  // without leaving the flow diagram.
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setParsed(null);
    setParseError(null);
    setParsing(true);
    parseIso20022(step.xml)
      .then((r) => { if (!cancelled) setParsed(r); })
      .catch(() => { if (!cancelled) setParseError("Erro ao parsear XML"); })
      .finally(() => { if (!cancelled) setParsing(false); });
    return () => { cancelled = true; };
  }, [step.xml]);

  const isUnmapped = parsed?.summary.confidence === "unknown";

  return (
    <Card>
      <CardHeader>
        <span className="text-sm font-semibold">
          {t("pix.flow.parseTitle")}
        </span>
      </CardHeader>
      <CardBody>
        {parsing && (
          <div
            className="flex items-center gap-2 text-xs text-text-tertiary"
            role="status"
            aria-live="polite"
          >
            <Loader2 size={14} className="animate-spin" />
            {t("common.loading")}
          </div>
        )}
        {!parsing && parseError && <ErrorBanner message={parseError} />}
        {!parsing && parsed && isUnmapped && (
          <p className="text-xs text-text-tertiary italic">
            {t("pix.flow.unmapped")}
          </p>
        )}
        {!parsing && parsed && !isUnmapped && (
          <MessageSummaryCard
            messageType={parsed.messageType}
            summary={parsed.summary}
          />
        )}
      </CardBody>
    </Card>
  );
}

// ---- Override dialog -------------------------------------------------------

function OverrideDialog({
  step,
  initialXml,
  onCancel,
  onConfirm,
}: {
  step: PixFlowStep;
  initialXml: string;
  onCancel: () => void;
  onConfirm: (xml: string) => void;
}) {
  const { t } = useTranslation();
  const [xml, setXml] = useState(initialXml);
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-bg-primary border border-[var(--border)] rounded-md shadow-xl w-[min(800px,95vw)] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <span className="text-sm font-semibold">
            {t("pix.flow.overrideTitle", { id: step.stepId, type: step.messageType })}
          </span>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary"
          >
            <X size={14} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 space-y-2">
          <p className="text-xs text-text-tertiary">
            {t("pix.flow.overrideHint")}
          </p>
          <textarea
            value={xml}
            onChange={(e) => setXml(e.target.value)}
            className="w-full h-[420px] p-2 rounded-md bg-bg-input border border-[var(--border)] font-mono text-[10px] resize-none focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent"
            data-testid="pix-flow-override-xml"
          />
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>{t("common.cancel")}</Button>
          <Button
            onClick={() => onConfirm(xml)}
            disabled={!xml.trim()}
            data-testid="pix-flow-override-confirm"
          >
            {t("pix.flow.applyOverride")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatErr(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message ?? "Erro ao gerar fluxo");
  }
  return "Erro ao gerar fluxo";
}

// ---- Sprint 9.3 additions --------------------------------------------------

function ProtocolTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
        active
          ? "bg-accent text-white border-accent"
          : "bg-bg-input border-[var(--border)] text-text-secondary hover:bg-bg-tertiary"
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Panel that replaces ParsePanel for MT steps. The Parser ISO 20022 can't
 * ingest raw SWIFT MT blocks, so we route the user to the dedicated MT
 * Parser page via sessionStorage instead. Payload rendering happens in
 * XmlPanel — this side just owns the CTA.
 */
function MtActionsPanel({ step }: { step: PixFlowStep }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openInMtParser = () => {
    try {
      sessionStorage.setItem("swift-mt-parser:payload", step.xml);
    } catch { /* private mode / quota — silent */ }
    navigate("/swift/mt-parser");
  };
  return (
    <Card>
      <CardHeader>
        <span className="text-sm font-semibold">
          {t("flow.mt.actionsTitle")}
        </span>
      </CardHeader>
      <CardBody className="space-y-2 text-xs">
        <p className="text-text-tertiary">
          {t("flow.mt.parserHint")}
        </p>
        <Button variant="secondary" onClick={openInMtParser}>
          → {t("flow.mt.openInParser")}
        </Button>
      </CardBody>
    </Card>
  );
}

/**
 * Sprint 9.4 — right-hand panel for ISO 8583 steps. Quick summary of
 * the fields analysts care about (MTI, PAN masked, amount, STAN,
 * POS-entry-mode, terminal id) plus a jump to the dedicated ISO 8583
 * Parser. Raw wire is rendered on the left by XmlPanel; here we own
 * only the summary + the "Abrir no Parser ISO 8583" action.
 */
function Iso8583SummaryPanel({ step }: { step: PixFlowStep }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const summary = useMemo(() => summariseIso8583(step.xml), [step.xml]);
  const openInParser = () => {
    try {
      sessionStorage.setItem("iso8583-parser:payload", step.xml);
    } catch { /* private mode / quota — silent */ }
    navigate("/parser");
  };
  // Stand-in hop (0110 approved by the brand instead of the issuer) or
  // the advice-back leg (0120/0130) — both carry the Note from the
  // service. Surface an orange badge next to the MTI so the analyst
  // notices the atypical origin at a glance.
  const isStandIn = step.note?.toLowerCase().includes("stand-in") === true;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {t("flow.iso8583.summaryTitle")}
          </span>
          {isStandIn && (
            <Badge tone="warning" title={step.note ?? ""}>Stand-in</Badge>
          )}
          {step.isRelayWithTpdu && (
            <Badge tone="warning" title={t("flow.iso8583.tpduHint")}>TPDU</Badge>
          )}
        </div>
      </CardHeader>
      <CardBody className="space-y-2 text-xs">
        {step.isRelayWithTpdu && (
          <p className="text-warning-text">⚠ {t("flow.iso8583.tpduHint")}</p>
        )}
        <dl className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-0.5 font-mono">
          {summary.entries.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-text-tertiary">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <Button variant="secondary" onClick={openInParser}>
          → {t("flow.iso8583.openInParser")}
        </Button>
      </CardBody>
    </Card>
  );
}

/**
 * Sprint 9.4-revision — dedicated left-hand panel for the stand-in
 * "issuer timed out" hop. Explains why the diagram jumps straight from
 * the request into a stand-in-approved response without an issuer
 * message in between, so the analyst reading the flow for the first
 * time doesn't wonder if there's a missing step.
 */
function TimeoutExplainPanel({ step }: { step: PixFlowStep }) {
  const { t } = useTranslation();
  const actorLabel = useActorLabel();
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-warning-text">
            ⚠ {t("flow.iso8583.timeout.title")}
          </span>
        </div>
      </CardHeader>
      <CardBody className="space-y-2 text-xs">
        <p className="font-mono text-text-tertiary">
          {actorLabel(step.fromActor)} → {actorLabel(step.toActor)}
        </p>
        <p>{t("flow.iso8583.timeout.body1")}</p>
        <p>{t("flow.iso8583.timeout.body2")}</p>
        <p>{t("flow.iso8583.timeout.body3")}</p>
      </CardBody>
    </Card>
  );
}

function TimeoutSidePanel() {
  const { t } = useTranslation();
  return (
    <Card>
      <CardBody className="flex items-center justify-center h-full text-xs">
        <Badge tone="warning">⚡ {t("flow.iso8583.timeout.badge")}</Badge>
      </CardBody>
    </Card>
  );
}

/**
 * Quick-and-dirty ISO 8583 field extractor for the visualizer summary.
 * Skips an optional 10-hex-char TPDU header, reads the 4-char MTI +
 * primary bitmap, then walks the bits we care about (2, 3, 4, 7, 11,
 * 22, 41, 42). Not a full parser — that's what the dedicated
 * IsoParserService does — but it's enough to render a legible summary
 * without a round-trip to the backend for every step selection.
 */
function summariseIso8583(wire: string): { entries: [string, string][] } {
  const entries: [string, string][] = [];
  const trimmed = wire.trim();
  let offset = 0;
  const looksLikeTpdu =
    trimmed.length >= 14
    && /^[0-9A-Fa-f]{10}/.test(trimmed)
    && /^60/.test(trimmed);
  if (looksLikeTpdu) offset = 10;
  if (trimmed.length < offset + 4) return { entries };

  const mti = trimmed.substring(offset, offset + 4);
  entries.push(["MTI:", mti]);
  offset += 4;

  const bitmap = trimmed.substring(offset, offset + 16);
  if (bitmap.length < 16) return { entries };
  const bits = hexToBinary(bitmap);
  offset += 16;
  const secondaryPresent = bits[0] === "1";
  let secondaryBits = "";
  if (secondaryPresent) {
    secondaryBits = hexToBinary(trimmed.substring(offset, offset + 16));
    offset += 16;
  }

  // Bit-set walker with per-bit reader closures so we can just skip
  // bits we don't render (still moves `offset` forward correctly).
  const readers: Record<number, (raw: string) => string> = {
    2: fromLLVar((v) => maskPan(v)),
    3: fromFixed(6, (v) => `${v} (${processingCodeLabel(v)})`),
    4: fromFixed(12, (v) => formatCents(v)),
    7: fromFixed(10, (v) => `${v.substring(0, 4)} ${v.substring(4)}`),
    11: fromFixed(6, (v) => v),
    22: fromFixed(3, (v) => `${v} (${posEntryLabel(v)})`),
    37: fromFixed(12, (v) => v),
    41: fromFixed(8, (v) => v),
    42: fromFixed(15, (v) => v),
    49: fromFixed(3, (v) => v),
  };
  const displayBits = new Set([2, 3, 4, 7, 11, 22, 41, 42]);

  for (let bit = 1; bit <= 128; bit++) {
    const isSet =
      bit <= 64
        ? bits[bit - 1] === "1"
        : secondaryBits[bit - 65] === "1";
    if (!isSet) continue;
    if (bit === 1) continue; // presence-of-secondary flag, not a field

    const reader = readers[bit];
    if (reader === undefined) {
      // Unknown bit — stop parsing (we'd need the full layout to walk
      // past it safely). The rendered summary still has what mattered.
      break;
    }
    const consumed = readerLength(reader, trimmed, offset);
    if (offset + consumed > trimmed.length) break;
    const raw = trimmed.substring(offset, offset + consumed);
    offset += consumed;
    if (displayBits.has(bit)) {
      const value = reader(raw);
      entries.push([`Campo ${bit}:`, value]);
    }
  }
  return { entries };
}

function fromFixed(length: number, format: (raw: string) => string) {
  const fn = (raw: string) => format(raw);
  (fn as any).__length = length;
  return fn;
}
function fromLLVar(format: (raw: string) => string) {
  const fn = (raw: string) => format(raw.substring(2));
  (fn as any).__isLLVar = true;
  return fn;
}
function readerLength(fn: (raw: string) => string, wire: string, offset: number): number {
  const anyFn = fn as any;
  if (anyFn.__length !== undefined) return anyFn.__length;
  if (anyFn.__isLLVar) {
    const len = parseInt(wire.substring(offset, offset + 2), 10);
    return isNaN(len) ? 0 : 2 + len;
  }
  return 0;
}
function hexToBinary(hex: string): string {
  let bin = "";
  for (const ch of hex) {
    const n = parseInt(ch, 16);
    if (isNaN(n)) return bin;
    bin += n.toString(2).padStart(4, "0");
  }
  return bin;
}
function maskPan(pan: string): string {
  if (pan.length <= 10) return pan;
  return pan.substring(0, 6) + "*".repeat(pan.length - 10) + pan.substring(pan.length - 4);
}
function formatCents(raw: string): string {
  const digits = raw.replace(/^0+/, "") || "0";
  const cents = digits.padStart(3, "0");
  const int = cents.slice(0, -2);
  const dec = cents.slice(-2);
  const intGrouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${intGrouped},${dec}`;
}
function processingCodeLabel(pc: string): string {
  if (pc.startsWith("31")) return "Consulta de saldo";
  if (pc.startsWith("00")) return "Compra";
  if (pc.startsWith("20")) return "Devolução";
  return "Outro";
}
function posEntryLabel(mode: string): string {
  if (mode === "051") return "Chip EMV";
  if (mode === "021") return "Senha (teclado PIN)";
  if (mode === "022") return "Chip + PIN";
  if (mode === "011") return "Tarja magnética";
  if (mode === "901") return "NFC/Contactless";
  return "—";
}
