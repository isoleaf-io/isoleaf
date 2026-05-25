import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { CreditCard, Eye, EyeOff } from "lucide-react";
import clsx from "clsx";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { CopyButton } from "@/components/ui/CopyButton";
import { MonoText } from "@/components/ui/MonoText";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { generateCard } from "@/api/cards";
import type { VirtualCard } from "@/types";

const BRANDS = ["Visa", "Mastercard", "Elo", "Amex", "Hipercard"];

const NAME_MAX_LEN = 26;
const NAME_ALLOWED = /^[A-Z /]*$/;

/** Normalises typed characters into the ISO-7813 track-1 alphabet:
 *  uppercase A-Z, space, slash. Anything else is dropped silently and
 *  the result is capped at 26 chars. */
function sanitizeName(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z /]/g, "")
    .slice(0, NAME_MAX_LEN);
}

/** Validates an expiry typed as YYMM (no separator).
 *  Returns a translation key for the error, or null when valid (or empty). */
function validateExpiry(raw: string): string | null {
  if (!raw) return null; // optional field
  if (!/^\d{4}$/.test(raw)) return "cards.expiryInvalidFormat";

  const yy = parseInt(raw.slice(0, 2), 10);
  const mm = parseInt(raw.slice(2, 4), 10);
  if (mm < 1 || mm > 12) return "cards.expiryInvalidMonth";

  // YY → 4-digit year using the same 2000-window the rest of the app uses.
  const fullYear = 2000 + yy;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  // Past month → expired
  if (fullYear < currentYear || (fullYear === currentYear && mm < currentMonth))
    return "cards.expiryPast";

  // More than 10 years out — unrealistic for test data
  if (fullYear > currentYear + 10) return "cards.expiryTooFar";

  return null;
}

const BRAND_GRADIENTS: Record<string, string> = {
  Visa: "from-blue-700 to-blue-500",
  Mastercard: "from-red-600 to-orange-500",
  Elo: "from-yellow-500 to-stone-900",
  Amex: "from-emerald-700 to-emerald-500",
  Hipercard: "from-rose-700 to-rose-500",
};

