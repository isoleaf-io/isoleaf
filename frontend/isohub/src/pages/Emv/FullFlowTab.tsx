import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronRight, RotateCcw, XCircle, Zap } from "lucide-react";
import clsx from "clsx";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { CopyButton } from "@/components/ui/CopyButton";
import { MonoText } from "@/components/ui/MonoText";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { fullFlow } from "@/api/emv";
import { useEmvStore } from "@/store/emv";
import type { FullFlowRequest } from "@/types";
import { TagsTable } from "./TagsTable";
import { ResultRow } from "./ResultRow";

const PROFILES = ["Visa", "Mastercard", "Elo"];

function StepHeader({ n, title, color }: { n: number; title: string; color?: "accent" | "success" | "danger" | "warning" }) {
  const tone = color ?? "accent";
  const cls = {
    accent: "bg-accent text-white",
    success: "bg-success text-white",
    danger: "bg-danger text-white",
    warning: "bg-warning text-white",
  }[tone];
  return (
    <div className="flex items-center gap-2">
      <span className={clsx("w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center", cls)}>
        {n}
      </span>
      <span className="text-sm font-semibold">{title}</span>
    </div>
  );
}

export function FullFlowTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const form = useEmvStore((s) => s.fullFlowInput) as FullFlowRequest;
  const result = useEmvStore((s) => s.fullFlowResult);
  const setInput = useEmvStore((s) => s.setFullFlowInput);
  const setResult = useEmvStore((s) => s.setFullFlowResult);
  const clearTab = useEmvStore((s) => s.clearTab);

  const mutation = useMutation({ mutationFn: fullFlow, onSuccess: setResult });
  const error = (mutation.error as Error | undefined)?.message;
  const set = <K extends keyof FullFlowRequest>(k: K, v: FullFlowRequest[K]) =>
    setInput({ [k]: v } as Partial<FullFlowRequest>);

  return (
    <div className="space-y-6">
      {/* ── Step 1 — Input ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <StepHeader n={1} title="Input" />
        </CardHeader>
        <CardBody className="space-y-3">
          <div>
            <Label>Bit 55 from request (0200 / 0100)</Label>
            <textarea
              value={form.hexBit55Request}
              onChange={(e) => set("hexBit55Request", e.target.value)}
              placeholder="9F2608A1B2C3D4E5F60708..."
              className="w-full min-h-[100px] p-3 rounded-md bg-bg-input border border-[var(--border)] font-mono text-[12px] resize-y focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              spellCheck={false}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Issuer Master Key</Label>
              <Input className="font-mono" value={form.issuerMasterKey} maxLength={32}
                onChange={(e) => set("issuerMasterKey", e.target.value.toUpperCase())} />
            </div>
            <div>
              <Label>Auth Response Code</Label>
              <Input className="font-mono" value={form.authResponseCode} maxLength={4}
                onChange={(e) => set("authResponseCode", e.target.value)} />
            </div>
            <div>
              <Label>PAN</Label>
              <Input className="font-mono" value={form.pan} onChange={(e) => set("pan", e.target.value)} />
            </div>
            <div>
              <Label>PAN Sequence Number</Label>
              <Input className="font-mono" value={form.panSequenceNumber} maxLength={2}
                onChange={(e) => set("panSequenceNumber", e.target.value)} />
            </div>
            <div>
              <Label>Profile</Label>
              <Select value={form.profile} onChange={(e) => set("profile", e.target.value)}>
                {PROFILES.map((p) => <option key={p}>{p}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <Label>Issuer Script 72 (optional)</Label>
            <textarea
              value={form.issuerScript72 ?? ""}
              onChange={(e) => set("issuerScript72", e.target.value || null)}
              className="w-full min-h-[60px] p-3 rounded-md bg-bg-input border border-[var(--border)] font-mono text-[12px] resize-y focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              spellCheck={false}
            />
          </div>
          <div className="flex gap-2">
            <Button size="md" onClick={() => mutation.mutate(form)}
              disabled={!form.hexBit55Request.trim() || mutation.isPending}>
              <Zap size={14} />
              {mutation.isPending ? t("common.loading") : "Run Full EMV Flow →"}
            </Button>
            <Button variant="secondary" onClick={() => clearTab("full-flow")}>
              <RotateCcw size={13} /> {t("common.clear")}
            </Button>
          </div>
          {error && <ErrorBanner message={error} />}
        </CardBody>
      </Card>

      {/* ── Step 2 — Results ─────────────────────────────────── */}
      {result && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <StepHeader
                n={2}
                title="ARQC Validation"
                color={result.arqcValidation.isValid ? "success" : "danger"}
              />
            </CardHeader>
            <CardBody>
              <div className={clsx("flex items-center gap-2 mb-3 text-sm font-semibold",
                result.arqcValidation.isValid ? "text-success-text" : "text-danger-text")}>
                {result.arqcValidation.isValid
                  ? <><CheckCircle2 size={18} /> ARQC válido</>
                  : <><XCircle size={18} /> ARQC inválido</>}
              </div>
              <ResultRow label="Calculated" value={result.arqcValidation.calculatedArqc} />
              <ResultRow label="Received" value={result.arqcValidation.receivedArqc} />
              <ResultRow label="Session Key" value={result.arqcValidation.sessionKey} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <StepHeader n={3} title="ARPC Generated" color="success" />
            </CardHeader>
            <CardBody>
              <ResultRow label="ARPC" value={result.arpc} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <StepHeader n={4} title="Response Bit 55" color="success" />
                <Button variant="secondary" size="sm"
                  onClick={() => navigate("/parser", { state: { autoMessage: result.hexBit55Response } })}>
                  <ChevronRight size={14} /> Open in Parser
                </Button>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="flex items-start gap-2 p-3 rounded-md bg-bg-input border border-[var(--border)]">
                <MonoText className="flex-1 text-text-mono break-all">{result.hexBit55Response}</MonoText>
                <CopyButton value={result.hexBit55Response} />
              </div>
              <TagsTable tags={result.responseTags} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <StepHeader n={5} title="Flow Summary" color="accent" />
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge tone={result.arqcValidation.isValid ? "success" : "danger"}>
                  {result.arqcValidation.isValid ? "OK" : "FAIL"}
                </Badge>
                <span className="text-sm text-text-secondary">{result.flowSummary}</span>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
