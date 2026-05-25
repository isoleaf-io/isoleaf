import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { MonoText } from "@/components/ui/MonoText";

interface Props {
  bit: number;
  name: string;
  /** Full value — shown when revealed, copied by the copy button. */
  value: string;
  /** Pre-masked rendering from the server — shown by default for sensitive bits. */
  displayValue?: string;
}

const SENSITIVE_BITS = new Set([2, 14, 35, 45, 52]);

export function FieldRow({ bit, name, value, displayValue }: Props) {
  const isSensitive = SENSITIVE_BITS.has(bit);
  const [revealed, setRevealed] = useState(false);
  // Sensitive bits start masked; "Reveal" toggles to the raw value.
  // Non-sensitive bits always show the value (server still echoes it as displayValue).
  const display = isSensitive && !revealed && displayValue ? displayValue : value;

  return (
    <tr className="group hover:bg-bg-tertiary/40 transition-colors">
      <td className="py-2.5 px-4 text-text-tertiary font-mono text-xs w-12">{bit}</td>
      <td className="py-2.5 px-4 text-sm">{name}</td>
      <td className="py-2.5 px-4">
        <div className="flex items-center gap-2">
          <MonoText className="flex-1 text-text-primary">{display}</MonoText>
          {isSensitive && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="p-1 rounded text-text-tertiary hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity"
              title={revealed ? "Hide" : "Reveal"}
            >
              {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
            <CopyButton value={value} />
          </span>
        </div>
      </td>
    </tr>
  );
}
