import { CopyButton } from "@/components/ui/CopyButton";
import { MonoText } from "@/components/ui/MonoText";

interface Props {
  label: string;
  value?: string | null;
  hint?: string;
}

/** Compact label + monospace value + copy button — used across EMV result cards. */
export function ResultRow({ label, value, hint }: Props) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="text-xs uppercase tracking-wider text-text-tertiary w-32 pt-1 shrink-0">
        {label}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <MonoText className="flex-1 text-text-primary break-all">{value}</MonoText>
          <CopyButton value={value} />
        </div>
        {hint && <div className="text-[11px] text-text-tertiary mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}
