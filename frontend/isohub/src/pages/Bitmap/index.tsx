import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { MonoText } from "@/components/ui/MonoText";
import { getLayoutFields, parseBitmap } from "@/api/parse";
import type { LayoutFieldDefinition } from "@/types";

function bitsToHex(bits: Set<number>) {
  const buf = new Uint8Array(16);
  for (const b of bits) {
    if (b < 1 || b > 128) continue;
    const idx = (b - 1) >> 3;
    const off = 7 - ((b - 1) & 7);
    buf[idx] |= 1 << off;
  }
  const hasSecondary = Array.from(bits).some((b) => b > 64);
  if (hasSecondary) buf[0] |= 0x80;
  const slice = hasSecondary ? buf : buf.slice(0, 8);
  return Array.from(slice)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

const BIT_1: LayoutFieldDefinition = {
  bitNumber: 1,
  name: "Secondary bitmap present",
  type: "Bitmap",
  maxLength: 8,
  encoding: "Binary",
};

const HEX_RE = /^[0-9A-F]*$/;

/** Returns true when normalized hex is exactly 16 or 32 chars and all valid hex. */
function isCompleteBitmap(s: string) {
  return (s.length === 16 || s.length === 32) && HEX_RE.test(s);
}

/** Pure normalization: trim whitespace, uppercase. */
function normalize(input: string) {
  return input.replace(/\s+/g, "").toUpperCase();
}

export default function BitmapPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [active, setActive] = useState<Set<number>>(new Set());
  /** Text shown in the input. Diverges from bitsToHex(active) only while the user is typing. */
  const [hexInput, setHexInput] = useState("");
  /** Tracks the source of the last update so we know whether to sync input ↔ active. */
  const lastSourceRef = useRef<"input" | "list" | null>(null);
  const hydrated = useRef(false);

  // Layout fields cached for the session.
  const layoutQuery = useQuery({
    queryKey: ["layout-fields", "default"],
    queryFn: () => getLayoutFields("default"),
    staleTime: Infinity,
  });

  const allFields = useMemo<LayoutFieldDefinition[]>(() => {
    const layout = layoutQuery.data ?? [];
    return [BIT_1, ...layout].slice().sort((a, b) => a.bitNumber - b.bitNumber);
  }, [layoutQuery.data]);

  // Decode mutation — fired after debounce on a complete hex string, or immediately on paste.
  const decodeMut = useMutation({
    mutationFn: (h: string) => parseBitmap(h),
    onSuccess: (data) => {
      setActive(new Set(data.activeBits));
    },
  });

  // Hydrate from navigation state (e.g. "Abrir no Bitmap" from Parser).
  useEffect(() => {
    if (hydrated.current) return;
    const hex = (location.state as { hexBitmap?: string } | null)?.hexBitmap;
    if (!hex) return;
    hydrated.current = true;
    const norm = hex.replace(/\s+/g, "").toUpperCase();
    if (norm.length === 16 || norm.length === 32) {
      lastSourceRef.current = "input";
      setHexInput(norm);
      decodeMut.mutate(norm);
    }
    window.history.replaceState({}, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // ── Click on a bit row → recompute hex from `active` and surface it in the input.
  const toggle = (b: number) => {
    const next = new Set(active);
    if (next.has(b)) next.delete(b);
    else next.add(b);
    lastSourceRef.current = "list";
    setActive(next);
    setHexInput(bitsToHex(next));
  };

  // ── Whenever `active` changes from a list click, the input is already synced above.
  //    When `active` changes from a successful decode, we also sync the input to the
  //    *normalized* representation (mirrors what the user pasted, but uppercased/trimmed).
  useEffect(() => {
    if (lastSourceRef.current === "input" && decodeMut.isSuccess) {
      // Keep the user's normalized text — already set on paste/type.
    }
  }, [decodeMut.isSuccess]);

  // ── Debounced decode when user types a complete hex.
  useEffect(() => {
    if (lastSourceRef.current !== "input") return;
    const norm = hexInput;
    if (!isCompleteBitmap(norm)) return;
    const h = setTimeout(() => decodeMut.mutate(norm), 400);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hexInput]);

  const onInputChange = (raw: string) => {
    const norm = normalize(raw);
    lastSourceRef.current = "input";
    setHexInput(norm);
    // If the user wiped the input, also clear active so the list reflects state.
    if (norm.length === 0) setActive(new Set());
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    const norm = normalize(pasted);
    if (isCompleteBitmap(norm)) {
      e.preventDefault();
      lastSourceRef.current = "input";
      setHexInput(norm);
      // Decode immediately on a complete paste — feels instant.
      decodeMut.mutate(norm);
    }
  };

  const onClear = () => {
    lastSourceRef.current = "list";
    setActive(new Set());
    setHexInput("");
  };

  const onUseInBuilder = () => {
    // Pass the selected bits as navigation state.
    // The Builder reconciles vs its current state:
    //   empty Builder  → seed empty editable rows for each selected bit
    //   populated      → add missing bits + drop extras, preserve common bits' values
    const bits = Array.from(active).sort((a, b) => a - b);
    navigate("/builder", { state: { fromBitmap: { bits } } });
  };

  const hexValid =
    hexInput.length === 0 ||
    isCompleteBitmap(hexInput) ||
    // Allow partial valid hex while user is still typing — no error border yet.
    (hexInput.length < 32 && HEX_RE.test(hexInput));

  const showInvalidHint = hexInput.length > 0 && !isCompleteBitmap(hexInput) && !HEX_RE.test(hexInput);

  const half = Math.ceil(allFields.length / 2);
  const left = allFields.slice(0, half);
  const right = allFields.slice(half);

  const renderRow = (f: LayoutFieldDefinition) => {
    const on = active.has(f.bitNumber);
    return (
      <button
        key={f.bitNumber}
        type="button"
        onClick={() => toggle(f.bitNumber)}
        className={clsx(
          "w-full flex items-center gap-2.5 px-3 py-1.5 text-left rounded transition-colors",
          on ? "bg-accent-bg text-text-primary" : "hover:bg-bg-tertiary text-text-secondary"
        )}
      >
        <MonoText className={clsx("w-16 shrink-0 text-xs whitespace-nowrap", on ? "text-accent-text" : "text-text-tertiary")}>
          Bit {f.bitNumber}
        </MonoText>
        <span className={clsx("flex-1 text-sm truncate", on && "font-medium")}>{f.name}</span>
        <span
          className={clsx(
            "inline-block w-3 h-3 rounded-full shrink-0 border",
            on ? "bg-accent border-accent" : "bg-bg-input border-[var(--border)]"
          )}
        />
        {on && <span className="text-[11px] text-accent-text w-3">✕</span>}
      </button>
    );
  };

  const activeList = Array.from(active).sort((a, b) => a - b);

  return (
    <AppShell title={t("bitmap.title")} subtitle={t("bitmap.subtitle")}>
      <Card>
        <CardHeader>
          <div className="space-y-3">
            <div className="relative">
              <input
                value={hexInput}
                onChange={(e) => onInputChange(e.target.value)}
                onPaste={onPaste}
                placeholder={t("bitmap.hexPlaceholder")}
                spellCheck={false}
                maxLength={32}
                className={clsx(
                  "w-full h-11 pl-3 pr-12 text-base font-mono rounded-md bg-bg-input border focus:outline-none focus:ring-2 focus:ring-accent/50 transition-colors",
                  showInvalidHint
                    ? "border-danger text-danger-text"
                    : "border-[var(--border)] focus:border-accent"
                )}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <CopyButton value={hexInput} />
              </div>
            </div>
            {showInvalidHint && (
              <div className="text-xs text-danger-text">
                {t("bitmap.invalidHint")}
              </div>
            )}
            <div className="flex items-center justify-between gap-3 flex-wrap text-xs">
              <div className="text-text-secondary">
                {activeList.length === 0 ? (
                  <span className="text-text-tertiary">{t("bitmap.noActiveBits")}</span>
                ) : (
                  <>
                    <span className="text-text-tertiary">{t("bitmap.activeBits")}: </span>
                    <MonoText>{activeList.join(", ")}</MonoText>
                    <span className="text-text-tertiary"> · {activeList.length} {t("bitmap.activeBitsSuffix")}</span>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={onClear} disabled={hexInput === "" && active.size === 0}>
                  {t("common.clear")}
                </Button>
                <Button size="sm" onClick={onUseInBuilder} disabled={active.size === 0}>
                  <ArrowRight size={13} /> {t("bitmap.useInBuilder")}
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
            <div className="space-y-0.5">{left.map(renderRow)}</div>
            <div className="space-y-0.5">{right.map(renderRow)}</div>
          </div>
        </CardBody>
      </Card>
    </AppShell>
  );
}
