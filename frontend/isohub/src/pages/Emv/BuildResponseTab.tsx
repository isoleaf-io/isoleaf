import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { RotateCcw } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { CopyButton } from "@/components/ui/CopyButton";
import { MonoText } from "@/components/ui/MonoText";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { buildBit55Response } from "@/api/emv";
import { useEmvStore } from "@/store/emv";
import type { BuildResponseBit55Request } from "@/types";
import { TagsTable } from "./TagsTable";

export function BuildResponseTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const form = useEmvStore((s) => s.buildResponseInput);
  const result = useEmvStore((s) => s.buildResponseResult);
  const setInput = useEmvStore((s) => s.setBuildResponseInput);
  const setResult = useEmvStore((s) => s.setBuildResponseResult);
  const clearTab = useEmvStore((s) => s.clearTab);

  const mutation = useMutation({ mutationFn: buildBit55Response, onSuccess: setResult });
  const error = (mutation.error as Error | undefined)?.message;
  const set = <K extends keyof BuildResponseBit55Request>(k: K, v: BuildResponseBit55Request[K]) =>
    setInput({ [k]: v } as Partial<BuildResponseBit55Request>);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <span className="text-sm font-semibold">Build Response Bit 55</span>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>ARPC (16 hex chars)</Label>
              <Input className="font-mono" value={form.arpc} maxLength={16}
                onChange={(e) => set("arpc", e.target.value.toUpperCase())} placeholder="A1B2C3D4E5F60712" />
            </div>
            <div>
              <Label>Auth Response Code</Label>
              <Input className="font-mono" value={form.authResponseCode} maxLength={4}
                onChange={(e) => set("authResponseCode", e.target.value)} placeholder="3030" />
            </div>
            <div className="md:col-span-2">
              <Label>Issuer Auth Code (optional)</Label>
              <Input className="font-mono" value={form.issuerAuthCode ?? ""}
                onChange={(e) => set("issuerAuthCode", e.target.value || null)} placeholder="optional" />
            </div>
          </div>
          <div>
            <Label>Issuer Script 71 (hex, optional)</Label>
            <textarea
              value={form.issuerScript71 ?? ""}
              onChange={(e) => set("issuerScript71", e.target.value || null)}
              className="w-full min-h-[60px] p-3 rounded-md bg-bg-input border border-[var(--border)] font-mono text-[12px] resize-y focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              spellCheck={false}
            />
          </div>
          <div>
            <Label>Issuer Script 72 (hex, optional)</Label>
            <textarea
              value={form.issuerScript72 ?? ""}
              onChange={(e) => set("issuerScript72", e.target.value || null)}
              className="w-full min-h-[60px] p-3 rounded-md bg-bg-input border border-[var(--border)] font-mono text-[12px] resize-y focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              spellCheck={false}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => mutation.mutate(form)} disabled={!form.arpc.trim() || mutation.isPending}>
              {mutation.isPending ? t("common.loading") : "Build Response â†’"}
            </Button>
            <Button variant="secondary" onClick={() => clearTab("build")}>
              <RotateCcw size={13} /> {t("common.clear")}
            </Button>
          </div>
          {error && <ErrorBanner message={error} />}
        </CardBody>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Bit 55 Response Built</span>
              <Button variant="secondary" size="sm"
                onClick={() => navigate("/parser", { state: { autoMessage: result.hexBit55 } })}>
                Open in Parser â†’
              </Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-md bg-bg-input border border-[var(--border)]">
              <MonoText className="flex-1 text-text-mono break-all">{result.hexBit55}</MonoText>
              <CopyButton value={result.hexBit55} />
            </div>
            <TagsTable tags={result.tags} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
