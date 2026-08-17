import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Radio } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface AgentNotConfiguredPanelProps {
  /**
   * Why the Simulator UI can't render:
   *   - "unconfigured" (default): the operator never set an Agent URL.
   *   - "unreachable":  a URL is saved but the Agent isn't responding.
   *
   * Both surface the same empty state (never the full form on top of an
   * error banner) but with a subtly different message so the user knows
   * which fix to apply — configure vs. start / adjust.
   */
  reason?: "unconfigured" | "unreachable";
  /** URL currently saved when reason is "unreachable". Displayed so the
   *  user can spot a wrong host/port at a glance. */
  attemptedUrl?: string | null;
  /** Verbatim error text from the health probe (only used when reason
   *  is "unreachable"). */
  errorMessage?: string | null;
}

/**
 * Empty state rendered on the Simulator page when the operator hasn't
 * configured the Agent base URL yet OR the saved URL isn't responding
 * (Sprint 12.4). Distinct from SimulatorLockedPanel (ISOHUB_MODE=online)
 * — that one is a permanent block; this one is always a "one-click fix"
 * via the Workspace.
 */
export function AgentNotConfiguredPanel({
  reason = "unconfigured",
  attemptedUrl,
  errorMessage,
}: AgentNotConfiguredPanelProps = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const titleKey =
    reason === "unreachable"
      ? "workspace.agent.notReachable.title"
      : "workspace.agent.notConfigured.title";
  const descKey =
    reason === "unreachable"
      ? "workspace.agent.notReachable.description"
      : "workspace.agent.notConfigured.description";

  return (
    <Card data-testid="simulator-agent-not-configured" data-reason={reason}>
      <CardBody className="flex flex-col items-center text-center gap-4 py-12">
        <div className="p-3 rounded-full bg-accent-bg/40 text-accent-text">
          <Radio size={24} />
        </div>
        <div className="space-y-1 max-w-md">
          <h3 className="text-base font-semibold">{t(titleKey)}</h3>
          <p className="text-sm text-text-tertiary">{t(descKey)}</p>
          {reason === "unreachable" && attemptedUrl && (
            <div
              className="mt-2 font-mono text-xs text-text-tertiary break-all"
              data-testid="simulator-agent-attempted-url"
            >
              {attemptedUrl}
            </div>
          )}
          {reason === "unreachable" && errorMessage && (
            <div
              className="mt-2 text-xs text-danger-text"
              data-testid="simulator-agent-error-message"
            >
              {errorMessage}
            </div>
          )}
        </div>
        <Button onClick={() => navigate("/workspace?tab=agent")}>
          {t("workspace.agent.notConfigured.cta")}
        </Button>
      </CardBody>
    </Card>
  );
}
