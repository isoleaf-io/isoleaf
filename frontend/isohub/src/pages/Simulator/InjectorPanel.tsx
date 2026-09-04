import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Eraser, Play, RotateCcw, Send, Square } from "lucide-react";
import clsx from "clsx";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Toggle } from "@/components/ui/Field";
import { MonoText } from "@/components/ui/MonoText";
import { Badge } from "@/components/ui/Badge";
import { HelpButton } from "@/components/ui/HelpButton";
import { injectDirect, type InjectDirectResponse } from "@/api/simulator";
import { useInjectorStore, isValidTpduOverride, type InjectorState } from "@/store/injector";
import type { MessageLogEntry, SimulatorSession } from "@/types";

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

// PersistedState + STORAGE_KEY + DEFAULTS were lifted into `@/store/injector`
// — the SessionRow component subscribes to the same store for reactive
// compatibility-border updates without prop-drilling.

/**
 * Encodes the message char count as a 4-hex-char big-endian uint16. Clamped
 * to 0xFFFF — any practical ISO 8583 frame fits well below that.
 */
function lengthPrefixHex(charCount: number): string {
  const v = Math.min(charCount, 0xffff);
  return v.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * True when the string is a non-empty even-length sequence of hex digits.
 * Mirrors `IsoWireHelper.IsBinaryHex` on the backend so both sides agree on
 * what "binary-hex" means when sizing the length prefix.
 */
function isHex(s: string): boolean {
  return s.length > 0 && s.length % 2 === 0 && /^[0-9A-Fa-f]+$/.test(s);
}

/**
 * Returns the wire byte count that the length prefix should declare.
 * Binary-hex wire: 2 hex chars per wire byte → length/2.
 * ASCII wire: every char goes on the wire as itself → length.
 */
function calculateWireCharCount(wire: string): number {
  if (!wire) return 0;
  return isHex(wire) ? wire.length / 2 : wire.length;
}

/**
 * Mirrors `IsoWireHelper.StripLengthPrefix` on the backend. If the first
 * 4 hex chars look like a length prefix (first byte non-printable, the 4
 * bytes that follow look like a printable ASCII MTI candidate at offset
 * 4 or after a raw 5-byte TPDU at offset 14), returns the payload without
 * those 4 chars. Otherwise returns the wire unchanged.
 */
function stripLengthPrefix(wire: string): { payload: string; detectedPrefix: string | null } {
  if (!isHex(wire) || wire.length < 12) return { payload: wire, detectedPrefix: null };

  const firstByte = parseInt(wire.substring(0, 2), 16);
  if (firstByte >= 0x20) return { payload: wire, detectedPrefix: null };

  // Same two-layout check used backend-side: [prefix][MTI] or [prefix][TPDU][MTI].
  const printableAt = (charOffset: number, byteCount: number): boolean => {
    if (charOffset + byteCount * 2 > wire.length) return false;
    for (let i = 0; i < byteCount; i++) {
      const b = parseInt(wire.substring(charOffset + i * 2, charOffset + i * 2 + 2), 16);
      if (b < 0x20 || b > 0x7E) return false;
    }
    return true;
  };

  if (!printableAt(4, 4) && !(wire.length >= 22 && printableAt(14, 4))) {
    return { payload: wire, detectedPrefix: null };
  }

  return {
    payload: wire.substring(4),
    detectedPrefix: wire.substring(0, 4).toUpperCase(),
  };
}


function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const MAX_RESPONSES = 100;

/**
 * Builds a synthetic <c>MessageLogEntry</c> for a FAILED injection so the
 * live log surfaces the attempt + error. Successful injections already
 * flow through SignalR from the receiver side; failures don't (the
 * receiver never got the message, or never sent a response), so we
 * synthesize one client-side.
 */
function buildFailureLogEntry(
  mti: string,
  errorMessage: string,
  targetHost: string,
  targetPort: number,
): MessageLogEntry {
  const truncated = errorMessage.length > 80
    ? errorMessage.slice(0, 80) + "…"
    : errorMessage;
  return {
    entryId: crypto.randomUUID(),
    sessionId: `injector:${targetHost}:${targetPort}`,
    timestamp: new Date().toISOString(),
    direction: "sent",
    asciiMessage: "",
    binaryHexMessage: "",
    decodedMti: mti,
    decodedFields: [],
    hasErrors: true,
    rejected: true,
    errorCode: "INJECTION_FAILED",
    validationSummary: truncated,
    processingMs: 0,
  };
}

export function InjectorPanel({
  sessions = [],
  onAppendLog,
}: {
  sessions?: SimulatorSession[];
  /** Lets the panel surface FAILED injections in the parent's live log
   *  (success entries already flow via SignalR from the receiver side). */
  onAppendLog?: (entry: MessageLogEntry) => void;
} = {}) {
  const { t } = useTranslation();

  // Single source of truth lives in the injector store — the SessionRow
  // subscribes to it too so its compatibility border updates reactively.
  const storeSet = useInjectorStore((s) => s.set);
  const storeReset = useInjectorStore((s) => s.reset);
  const persisted = useInjectorStore() as InjectorState;
  const setPersistedField = <K extends keyof InjectorState>(k: K, v: InjectorState[K]) =>
    storeSet(k, v);

  // Compute the "effective" destination + framing. When a session is selected
  // in the combobox, host/port/framing come from that session — the persisted
  // free-form values stay untouched so the user can flip back to "custom".
  const activeRebatedores = sessions.filter(
    (s) => (s.status === "active" || s.status === "starting")
      && s.mode?.toLowerCase() === "rebatedor",
  );
  const selectedSession = persisted.destination.startsWith("session:")
    ? activeRebatedores.find((s) => `session:${s.tcpPort}` === persisted.destination)
    : undefined;
  const effectiveHost = selectedSession ? "localhost" : persisted.targetHost;
  const effectivePort = selectedSession ? selectedSession.tcpPort : persisted.targetPort;
  const effectiveIncludePrefix = selectedSession
    ? (selectedSession.headerSize ?? 2) !== 0
    : persisted.includeLengthPrefix;

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
    storeReset();
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

  // TPDU validation surfaces only when the user typed something AND it isn't
  // 10 hex chars. Empty + includeTpdu=true means AUTO (Workspace NIIs) — also valid.
  const tpduInvalid =
    persisted.includeTpdu && !isValidTpduOverride(persisted.tpduOverride);

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
    // The length prefix is computed and prepended by the backend (as 2 raw
    // binary bytes) — we just pass the flag. Concatenating it here as ASCII
    // hex chars was the previous bug: receivers got "000A" inside the body
    // and failed to parse the MTI.
    const trimmed = persisted.message.trim();
    try {
      const res: InjectDirectResponse = await injectDirect({
        // Use effective values — when a session is selected, host/port/framing
        // come from the session, not the persisted free-form fields.
        targetHost: effectiveHost,
        targetPort: effectivePort,
        message: trimmed,
        includeLengthPrefix: effectiveIncludePrefix,
        includeTpdu: persisted.includeTpdu,
        // Literal TPDU only matters when the toggle is on; empty string maps to
        // null so the backend falls back to Workspace-NII auto-generation.
        tpduOverride: persisted.includeTpdu
          ? (persisted.tpduOverride && persisted.tpduOverride.length > 0
              ? persisted.tpduOverride
              : null)
          : null,
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

      // Append FAILED injections to the live log too. Successful ones flow
      // back via SignalR from the receiver side, but a failure (timeout,
      // connection closed, framing mismatch) has no receiver entry — so
      // the user would see nothing in the log without this.
      if (onAppendLog && (!res.success || res.error))
      {
        onAppendLog(buildFailureLogEntry(
          res.requestMti ?? trimmed.slice(0, 4),
          res.error ?? "Injection failed",
          effectiveHost, effectivePort,
        ));
      }
    } catch (err) {
      const entry: InjectorResponse = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        processingMs: Math.round(performance.now() - startedAt),
        success: false,
        error: (err as Error)?.message ?? "Unknown error",
      };
      setResponses((prev) => [entry, ...prev].slice(0, MAX_RESPONSES));
      onAppendLog?.(buildFailureLogEntry(
        trimmed.slice(0, 4),
        (err as Error)?.message ?? "Unknown error",
        persisted.targetHost, persisted.targetPort,
      ));
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
        {/* Destination combobox replaces the legacy host/port pair. Each
            active Rebatedor surfaces with its framing icon so a glance tells
            the user whether sending will work; "Destino customizado" keeps
            the free-form host/port + manual prefix toggle. */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <Label>{t("simulator.injector.destination")}</Label>
            <select
              value={persisted.destination}
              onChange={(e) => setPersistedField("destination", e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-bg-input border border-[var(--border)] text-sm"
              data-testid="injector-destination"
            >
              {activeRebatedores.map((s) => {
                const sessionPrefixOn = (s.headerSize ?? 2) !== 0;
                // Compare against the EFFECTIVE prefix, not the manual toggle.
                // When a session is selected, effectiveIncludePrefix mirrors
                // that session — so the active option always shows ✅, and the
                // ⚠️ surfaces only on OTHER sessions whose framing actually
                // differs (a real switch-cost cue, not a phantom alert).
                const compatible = sessionPrefixOn === effectiveIncludePrefix;
                const icon = compatible ? "✅" : "⚠️";
                const framing = sessionPrefixOn
                  ? t("simulator.framingWithPrefix")
                  : t("simulator.framingWithoutPrefix");
                return (
                  <option key={s.sessionId} value={`session:${s.tcpPort}`}>
                    {t("simulator.injector.destinationSession", {
                      icon, port: s.tcpPort, role: s.role, framing,
                    })}
                  </option>
                );
              })}
              {activeRebatedores.length > 0 && (
                <option disabled>──────────</option>
              )}
              <option value="custom">{t("simulator.injector.destinationCustom")}</option>
            </select>
          </div>
          <div className="pb-1 flex flex-col gap-1.5">
            <Toggle
              checked={persisted.includeTpdu}
              onChange={(v) => setPersistedField("includeTpdu", v)}
              label={t("simulator.injector.includeTpdu")}
            />
            {/* Length prefix toggle. In "custom" mode the user controls it
                directly. With a session selected the framing is dictated by
                the session's HeaderSize — we still render the toggle so the
                user can SEE the effective state, but it's disabled + tinted,
                with a hint explaining how to change it. */}
            {selectedSession ? (
              <div
                className="opacity-60 pointer-events-none"
                title={t("simulator.injector.prefixFromSessionHint")}
                data-testid="injector-prefix-readonly"
              >
                <Toggle
                  checked={effectiveIncludePrefix}
                  onChange={() => { /* read-only when a session is selected */ }}
                  label={`${t("simulator.includeLengthPrefix")} · ${t("simulator.injector.prefixFromSessionBadge")}`}
                />
              </div>
            ) : (
              <div title={t("simulator.injector.includeLengthPrefixDescription")}>
                <Toggle
                  checked={persisted.includeLengthPrefix}
                  onChange={(v) => setPersistedField("includeLengthPrefix", v)}
                  label={t("simulator.includeLengthPrefix")}
                />
              </div>
            )}
          </div>
        </div>

        {/* Editable TPDU literal. Mirrors the Builder's ContextBar pattern: an
            input appears only when the TPDU toggle is on. Empty input means
            AUTO (backend uses Workspace NIIs); a 10-hex literal forces those
            5 bytes verbatim. Validation surfaces red border + inline hint. */}
        {persisted.includeTpdu && (
          <div data-testid="injector-tpdu-field" className="flex flex-col" style={{ maxWidth: 260 }}>
            <Label>{t("simulator.injector.tpduValue")}</Label>
            <Input
              value={persisted.tpduOverride ?? ""}
              onChange={(e) => setPersistedField("tpduOverride", e.target.value || null)}
              placeholder="6000000000"
              maxLength={10}
              className={clsx("font-mono", tpduInvalid && "border-danger focus:ring-danger/30")}
              spellCheck={false}
            />
            <div className="text-[11px] text-text-tertiary mt-0.5">
              {tpduInvalid
                ? t("simulator.injector.tpduInvalid")
                : t("simulator.injector.tpduHint")}
            </div>
          </div>
        )}

        {/* Custom host/port — only when "Destino customizado" is selected. */}
        {!selectedSession && (
          <div className="grid grid-cols-[1fr_140px] gap-3" data-testid="injector-custom-fields">
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
          </div>
        )}

        {/* Custom-destination mode points at an external host/port, so we
            have no grounds to second-guess the framing — the local
            Rebatedores running here are irrelevant. The compatibility
            ⚠️ icons inside the combobox already surface mismatches against
            LOCAL sessions if the user wants to glance at them. */}

        {persisted.includeLengthPrefix && persisted.message.trim().length > 0 && (() => {
          // The user may have pasted a wire that already starts with a
          // length prefix — strip it client-side so the preview shows the
          // recomputed prefix for the PAYLOAD (matches what the backend
          // actually sends after the same strip).
          const trimmed = persisted.message.trim();
          const { payload, detectedPrefix } = stripLengthPrefix(trimmed);
          const charCount = calculateWireCharCount(payload);
          return (
            <div className="text-xs text-text-tertiary -mt-1" data-testid="injector-length-preview">
              {t("simulator.includeLengthPrefixHint")}{" "}
              <span className="font-mono text-accent">[{lengthPrefixHex(charCount)}]</span>{" "}
              {payload.slice(0, 40)}{payload.length > 40 ? "…" : ""}
              {detectedPrefix && (
                <div className="text-text-tertiary mt-0.5">
                  <span className="opacity-70">↳</span>{" "}
                  {t("simulator.injector.detectedPrefixHint", { prefix: detectedPrefix })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Mensagem — Sprint 12.6 P5: the eraser next to the label clears
            ONLY this field (host/port/toggles stay intact); the big "Limpar"
            below still resets everything. Two-tier UX: the small one is
            for iterating on the payload, the big one is for starting over. */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="mb-0">{t("simulator.injector.message")}</Label>
            <button
              type="button"
              onClick={() => setPersistedField("message", "")}
              disabled={messageEmpty}
              title={t("simulator.injector.clearMessageTitle")}
              data-testid="injector-clear-message"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] text-text-tertiary hover:text-text-primary rounded hover:bg-bg-tertiary/40 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-tertiary disabled:cursor-not-allowed transition-colors"
            >
              <Eraser size={11} />
              {t("simulator.injector.clearMessage")}
            </button>
          </div>
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
          <Button onClick={() => injectOne(false)} disabled={messageEmpty || busy || running || tpduInvalid}>
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
                <Button variant="secondary" onClick={startContinuous} disabled={messageEmpty || tpduInvalid}>
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
