import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  PowerOff,
  ScrollText,
  Settings,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import clsx from "clsx";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Label, Select, Toggle } from "@/components/ui/Field";
import { MonoText } from "@/components/ui/MonoText";
import { listSessions, startSession, stopSession, getLog, clearLog } from "@/api/simulator";
import { useSimulatorHub } from "@/hooks/useSimulatorHub";
import { useAppConfig } from "@/contexts/AppConfigContext";
import { InjectorPanel } from "./InjectorPanel";
import { SimulatorLockedPanel } from "./SimulatorLockedPanel";
import { EmvResponseConfigModal } from "./EmvResponseConfigModal";
import type { MessageLogEntry, SimulatorSession } from "@/types";

const STATUS_TONE: Record<string, "accent" | "success" | "warning" | "danger" | "neutral"> = {
  starting: "warning",
  active: "success",
  stopped: "neutral",
  error: "danger",
};

export default function SimulatorPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { simulatorEnabled } = useAppConfig();
  const [filter, setFilter] = useState<"all" | "received" | "sent" | "errors" | "rejected">("all");
  const [showForm, setShowForm] = useState(false);

  // Online mode: backend blocks /api/simulator/* with 403. Render the locked
  // panel instead of the live UI so users see why the feature isn't running
  // (and how to enable it locally) before hitting any 403s.
  if (!simulatorEnabled) {
    return (
      <AppShell title={t("simulator.title")} subtitle={t("simulator.subtitle")}>
        <SimulatorLockedPanel />
      </AppShell>
    );
  }

  // Live log is collapsed by default — most users only care about the Injector
  // panel above. Persist the choice so it survives a reload.
  const [logExpanded, setLogExpanded] = useState<boolean>(() => {
    try { return localStorage.getItem("simulator-logExpanded") === "true"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("simulator-logExpanded", String(logExpanded)); } catch { /* ignore */ }
  }, [logExpanded]);

  // When set, the log shows only entries from this session. Ephemeral (not persisted).
  const [activeSessionFilter, setActiveSessionFilter] = useState<string | null>(null);
  const logCardRef = useRef<HTMLDivElement | null>(null);

  /** Toggle session filter + expand the log + scroll into view. Called from a session card. */
  const onViewSessionLog = (sessionId: string) => {
    // Second click on the same session clears the filter.
    if (activeSessionFilter === sessionId) {
      setActiveSessionFilter(null);
      return;
    }
    setActiveSessionFilter(sessionId);
    setLogExpanded(true);
    // Defer scroll so the expansion has time to render its full height.
    // jsdom (test runner) doesn't ship `scrollIntoView`, so guard the call.
    setTimeout(() => {
      try { logCardRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }); }
      catch { /* unsupported in test env — no-op */ }
    }, 60);
  };

  // Live log buffer fed by SignalR. Initialized from /simulator/log on mount.
  const [liveLog, setLiveLog] = useState<MessageLogEntry[]>([]);

  const sessionsQuery = useQuery({
    queryKey: ["sessions"],
    queryFn: listSessions,
    refetchInterval: 5_000,
  });

  // Initial load only — afterwards SignalR is the source of truth.
  const initialLogQuery = useQuery({
    queryKey: ["log-initial"],
    queryFn: () => getLog(),
    staleTime: Infinity,
  });
  useEffect(() => {
    if (initialLogQuery.data) setLiveLog(initialLogQuery.data);
  }, [initialLogQuery.data]);

  const hub = useSimulatorHub({
    onMessageReceived: (entry) => setLiveLog((l) => [entry, ...l].slice(0, 500)),
    onMessageSent: (entry) => setLiveLog((l) => [entry, ...l].slice(0, 500)),
    onSessionStarted: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
    onSessionStopped: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });

  // Auto-join all active sessions when hub connects or session list changes.
  useEffect(() => {
    if (hub.status !== "connected" || !sessionsQuery.data) return;
    sessionsQuery.data.forEach((s) => {
      if (s.status === "active" || s.status === "starting") {
        hub.joinSession(s.sessionId);
      }
    });
  }, [hub.status, sessionsQuery.data, hub.joinSession]);

  const startMut = useMutation({
    mutationFn: startSession,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });
  const stopMut = useMutation({
    mutationFn: (id: string) => {
      hub.leaveSession(id);
      return stopSession(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });
  const clearMut = useMutation({
    mutationFn: async () => {
      await clearLog();
      setLiveLog([]);
    },
  });

  const filtered = useMemo(
    () =>
      liveLog.filter((e) => {
        // Session filter wins first — it's the most explicit narrowing the user can do.
        if (activeSessionFilter && e.sessionId !== activeSessionFilter) return false;
        if (filter === "all") return true;
        if (filter === "errors") return e.hasErrors;
        if (filter === "rejected") return !!e.rejected;
        return e.direction === filter;
      }),
    [liveLog, filter, activeSessionFilter]
  );

  /** Lookup: sessionId → "port X · role" for the inline badge on each log entry. */
  const sessionInfoById = useMemo(() => {
    const m = new Map<string, { tcpPort: number; role: string; status: string }>();
    for (const s of sessionsQuery.data ?? []) {
      m.set(s.sessionId, { tcpPort: s.tcpPort, role: s.role, status: s.status });
    }
    return m;
  }, [sessionsQuery.data]);

  const activeFilterSession = activeSessionFilter
    ? sessionInfoById.get(activeSessionFilter) ?? null
    : null;

  // Filter sessions to display only Rebatedores. Legacy Injetor sessions (if any
  // are still active) stay running on the backend but are hidden from the new UI
  // — the injector is now an always-on panel, not a long-lived session.
  // The agent serialises enums with CamelCase naming policy ("rebatedor"/"injetor"),
  // so compare case-insensitively to stay resilient to either casing.
  const rebatedores = (sessionsQuery.data ?? []).filter(
    (s) => (s.mode ?? "").toLowerCase() === "rebatedor"
  );

  return (
    <AppShell title={t("simulator.title")} subtitle={t("simulator.subtitle")}>
      <div className="space-y-6">
        {/* ── Section 1: Rebatedores ─────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm font-semibold">{t("simulator.rebatedores")}</span>
              <Button size="sm" onClick={() => setShowForm(!showForm)}>
                + {t("simulator.newSession")}
              </Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {startMut.isError && (
              <div className="rounded-md border border-danger bg-danger-bg/40 p-2 text-xs text-danger-text">
                {(startMut.error as Error).message ?? "Falha ao criar sessão"}
              </div>
            )}
            {showForm && (
              <SessionForm
                onSubmit={(cfg) => {
                  // Keep the form open if the mutation fails so the user can fix
                  // the inputs and retry; close only on success.
                  startMut.mutate(cfg, { onSuccess: () => setShowForm(false) });
                }}
                onCancel={() => setShowForm(false)}
                loading={startMut.isPending}
              />
            )}
            {rebatedores.length === 0 ? (
              <div className="text-xs text-text-tertiary text-center py-6">
                {t("simulator.noRebatedores")}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {rebatedores.map((s) => (
                  <SessionRow
                    key={s.sessionId}
                    session={s}
                    onStop={() => stopMut.mutate(s.sessionId)}
                    onViewLog={() => onViewSessionLog(s.sessionId)}
                    isLogFiltered={activeSessionFilter === s.sessionId}
                  />
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* ── Section 2: Injector (always-on panel) ──────────────────── */}
        <InjectorPanel />

        {/* ── Section 3: Live log (collapsed by default) ─────────────── */}
        <div ref={logCardRef}>
          <Card>
            {/* Always-visible collapsible bar */}
            <button
              type="button"
              onClick={() => setLogExpanded((v) => !v)}
              aria-expanded={logExpanded}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-bg-tertiary/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                {logExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <ScrollText size={14} className="text-text-tertiary" />
                <span className="text-sm font-semibold">{t("simulator.liveLog")}</span>
                <ConnectionBadge status={hub.status} onReconnect={hub.reconnect} />
              </div>
              <div className="flex items-center gap-2">
                {activeFilterSession && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-accent-bg text-accent-text">
                    {t("simulator.log.filtering", {
                      session: `port ${activeFilterSession.tcpPort} · ${activeFilterSession.role}`,
                    })}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSessionFilter(null);
                      }}
                      title={t("simulator.log.clearFilter")}
                      className="ml-1 hover:opacity-80"
                    >
                      <X size={11} />
                    </button>
                  </span>
                )}
                <span className="text-xs text-text-tertiary">
                  {t("simulator.messages", { count: filtered.length })}
                </span>
              </div>
            </button>

            {logExpanded && (
              <>
                {/* Filter row — only visible when the log is expanded. */}
                <div className="px-4 py-2 border-t border-[var(--border)] flex items-center justify-end gap-1 flex-wrap">
                  {(["all", "received", "sent", "errors", "rejected"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={clsx(
                        "px-2 py-1 text-xs rounded",
                        filter === f
                          ? "bg-accent-bg text-accent-text"
                          : "text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary"
                      )}
                    >
                      {t(`simulator.filter.${f}`)}
                    </button>
                  ))}
                  <button
                    onClick={() => clearMut.mutate()}
                    className="ml-2 px-2 py-1 text-xs rounded text-text-tertiary hover:text-danger"
                  >
                    {t("common.clear")}
                  </button>
                </div>

                <CardBody className="p-0 max-h-[600px] overflow-y-auto">
                  {filtered.length === 0 ? (
                    <div className="text-xs text-text-tertiary text-center py-12">
                      {t("simulator.messages", { count: 0 })}
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--border)]">
                      {filtered.map((entry) => (
                        <LogEntry
                          key={entry.entryId}
                          entry={entry}
                          sessionInfo={sessionInfoById.get(entry.sessionId)}
                        />
                      ))}
                    </div>
                  )}
                </CardBody>
              </>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function ConnectionBadge({
  status,
  onReconnect,
}: {
  status: ReturnType<typeof useSimulatorHub>["status"];
  onReconnect: () => void;
}) {
  if (status === "connected")
    return (
      <Badge tone="success" className="gap-1">
        <Wifi size={11} /> Live
      </Badge>
    );
  if (status === "connecting")
    return (
      <Badge tone="warning" className="gap-1">
        <Wifi size={11} /> Connecting…
      </Badge>
    );
  return (
    <button
      onClick={onReconnect}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-danger-bg text-danger-text hover:opacity-80"
    >
      <WifiOff size={11} /> Disconnected · Reconnect
    </button>
  );
}

function SessionRow({
  session,
  onStop,
  onViewLog,
  isLogFiltered,
}: {
  session: SimulatorSession;
  onStop: () => void;
  onViewLog: () => void;
  isLogFiltered: boolean;
}) {
  const { t } = useTranslation();
  const isActive = session.status === "active" || session.status === "starting";
  // Backend serializes enum values in lowercase ("emissor", "active") — match
  // case-insensitively so a future serialization policy change doesn't silently
  // hide the EMV config button.
  const isIssuer = session.role?.toLowerCase() === "emissor";
  const [emvModalOpen, setEmvModalOpen] = useState(false);
  // Local optimistic mirror so the badge updates immediately on save (the
  // store-side update only surfaces on the next sessions refetch).
  const [localEmvConfig, setLocalEmvConfig] = useState(session.emvResponse);
  const effectiveEmv = localEmvConfig ?? session.emvResponse;
  const emvMode = effectiveEmv?.mode ?? "Echo";

  return (
    <div className="p-3 rounded-md bg-bg-input border border-[var(--border)]">
      <div className="flex items-center justify-between mb-2">
        <Badge tone={STATUS_TONE[session.status] ?? "neutral"}>{session.status}</Badge>
        <div className="flex items-center gap-1">
          {isIssuer && isActive && (
            <button
              onClick={() => setEmvModalOpen(true)}
              title={t("simulator.emvConfig.title")}
              className="p-1 text-text-tertiary hover:text-text-primary"
              data-testid="emv-config-button"
            >
              <Settings size={14} />
            </button>
          )}
          <button
            onClick={onViewLog}
            title={t("simulator.log.viewLog")}
            className={clsx(
              "p-1",
              isLogFiltered
                ? "text-accent"
                : "text-text-tertiary hover:text-text-primary"
            )}
          >
            <ScrollText size={14} />
          </button>
          {isActive && (
            <button
              onClick={onStop}
              className="p-1 text-text-tertiary hover:text-danger"
              title="Stop"
            >
              <PowerOff size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="font-mono text-xs text-text-secondary mb-1">port {session.tcpPort}</div>
      <div className="text-xs text-text-tertiary flex justify-between items-center gap-2">
        <span className="flex items-center gap-1.5 flex-wrap">
          {session.role}
          <Badge
            tone={session.headerSize === 0 ? "warning" : "success"}
            className="text-[10px] px-1 py-0"
            title={
              session.headerSize === 0
                ? t("simulator.framingWithoutPrefixHint")
                : t("simulator.framingWithPrefixHint")
            }
          >
            {session.headerSize === 0
              ? t("simulator.framingWithoutPrefix")
              : t("simulator.framingWithPrefix")}
          </Badge>
          {isIssuer && (
            <Badge
              tone={emvMode === "GenerateArpc" ? "accent" : "neutral"}
              className="text-[10px] px-1 py-0"
            >
              {emvMode === "GenerateArpc"
                ? t("simulator.emvConfig.badgeArpc")
                : t("simulator.emvConfig.badgeEcho")}
            </Badge>
          )}
        </span>
        <span title={t("simulator.log.transactionsTooltip")}>
          {t("simulator.log.transactions", { count: session.messagesProcessed })}
        </span>
      </div>
      <EmvResponseConfigModal
        open={emvModalOpen}
        sessionId={session.sessionId}
        initialConfig={effectiveEmv}
        onSaved={(saved) => setLocalEmvConfig(saved)}
        onClose={() => setEmvModalOpen(false)}
      />
    </div>
  );
}

function LogEntry({
  entry,
  sessionInfo,
}: {
  entry: MessageLogEntry;
  sessionInfo?: { tcpPort: number; role: string; status: string };
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ts =
    new Date(entry.timestamp).toLocaleTimeString("en-US", { hour12: false }) +
    "." +
    new Date(entry.timestamp).getMilliseconds().toString().padStart(3, "0");

  const isTpduRequired = entry.rejected && entry.errorCode === "TPDU_REQUIRED";
  const isUnknownMtiRejected = entry.rejected && entry.errorCode === "UNKNOWN_MTI";

  // Parse the UnknownMtiAction tag: "Derived:XXXX" / "Custom:XXXX" / "Echoed" / "Rejected — ..."
  const action = entry.unknownMtiAction ?? "";
  const isUnknownMtiDerived = action.startsWith("Derived:");
  const isUnknownMtiEchoed = action === "Echoed";
  const isUnknownMtiCustom = action.startsWith("Custom:");
  const derivedMti = isUnknownMtiDerived ? action.slice("Derived:".length) : null;
  const customMti = isUnknownMtiCustom ? action.slice("Custom:".length) : null;

  return (
    <div
      className={clsx(
        "px-4 py-2.5 hover:bg-bg-tertiary/40",
        // TPDU rejection and Unknown-MTI rejection are config issues, not parse errors —
        // surface them with warning (orange) instead of danger (red).
        isTpduRequired || isUnknownMtiRejected
          ? "bg-warning-bg/40"
          : entry.hasErrors && "bg-danger-bg/30"
      )}
    >
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 text-left">
        <span className="font-mono text-[11px] text-text-tertiary w-24">{ts}</span>
        {entry.direction === "received" ? (
          <ArrowDown size={14} className="text-success" />
        ) : (
          <ArrowUp size={14} className="text-accent" />
        )}
        {entry.decodedMti && (
          <Badge tone={entry.direction === "received" ? "success" : "accent"} className="font-mono">
            {entry.decodedMti}
          </Badge>
        )}
        {entry.tpduPresent && <Badge tone="warning">TPDU</Badge>}
        {entry.rejected && !isUnknownMtiRejected && (
          <Badge tone="warning">{entry.errorCode ?? "Rejected"}</Badge>
        )}
        {isUnknownMtiRejected && (
          <Badge tone="warning">MTI desconhecido — rejeitado</Badge>
        )}
        {isUnknownMtiDerived && (
          <Badge tone="accent">MTI derivado: {derivedMti}</Badge>
        )}
        {isUnknownMtiEchoed && (
          <Badge tone="neutral">MTI ecoado</Badge>
        )}
        {isUnknownMtiCustom && (
          <Badge tone="success">MTI customizado: {customMti}</Badge>
        )}
        {sessionInfo && (
          <Badge
            tone={(STATUS_TONE[sessionInfo.status] ?? "neutral") as "accent" | "success" | "warning" | "danger" | "neutral"}
            className="font-mono"
          >
            port {sessionInfo.tcpPort} · {sessionInfo.role}
          </Badge>
        )}
        <span className="text-xs text-text-tertiary ml-auto">{entry.processingMs}ms</span>
      </button>

      {isTpduRequired && (
        <div className="ml-9 mt-2 flex flex-wrap items-center gap-3 text-xs text-warning-text">
          <span>⚠ Mensagem rejeitada: esta sessão exige TPDU.</span>
          <span className="text-text-tertiary">
            Configure o Builder para incluir TPDU antes de enviar.
          </span>
          <button
            type="button"
            onClick={() => navigate("/builder")}
            className="underline text-accent hover:text-accent-text"
          >
            Abrir no Builder
          </button>
        </div>
      )}

      {isUnknownMtiRejected && (
        <div className="ml-9 mt-2 flex flex-wrap items-center gap-3 text-xs text-warning-text">
          <span>⚠ {entry.unknownMtiAction ?? "MTI desconhecido — rejeitado"}</span>
          <span className="text-text-tertiary">
            Configure o mapa de respostas ou ajuste "MTI desconhecido" na sessão.
          </span>
        </div>
      )}
      {open && entry.decodedFields.length > 0 && (
        <div className="mt-2 ml-9 space-y-0.5 text-xs">
          {entry.decodedFields.map((f) => (
            <div key={f.bitNumber} className="flex gap-3">
              <span className="text-text-tertiary w-8">{f.bitNumber}</span>
              <span className="text-text-secondary flex-1">{f.name}</span>
              <MonoText className="flex-1 truncate">{f.maskedValue}</MonoText>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionForm({
  onSubmit,
  onCancel,
  loading,
}: {
  onSubmit: (cfg: Record<string, unknown>) => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  const { t } = useTranslation();
  const [cfg, setCfg] = useState({
    sessionId: "",
    tcpPort: 8583,
    // Mode is locked to Rebatedor — the new design has a single, always-on Injector
    // panel below the rebatedor list, so the session creator never picks a mode.
    mode: "Rebatedor",
    role: "Adquirente",
    layoutName: "default",
    defaultResponseCode: "00",
    validateArqc: false,
    autoRespond: true,
    tpduMode: "Optional",
    unknownMtiResponse: "Derive",
    unknownMtiCustomValue: "",
    // When true → backend's MessageFramer uses HeaderSize=2 (standard
    // acquirer/network framing). When false → HeaderSize=0 (1 connect = 1
    // message, no length prefix on the wire — typical for POS terminals
    // with proprietary protocols).
    expectLengthPrefix: true,
  });

  const TPDU_HINTS: Record<string, string> = {
    Auto: t("simulator.tpduModeHints.auto"),
    Required: t("simulator.tpduModeHints.required"),
    Optional: t("simulator.tpduModeHints.optional"),
    Strip: t("simulator.tpduModeHints.strip"),
  };

  // Translated labels for the TPDU mode <option> entries — keys match the internal
  // enum identifier (Auto / Required / Optional / Strip) sent to the backend.
  const TPDU_LABELS: Record<string, string> = {
    Auto: t("simulator.tpduModes.auto"),
    Required: t("simulator.tpduModes.required"),
    Optional: t("simulator.tpduModes.optional"),
    Strip: t("simulator.tpduModes.strip"),
  };

  const UNKNOWN_MTI_HINTS: Record<string, string> = {
    Derive: t("simulator.unknownMti.deriveHint"),
    Reject: t("simulator.unknownMti.rejectHint"),
    Echo: t("simulator.unknownMti.echoHint"),
    Custom: t("simulator.unknownMti.customHint"),
  };

  // Per-role explainer shown below the Select so the user can pick the right
  // session role without consulting docs. Authorizador was dropped from the
  // form (redundant with Emissor) — legacy sessions still render fine because
  // the backend enum still has the value.
  const ROLE_HINTS: Record<string, string> = {
    Adquirente: t("simulator.roleHints.acquirer"),
    Bandeira: t("simulator.roleHints.brand"),
    Emissor: t("simulator.roleHints.issuer"),
  };

  // Custom MTI must be exactly 4 numeric digits when provided.
  const customMtiInvalid =
    cfg.unknownMtiResponse === "Custom" &&
    !/^\d{4}$/.test(cfg.unknownMtiCustomValue);
  const tcpPortInvalid = !(cfg.tcpPort > 0 && cfg.tcpPort < 65536);
  const formInvalid = customMtiInvalid || tcpPortInvalid;

  return (
    <Card>
      <CardHeader>
        <span className="text-sm font-semibold">{t("simulator.newSession")}</span>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t("simulator.tcpPort")}</Label>
            <Input
              type="number"
              value={cfg.tcpPort}
              onChange={(e) => setCfg({ ...cfg, tcpPort: Number(e.target.value) })}
              className={clsx(tcpPortInvalid && "border-danger focus:ring-danger/30")}
            />
          </div>
          <div>
            <Label>{t("simulator.role")}</Label>
            <Select
              value={cfg.role}
              onChange={(e) => setCfg({ ...cfg, role: e.target.value })}
              title={ROLE_HINTS[cfg.role]}
            >
              {/* Internal value (sent to backend) stays in PT; the display label is
                  resolved from builder.roles.* so EN users see Acquirer/etc. */}
              <option value="Adquirente">{t("builder.roles.adquirente")}</option>
              <option value="Bandeira">{t("builder.roles.bandeira")}</option>
              <option value="Emissor">{t("builder.roles.emissor")}</option>
            </Select>
            {ROLE_HINTS[cfg.role] && (
              <div className="text-xs text-text-tertiary mt-1">{ROLE_HINTS[cfg.role]}</div>
            )}
          </div>
          <div>
            <Label>{t("simulator.defaultRc")}</Label>
            <Input
              value={cfg.defaultResponseCode}
              onChange={(e) => setCfg({ ...cfg, defaultResponseCode: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label>{t("simulator.tpduMode")}</Label>
          <Select
            value={cfg.tpduMode}
            onChange={(e) => setCfg({ ...cfg, tpduMode: e.target.value })}
            title={TPDU_HINTS[cfg.tpduMode]}
          >
            <option value="Auto">{TPDU_LABELS.Auto}</option>
            <option value="Required">{TPDU_LABELS.Required}</option>
            <option value="Optional">{TPDU_LABELS.Optional}</option>
            <option value="Strip">{TPDU_LABELS.Strip}</option>
          </Select>
          <div className="text-xs text-text-tertiary mt-1">{TPDU_HINTS[cfg.tpduMode]}</div>
        </div>

        <div>
          <Label>{t("simulator.unknownMti.label")}</Label>
          <Select
            value={cfg.unknownMtiResponse}
            onChange={(e) => setCfg({ ...cfg, unknownMtiResponse: e.target.value })}
            title={UNKNOWN_MTI_HINTS[cfg.unknownMtiResponse]}
          >
            <option value="Derive" title={UNKNOWN_MTI_HINTS.Derive}>
              {t("simulator.unknownMti.derive")}
            </option>
            <option value="Reject" title={UNKNOWN_MTI_HINTS.Reject}>
              {t("simulator.unknownMti.reject")}
            </option>
            <option value="Echo" title={UNKNOWN_MTI_HINTS.Echo}>
              {t("simulator.unknownMti.echo")}
            </option>
            <option value="Custom" title={UNKNOWN_MTI_HINTS.Custom}>
              {t("simulator.unknownMti.custom")}
            </option>
          </Select>
          <div className="text-xs text-text-tertiary mt-1">
            {UNKNOWN_MTI_HINTS[cfg.unknownMtiResponse]}
          </div>

          {cfg.unknownMtiResponse === "Custom" && (
            <div className="mt-2">
              <Label>{t("simulator.unknownMti.customMtiLabel")}</Label>
              <Input
                value={cfg.unknownMtiCustomValue}
                onChange={(e) =>
                  setCfg({ ...cfg, unknownMtiCustomValue: e.target.value.replace(/\D/g, "").slice(0, 4) })
                }
                placeholder={t("simulator.unknownMti.customMtiPlaceholder")}
                maxLength={4}
                className={clsx("font-mono", customMtiInvalid && "border-danger focus:ring-danger/30")}
              />
            </div>
          )}
        </div>
        <Toggle
          checked={cfg.autoRespond}
          onChange={(v) => setCfg({ ...cfg, autoRespond: v })}
          label={t("simulator.autoRespond")}
        />
        <Toggle
          checked={cfg.validateArqc}
          onChange={(v) => setCfg({ ...cfg, validateArqc: v })}
          label={t("simulator.validateArqc")}
        />
        <div>
          <Toggle
            checked={cfg.expectLengthPrefix}
            onChange={(v) => setCfg({ ...cfg, expectLengthPrefix: v })}
            label={t("simulator.expectLengthPrefix")}
          />
          <div className="text-xs text-text-tertiary mt-1">
            {t("simulator.expectLengthPrefixHint")}
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => {
              // mode is always "Rebatedor" — the form no longer offers a choice.
              // expectLengthPrefix is a UI-side concept; the backend reads
              // `headerSize` from SessionConfig (0 = un-framed, 2 = standard).
              const { expectLengthPrefix, ...rest } = cfg;
              const payload = {
                ...rest,
                sessionId: crypto.randomUUID(),
                headerSize: expectLengthPrefix ? 2 : 0,
                unknownMtiCustomValue:
                  cfg.unknownMtiResponse === "Custom" ? cfg.unknownMtiCustomValue : null,
              };
              onSubmit(payload);
            }}
            disabled={loading || formInvalid}
          >
            {loading ? t("common.loading") : t("common.confirm")}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
