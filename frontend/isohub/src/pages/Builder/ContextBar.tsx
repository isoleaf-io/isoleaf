import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, FolderOpen } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label, Select, Toggle } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import type { BuilderContext } from "@/store/builder";

// Known MTI suggestions, grouped semantically. Group labels are i18n keys —
// the JSX resolves them via t() so EN users don't see "Autorizações".
const MTI_GROUPS: { labelKey: string; mtis: { mti: string; name?: string }[] }[] = [
  { labelKey: "builder.mtiGroups.authorizations", mtis: [
    { mti: "0100", name: "Authorization Request" },
    { mti: "0110", name: "Authorization Response" },
    { mti: "0120", name: "Authorization Advice" },
    { mti: "0121", name: "Authorization Advice Repeat" },
    { mti: "0130", name: "Authorization Advice Response" },
  ]},
  { labelKey: "builder.mtiGroups.financial", mtis: [
    { mti: "0200", name: "Financial Request" },
    { mti: "0210", name: "Financial Response" },
    { mti: "0220", name: "Financial Advice" },
    { mti: "0221", name: "Financial Advice Repeat" },
    { mti: "0230", name: "Financial Advice Response" },
  ]},
  { labelKey: "builder.mtiGroups.reversals", mtis: [
    { mti: "0400", name: "Reversal Request" },
    { mti: "0410", name: "Reversal Response" },
    { mti: "0420", name: "Reversal Advice" },
    { mti: "0421", name: "Reversal Advice Repeat" },
    { mti: "0430", name: "Reversal Advice Response" },
  ]},
  { labelKey: "builder.mtiGroups.administrative", mtis: [
    { mti: "0600" }, { mti: "0610" }, { mti: "0620" }, { mti: "0621" }, { mti: "0630" },
  ]},
  { labelKey: "builder.mtiGroups.networkMgmt", mtis: [
    { mti: "0800", name: "Network Management Request" },
    { mti: "0810", name: "Network Management Response" },
    { mti: "0820" }, { mti: "0821" }, { mti: "0830" },
  ]},
];
const ALL_KNOWN_MTIS = new Set(MTI_GROUPS.flatMap((g) => g.mtis.map((m) => m.mti)));

// Smaller "well-known" set that gates the recent-MTI history feature.
const KNOWN_MTIS_FOR_HISTORY = new Set([
  "0100", "0110", "0120", "0200", "0210", "0220",
  "0400", "0410", "0420", "0800", "0810", "0820",
  "0600", "0610", "0620",
]);
const MTI_HISTORY_KEY = "isohub-mti-history";
const MTI_HISTORY_MAX = 5;

