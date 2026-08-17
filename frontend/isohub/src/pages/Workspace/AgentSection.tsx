import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Pencil, Radio, XCircle } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { useAppConfig } from "@/contexts/AppConfigContext";
import { probeAgentHealth } from "@/api/agent";
import {
  normalizeAgentUrl,
  useAgentConnectionStore,
} from "@/store/agentConnection";
import type { HealthStatus } from "@/types";

/**
 * Sprint 12.2 P5+ — Agent (Simulator) connection panel. The Agent lives
 * in a separate process from the Backend (this Backend is what serves this
 * SPA) since the Simulator needs to be on the operator's own machine/network
 * to bind local TCP ports. The URL is per-operator state — we keep it in
 * localStorage via <c>useAgentConnectionStore</c>.
 *
 * "Conectar" runs a health probe against {url}/api/health BEFORE committing
 * the URL to storage. A failure surfaces the error inline verbatim (same
 * convention as the Schemas upload panel) and leaves the previous saved
 * value untouched.
 */
export function AgentSection() {
  const { t } = useTranslation();
  const { agentUrlHint } = useAppConfig();

  const savedUrl = useAgentConnectionStore((s) => s.agentUrl);
  const setAgentUrl = useAgentConnectionStore((s) => s.setAgentUrl);
  const setStatus = useAgentConnectionStore((s) => s.setStatus);
  const setError = useAgentConnectionStore((s) => s.setError);
  const clear = useAgentConnectionStore((s) => s.clear);
  const status = useAgentConnectionStore((s) => s.status);
  const errorMessage = useAgentConnectionStore((s) => s.errorMessage);

  // The URL currently in the text input. Seeded from the saved value if
  // present; otherwise from the Backend's hint (env var AGENT_URL_HINT).
  // Falls back to empty so the user always sees an editable field.
  const initialDraft = useMemo(
    () => savedUrl ?? agentUrlHint ?? "",
    // We only care about the very first render — subsequent edits are local
    // to the input. If the saved URL changes elsewhere (e.g. a Clear), we
    // reset via the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [draft, setDraft] = useState(initialDraft);

  // When the saved URL is externally cleared (or when the hint arrives late
  // via /api/config), refresh the input so it stays coherent with the store.
  useEffect(() => {
    if (savedUrl === null && draft === "") {
      setDraft(agentUrlHint ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedUrl, agentUrlHint]);

  // Last successful health payload — surfaced in the "Conectado" panel.
  const [lastHealth, setLastHealth] = useState<HealthStatus | null>(null);
  // Editing lets the user re-open the input when a URL is already saved.
  const [editing, setEditing] = useState(!savedUrl);

  const connectMut = useMutation({
    mutationFn: (url: string) => probeAgentHealth(url),
    onMutate: () => {
      setStatus("testing");
      setError(null);
    },
    onSuccess: (health, url) => {
      setAgentUrl(url);
      setStatus("connected");
      setLastHealth(health);
      setEditing(false);
    },
    onError: (err: unknown) => {
      // Verbatim message pipeline — same convention as SchemasSection.
      const message = (err as Error)?.message ?? "Failed to reach the Agent.";
      setStatus("error");
      setError(message);
      // Do NOT setAgentUrl — the previous saved value stays intact.
    },
  });

  const onConnect = () => {
    const normalized = normalizeAgentUrl(draft);
    if (!normalized) {
      setError(t("workspace.agent.urlRequired"));
      setStatus("error");
      return;
    }
    connectMut.mutate(normalized);
  };

  const onDisconnect = () => {
    clear();
    setLastHealth(null);
    setDraft(agentUrlHint ?? "");
    setEditing(true);
  };

  const isConnected = status === "connected" && savedUrl;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 w-full">
          <Radio size={14} className="text-text-secondary" />
          <span className="text-sm font-semibold">{t("workspace.agent.title")}</span>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="text-xs text-text-tertiary leading-relaxed">
          {t("workspace.agent.description")}
        </div>

        {isConnected && !editing ? (
          <div
            className="rounded-md border border-success/40 bg-success-bg/30 p-3 space-y-2"
            data-testid="workspace-agent-connected"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-success-text">
              <CheckCircle2 size={14} />
              {t("workspace.agent.connected")}
            </div>
            <div className="font-mono text-xs text-text-secondary break-all">
              {savedUrl}
            </div>
            {lastHealth && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-tertiary">
                <span>v{lastHealth.version}</span>
                <span>·</span>
                <span>
                  {t("workspace.agent.activeSessions", { count: lastHealth.activeSessions })}
                </span>
                <span>·</span>
                <span>
                  {t("workspace.agent.totalMessages", { count: lastHealth.totalMessagesProcessed })}
                </span>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditing(true)}
                data-testid="workspace-agent-edit"
              >
                <Pencil size={12} /> {t("workspace.agent.edit")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={onDisconnect}
                data-testid="workspace-agent-disconnect"
              >
                <XCircle size={12} /> {t("workspace.agent.disconnect")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <Label>{t("workspace.agent.urlLabel")}</Label>
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t("workspace.agent.urlPlaceholder")}
                className="font-mono"
                spellCheck={false}
                autoComplete="off"
                data-testid="workspace-agent-url"
              />
              <div className="text-[11px] text-text-tertiary mt-1">
                {t("workspace.agent.urlHint")}
              </div>
            </div>
            {errorMessage && status === "error" && (
              <ErrorBanner message={errorMessage} />
            )}
            <div className="flex gap-2">
              <Button
                onClick={onConnect}
                disabled={connectMut.isPending || draft.trim().length === 0}
                data-testid="workspace-agent-connect"
              >
                {connectMut.isPending
                  ? t("workspace.agent.connecting")
                  : t("workspace.agent.connect")}
              </Button>
              {savedUrl && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditing(false);
                    setDraft(savedUrl);
                    setError(null);
                  }}
                >
                  {t("common.cancel")}
                </Button>
              )}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
