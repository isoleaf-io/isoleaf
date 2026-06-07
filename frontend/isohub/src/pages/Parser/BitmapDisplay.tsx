import clsx from "clsx";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { MonoText } from "@/components/ui/MonoText";

interface Props {
  activeBits: number[];
  hasSecondary: boolean;
}

function Grid({ from, activeBits }: { from: number; activeBits: number[] }) {
  const set = new Set(activeBits);
  return (
    <div className="grid grid-cols-16 gap-[3px]" style={{ gridTemplateColumns: "repeat(16, 1fr)" }}>
      {Array.from({ length: 64 }, (_, i) => {
        const bit = from + i;
        const active = set.has(bit);
        return (
          <div
            key={bit}
            title={`Bit ${bit}`}
            className={clsx(
              "aspect-square rounded-[3px] text-[9px] flex items-center justify-center font-mono",
              active ? "bg-accent text-white" : "bg-bg-tertiary text-text-tertiary"
            )}
          >
            {bit}
          </div>
        );
      })}
    </div>
  );
}

/** Computes the 16- or 32-char hex from the active-bit list. */
function bitsToHex(activeBits: number[]): { primary: string; secondary: string | null } {
  const hasSecondary = activeBits.some((b) => b > 64);
  const buf = new Uint8Array(16);
  for (const b of activeBits) {
    if (b < 1 || b > 128) continue;
    const idx = (b - 1) >> 3;
    const off = 7 - ((b - 1) & 7);
    buf[idx] |= 1 << off;
  }
  if (hasSecondary) buf[0] |= 0x80;
  const toHex = (slice: Uint8Array) =>
    Array.from(slice).map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
  return {
    primary: toHex(buf.slice(0, 8)),
    secondary: hasSecondary ? toHex(buf.slice(8, 16)) : null,
  };
}

export function BitmapDisplay({ activeBits, hasSecondary }: Props) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { primary, secondary } = useMemo(() => bitsToHex(activeBits), [activeBits]);
  const display = secondary ? `${primary} ${secondary}` : primary;
  const raw = secondary ? primary + secondary : primary; // no space — used in clipboard + nav

  return (
    <div className="border border-[var(--border)] rounded-md bg-bg-primary">
      {/* Always-visible hex line + actions. */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-[var(--border)]">
        <div className="flex-1 min-w-0 flex items-center gap-2 p-2 rounded-md bg-bg-input border border-[var(--border)]">
          <MonoText className="flex-1 text-text-mono break-all">{display}</MonoText>
          <CopyButton value={raw} />
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate("/bitmap", { state: { hexBitmap: raw } })}
          title="Abre a tela de Bitmap com este valor já decodificado"
        >
          <ExternalLink size={13} /> Abrir no Bitmap
        </Button>
      </div>

      {/* Visual grid (collapsible). */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-bg-tertiary/40 transition-colors"
      >
        <span className="font-medium">
          {open ? t("parser.hideBitmap") : t("parser.showBitmap")}
        </span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open && (
        <div className="p-4 border-t border-[var(--border)] space-y-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-text-tertiary mb-2">
              {t("bitmap.primaryBitmap")}
            </div>
            <Grid from={1} activeBits={activeBits} />
          </div>
          {hasSecondary && (
            <div>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-text-tertiary mb-2">
                {t("bitmap.secondaryBitmap")}
              </div>
              <Grid from={65} activeBits={activeBits} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
