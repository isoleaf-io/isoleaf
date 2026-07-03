import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import {
  convertMtToMx,
  fetchAvailableVersions,
  fetchMtMapping,
  type MtMxConvertResult,
  type MtMxMappingRow,
  type MtMxMappingTable,
  type MxVersionInfo,
} from "@/api/swiftMtMx";

// Sprint 9.2 fix #3 — per-row lifecycle. Automatic/NoMapping rows start
// in their eponymous state; Ambiguous rows stay pending until the user
// hits "✓ Confirmar", flipping to "confirmed". If the user edits an
// Automatic row's MX path via the pencil icon it becomes "customized".
export type RowStatus = "automatic" | "ambiguous" | "confirmed" | "customized" | "noMapping";

export interface RowState {
  currentPath: string;
  status: RowStatus;
}

/**
 * Shared MT→MX mapping + convert widget. Rendered inline both by the
 * MT Parser page (as a follow-up to a successful parse) and — in the
 * future — by any other surface that needs to walk the user through
 * the mapping table + generate step.
 *
 * When <code>autoStart</code> is true the widget kicks off the mapping
 * fetch as soon as it mounts (or the raw message changes) — used by
 * the MT Parser where the user already clicked "→ Converter para MX"
 * on the parent screen and shouldn't have to hit a second CTA.
 */
