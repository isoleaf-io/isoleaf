import { ArrowLeft, ChevronRight } from "lucide-react";
import type { FieldSearchResultDto } from "@/api/iso20022Reference";
import {
  ISO20022_FAMILIES,
  extractFamilyId,
  extractPrefix,
  extractVersion,
  getFamilyByPrefix,
} from "@/config/iso20022Families";

interface Props {
  results: FieldSearchResultDto[];
  term: string;
  /** When set, the panel drills into this field's family/version map (step 2). */
  selectedFieldName: string | null;
  /** Step-1 click: opens the drill-down view for a specific field name. */
  onSelectField: (fieldName: string) => void;
  /** Step-2 back button: returns to the step-1 field list. */
  onBack: () => void;
  /** Step-2 chip click: navigates to "Por mensagem" with the field selected. */
  onNavigate: (messageType: string, fieldName: string) => void;
}

interface SearchFamily {
  prefix: string;
  officialName: string;
  messageIds: string[];
  versionsByMessageId: Record<string, string[]>;
  /** `${familyId}|${version}` → fieldName that owns this slot. */
  fieldByVersion: Record<string, string>;
  /** `${familyId}|${version}` → full messageType. */
  fullTypeByVersion: Record<string, string>;
}

function buildSearchFamilies(results: FieldSearchResultDto[]): SearchFamily[] {
  const map = new Map<string, SearchFamily>();

  for (const result of results) {
    for (const occ of result.occurrences) {
      const prefix = extractPrefix(occ.messageType);
      const familyId = extractFamilyId(occ.messageType);
      const version = extractVersion(occ.messageType);
      const family = getFamilyByPrefix(prefix);

      if (!map.has(prefix)) {
        map.set(prefix, {
          prefix,
          officialName: family?.officialName ?? prefix,
          messageIds: [],
          versionsByMessageId: {},
          fieldByVersion: {},
          fullTypeByVersion: {},
        });
      }

      const group = map.get(prefix)!;
      if (!group.versionsByMessageId[familyId]) {
        group.versionsByMessageId[familyId] = [];
        group.messageIds.push(familyId);
      }
      if (!group.versionsByMessageId[familyId].includes(version)) {
        group.versionsByMessageId[familyId].push(version);
        group.fieldByVersion[`${familyId}|${version}`] = result.fieldName;
        group.fullTypeByVersion[`${familyId}|${version}`] = occ.messageType;
      }
    }
  }

  for (const group of map.values()) {
    group.messageIds.sort();
    for (const key of Object.keys(group.versionsByMessageId))
      group.versionsByMessageId[key].sort();
  }

  return ISO20022_FAMILIES.filter((f) => map.has(f.prefix)).map((f) => map.get(f.prefix)!);
}

export function FieldSearchResults({
  results,
  term,
  selectedFieldName,
  onSelectField,
  onBack,
  onNavigate,
}: Props) {
  if (results.length === 0) {
    return (
      <p className="text-text-tertiary text-sm" data-testid="field-search-empty">
        Nenhum campo encontrado.
      </p>
    );
  }

  // Step 2 — drill-down. Filter results down to the chosen field, then render
  // the same family/version layout as before.
  const detail = selectedFieldName
    ? results.find((r) => r.fieldName === selectedFieldName)
    : null;

  if (selectedFieldName && detail) {
    return (
      <FieldDetailView
        detail={detail}
        term={term}
        onBack={onBack}
        onNavigate={onNavigate}
      />
    );
  }

  // Step 1 — field list. Sorted by occurrence count (desc) so the most
  // populated fields surface first; ties broken by name.
  const sorted = [...results].sort((a, b) => {
    const diff = b.occurrences.length - a.occurrences.length;
    return diff !== 0 ? diff : a.fieldName.localeCompare(b.fieldName);
  });
  const totalOccurrences = results.reduce((sum, r) => sum + r.occurrences.length, 0);

  return (
    <div className="flex flex-col gap-1" data-testid="field-search-list">
      <p className="text-xs text-text-tertiary mb-2">
        {results.length} campo(s) · {totalOccurrences} ocorrência(s) para "{term}"
      </p>

      <div className="rounded-md border border-[var(--border)] overflow-hidden bg-bg-primary">
        {sorted.map((r) => (
          <button
            key={r.fieldName}
            type="button"
            onClick={() => onSelectField(r.fieldName)}
            data-testid={`field-search-list-item-${r.fieldName}`}
            className="w-full flex items-center justify-between gap-3 px-4 py-2 text-left border-b border-[var(--border)] last:border-b-0 hover:bg-bg-secondary transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-sm font-semibold text-accent-text">
                {r.fieldName}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-text-tertiary tabular-nums">
                {r.occurrences.length}{" "}
                {r.occurrences.length === 1 ? "ocorrência" : "ocorrências"}
              </span>
              <ChevronRight size={14} className="text-text-tertiary" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function FieldDetailView({
  detail,
  term,
  onBack,
  onNavigate,
}: {
  detail: FieldSearchResultDto;
  term: string;
  onBack: () => void;
  onNavigate: (messageType: string, fieldName: string) => void;
}) {
  const families = buildSearchFamilies([detail]);
  const total = detail.occurrences.length;

  return (
    <div className="flex flex-col gap-2" data-testid="field-search-detail">
      <div className="flex items-center justify-between gap-3 mb-1">
        <button
          type="button"
          onClick={onBack}
          data-testid="field-search-back"
          className="inline-flex items-center gap-1 text-xs text-accent-text hover:underline"
        >
          <ArrowLeft size={12} /> Voltar à lista
        </button>
        <span className="text-xs text-text-tertiary">
          <span className="font-mono font-semibold text-text-primary">
            {detail.fieldName}
          </span>{" "}
          · {total} ocorrência(s) para "{term}"
        </span>
      </div>

      {families.map((family) => (
        <div
          key={family.prefix}
          className="rounded-md border border-[var(--border)] overflow-hidden mb-3"
          data-testid={`field-search-family-${family.prefix}`}
        >
          <div className="px-4 py-2 bg-bg-secondary border-b border-[var(--border)]">
            <span className="text-sm font-semibold text-text-primary">
              {family.officialName}
            </span>
            <span className="text-xs text-text-tertiary font-mono ml-2">
              ({family.prefix})
            </span>
          </div>

          <div className="divide-y divide-[var(--border)] bg-bg-primary">
            {family.messageIds.map((msgId) => (
              <div
                key={msgId}
                className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-bg-secondary/40 transition-colors"
              >
                <span className="font-mono text-xs text-text-secondary shrink-0 w-24">
                  {msgId}
                </span>
                <div className="flex items-center gap-1 flex-wrap justify-end">
                  {family.versionsByMessageId[msgId].map((version) => {
                    const key = `${msgId}|${version}`;
                    const fullType = family.fullTypeByVersion[key];
                    const fieldName = family.fieldByVersion[key];
                    return (
                      <button
                        key={version}
                        type="button"
                        onClick={() => onNavigate(fullType, fieldName)}
                        title={`Ver ${fieldName} em ${fullType}`}
                        data-testid={`field-search-chip-${fullType}`}
                        className={
                          "text-[11px] font-mono px-2 py-0.5 rounded border transition-colors " +
                          "bg-bg-tertiary border-[var(--border)] text-text-secondary " +
                          "hover:border-accent hover:text-accent-text hover:bg-accent-bg/40"
                        }
                      >
                        {version}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <p className="text-xs text-text-tertiary mt-1">
        Clique em uma versão para abrir o campo em "Por mensagem".
      </p>
    </div>
  );
}
