import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Label } from "@/components/ui/Field";
import { Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { updateEmvConfig } from "@/api/simulator";
import type { EmvResponseConfig, EmvResponseMode } from "@/types";

interface Props {
  open: boolean;
  sessionId: string;
  initialConfig?: EmvResponseConfig;
  onSaved: (cfg: EmvResponseConfig) => void;
  onClose: () => void;
}

const DEFAULT_CONFIG: EmvResponseConfig = {
  mode: "Echo",
  proprietaryHeaderBytes: 0,
  imkOverride: null,
  brand: "Visa",
};

/**
 * Per-session EMV response configuration modal. Only meaningful when the
 * session's role is Issuer/Emissor. Echo (default) is recommended for
 * arbitrary payloads; GenerateArpc requires an IMK and tries the full
 * crypto path with graceful fallback to Echo on any failure.
 */
export function EmvResponseConfigModal({
  open, sessionId, initialConfig, onSaved, onClose,
}: Props) {
  const { t } = useTranslation();
  const [cfg, setCfg] = useState<EmvResponseConfig>(initialConfig ?? DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setCfg(initialConfig ?? DEFAULT_CONFIG);
  }, [open, initialConfig]);

  if (!open) return null;

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      await updateEmvConfig(sessionId, cfg);
      onSaved(cfg);
      onClose();
    } catch (e) {
      setError((e as Error)?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const setMode = (mode: EmvResponseMode) => setCfg((c) => ({ ...c, mode }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="emv-config-modal"
      role="dialog"
      aria-label={t("simulator.emvConfig.title")}
    >
      <div className="w-full max-w-md rounded-lg bg-bg-primary shadow-xl border border-[var(--border)]">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold">{t("simulator.emvConfig.title")}</h3>
        </div>
        <div className="p-4 space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-text-tertiary">
              {t("simulator.emvConfig.bit55Mode")}
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="emv-mode"
                checked={cfg.mode === "Echo"}
                onChange={() => setMode("Echo")}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t("simulator.emvConfig.echo")}</span>
                  <Badge tone="success" className="text-[10px] px-1 py-0">
                    {t("simulator.emvConfig.echoRecommended")}
                  </Badge>
                </div>
                <div className="text-xs text-text-tertiary mt-0.5">
                  {t("simulator.emvConfig.echoDescription")}
                </div>
              </div>
            </label>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="emv-mode"
                checked={cfg.mode === "GenerateArpc"}
                onChange={() => setMode("GenerateArpc")}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium">{t("simulator.emvConfig.generateArpc")}</div>
                <div className="text-xs text-text-tertiary mt-0.5">
                  {t("simulator.emvConfig.generateArpcDescription")}
                </div>
              </div>
            </label>
          </div>

          {cfg.mode === "GenerateArpc" && (
            <div className="space-y-3 pl-6 border-l-2 border-[var(--border)]" data-testid="arpc-fields">
              <div>
                <Label className="flex items-center gap-1">
                  {t("simulator.emvConfig.proprietaryHeader")}
                  <span title={t("simulator.emvConfig.proprietaryHeaderTooltip")}>
                    <Info size={12} className="text-text-tertiary" />
                  </span>
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={32}
                  value={cfg.proprietaryHeaderBytes}
                  onChange={(e) =>
                    setCfg((c) => ({
                      ...c,
                      proprietaryHeaderBytes: Math.max(0, Math.min(32, Number(e.target.value) || 0)),
                    }))
                  }
                />
              </div>

              <div>
                <Label>{t("simulator.emvConfig.imkOverride")}</Label>
                <Input
                  type="password"
                  placeholder={t("simulator.emvConfig.imkOverrideHint")}
                  value={cfg.imkOverride ?? ""}
                  onChange={(e) =>
                    setCfg((c) => ({ ...c, imkOverride: e.target.value || null }))
                  }
                  className="font-mono"
                />
                <div className="text-xs text-text-tertiary mt-1">
                  {t("simulator.emvConfig.imkOverrideHint")}
                </div>
              </div>

              <div>
                <Label>{t("simulator.emvConfig.brand")}</Label>
                <Select
                  value={cfg.brand}
                  onChange={(e) => setCfg((c) => ({ ...c, brand: e.target.value }))}
                >
                  <option value="Visa">Visa</option>
                  <option value="Mastercard">Mastercard</option>
                  <option value="Elo">Elo</option>
                </Select>
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-danger-text border border-danger/30 bg-danger-bg rounded p-2">
              {error}
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)] flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? t("common.loading") : t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