export function MappingWorkflow({
  rawMessage,
  autoStart = false,
}: {
  rawMessage: string;
  autoStart?: boolean;
}) {
  const navigate = useNavigate();
  const [table, setTable] = useState<MtMxMappingTable | null>(null);
  const [rowStates, setRowStates] = useState<RowState[]>([]);
  const [result, setResult] = useState<MtMxConvertResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [availableVersions, setAvailableVersions] = useState<MxVersionInfo[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("");

  const startAnalysis = useCallback(async () => {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const t = await fetchMtMapping(rawMessage);
      setTable(t);
      setRowStates(t.rows.map((r) => ({
        currentPath: r.suggestedMxPath,
        status: initialStatus(r),
      })));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [rawMessage]);

  // Reset when the parent's raw message changes — a fresh parse should
  // wipe any half-built mapping state and avoid stale rows lingering.
  useEffect(() => {
    setTable(null);
    setRowStates([]);
    setResult(null);
    setError(null);
  }, [rawMessage]);

  // autoStart mode — kick the analysis the moment the widget mounts
  // (parent already committed the user to converting). Guard against
  // re-firing while a fetch is in flight or after it succeeded.
  useEffect(() => {
    if (!autoStart) return;
    if (table || loading || error) return;
    if (!rawMessage.trim()) return;
    void startAnalysis();
  }, [autoStart, rawMessage, table, loading, error, startAnalysis]);

  // Once the mapping table is up, ask the backend for the pacs.008 or
  // pacs.009 versions embedded and default to the newest. The family
  // prefix is the piece before ".001." — the backend then returns the
  // full "pacs.008.001.NN" list, most recent first.
  useEffect(() => {
    if (!table) return;
    const dot = table.targetMxType.indexOf(".001");
    const prefix = dot > 0 ? table.targetMxType.slice(0, dot) : table.targetMxType;
    void fetchAvailableVersions(prefix).then((v) => {
      setAvailableVersions(v);
      if (v.length > 0) setSelectedVersion(v[0].version);
    });
  }, [table]);

  const updateRow = useCallback((index: number, patch: Partial<RowState>) => {
    setRowStates((prev) => prev.map((rs, i) => (i === index ? { ...rs, ...patch } : rs)));
  }, []);

  const pendingCount = useMemo(
    () => rowStates.filter((rs) => rs.status === "ambiguous").length,
    [rowStates],
  );
  const canGenerate = !loading && !!table && pendingCount === 0;

  const handleGenerate = useCallback(async () => {
    if (!table) return;
    // Every row whose currentPath differs from the server's original
    // suggestion goes into UserOverrides so the backend re-routes the
    // value into the user-picked leaf.
    const overrides: Record<string, string> = {};
    rowStates.forEach((rs, i) => {
      const row = table.rows[i];
      if (rs.currentPath !== row.suggestedMxPath) {
        overrides[rs.currentPath] = row.suggestedMxValue ?? row.parsedValue ?? row.rawValue;
      }
    });
    setError(null);
    setLoading(true);
    try {
      setResult(await convertMtToMx(rawMessage, overrides, selectedVersion || null));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [rawMessage, rowStates, table, selectedVersion]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    try { await navigator.clipboard.writeText(result.xml); }
    catch { /* clipboard rejection — silent */ }
  }, [result]);

  const generateLabel = table
    ? `Gerar ${table.targetMxType.startsWith("pacs.009") ? "pacs.009" : "pacs.008"}`
    : "Gerar";

  return (
    <div className="space-y-4">
      {!table && !autoStart && (
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold">Converter para MX</span>
          </CardHeader>
          <CardBody className="space-y-2">
            <p className="text-xs text-text-tertiary">
              Analisa a mensagem MT já colada acima e gera a tabela de mapeamento
              para o pacs.008 ou pacs.009 equivalente.
            </p>
            <Button onClick={startAnalysis} disabled={loading || !rawMessage.trim()}>
              {loading ? "Analisando..." : "→ Converter para MX"}
            </Button>
            {error && <ErrorBanner message={error} />}
          </CardBody>
        </Card>
      )}
      {!table && autoStart && (loading || error) && (
        <Card>
          <CardBody>
            {loading && <span className="text-xs text-text-tertiary">Analisando mensagem MT…</span>}
            {error && <ErrorBanner message={error} />}
          </CardBody>
        </Card>
      )}

      {table && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">Confirme o mapeamento</span>
              <Badge tone="accent">{table.messageType}</Badge>
              <span className="text-xs text-text-tertiary">→</span>
              <Badge tone="neutral">{table.targetMxType}</Badge>
            </div>
          </CardHeader>
          <CardBody className="space-y-2">
            <MappingTableView
              rows={table.rows}
              states={rowStates}
              onUpdate={updateRow}
            />
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button onClick={handleGenerate} disabled={!canGenerate}>
                {loading ? "Gerando..." : `${generateLabel} →`}
              </Button>
              {availableVersions.length > 0 && (
                // Version selector — defaults to the newest embedded
                // XSD (first entry, backend sorts descending). Rendered
                // right after the Generate button so the user notices
                // it while the mapping table is still on screen.
                <label className="flex items-center gap-1 text-xs text-text-tertiary">
                  Versão:
                  <select
                    value={selectedVersion}
                    onChange={(e) => setSelectedVersion(e.target.value)}
                    className="px-1.5 py-0.5 rounded bg-bg-input border border-[var(--border)] font-mono text-[11px]"
                    data-testid="mt-mx-version-select"
                  >
                    {availableVersions.map((v) => (
                      <option key={v.messageType} value={v.version}>
                        {v.version}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {pendingCount > 0 && (
                <span className="text-xs text-warning-text">
                  ⚠ {pendingCount} campo{pendingCount === 1 ? "" : "s"} aguardando confirmação
                </span>
              )}
            </div>
            {error && <ErrorBanner message={error} />}
          </CardBody>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">XML MX gerado</span>
              <Badge tone="accent">{result.generatedMxType}</Badge>
            </div>
          </CardHeader>
          <CardBody className="space-y-2">
            <pre className="font-mono text-[11px] whitespace-pre-wrap bg-bg-input p-2 rounded max-h-96 overflow-auto">
              {result.xml}
            </pre>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleCopy}>Copiar XML</Button>
              <Button
                variant="ghost"
                onClick={() => navigate("/iso20022/parser", { state: { xml: result.xml } })}
              >
                Abrir no Parser
              </Button>
              {/* Sprint 9.2 fix — "Validar" removido: o próprio Parser
                  ISO 20022 dispara validação XSD ao carregar o XML,
                  então o botão dedicado ficava redundante. */}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function initialStatus(row: MtMxMappingRow): RowStatus {
  if (row.confidence === "automatic") return "automatic";
  if (row.confidence === "ambiguous") return "ambiguous";
  return "noMapping";
}

function MappingTableView({
  rows,
  states,
  onUpdate,
}: {
  rows: MtMxMappingRow[];
  states: RowState[];
  onUpdate: (index: number, patch: Partial<RowState>) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-left text-text-tertiary">
            <th className="py-1 pr-2">Tag</th>
            <th className="py-1 pr-2">Subcampo</th>
            <th className="py-1 pr-2">Valor MT</th>
            <th className="py-1 pr-2">Campo MX</th>
            <th className="py-1">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <MappingRowView
              key={i}
              row={row}
              state={states[i] ?? { currentPath: row.suggestedMxPath, status: initialStatus(row) }}
              onUpdate={(patch) => onUpdate(i, patch)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Sentinel returned by <PathSelect> when the user picks
// "Outro (digitar manualmente)…". Any real MX path is a slash-
// separated identifier, so this token can't collide with a legitimate
// value; the row switches to a text-input editor when it observes this.
const OTHER_SENTINEL = "__other__";

function MappingRowView({
  row,
  state,
  onUpdate,
}: {
  row: MtMxMappingRow;
  state: RowState;
  onUpdate: (patch: Partial<RowState>) => void;
}) {
  // Free-text mode — user chose "Outro…" from the dropdown. We remember
  // the value that was selected right before entering manual mode so
  // "✕ cancelar" can restore it without touching the row status.
  const [manualMode, setManualMode] = useState(false);
  const [pathBeforeManual, setPathBeforeManual] = useState<string | null>(null);

  const rowBg = state.status === "ambiguous" ? "bg-yellow-500/10" : "";
  // Always include the original suggestion in the pool so the user
  // can navigate back to it via the dropdown too (independent of the
  // dedicated "↺" undo button).
  const options = useMemo(() => {
    const base = row.mxAlternatives.length > 0 ? [...row.mxAlternatives] : [];
    if (!base.includes(row.suggestedMxPath)) base.unshift(row.suggestedMxPath);
    if (!base.includes(state.currentPath) && state.currentPath) base.push(state.currentPath);
    return base;
  }, [row.mxAlternatives, row.suggestedMxPath, state.currentPath]);

  const enterManualMode = () => {
    setPathBeforeManual(state.currentPath);
    setManualMode(true);
  };
  const cancelManualMode = () => {
    // Restore the pre-manual value without altering the status —
    // ambiguous stays ambiguous, customized stays customized.
    if (pathBeforeManual !== null) {
      onUpdate({ currentPath: pathBeforeManual });
    }
    setManualMode(false);
    setPathBeforeManual(null);
  };
  const resetToSuggested = () => {
    onUpdate({
      currentPath: row.suggestedMxPath,
      status: row.confidence === "ambiguous" ? "ambiguous" : "automatic",
    });
    setManualMode(false);
    setPathBeforeManual(null);
  };

  return (
    <tr className={`border-t border-[var(--border)] ${rowBg}`}>
      <td className="py-1 pr-2 font-mono">{row.tag}</td>
      <td className="py-1 pr-2">{row.subId ?? "—"}</td>
      <td className="py-1 pr-2 font-mono">
        {row.parsedValue ?? row.rawValue}
      </td>
      <td className="py-1 pr-2">
        {renderMxCell(
          row, state, options, manualMode, enterManualMode,
          cancelManualMode, resetToSuggested, onUpdate)}
      </td>
      <td className="py-1">
        <RowStatusPill state={state} row={row} onUpdate={onUpdate} />
      </td>
    </tr>
  );
}

function renderMxCell(
  row: MtMxMappingRow,
  state: RowState,
  options: string[],
  manualMode: boolean,
  onEnterManual: () => void,
  onCancelManual: () => void,
  onResetToSuggested: () => void,
  onUpdate: (patch: Partial<RowState>) => void,
) {
  if (row.confidence === "noMapping") {
    return <span className="text-text-tertiary">—</span>;
  }

  // Free-text override — replaces the dropdown entirely. Applies to
  // both ambiguous rows (before confirmation) and customized rows.
  if (manualMode) {
    return (
      <div className="flex items-center gap-2">
        <input
          value={state.currentPath}
          onChange={(e) => onUpdate({
            currentPath: e.target.value,
            status: e.target.value === row.suggestedMxPath
              ? (row.confidence === "ambiguous" ? "ambiguous" : "automatic")
              : "customized",
          })}
          placeholder="Ex: Dbtr/Id/PrvtId/Othr/Id"
          className="px-1.5 py-0.5 rounded bg-bg-input border border-[var(--border)] font-mono text-[11px] w-64"
          autoFocus
        />
        <button
          onClick={onCancelManual}
          className="text-text-tertiary hover:text-text-primary text-[11px]"
          title="Cancelar — voltar ao dropdown com o valor anterior"
        >
          ✕
        </button>
        <button
          onClick={onResetToSuggested}
          className="text-text-tertiary hover:text-text-primary text-[11px]"
          title="Desfazer — voltar à sugestão original"
        >
          ↺
        </button>
      </div>
    );
  }

  // Ambiguous rows keep the dropdown + confirm button while pending.
  if (row.confidence === "ambiguous" && state.status !== "confirmed") {
    return (
      <div className="flex items-center gap-2">
        <PathSelect
          value={state.currentPath}
          options={options}
          onChange={(v) => onUpdate({ currentPath: v })}
          onOtherRequested={onEnterManual}
        />
        <button
          onClick={() => onUpdate({ status: "confirmed" })}
          className="px-2 py-0.5 rounded bg-accent text-white text-[10px] hover:opacity-90"
          title="Confirmar escolha"
        >
          ✓ Confirmar
        </button>
      </div>
    );
  }

  // Customised automatic row — dropdown stays visible, plus an "undo"
  // button that snaps back to the original suggestion.
  if (state.status === "customized") {
    return (
      <div className="flex items-center gap-2">
        <PathSelect
          value={state.currentPath}
          options={options}
          onChange={(v) => onUpdate({
            currentPath: v,
            status: v === row.suggestedMxPath ? "automatic" : "customized",
          })}
          onOtherRequested={onEnterManual}
        />
        <button
          onClick={onResetToSuggested}
          className="text-text-tertiary hover:text-text-primary text-[11px]"
          title="Desfazer — voltar ao mapeamento automático"
        >
          ↺
        </button>
      </div>
    );
  }

  // Automatic + resting — MX path in plain text, no editing affordance.
  return (
    <span className="font-mono text-text-secondary">{state.currentPath}</span>
  );
}

function PathSelect({
  value,
  options,
  onChange,
  onOtherRequested,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  onOtherRequested?: () => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === OTHER_SENTINEL) {
          onOtherRequested?.();
          return;
        }
        onChange(e.target.value);
      }}
      className="px-1.5 py-0.5 rounded bg-bg-input border border-[var(--border)] font-mono text-[11px]"
    >
      {options.map((alt) => (
        <option key={alt} value={alt}>{alt}</option>
      ))}
      {onOtherRequested && (
        <option value={OTHER_SENTINEL}>Outro (digitar manualmente)…</option>
      )}
    </select>
  );
}

function RowStatusPill({
  state,
  row,
  onUpdate,
}: {
  state: RowState;
  row: MtMxMappingRow;
  onUpdate?: (patch: Partial<RowState>) => void;
}) {
  if (state.status === "confirmed") {
    return (
      <span className="inline-flex items-center gap-2">
        <span title="Confirmado pelo usuário" className="text-green-500">
          ✓ Confirmado
        </span>
        {onUpdate && (
          // Snapping back to "ambiguous" keeps the currentPath the user
          // had at confirmation time — the dropdown re-opens right where
          // they were, so they can flip to another option or re-confirm
          // without starting over.
          <button
            onClick={() => onUpdate({ status: "ambiguous" })}
            className="text-text-tertiary hover:text-text-primary text-[10px]"
            title="Reeditar — reabrir o dropdown com o valor atual"
          >
            ✎ Reeditar
          </button>
        )}
      </span>
    );
  }
  if (state.status === "customized") {
    return <span title="Alterado pelo usuário" className="text-blue-500">✏️ Customizado</span>;
  }
  if (state.status === "ambiguous") {
    return <span title="Aguardando confirmação" className="text-yellow-500">⚠️ Ambíguo</span>;
  }
  if (row.confidence === "noMapping") {
    return <span title="Sem MX" className="text-text-tertiary">—</span>;
  }
  return <span title="Mapeamento automático" className="text-green-500">✅</span>;
}