export default function CardsPage() {
  const { t } = useTranslation();
  const [brand, setBrand] = useState("Visa");
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [card, setCard] = useState<VirtualCard | null>(null);
  const [revealed, setRevealed] = useState(false);

  // Validation surfaces only after the user has interacted with the field,
  // so the empty initial state doesn't immediately scream errors.
  const [nameTouched, setNameTouched] = useState(false);
  const [expiryTouched, setExpiryTouched] = useState(false);

  // Name passes a single-shot sanitizer at onChange (uppercase + filter),
  // so the only way to land in an invalid state would be paste of disallowed
  // chars — which the sanitizer also strips. Length cap is enforced by maxLength.
  const nameInvalid = name.length > 0 && !NAME_ALLOWED.test(name);
  const expiryErrorKey = validateExpiry(expiry);

  const showNameError = nameTouched && nameInvalid;
  const showExpiryError = expiryTouched && expiryErrorKey !== null;
  const formInvalid = nameInvalid || expiryErrorKey !== null;

  const mutation = useMutation({
    mutationFn: () => generateCard(brand, name || undefined, expiry || undefined),
    onSuccess: setCard,
  });

  const error = (mutation.error as Error | undefined)?.message;

  return (
    <AppShell title={t("cards.title")} subtitle={t("cards.subtitle")}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold">{t("cards.generateCard")}</span>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <Label>{t("cards.brand")}</Label>
              <Select value={brand} onChange={(e) => setBrand(e.target.value)}>
                {BRANDS.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </Select>
            </div>
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <Label className="mb-0">{t("cards.cardholderName")}</Label>
                <span className={clsx(
                  "text-[11px] font-mono",
                  showNameError ? "text-danger-text" : "text-text-tertiary"
                )}>
                  {name.length}/{NAME_MAX_LEN}
                </span>
              </div>
              <Input
                value={name}
                onChange={(e) => setName(sanitizeName(e.target.value))}
                onBlur={() => setNameTouched(true)}
                placeholder="SILVA/JOAO"
                maxLength={NAME_MAX_LEN}
                className={clsx(
                  "font-mono",
                  showNameError && "border-danger focus:ring-danger/30"
                )}
              />
              {showNameError && (
                <div className="text-[11px] text-danger-text mt-1">
                  {t("cards.nameInvalid")}
                </div>
              )}
            </div>
            <div>
              <Label>{t("cards.expiry")}</Label>
              <Input
                value={expiry}
                onChange={(e) => setExpiry(e.target.value.replace(/\D/g, "").slice(0, 4))}
                onBlur={() => setExpiryTouched(true)}
                placeholder="2812"
                maxLength={4}
                inputMode="numeric"
                className={clsx(
                  "font-mono",
                  showExpiryError && "border-danger focus:ring-danger/30"
                )}
              />
              {showExpiryError && expiryErrorKey && (
                <div className="text-[11px] text-danger-text mt-1">
                  {t(expiryErrorKey)}
                </div>
              )}
            </div>
            <Button
              onClick={() => {
                // Force touched flags before submit so any unseen error surfaces.
                setNameTouched(true);
                setExpiryTouched(true);
                if (!formInvalid) mutation.mutate();
              }}
              disabled={mutation.isPending || formInvalid}
            >
              {mutation.isPending ? t("common.loading") : t("cards.generateCard")}
            </Button>
            {error && <ErrorBanner message={error} />}
          </CardBody>
        </Card>

        <div className="space-y-4">
          {card && (
            <>
              <div
                className={`relative aspect-[1.586/1] rounded-2xl bg-gradient-to-br ${BRAND_GRADIENTS[card.brand] ?? "from-slate-700 to-slate-500"} text-white p-6 shadow-xl`}
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-9 rounded-md bg-yellow-300/40 backdrop-blur" />
                  <span className="font-bold text-lg">{card.brand}</span>
                </div>
                <div className="absolute bottom-6 left-6 right-6">
                  <button
                    onClick={() => setRevealed(!revealed)}
                    className="font-mono text-lg tracking-widest mb-3 cursor-pointer"
                  >
                    {revealed ? card.pan.replace(/(.{4})/g, "$1 ").trim() : card.panMasked}
                  </button>
                  <div className="flex justify-between text-xs uppercase opacity-90">
                    <span>{card.cardholderName}</span>
                    <span>{card.expiryFormatted}</span>
                  </div>
                </div>
              </div>

              <Card>
                <CardBody className="space-y-3">
                  <Row label={t("cards.pan")} value={revealed ? card.pan : card.panMasked} icon={
                    <button onClick={() => setRevealed(!revealed)} className="text-text-tertiary hover:text-text-primary">
                      {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  } copy={card.pan}/>
                  <Row label={t("cards.cvv")} value={card.cvv} copy={card.cvv} />
                  <Row label={t("cards.track1")} value={card.track1} copy={card.track1} small />
                  <Row label={t("cards.track2")} value={card.track2} copy={card.track2} small />
                </CardBody>
              </Card>
            </>
          )}
          {!card && (
            <Card>
              <CardBody className="text-center py-12 space-y-2">
                <CreditCard size={36} className="mx-auto text-text-tertiary opacity-60" />
                <div className="text-sm text-text-secondary">
                  {t("cards.placeholderTitle")}
                </div>
                <div className="text-xs text-text-tertiary">
                  {t("cards.placeholderSubtitle")}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Row({
  label,
  value,
  copy,
  icon,
  small,
}: {
  label: string;
  value: string;
  copy: string;
  icon?: React.ReactNode;
  small?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs uppercase tracking-wider text-text-tertiary w-20">{label}</span>
      <MonoText className={small ? "flex-1 text-[11px] truncate" : "flex-1"}>{value}</MonoText>
      {icon}
      <CopyButton value={copy} />
    </div>
  );
}
