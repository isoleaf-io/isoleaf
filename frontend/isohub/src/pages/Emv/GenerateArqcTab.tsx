import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Copy, RotateCcw } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { generateArqc } from "@/api/emv";
import { useEmvStore } from "@/store/emv";
import type { ArqcInput } from "@/types";
import { ResultRow } from "./ResultRow";

const PROFILES = ["Visa", "Mastercard", "Elo"];

export function GenerateArqcTab() {
  const { t } = useTranslation();
  const form = useEmvStore((s) => s.generateArqcInput) as ArqcInput;
  const result = useEmvStore((s) => s.generateArqcResult);
  const setInput = useEmvStore((s) => s.setGenerateArqcInput);
  const setResult = useEmvStore((s) => s.setGenerateArqcResult);
  const clearTab = useEmvStore((s) => s.clearTab);

  const mutation = useMutation({ mutationFn: generateArqc, onSuccess: setResult });
  const error = (mutation.error as Error | undefined)?.message;
  const set = <K extends keyof ArqcInput>(k: K, v: ArqcInput[K]) =>
    setInput({ [k]: v } as Partial<ArqcInput>);

  const copyAsTlv = async () => {
    if (!result?.arqc) return;
    // Tag 9F26, length 08, value = 16 hex chars
    const tlv = `9F2608${result.arqc}`;
    try { await navigator.clipboard.writeText(tlv); } catch { /* ignore */ }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <span className="text-sm font-semibold">Generate ARQC</span>
        </CardHeader>
        <CardBody className="space-y-5">
          <section>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-text-tertiary mb-2">
              Card Data
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Issuer / ICC Master Key</Label>
                <Input className="font-mono" value={form.issuerMasterKey}
                  onChange={(e) => set("issuerMasterKey", e.target.value.toUpperCase())} maxLength={32} />
              </div>
              <div>
                <Label>PAN</Label>
                <Input className="font-mono" value={form.pan} onChange={(e) => set("pan", e.target.value)} />
              </div>
              <div>
                <Label>PSN</Label>
                <Input className="font-mono" value={form.panSequenceNumber}
                  onChange={(e) => set("panSequenceNumber", e.target.value)} maxLength={2} />
              </div>
            </div>
          </section>

          <section>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-text-tertiary mb-2">
              Transaction Data
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><Label>ATC</Label><Input className="font-mono" value={form.atc} onChange={(e) => set("atc", e.target.value.toUpperCase())} maxLength={4} /></div>
              <div><Label>Amount Authorized</Label><Input className="font-mono" value={form.amountAuthorized} onChange={(e) => set("amountAuthorized", e.target.value)} maxLength={12} /></div>
              <div><Label>Amount Other</Label><Input className="font-mono" value={form.amountOther} onChange={(e) => set("amountOther", e.target.value)} maxLength={12} /></div>
              <div><Label>Terminal Country Code</Label><Input className="font-mono" value={form.terminalCountryCode} onChange={(e) => set("terminalCountryCode", e.target.value)} maxLength={4} /></div>
              <div><Label>TVR</Label><Input className="font-mono" value={form.tvr} onChange={(e) => set("tvr", e.target.value.toUpperCase())} maxLength={10} /></div>
              <div><Label>Currency Code</Label><Input className="font-mono" value={form.currencyCode} onChange={(e) => set("currencyCode", e.target.value)} maxLength={4} /></div>
              <div><Label>Transaction Date (YYMMDD)</Label><Input className="font-mono" value={form.transactionDate} onChange={(e) => set("transactionDate", e.target.value)} maxLength={6} /></div>
              <div><Label>Transaction Type</Label><Input className="font-mono" value={form.transactionType} onChange={(e) => set("transactionType", e.target.value)} maxLength={2} /></div>
              <div><Label>Unpredictable Number</Label><Input className="font-mono" value={form.unpredictableNumber} onChange={(e) => set("unpredictableNumber", e.target.value.toUpperCase())} maxLength={8} /></div>
              <div><Label>AIP</Label><Input className="font-mono" value={form.aip} onChange={(e) => set("aip", e.target.value.toUpperCase())} maxLength={4} /></div>
              <div className="md:col-span-2"><Label>IAD</Label><Input className="font-mono" value={form.iad} onChange={(e) => set("iad", e.target.value.toUpperCase())} /></div>
              <div>
                <Label>Profile</Label>
                <Select value={form.profile} onChange={(e) => set("profile", e.target.value)}>
                  {PROFILES.map((p) => <option key={p}>{p}</option>)}
                </Select>
              </div>
            </div>
          </section>

          <div className="flex gap-2">
            <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending}>
              {mutation.isPending ? t("common.loading") : "Generate ARQC →"}
            </Button>
            <Button variant="secondary" onClick={() => clearTab("gen-arqc")}>
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
              <span className="text-sm font-semibold">ARQC Generated</span>
              <Button variant="secondary" size="sm" onClick={copyAsTlv}>
                <Copy size={14} /> Copy as Bit 55 TLV
              </Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-1">
            <ResultRow label="ARQC" value={result.arqc} hint="8 bytes / 16 hex" />
            <ResultRow label="Session Key" value={result.sessionKey} />
            <ResultRow label="ICC Master Key" value={result.iccMasterKey} hint="derived from issuer MK + PAN/PSN" />
            <ResultRow label="Transaction Data" value={result.transactionData} />
            <ResultRow label="Profile" value={result.profile} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
