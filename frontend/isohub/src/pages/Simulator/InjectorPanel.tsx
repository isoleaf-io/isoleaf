import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Play, RotateCcw, Send, Square } from "lucide-react";
import clsx from "clsx";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Toggle } from "@/components/ui/Field";
import { MonoText } from "@/components/ui/MonoText";
import { Badge } from "@/components/ui/Badge";
import { HelpButton } from "@/components/ui/HelpButton";
import { injectDirect, type InjectDirectResponse } from "@/api/simulator";

interface InjectorResponse {
  id: string;
  timestamp: string;
  mti?: string | null;
  responseCode?: string | null;
  processingMs: number;
  success: boolean;
  error?: string | null;
  rawHex?: string | null;
  fields?: { bitNumber: number; name: string; value: string }[];
  /** What actually went out on the wire (post-variation). Helps debugging when
   *  the autorizador echoes everything and the user can't tell whether the STAN
   *  refresh actually fired. */
  requestMti?: string | null;
  requestHex?: string | null;
  requestFields?: { bitNumber: number; name: string; value: string }[];
}

interface PersistedState {
  targetHost: string;
  targetPort: number;
  message: string;
  includeTpdu: boolean;
  /** Duration in whole seconds. 0 = run until the user clicks Stop. */
  durationSeconds: number;
  /** Refresh STAN/RRN/timestamps each iteration. Default on — safer for continuous loads. */
  varyIdentifiers: boolean;
  /** Randomise Bit 4 within [amountMinReais, amountMaxReais]. Default off. */
  varyAmount: boolean;
  /** Amounts are expressed to the user in BRL; backend converts to cents. */
  amountMinReais: number;
  amountMaxReais: number;
  /**
   * Prepend a 2-byte big-endian length prefix (encoded as 4 ASCII hex chars)
   * to the message before injection. Off by default; toggled by the user.
   */
  includeLengthPrefix: boolean;
}

const STORAGE_KEY = "isoleaf-injector";
const DEFAULTS: PersistedState = {
  targetHost: "localhost",
  targetPort: 8583,
  message: "",
  includeTpdu: false,
  durationSeconds: 0,
  varyIdentifiers: true,
  varyAmount: false,
  amountMinReais: 1,
  amountMaxReais: 500,
  includeLengthPrefix: false,
};

/**
 * Encodes the message char count as a 4-hex-char big-endian uint16. Clamped
 * to 0xFFFF — any practical ISO 8583 frame fits well below that.
 */
function lengthPrefixHex(charCount: number): string {
  const v = Math.min(charCount, 0xffff);
  return v.toString(16).toUpperCase().padStart(4, "0");
}

