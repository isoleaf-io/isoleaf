import { useCallback, useEffect, useMemo, useState } from "react";
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

// Canonical SPI arrangement — columns render in this order regardless of
// flow type; absent actors are filtered out for shorter flows.
const ACTOR_ORDER: string[] = [
  "Pagador",
  "PSP Pagador",
  "SPI/BCB",
  "PSP Recebedor",
  "Recebedor",
];

// Pinned set — matches the FlowDefinition keys in PixFlowService. Kept
// inline so we don't gate the page rendering on a /types round-trip.
const FLOW_TYPES = [
  { id: "pix-transfer",             labelKey: "pix.flow.types.transfer" },
  { id: "pix-transfer-with-return", labelKey: "pix.flow.types.transferReturn" },
  { id: "pix-open-finance",         labelKey: "pix.flow.types.openFinance" },
  { id: "pix-rejected",             labelKey: "pix.flow.types.rejected" },
] as const;

// Distinct hues per ISO 20022 family so the diagram reads as colour-coded
// at a glance (pacs blue, pain green, camt orange).
function familyColor(messageType: string): string {
  if (messageType.startsWith("pacs.")) return "#3b82f6";
  if (messageType.startsWith("pain.")) return "#22c55e";
  if (messageType.startsWith("camt.")) return "#f97316";
  return "#94a3b8";
}

export default function PixFlowVisualizerPage() {
  const { t } = useTranslation();
  const [flowType, setFlowType] = useState<string>(FLOW_TYPES[0].id);
  const [result, setResult] = useState<PixFlowResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [overrideTarget, setOverrideTarget] = useState<PixFlowStep | null>(null);

  const generate = useCallback(
    async (nextOverrides: Record<number, string>) => {
      setLoading(true);
      setError(null);
      try {
        const r = await generatePixFlow(
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
    [flowType, selectedStepId],
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
    <AppShell title={t("pix.flow.title")} subtitle={t("pix.flow.subtitle")}>
      <div className="space-y-4">
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
                  data-testid="pix-flow-type"
                  className="bg-bg-input border border-[var(--border)] rounded-md px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                >
                  {FLOW_TYPES.map((ft) => (
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
                selectedStepId={selectedStepId}
                onSelect={(s) => setSelectedStepId(s.stepId)}
              />
            </CardBody>
          </Card>
        )}

        {/* Row 2 — XML + parse summary 50/50. `key` forces a remount on
            step switch so the fade-in animation replays without scroll. */}
        {result && selectedStep && (
          <div
            key={selectedStep.stepId}
            className="pix-flow-fade-in grid grid-cols-1 lg:grid-cols-2 gap-4"
          >
            <XmlPanel
              step={selectedStep}
              alerts={stepAlerts}
              hasOverride={overrides[selectedStep.stepId] != null}
              onReplace={() => setOverrideTarget(selectedStep)}
              onClearOverride={() => handleOverrideClear(selectedStep.stepId)}
            />
            <ParsePanel step={selectedStep} />
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
  selectedStepId,
  onSelect,
}: {
  steps: PixFlowStep[];
  selectedStepId: number | null;
  onSelect: (s: PixFlowStep) => void;
}) {
  // Pinned column order from ACTOR_ORDER — keeps the SPI layout (Pagador
  // on the left, Recebedor on the right) even when a given flow omits
  // some intermediate actor. ViaActor is also considered so interbank
  // hops show up even if no step has SPI as a direct endpoint.
  const actors = useMemo(() => {
    const present = new Set<string>();
    for (const s of steps) {
      present.add(s.fromActor);
      present.add(s.toActor);
      if (s.viaActor) present.add(s.viaActor);
    }
    return ACTOR_ORDER.filter((a) => present.has(a));
  }, [steps]);

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
    <div className="flex justify-center overflow-x-auto">
      <svg width={width} height={height} className="block">
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
              {actor}
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
            const color = familyColor(s.messageType);
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
              arrows.push(
                <g key={s.stepId} onClick={() => onSelect(s)} style={{ cursor: "pointer" }}>
                  {x1 === x2
                    ? renderSelfArrow(x1, baseY, color, isSelected, s.messageType)
                    : renderArrow(x1, baseY, x2, baseY,
                        color, isSelected, s.messageType, s.label, false)}
                </g>,
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
            {step.fromActor}
            {step.viaActor ? ` → ${step.viaActor}` : ""}
            {" "}→ {step.toActor}
          </span>
        </div>
        <p className="text-xs text-text-secondary">{step.label}</p>

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
            <Edit3 size={13} /> {t("pix.flow.replace")}
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
