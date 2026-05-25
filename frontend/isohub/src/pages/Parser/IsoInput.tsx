import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onParse: () => void;
  onClear: () => void;
  loading?: boolean;
  tpduDetected?: boolean;
}

export function IsoInput({ value, onChange, onParse, onClear, loading, tpduDetected }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLTextAreaElement>(null);
  const onParseRef = useRef(onParse);
  onParseRef.current = onParse;
  const [pasteHint, setPasteHint] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && document.activeElement === ref.current) {
        e.preventDefault();
        onParseRef.current();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const onPaste = () => {
    setPasteHint(true);
    setTimeout(() => {
      setPasteHint(false);
      onParseRef.current();
    }, 300);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-text-secondary">
          {t("parser.inputLabel")}
        </label>
        <div className="flex gap-2">
          <Badge tone="accent">{t("parser.autoDetect")} ✓</Badge>
          {tpduDetected && <Badge tone="warning">{t("parser.tpduDetected")}</Badge>}
          {pasteHint && <Badge tone="neutral">{t("common.loading")}</Badge>}
        </div>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPaste}
        placeholder={t("parser.inputPlaceholder")}
        className="w-full min-h-[140px] p-3 rounded-md bg-bg-input border border-[var(--border)] font-mono text-[13px] text-text-primary leading-snug resize-y focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
        spellCheck={false}
      />
      <div className="flex gap-2">
        <Button onClick={onParse} disabled={!value.trim() || loading}>
          {loading ? t("common.loading") : `${t("common.parse")} →`}
        </Button>
        <Button variant="secondary" onClick={onClear} disabled={!value}>
          {t("common.clear")}
        </Button>
      </div>
    </div>
  );
}
