import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { generateArpc } from "@/api/emv";
import { useEmvStore } from "@/store/emv";
import type { ArpcInput } from "@/types";
import { ResultRow } from "./ResultRow";

const PROFILES = ["Visa", "Mastercard", "Elo"];
const METHODS: ArpcInput["method"][] = ["Method1", "Method2"];

export function GenerateArpcTab() {
  const { t } = useTranslation();
  const form = useEmvStore((s) => s.generateArpcInput) as ArpcInput;
  const result = useEmvStore((s) => s.generateArpcResult);
  const setInput = useEmvStore((s) => s.setGenerateArpcInput);
  const setResult = useEmvStore((s) => s.setGenerateArpcResult);
  const clearTab = useEmvStore((s) => s.clearTab);

  const mutation = useMutation({ mutationFn: generateArpc, onSuccess: setResult });
  const error = (mutation.error as Error | undefined)?.message;
  const set = <K extends keyof ArpcInput>(k: K, v: ArpcInput[K]) =>
    setInput({ [k]: v } as Partial<ArpcInput>);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <span className="text-sm font-semibold">Generate ARPC</span>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>ARQC (16 hex chars)</Label>
              <Input className="font-mono" value={form.arqc} maxLength={16}
                onChange={(e) => set("arqc", e.target.value.toUpperCase())}
                placeholder="A1B2C3D4E5F60712" />
            </div>
            <div>
              <Label>ICC / Issuer Master Key</Label>
              <Input className="font-mono" value={form.issuerMasterKey} maxLength={32}
                onChange={(e) => set("issuerMasterKey", e.target.value.toUpperCase())} />
            </div>
            <div>
              <Label>ATC</Label>
              <Input className="font-mono" value={form.atc} maxLength={4}
                onChange={(e) => set("atc", e.target.value.toUpperCase())} />
            </div>
            <div>
              <Label>PAN</Label>
              <Input className="font-mono" value={form.pan} onChange={(e) => set("pan", e.target.value)} />
            </div>
            <div>
              <Label>PSN</Label>
              <Input className="font-mono" value={form.panSequenceNumber} maxLength={2}
                onChange={(e) => set("panSequenceNumber", e.target.value)} />
            </div>
            <div>
              <Label>Auth Response Code</Label>
              <Input className="font-mono" value={form.authResponseCode} maxLength={4}
                onChange={(e) => set("authResponseCode", e.target.value)} placeholder="3030 = approved" />
            </div>
            <div>
              <Label>CSU (Method 2 only)</Label>
              <Input className="font-mono" value={form.csu ?? ""}
                onChange={(e) => set("csu", e.target.value || null)} maxLength={8} placeholder="optional" />
            </div>
            <div>
              <Label>Profile</Label>
              <Select value={form.profile} onChange={(e) => set("profile", e.target.value)}>
                {PROFILES.map((p) => <option key={p}>{p}</option>)}
              </Select>
            </div>
            <div>
              <Label>Method</Label>
              <Select value={form.method} onChange={(e) => set("method", e.target.value as ArpcInput["method"])}>
                {METHODS.map((m) => <option key={m}>{m}</option>)}
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => mutation.mutate(form)} disabled={!form.arqc.trim() || mutation.isPending}>
              {mutation.isPending ? t("common.loading") : "Generate ARPC →"}
            </Button>
            <Button variant="secondary" onClick={() => clearTab("gen-arpc")}>
              <RotateCcw size={13} /> {t("common.clear")}
            </Button>
          </div>
          {error && <ErrorBanner message={error} />}
        </CardBody>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold">ARPC Generated</span>
          </CardHeader>
          <CardBody className="space-y-1">
            <ResultRow label="ARPC" value={result.arpc} hint="8 bytes / 16 hex" />
            <ResultRow label="Method" value={result.method} />
            <ResultRow label="Session Key" value={result.sessionKey} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