function loadPersisted(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const MAX_RESPONSES = 100;

export function InjectorPanel() {
  const { t } = useTranslation();

  const [persisted, setPersisted] = useState<PersistedState>(loadPersisted);
  const setPersistedField = <K extends keyof PersistedState>(k: K, v: PersistedState[K]) => {
    setPersisted((s) => {
      const next = { ...s, [k]: v };
      // Best-effort persist; localStorage can throw in private mode etc.
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const [responses, setResponses] = useState<InjectorResponse[]>([]);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const intervalRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const durationLimitRef = useRef<number | null>(null);

  const stats = (() => {
    const success = responses.filter((r) => r.success).length;
    const failure = responses.length - success;
    const avgMs = responses.length > 0
      ? Math.round(responses.reduce((sum, r) => sum + r.processingMs, 0) / responses.length)
      : 0;
    return { success, failure, avgMs };
  })();

  const successPercent = responses.length === 0
    ? 0
    : Math.round((stats.success / responses.length) * 100);

  /**
   * Full panel reset: stops the continuous loop, blanks every persisted field
   * back to its default, and wipes the response log + stats. Intentionally
   * destructive — the user clicks "Limpar" to start over.
   */
  const clearAll = () => {
    // Stop the timer first so a final injectOne doesn't race the localStorage write.
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    startedAtRef.current = null;
    durationLimitRef.current = null;
    setRunning(false);
    setElapsedSeconds(0);
    setResponses([]);
    setExpanded({});
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULTS)); } catch { /* ignore */ }
    setPersisted(DEFAULTS);
  };

  const stopContinuous = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    startedAtRef.current = null;
    durationLimitRef.current = null;
    setRunning(false);
  };

  // Clean up timers on unmount so navigating away doesn't leave a zombie loop.
  useEffect(() => () => stopContinuous(), []);

  // Validation for the "vary amount" mini-form. Both values must be positive numbers
  // and min < max. When invalid, the inject button stays enabled — backend clamps
  // the values, so the user still gets a valid (capped) range rather than an error.
  const amountInvalid =
    persisted.varyAmount &&
    (persisted.amountMinReais <= 0 ||
      persisted.amountMaxReais <= 0 ||
      persisted.amountMinReais >= persisted.amountMaxReais);

  /**
   * Sends one message. When `applyVariations` is true (continuous mode),
   * passes the configured flags to the backend so STAN/timestamps/amount get
   * refreshed per send. When false (single-shot "Injetar →" button) the
   * message goes exactly as typed — no STAN bump, no amount randomisation.
   */
  const injectOne = async (applyVariations: boolean) => {
    if (!persisted.message.trim()) return;
    setBusy(true);
    const startedAt = performance.now();
    // Prepend the 4-hex-char length prefix when enabled. Length counts the
    // chars in the trimmed message (matches what the backend forwards on
    // the wire). The prefix itself is NOT counted — same convention used
    // by the Builder preview.
    const trimmed = persisted.message.trim();
    const wireMessage = persisted.includeLengthPrefix
      ? `${lengthPrefixHex(trimmed.length)}${trimmed}`
      : trimmed;
    try {
      const res: InjectDirectResponse = await injectDirect({
        targetHost: persisted.targetHost,
        targetPort: persisted.targetPort,
        message: wireMessage,
        includeTpdu: persisted.includeTpdu,
        // Variations are continuous-mode only — the unit-mode button must always
        // forward the message verbatim so power users can test exact payloads.
        varyIdentifiers: applyVariations && persisted.varyIdentifiers,
        varyAmount: applyVariations && persisted.varyAmount,
        // BRL reais → cents. Only relevant when varyAmount is true.
        amountMin: Math.round(persisted.amountMinReais * 100),
        amountMax: Math.round(persisted.amountMaxReais * 100),
      });
      const entry: InjectorResponse = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        mti: res.mti,
        responseCode: res.responseCode,
        processingMs: res.processingMs ?? Math.round(performance.now() - startedAt),
        success: res.success && !res.error,
        error: res.error,
        rawHex: res.responseHex,
        fields: res.fields,
        requestMti: res.requestMti,
        requestHex: res.requestHex,
        requestFields: res.requestFields,
      };
      setResponses((prev) => [entry, ...prev].slice(0, MAX_RESPONSES));
    } catch (err) {
      const entry: InjectorResponse = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        processingMs: Math.round(performance.now() - startedAt),
        success: false,
        error: (err as Error)?.message ?? "Unknown error",
      };
      setResponses((prev) => [entry, ...prev].slice(0, MAX_RESPONSES));
    } finally {
      setBusy(false);
    }
  };

  const startContinuous = () => {
    if (running) return;
    if (!persisted.message.trim()) return;
    // 0 (or empty) means "no limit — runs until the user clicks Stop".
    const durationSec = persisted.durationSeconds > 0 ? persisted.durationSeconds : null;
    durationLimitRef.current = durationSec;
    startedAtRef.current = Date.now();
    setElapsedSeconds(0);
    setRunning(true);

    // Fire once immediately, then on a fixed 1s interval — load is intentionally
    // low; this isn't a benchmarking tool. `true` enables per-send variations
    // (STAN/timestamps/amount) — these only fire from the continuous loop.
    void injectOne(true);
    intervalRef.current = window.setInterval(() => {
      void injectOne(true);
    }, 1000);

    // Separate tick keeps the elapsed counter alive even when the injection
    // takes longer than 1s (the interval would otherwise skip a beat).
    tickRef.current = window.setInterval(() => {
      const started = startedAtRef.current;
      if (started === null) return;
      const seconds = Math.floor((Date.now() - started) / 1000);
      setElapsedSeconds(seconds);
      const limit = durationLimitRef.current;
      if (limit !== null && seconds >= limit) stopContinuous();
    }, 1000);
  };

  const toggleExpand = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const durationTotalSec = persisted.durationSeconds > 0 ? persisted.durationSeconds : null;
  const messageEmpty = !persisted.message.trim();

  return (
    <Card>
      <CardHeader>
        <div>
          <div className="text-sm font-semibold">{t("simulator.injector.title")}</div>
          <div className="text-xs text-text-tertiary mt-0.5">
            {t("simulator.injector.subtitle")}
          </div>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        {/* Conexão */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-3 items-end">
          <div>
            <Label>{t("simulator.injector.targetHost")}</Label>
            <Input
              value={persisted.targetHost}
              onChange={(e) => setPersistedField("targetHost", e.target.value)}
              placeholder="localhost"
            />
          </div>
          <div>
            <Label>{t("simulator.injector.targetPort")}</Label>
            <Input
              type="number"
              value={persisted.targetPort}
              onChange={(e) => setPersistedField("targetPort", Number(e.target.value))}
            />
          </div>
          <div className="pb-1 flex flex-col gap-1.5">
            <Toggle
              checked={persisted.includeTpdu}
              onChange={(v) => setPersistedField("includeTpdu", v)}
              label={t("simulator.injector.includeTpdu")}
            />
            <Toggle
              checked={persisted.includeLengthPrefix}
              onChange={(v) => setPersistedField("includeLengthPrefix", v)}
              label={t("simulator.includeLengthPrefix")}
            />
          </div>
        </div>

        {persisted.includeLengthPrefix && persisted.message.trim().length > 0 && (
          <div className="text-xs text-text-tertiary -mt-1" data-testid="injector-length-preview">
            {t("simulator.includeLengthPrefixHint")}{" "}
            <span className="font-mono text-accent">
              [{lengthPrefixHex(persisted.message.trim().length)}]
            </span>{" "}
            {persisted.message.trim().slice(0, 40)}
            {persisted.message.trim().length > 40 ? "…" : ""}
          </div>
        )}

        {/* Mensagem */}
        <div>
          <Label>{t("simulator.injector.message")}</Label>
          <textarea
            value={persisted.message}
            onChange={(e) => setPersistedField("message", e.target.value)}
            placeholder="0200F23C..."
            className="w-full min-h-[100px] p-3 rounded-md bg-bg-input border border-[var(--border)] font-mono text-[12px] resize-y focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            spellCheck={false}
          />
        </div>

        {/* Ação unitária — envia exatamente o que está no textarea, sem variações. */}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => injectOne(false)} disabled={messageEmpty || busy || running}>
            <Send size={13} /> {t("simulator.injector.inject")} →
          </Button>
          <Button variant="secondary" onClick={clearAll}>
            <RotateCcw size={13} /> {t("common.clear")}
          </Button>
        </div>

        {/* ── Continuous mode ─────────────────────────────────────────────
            Flags + duration live here, never near the single-shot button, so
            they only affect repeated sends. STAN/timestamps would be useless
            (or even misleading) for one-off "send exactly this bytes" tests. */}
        <div className="rounded-md border border-[var(--border)] p-3 bg-bg-secondary/40 space-y-3">
          <div className="text-sm font-semibold">
            {t("simulator.injector.continuousMode")}
          </div>

          {/* Vary flags */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={persisted.varyIdentifiers}
                  onChange={(e) => setPersistedField("varyIdentifiers", e.target.checked)}
                  className="rounded border-[var(--border)]"
                />
                {t("simulator.injector.varyIdentifiers")}
              </label>
              <HelpButton
                title={t("simulator.injector.varyIdentifiersHelpTitle")}
                content={t("simulator.injector.varyIdentifiersHelpBody")}
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={persisted.varyAmount}
                  onChange={(e) => setPersistedField("varyAmount", e.target.checked)}
                  className="rounded border-[var(--border)]"
                />
                {t("simulator.injector.varyAmount")}
              </label>
              <HelpButton
                title={t("simulator.injector.varyAmountHelpTitle")}
                content={t("simulator.injector.varyAmountHelpBody")}
              />
            </div>

            {persisted.varyAmount && (
              <div className="grid grid-cols-2 gap-3 pl-6 pt-1">
                <div>
                  <Label>{t("simulator.injector.amountMin")}</Label>
                  <Input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={persisted.amountMinReais}
                    onChange={(e) => setPersistedField("amountMinReais", Number(e.target.value))}
                    className={clsx("font-mono", amountInvalid && "border-danger focus:ring-danger/30")}
                  />
                </div>
                <div>
                  <Label>{t("simulator.injector.amountMax")}</Label>
                  <Input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={persisted.amountMaxReais}
                    onChange={(e) => setPersistedField("amountMaxReais", Number(e.target.value))}
                    className={clsx("font-mono", amountInvalid && "border-danger focus:ring-danger/30")}
                  />
                </div>
                {amountInvalid && (
                  <div className="col-span-2 text-[11px] text-danger-text">
                    {t("simulator.injector.amountRangeInvalid")}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Duration + start/stop. The duration input has a Label above and a hint
              below; the start/stop button is a single-row control. To keep them on
              the same visual baseline we (a) pull the duration hint out of the input
              container and render it below the row, and (b) wrap the button with a
              hidden Label so it inherits the same top-spacing as the labelled input. */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col">
              <Label className="mb-0">{t("simulator.injector.duration")}</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={persisted.durationSeconds}
                onChange={(e) =>
                  setPersistedField(
                    "durationSeconds",
                    Math.max(0, Math.floor(Number(e.target.value) || 0))
                  )
                }
                placeholder="0"
                className="w-24 font-mono"
              />
            </div>

            <div className="flex flex-col">
              <Label className="mb-0 opacity-0 select-none" aria-hidden="true">·</Label>
              {running ? (
                <Button variant="danger" onClick={stopContinuous}>
                  <Square size={13} /> {t("simulator.injector.stop")}
                </Button>
              ) : (
                <Button variant="secondary" onClick={startContinuous} disabled={messageEmpty}>
                  <Play size={13} /> {t("simulator.injector.startContinuous")}
                </Button>
              )}
            </div>

            {running && durationTotalSec !== null && (
              <span className="text-xs font-mono text-text-tertiary self-center">
                {t("simulator.injector.runningOf", {
                  elapsed: formatDuration(elapsedSeconds),
                  total: formatDuration(durationTotalSec),
                })}
              </span>
            )}
            {running && durationTotalSec === null && (
              <span className="text-xs font-mono text-text-tertiary self-center">
                {t("simulator.injector.running", { time: formatDuration(elapsedSeconds) })}
              </span>
            )}
          </div>

          {/* Duration hint lives below the row so it doesn't push the start button
              out of vertical alignment with the input. */}
          <div className="text-[11px] text-text-tertiary">
            {t("simulator.injector.durationHint")}
          </div>
        </div>

        {/* Contador acumulativo */}
        {responses.length > 0 && (
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="text-success-text font-medium">
              ✅ {stats.success} {t("simulator.injector.success")}
            </span>
            <span className="text-danger-text font-medium">
              ❌ {stats.failure} {t("simulator.injector.failure")}
            </span>
            <span className="text-text-secondary font-medium">
              ⏱ {stats.avgMs}{t("simulator.injector.avgMs")}
            </span>
            <div className="flex items-center gap-2 flex-1 max-w-[200px]">
              <div className="flex-1 h-1.5 rounded bg-bg-tertiary overflow-hidden">
                <div
                  className="h-full bg-success transition-all"
                  style={{ width: `${successPercent}%` }}
                />
              </div>
              <span className="text-text-tertiary font-mono w-10 text-right">{successPercent}%</span>
            </div>
          </div>
        )}

        {/* Lista de respostas */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-text-secondary">
              {t("simulator.injector.responses")} ({responses.length})
            </span>
          </div>
          <div className="rounded-md border border-[var(--border)] max-h-[260px] overflow-y-auto divide-y divide-[var(--border)] bg-bg-input">
            {responses.length === 0 ? (
              <div className="text-xs text-text-tertiary text-center py-6">
                {t("simulator.injector.noResponses")}
              </div>
            ) : (
              responses.map((r) => {
                const ts = new Date(r.timestamp).toLocaleTimeString("en-US", { hour12: false });
                const isOpen = !!expanded[r.id];
                return (
                  <div key={r.id} className="px-3 py-1.5 text-xs">
                    <button
                      onClick={() => toggleExpand(r.id)}
                      className="w-full flex items-center gap-2 text-left"
                    >
                      {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      <span className="font-mono text-text-tertiary w-20">{ts}</span>
                      <span>↓</span>
                      {r.mti && <Badge tone="accent" className="font-mono text-[10px]">{r.mti}</Badge>}
                      {r.responseCode && (
                        <span className="font-mono text-text-secondary">
                          RC={r.responseCode}
                        </span>
                      )}
                      <span className="font-mono text-text-tertiary">{r.processingMs}ms</span>
                      <span className={clsx("ml-auto", r.success ? "text-success-text" : "text-danger-text")}>
                        {r.success ? "✅" : "❌"}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="mt-1 ml-5 space-y-2">
                        {r.error && <div className="text-danger-text">{r.error}</div>}

                        {/* What we sent — proves whether variations actually applied. */}
                        {(r.requestHex || (r.requestFields && r.requestFields.length > 0)) && (
                          <div className="space-y-0.5 pb-1 border-b border-[var(--border)]">
                            <div className="text-text-tertiary text-[10px] uppercase tracking-wider">
                              {t("simulator.injector.requestSent")}
                            </div>
                            {r.requestMti && (
                              <div className="text-[11px] text-text-secondary">
                                MTI: <MonoText className="text-text-mono">{r.requestMti}</MonoText>
                              </div>
                            )}
                            {r.requestHex && (
                              <MonoText className="break-all text-[10px] text-text-tertiary">{r.requestHex}</MonoText>
                            )}
                            {r.requestFields && r.requestFields.length > 0 && (
                              <div className="space-y-0.5 mt-1">
                                {r.requestFields.map((f) => (
                                  <div key={`req-${f.bitNumber}`} className="flex gap-2">
                                    <span className="text-text-tertiary w-6">{f.bitNumber}</span>
                                    <span className="text-text-secondary flex-1">{f.name}</span>
                                    <MonoText className="flex-1 truncate">{f.value}</MonoText>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Reply from the remote system. */}
                        <div className="space-y-0.5">
                          <div className="text-text-tertiary text-[10px] uppercase tracking-wider">
                            {t("simulator.injector.responseReceived")}
                          </div>
                          {r.rawHex && (
                            <MonoText className="break-all text-[10px] text-text-tertiary">{r.rawHex}</MonoText>
                          )}
                          {r.fields && r.fields.length > 0 && (
                            <div className="space-y-0.5 mt-1">
                              {r.fields.map((f) => (
                                <div key={f.bitNumber} className="flex gap-2">
                                  <span className="text-text-tertiary w-6">{f.bitNumber}</span>
                                  <span className="text-text-secondary flex-1">{f.name}</span>
                                  <MonoText className="flex-1 truncate">{f.value}</MonoText>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
