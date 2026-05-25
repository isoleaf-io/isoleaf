import { useEffect, useState } from "react";
import { useEmvStore } from "@/store/emv";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Info, RotateCcw, XCircle } from "lucide-react";
import clsx from "clsx";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { validateArqc } from "@/api/emv";
import type { ArqcResult, ValidateArqcRequest } from "@/types";
import { TagsTable } from "./TagsTable";
import { ResultRow } from "./ResultRow";

const PROFILES = ["Visa", "Mastercard", "Elo"];

export function ValidateArqcTab() {
  const { t } = useTranslation();
  const form = useEmvStore((s) => s.validateInput);
  const result = useEmvStore((s) => s.validateResult);
  const setInput = useEmvStore((s) => s.setValidateInput);
  const setResult = useEmvStore((s) => s.setValidateResult);
  const clearTab = useEmvStore((s) => s.clearTab);
  const loadedFromParser = useEmvStore((s) => s.loadedFromParser);
  const acknowledgeLoadedFromParser = useEmvStore((s) => s.acknowledgeLoadedFromParser);
  const [revealKey, setRevealKey] = useState(false);

  const mutation = useMutation({ mutationFn: validateArqc, onSuccess: setResult });
  const error = (mutation.error as Error | undefined)?.message;
  // Any edit dismisses the "loaded from Parser" hint — the user knows the values
  // are now their own. The 5s auto-clear below handles the case of zero edits.
  const set = <K extends keyof ValidateArqcRequest>(k: K, v: ValidateArqcRequest[K]) => {
    if (loadedFromParser) acknowledgeLoadedFromParser();
    setInput({ [k]: v } as Partial<ValidateArqcRequest>);
  };

  useEffect(() => {
    if (!loadedFromParser) return;
    const timer = setTimeout(() => acknowledgeLoadedFromParser(), 5000);
    return () => clearTimeout(timer);
  }, [loadedFromParser, acknowledgeLoadedFromParser]);

  return (
    <div className="space-y-6">
      {loadedFromParser && (
        <div className="rounded-md border border-accent/40 bg-accent-bg/40 px-3 py-2 flex items-center gap-2 text-xs text-accent-text">
          <Info size={14} />
          <span>{t("emv.loadedFromParser")}</span>
        </div>
      )}
      <Card>
        <CardHeader>
          <span className="text-sm font-semibold">{t("emv.validateArqc")}</span>
        </CardHeader>
        <CardBody className="space-y-3">
          <div>
            <Label>{t("emv.hexBit55")}</Label>
            <textarea
              value={form.hexBit55}
              onChange={(e) => set("hexBit55", e.target.value)}
              placeholder="9F2608A1B2C3D4E5F60708..."
              className="w-full min-h-[80px] p-3 rounded-md bg-bg-input border border-[var(--border)] font-mono text-[12px] resize-y focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              spellCheck={false}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Issuer Master Key (32 hex)</Label>
              <div className="flex gap-2">
                <Input
                  type={revealKey ? "text" : "password"}
                  className="font-mono"
                  value={form.issuerMasterKey}
                  onChange={(e) => set("issuerMasterKey", e.target.value.toUpperCase())}
                  maxLength={32}
                />
                <Button variant="secondary" size="sm" onClick={() => setRevealKey((v) => !v)}>
                  {revealKey ? "Hide" : "Show"}
                </Button>
              </div>
            </div>
            <div>
              <Label>PAN</Label>
              <Input className="font-mono" value={form.pan} onChange={(e) => set("pan", e.target.value)} />
            </div>
            <div>
              <Label>PAN Sequence Number</Label>
              <Input className="font-mono" value={form.panSequenceNumber} onChange={(e) => set("panSequenceNumber", e.target.value)} maxLength={2} />
            </div>
            <div>
              <Label>Profile</Label>
              <Select value={form.profile} onChange={(e) => set("profile", e.target.value)}>
                {PROFILES.map((p) => <option key={p}>{p}</option>)}
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => mutation.mutate(form)} disabled={!form.hexBit55.trim() || mutation.isPending}>
              {mutation.isPending ? t("common.loading") : `${t("emv.validateArqc")} →`}
            </Button>
            <Button variant="secondary" onClick={() => clearTab("validate")}>
              <RotateCcw size={13} /> {t("common.clear")}
            </Button>
          </div>
          {error && <ErrorBanner message={error} />}
        </CardBody>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className={clsx("flex items-center gap-3 text-base font-semibold",
              result.isValid ? "text-success-text" : "text-danger-text")}>
              {result.isValid ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
              {result.isValid ? "ARQC válido" : "ARQC inválido"}
            </div>
          </CardHeader>
          <CardBody className="space-y-1">
            <ResultRow label="Calculated ARQC" value={result.calculatedArqc} />
            <ResultRow label="Received ARQC" value={result.receivedArqc} />
            <ResultRow label="Session Key" value={result.sessionKey} />
            <ResultRow label="Profile" value={result.profile} />
            <div className="pt-3">
              <TagsTable tags={result.tags} />
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