function loadMtiHistory(): string[] {
  try {
    const raw = localStorage.getItem(MTI_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string" && /^\d{4}$/.test(x)) : [];
  } catch {
    return [];
  }
}

function pushMtiHistory(mti: string) {
  if (!/^\d{4}$/.test(mti)) return;
  if (KNOWN_MTIS_FOR_HISTORY.has(mti)) return;
  const history = loadMtiHistory();
  if (history.includes(mti)) return;
  const next = [mti, ...history].slice(0, MTI_HISTORY_MAX);
  try { localStorage.setItem(MTI_HISTORY_KEY, JSON.stringify(next)); } catch { /* ignore quota */ }
}

// Internal enum identifiers — never displayed directly; the JSX maps each to
// an i18n key so labels/hints respect the active language.
const ROLES = ["Adquirente", "Bandeira", "Emissor", "Autorizador"] as const;
const ROLE_HINT_KEYS: Record<string, string> = {
  Adquirente: "builder.roleHints.acquirer",
  Bandeira:   "builder.roleHints.brand",
  Emissor:    "builder.roleHints.issuer",
  Autorizador:"builder.roleHints.authorizer",
};

const BRANDS = ["Auto", "Visa", "Mastercard", "Elo", "Amex", "Hipercard", "Default"];
// Only "Default" has a localized label; all others are proper names that stay as-is.
const BRAND_LABEL_KEY: Record<string, string | undefined> = {
  Default: "builder.brandLabels.default",
};
const BRAND_HINT_KEY: Record<string, string | undefined> = {
  Default: "builder.brandHints.default",
};

const CHANNELS = ["Chip", "Tarja", "Contactless", "CNP", "Presencial", "Fallback"];
const TX_TYPES = ["Credito", "Debito", "Voucher", "Saque", "PreAutorizacao", "Devolucao"];

interface Props {
  context: BuilderContext;
  onChange: (partial: Partial<BuilderContext>) => void;
  onBuild: () => void;
  onClear: () => void;
  onOpenTemplates?: () => void;
  loading?: boolean;
}

function badgesFor(ctx: BuilderContext) {
  // Each entry is either a literal label (channel names like "Chip", "CNP" — these
  // are enum identifiers, not natural-language strings) or an i18n key the caller
  // resolves. Keeps this function pure and locale-agnostic.
  const out: {
    tone: "accent" | "success" | "warning" | "neutral";
    label?: string;
    labelKey?: string;
  }[] = [];
  if (ctx.channel === "Chip" || ctx.channel === "Contactless")
    out.push({ tone: "accent", label: `${ctx.channel} · EMV` });
  if (ctx.txType === "Debito") out.push({ tone: "warning", labelKey: "builder.badges.debitPin" });
  if (ctx.channel === "CNP") out.push({ tone: "neutral", labelKey: "builder.badges.cnp" });
  // 04xx implies a reversal — surface it as a badge so the user sees it explicitly.
  if (ctx.mti.startsWith("04")) out.push({ tone: "warning", labelKey: "builder.badges.reversal" });
  return out;
}

/** Validates 4-digit decimal MTI input. */
function isValidMti(mti: string) {
  return /^\d{4}$/.test(mti);
}

export function ContextBar({ context, onChange, onBuild, onClear, onOpenTemplates, loading }: Props) {
  const { t } = useTranslation();
  const isCredit = context.txType === "Credito";

  /**
   * Resolves the display label for an enum-style value (Role, Channel, TxType, …).
   * Looks up `<namespace>.<lowercased-value>` in i18n, falls back to the original
   * value when no translation exists. The internal enum identifier sent to the
   * backend is never altered — this is purely display-side.
   */
  const localized = (value: string, namespace: string) => {
    const key = `builder.${namespace}.${value.toLowerCase()}`;
    const out = t(key);
    return out === key ? value : out;
  };

  // ── MTI combobox ────────────────────────────────────────────────────────
  // Datalist-backed input — user can type any 4-digit MTI or pick a suggestion.
  const [mtiDraft, setMtiDraft] = useState(context.mti);
  // Keep draft in sync when context.mti changes externally (e.g. "Use 0400").
  useMemo(() => setMtiDraft(context.mti), [context.mti]);
  const mtiValid = isValidMti(mtiDraft);
  const isCustomMti = mtiValid && !ALL_KNOWN_MTIS.has(mtiDraft);

  // Recent custom MTIs from localStorage. Re-read each Build so newly saved ones surface.
  const [mtiHistory, setMtiHistory] = useState<string[]>(() => loadMtiHistory());

  const commitMti = (next: string) => {
    if (isValidMti(next)) onChange({ mti: next });
  };

  // Wrap onBuild to persist non-standard MTIs to the history bucket.
  const handleBuild = () => {
    if (isValidMti(context.mti)) {
      pushMtiHistory(context.mti);
      setMtiHistory(loadMtiHistory());
    }
    onBuild();
  };

  // ── Saque + MTI 0100 warning ────────────────────────────────────────────
  const saqueOn0100Warning = context.txType === "Saque" && context.mti === "0100";

  return (
    <Card>
      <CardBody className="space-y-3">
        {/* Row 1 — primary identification of the message: MTI + role + brand + channel + tx type.
            5 equal columns at lg breakpoints; collapses to 2-3 on smaller widths. */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <Label>{t("builder.mti")}</Label>
            <input
              list="isohub-mti-options"
              value={mtiDraft}
              onChange={(e) => {
                const v = e.target.value;
                setMtiDraft(v);
                if (isValidMti(v)) commitMti(v);
              }}
              onBlur={() => mtiValid && commitMti(mtiDraft)}
              maxLength={4}
              inputMode="numeric"
              pattern="\d{4}"
              placeholder="0200"
              className="w-full h-9 px-3 text-sm font-mono rounded-md bg-bg-input border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            />
            <datalist id="isohub-mti-options">
              {MTI_GROUPS.flatMap((group) => [
                /* Disabled separator — Chrome greys it out; other browsers just hide. */
                <option key={`sep-${group.labelKey}`} value="" disabled>{`── ${t(group.labelKey)} ──`}</option>,
                ...group.mtis.map((m) => (
                  <option key={m.mti} value={m.mti}>
                    {m.name ? `${m.mti} · ${m.name}` : m.mti}
                  </option>
                )),
              ])}
              {mtiHistory.length > 0 && (
                <option key="sep-recent" value="" disabled>{t("builder.mtiRecentSeparator")}</option>
              )}
              {mtiHistory.map((m) => (
                <option key={`recent-${m}`} value={m}>{`${m} · ${t("builder.mtiRecentSuffix")}`}</option>
              ))}
            </datalist>
            {!mtiValid && mtiDraft.length > 0 && (
              <div className="text-[11px] text-danger-text mt-1">{t("builder.mtiInvalidLength")}</div>
            )}
            {isCustomMti && (
              <div className="text-[11px] text-accent-text mt-1">{t("builder.mtiCustom", { mti: mtiDraft })}</div>
            )}
          </div>

          <div>
            <Label>{t("builder.role")}</Label>
            <Select
              value={context.role}
              onChange={(e) => onChange({ role: e.target.value })}
              title={ROLE_HINT_KEYS[context.role] ? t(ROLE_HINT_KEYS[context.role]) : undefined}
            >
              {ROLES.map((r) => (
                <option key={r} value={r} title={ROLE_HINT_KEYS[r] ? t(ROLE_HINT_KEYS[r]) : undefined}>
                  {localized(r, "roles")}
                </option>
              ))}
            </Select>
            {ROLE_HINT_KEYS[context.role] && (
              <div className="text-[11px] text-text-tertiary mt-1 truncate" title={t(ROLE_HINT_KEYS[context.role])}>
                {t(ROLE_HINT_KEYS[context.role])}
              </div>
            )}
          </div>

          <div>
            <Label>{t("builder.brand")}</Label>
            <Select
              value={context.brand}
              onChange={(e) => onChange({ brand: e.target.value })}
              title={BRAND_HINT_KEY[context.brand] ? t(BRAND_HINT_KEY[context.brand]!) : undefined}
            >
              {BRANDS.map((b) => {
                const labelKey = BRAND_LABEL_KEY[b];
                const hintKey = BRAND_HINT_KEY[b];
                return (
                  <option key={b} value={b} title={hintKey ? t(hintKey) : undefined}>
                    {labelKey ? t(labelKey) : b}
                  </option>
                );
              })}
            </Select>
          </div>

          <div>
            <Label>{t("builder.channel")}</Label>
            <Select value={context.channel} onChange={(e) => onChange({ channel: e.target.value })}>
              {CHANNELS.map((c) => (
                <option key={c} value={c}>{localized(c, "channels")}</option>
              ))}
            </Select>
          </div>

          <div>
            <Label>{t("builder.transactionType")}</Label>
            <Select value={context.txType} onChange={(e) => onChange({ txType: e.target.value })}>
              {TX_TYPES.map((tx) => (
                <option key={tx} value={tx}>{localized(tx, "txTypes")}</option>
              ))}
            </Select>
          </div>
        </div>

        {/* Row 2 — optional / conditional fields. Each child reserves a hidden
            Label placeholder so the controls line up cleanly with `items-end`
            regardless of which ones are visible. The toggle sits left as the
            anchor; TPDU NIIs and Installments expand to its right when active. */}
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2 pt-2 border-t border-[var(--border)]">
          {/* Toggle row — the invisible Label keeps its baseline aligned with the
              labelled inputs (TPDU NIIs / Installments) when they appear. */}
          <div className="flex flex-col">
            <Label className="opacity-0 select-none" aria-hidden="true">·</Label>
            <div className="h-9 flex items-center whitespace-nowrap">
              <Toggle
                checked={context.includeTpdu}
                onChange={(v) => onChange({ includeTpdu: v })}
                label={t("builder.includeTpdu")}
              />
            </div>
          </div>

          {/* TPDU NIIs — only rendered when TPDU is on. Width capped at 200px
              per spec; transition is implicit (the element mounts/unmounts). */}
          {context.includeTpdu && (
            <div className="flex flex-col" style={{ maxWidth: 200 }}>
              <Label>{t("builder.tpduNiis")}</Label>
              <input
                type="text"
                value={context.tpduOverride ?? ""}
                onChange={(e) => onChange({ tpduOverride: e.target.value || null })}
                placeholder={t("builder.tpduPlaceholder")}
                maxLength={10}
                className="w-full h-9 px-3 text-sm font-mono rounded-md bg-bg-input border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              />
            </div>
          )}

          {/* Installments — credit only, capped at 120px wide. */}
          {isCredit && (
            <div className="flex flex-col" style={{ maxWidth: 120 }}>
              <Label>{t("builder.installments")}</Label>
              <input
                type="number"
                min={1}
                max={12}
                value={context.installments}
                onChange={(e) => onChange({ installments: Number(e.target.value) })}
                className="w-full h-9 px-3 text-sm rounded-md bg-bg-input border border-[var(--border)]"
                title={t("builder.installmentsHint")}
              />
            </div>
          )}
        </div>

        {/* Row 3 — hints + badges. Hints are pulled out of the controls above so
            row 2 stays a clean single line of inputs. */}
        {(context.includeTpdu || isCredit) && (
          <div className="text-[11px] text-text-tertiary space-y-0.5">
            {context.includeTpdu && <div>{t("builder.tpduHint")}</div>}
            {isCredit && <div>{t("builder.installmentsHint")}</div>}
          </div>
        )}

        {saqueOn0100Warning && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-warning-bg/50 text-warning-text text-xs">
            <AlertTriangle size={14} />
            <span>{t("builder.saqueOn0100Warning")}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {badgesFor(context).map((b, i) => (
            <Badge key={i} tone={b.tone}>{b.labelKey ? t(b.labelKey) : b.label}</Badge>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button onClick={handleBuild} disabled={loading || !mtiValid}>
            {loading ? t("common.loading") : `${t("builder.build")} →`}
          </Button>
          <Button variant="secondary" onClick={onClear} disabled={loading}>
            {t("common.clear")}
          </Button>
          {onOpenTemplates && (
            <Button variant="secondary" onClick={onOpenTemplates}>
              <FolderOpen size={14} /> {t("builder.templates")}
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
