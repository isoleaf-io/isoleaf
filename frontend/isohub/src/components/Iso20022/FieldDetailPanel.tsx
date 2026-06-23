import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, X } from "lucide-react";
import clsx from "clsx";
import { Badge } from "@/components/ui/Badge";
import {
  getFieldDetail,
  getFieldExample,
  type FieldDefinitionDto,
  type FieldExampleResponse,
  type FieldSearchResultDto,
} from "@/api/iso20022Reference";
import { UsedInTab } from "./UsedInTab";

interface Props {
  messageType: string;
  field: FieldDefinitionDto;
  onClose: () => void;
}

type Tab = "iso" | "xml" | "usedIn";

/**
 * Side panel that opens when the user clicks any field in the FieldTree.
 * Three tabs: Padrão ISO (standard properties + restrictions), Exemplo XML
 * (minimal XML skeleton with the field highlighted), Usado em (every other
 * message type that defines a field of the same name). Each tab fetches its
 * data on first activation and caches it for the lifetime of the panel.
 */
export function FieldDetailPanel({ messageType, field, onClose }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("iso");

  const [usedIn, setUsedIn] = useState<FieldSearchResultDto | null>(null);
  const [usedInLoading, setUsedInLoading] = useState(false);
  const [usedInError, setUsedInError] = useState<string | null>(null);

  const [example, setExample] = useState<FieldExampleResponse | null>(null);
  const [exampleLoading, setExampleLoading] = useState(false);
  const [exampleError, setExampleError] = useState<string | null>(null);

  // Reset every cached fetch when the user clicks a different field — keeps
  // the panel from showing stale data after the parent swaps the field prop.
  useEffect(() => {
    setUsedIn(null);
    setUsedInError(null);
    setExample(null);
    setExampleError(null);
  }, [field.xpath, messageType]);

  // Lazy load: "Usado em" only fires when the user opens that tab.
  useEffect(() => {
    if (tab !== "usedIn" || usedIn || usedInLoading) return;
    setUsedInLoading(true);
    getFieldDetail(field.name)
      .then(setUsedIn)
      .catch((e: Error) => setUsedInError(e.message))
      .finally(() => setUsedInLoading(false));
  }, [tab, field.name, usedIn, usedInLoading]);

  useEffect(() => {
    if (tab !== "xml" || example || exampleLoading) return;
    setExampleLoading(true);
    getFieldExample(messageType, field.xpath)
      .then(setExample)
      .catch((e: Error) => setExampleError(e.message))
      .finally(() => setExampleLoading(false));
  }, [tab, messageType, field.xpath, example, exampleLoading]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "iso", label: t("iso20022.reference.detail.tabIso") },
    { id: "xml", label: t("iso20022.reference.detail.tabXml") },
    { id: "usedIn", label: t("iso20022.reference.detail.tabUsedIn") },
  ];

  // Breadcrumb: Document › messageType › xpath segments.
  const crumbs = ["Document", messageType, ...field.xpath.split("/").filter(Boolean)];

  return (
    <div
      className="flex flex-col h-full overflow-hidden bg-bg-primary"
      data-testid="iso20022-field-detail-panel"
    >
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-1 text-[11px] text-text-tertiary flex-wrap">
            {crumbs.map((part, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={10} />}
                <span
                  className={clsx(
                    i === crumbs.length - 1 ? "text-text-primary font-medium" : "text-text-tertiary",
                  )}
                >
                  {part}
                </span>
              </span>
            ))}
          </div>
          <h2 className="text-lg font-bold font-mono">{field.name}</h2>
          {field.documentation && (
            <p className="text-xs text-text-secondary leading-relaxed">{field.documentation}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-text-tertiary hover:text-text-primary transition-colors shrink-0 rounded p-1 hover:bg-bg-tertiary"
          aria-label={t("common.close")}
          data-testid="iso20022-field-detail-close"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex border-b border-[var(--border)] px-5">
        {tabs.map((cfg) => (
          <button
            key={cfg.id}
            type="button"
            onClick={() => setTab(cfg.id)}
            data-testid={`field-detail-tab-${cfg.id}`}
            className={clsx(
              "px-3 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              tab === cfg.id
                ? "border-accent text-accent-text"
                : "border-transparent text-text-tertiary hover:text-text-primary",
            )}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {tab === "iso" && <IsoTab field={field} />}
        {tab === "xml" && (
          <XmlTab
            example={example}
            loading={exampleLoading}
            error={exampleError}
            fieldName={field.name}
          />
        )}
        {tab === "usedIn" && (
          <div>
            {usedInLoading && (
              <p className="text-text-tertiary text-sm">Carregando ocorrências...</p>
            )}
            {usedInError && !usedInLoading && (
              <p className="text-danger-text text-sm">{usedInError}</p>
            )}
            {usedIn && !usedInLoading && (
              <UsedInTab usedIn={usedIn} currentMessageType={messageType} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Padrão ISO ------------------------------------------------------------
function IsoTab({ field }: { field: FieldDefinitionDto }) {
  const { t } = useTranslation();
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-[var(--border)]">
        <IsoRow icon="⬡" label={t("iso20022.reference.detail.iso.type")} value={field.typeName} mono />
        <IsoRow
          icon="↔"
          label={t("iso20022.reference.detail.iso.length")}
          value={formatLength(field.minLength, field.maxLength, t)}
        />
        <IsoRow
          icon="⊙"
          label={t("iso20022.reference.detail.iso.mandatory")}
          custom={
            <Badge tone={field.isMandatory ? "success" : "neutral"}>
              {field.isMandatory
                ? t("iso20022.reference.detail.iso.mandatoryYes")
                : t("iso20022.reference.detail.iso.mandatoryNo")}
            </Badge>
          }
        />
        <IsoRow
          icon="Tr"
          label={t("iso20022.reference.detail.iso.acceptedPattern")}
          value={
            field.pattern
              ? field.pattern
              : field.enumerations.length > 0
                ? t("iso20022.reference.detail.iso.enumeration", { values: field.enumerations.join(", ") })
                : t("iso20022.reference.detail.iso.noRestriction")
          }
          mono={!!field.pattern}
        />
        <IsoRow
          icon="↻"
          label={t("iso20022.reference.detail.iso.cardinality")}
          value={`${field.cardinality} — ${cardinalityLabel(field, t)}`}
        />
        {field.documentation && (
          <IsoRow
            icon="≡"
            label={t("iso20022.reference.detail.iso.description")}
            value={field.documentation}
          />
        )}
        <IsoRow
          icon="⌘"
          label={t("iso20022.reference.detail.iso.xpath")}
          value={`Document / ${field.xpath.replace(/\//g, " / ")}`}
          mono
          muted
        />
      </tbody>
    </table>
  );
}

function IsoRow({
  icon,
  label,
  value,
  mono,
  muted,
  custom,
}: {
  icon: string;
  label: string;
  value?: string | null;
  mono?: boolean;
  muted?: boolean;
  custom?: ReactNode;
}) {
  if (!value && !custom) return null;
  return (
    <tr>
      <td className="py-3 pr-4 align-top w-44">
        <div className="flex items-center gap-2 text-text-tertiary text-xs">
          <span className="text-text-tertiary font-mono w-4 text-center shrink-0">{icon}</span>
          {label}
        </div>
      </td>
      <td className="py-3 align-top">
        {custom ?? (
          <span
            className={clsx(
              "text-sm",
              mono && "font-mono text-text-primary",
              muted && "text-text-tertiary font-mono text-xs",
              !mono && !muted && "text-text-primary",
            )}
          >
            {value}
          </span>
        )}
      </td>
    </tr>
  );
}

// ---- Exemplo XML -----------------------------------------------------------
function XmlTab({
  example,
  loading,
  error,
  fieldName,
}: {
  example: FieldExampleResponse | null;
  loading: boolean;
  error: string | null;
  fieldName: string;
}) {
  const { t } = useTranslation();

  if (loading) return <p className="text-text-tertiary text-sm">{t("common.loading")}</p>;
  if (error) return <p className="text-danger-text text-sm">{error}</p>;
  if (!example) return null;

  return (
    <div>
      <pre className="bg-bg-input border border-[var(--border)] rounded-md p-4 text-xs font-mono text-text-primary overflow-x-auto whitespace-pre leading-relaxed">
        <HighlightedXml xml={example.xmlExample} fieldName={fieldName} />
      </pre>
      <p className="text-xs text-text-tertiary mt-2">
        {t("iso20022.reference.detail.xml.disclaimer")}
      </p>
    </div>
  );
}

function HighlightedXml({ xml, fieldName }: { xml: string; fieldName: string }) {
  const lines = xml.split("\n");
  let highlighting = false;

  return (
    <>
      {lines.map((line, i) => {
        if (line.includes(`<!-- ▶ ${fieldName} -->`)) {
          highlighting = true;
          return null;
        }
        if (line.includes("<!-- ◀ -->")) {
          highlighting = false;
          return null;
        }
        return (
          <span
            key={i}
            className={highlighting ? "bg-accent-bg text-accent-text block" : "block"}
          >
            {line + "\n"}
          </span>
        );
      })}
    </>
  );
}

// ---- Helpers ---------------------------------------------------------------
function formatLength(
  min: number | null,
  max: number | null,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string | null {
  if (min == null && max == null) return null;
  if (min === max && min != null) return t("iso20022.reference.detail.iso.lengthExact", { count: min });
  return t("iso20022.reference.detail.iso.lengthRange", {
    min: min ?? 0,
    max: max ?? "∞",
  });
}

function cardinalityLabel(
  field: FieldDefinitionDto,
  t: (key: string) => string,
): string {
  if (field.cardinality === "[1..1]") return t("iso20022.reference.detail.iso.cardOneOne");
  if (field.cardinality === "[0..1]") return t("iso20022.reference.detail.iso.cardZeroOne");
  if (field.cardinality.endsWith("..n]")) return t("iso20022.reference.detail.iso.cardRepeats");
  return "";
}
