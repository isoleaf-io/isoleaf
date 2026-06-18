import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Label } from "@/components/ui/Field";
import { CopyButton } from "@/components/ui/CopyButton";
import { MonoText } from "@/components/ui/MonoText";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { parseBit55 } from "@/api/emv";
import { useEmvStore } from "@/store/emv";
import { TagsTable } from "./TagsTable";

const cryptogramTone: Record<string, "accent" | "success" | "warning"> = {
  ARQC: "accent",
  TC: "success",
  AAC: "warning",
};

export function ParseBit55Tab() {
  const { t } = useTranslation();
  const hex = useEmvStore((s) => s.parseBit55Input);
  const header = useEmvStore((s) => s.parseBit55HeaderBytes);
  const parsed = useEmvStore((s) => s.parseBit55Result);
  const setHex = useEmvStore((s) => s.setParseBit55Input);
  const setHeader = useEmvStore((s) => s.setParseBit55HeaderBytes);
  const setParsed = useEmvStore((s) => s.setParseBit55Result);
  const clearTab = useEmvStore((s) => s.clearTab);

  const mutation = useMutation({
    mutationFn: ({ hex, header }: { hex: string; header: number }) => parseBit55(hex, header),
    onSuccess: setParsed,
  });
  const error = (mutation.error as Error | undefined)?.message;

  // Editing the hex or header clears any stuck mutation state. Without this,
  // a hung request (e.g. agent unreachable) or a prior error left the Parsear
  // button disabled and forced the user to click Limpar to recover — losing
  // the bit55 content they were trying to fix.
  const handleHexChange = (v: string) => {
    setHex(v);
    if (mutation.isPending || mutation.isError) mutation.reset();
  };
  const handleHeaderChange = (v: number) => {
    setHeader(v);
    if (mutation.isPending || mutation.isError) mutation.reset();
  };

  const [warningsOpen, setWarningsOpen] = useState(false);

  // Auto-parse on mount when there's persisted input but no result yet
  // (e.g. just arrived from Parser via loadFromParser).
  const autoFired = useRef(false);
  useEffect(() => {
    if (autoFired.current) return;
    if (hex.trim() && !parsed) {
      autoFired.current = true;
      mutation.mutate({ hex, header });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showPartial = parsed && parsed.isComplete === false;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <span className="text-sm font-semibold">{t("emv.hexBit55")}</span>
        </CardHeader>
        <CardBody className="space-y-3">
          <textarea
            value={hex}
            onChange={(e) => handleHexChange(e.target.value)}
            placeholder="9F2608A1B2C3D4E5F60708..."
            className="w-full min-h-[100px] p-3 rounded-md bg-bg-input border border-[var(--border)] font-mono text-[12px] resize-y focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            spellCheck={false}
          />

          <div>
            <Label>{t("emv.headerLabel")}</Label>
            <div className="flex items-center gap-2">
              {/* Width-constrained wrapper because the shared <Input> hard-codes
                  `w-full` — without this the field expands inside the flex row. */}
              <div className="w-28">
                <Input
                  type="number"
                  min={0}
                  max={16}
                  value={header}
                  onChange={(e) => handleHeaderChange(Number(e.target.value))}
                  placeholder="0"
                  className="font-mono text-center"
                  aria-label={t("emv.headerLabel")}
                />
              </div>
              <span className="text-[11px] text-text-tertiary">{t("emv.headerHint")}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => mutation.mutate({ hex, header })}
              disabled={!hex.trim() || mutation.isPending}
            >
              {mutation.isPending ? t("common.loading") : `${t("common.parse")} →`}
            </Button>
            <Button variant="secondary" onClick={() => clearTab("parse")}>
              <RotateCcw size={13} /> {t("common.clear")}
            </Button>
          </div>
          {error && <ErrorBanner message={error} />}
        </CardBody>
      </Card>

      {showPartial && parsed && (
        <div className="rounded-md border border-warning bg-warning-bg/40 p-3 space-y-1">
          <div className="flex items-center gap-2 text-warning-text text-sm font-medium">
            <AlertTriangle size={14} />
            <span>⚠ {t("emv.partialBanner")} — {parsed.parseError}</span>
          </div>
          <div className="text-xs text-text-secondary">
            {t("emv.parsedOf", { parsed: parsed.parsedBytes, total: parsed.totalBytes })}
          </div>
        </div>
      )}

      {parsed && parsed.tags.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">Tags ({parsed.tags.length})</span>
              {parsed.cryptogramType && (
                <Badge tone={cryptogramTone[parsed.cryptogramType] ?? "neutral"}>
                  {parsed.cryptogramType}
                </Badge>
              )}
              {parsed.atc && <Badge tone="neutral">ATC: {parsed.atc}</Badge>}
              {parsed.headerHex && (
                <Badge tone="neutral" title="Header skipped">
                  Header: <MonoText className="ml-1">{parsed.headerHex}</MonoText>
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardBody>
            <TagsTable tags={parsed.tags} />
          </CardBody>
        </Card>
      )}

      {parsed && parsed.unparsedHex && (
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold">{t("emv.unparsedTitle")}</span>
          </CardHeader>
          <CardBody className="space-y-2">
            <div className="relative">
              <pre className="bg-bg-input border border-[var(--border)] rounded-md py-3 pl-3 pr-10 font-mono text-xs whitespace-pre-wrap break-all max-h-[140px] overflow-auto">
                {parsed.unparsedHex}
              </pre>
              <div className="absolute top-2 right-2">
                <CopyButton value={parsed.unparsedHex} />
              </div>
            </div>
            <div className="text-[11px] text-text-tertiary">{t("emv.unparsedHint")}</div>
          </CardBody>
        </Card>
      )}

      {parsed && parsed.warnings?.length > 0 && (
        <Card>
          <CardHeader>
            <button
              type="button"
              onClick={() => setWarningsOpen((v) => !v)}
              className="flex items-center gap-2 text-sm font-semibold w-full text-left"
            >
              {warningsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {t("emv.warningsTitle")} ({parsed.warnings.length})
            </button>
          </CardHeader>
          {warningsOpen && (
            <CardBody>
              <ul className="text-xs text-text-secondary list-disc pl-5 space-y-1">
                {parsed.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </CardBody>
          )}
        </Card>
      )}

      {parsed && parsed.tags.length === 0 && parsed.isComplete === false && (
        <Card>
          <CardBody className="text-center text-sm text-text-tertiary py-6">
            {t("emv.noTagsHint")}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
