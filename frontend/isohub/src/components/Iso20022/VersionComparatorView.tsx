import { Fragment, useEffect, useMemo, useState } from "react";
import { Minus, Pencil, Plus } from "lucide-react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import {
  ISO20022_FAMILIES,
  extractFamilyId,
  extractPrefix,
  extractVersion,
  getFamilyByPrefix,
} from "@/config/iso20022Families";
import {
  compareIso20022Versions,
  type CompareResponse,
} from "@/api/iso20022Compare";

interface Props {
  messageTypes: string[];
  /** If set, the "from" side is locked (used by the parser modal). */
  lockedFromVersion?: string;
  /**
   * XPaths present in the user's current XML. When provided alongside
   * <c>lockedFromVersion</c>, the diff is filtered to the actual impact on
   * that document: mandatory-added, every removed, and changed-on-paths-used.
   * Without it, the full diff renders (standalone "Comparador" page).
   */
  currentXPaths?: string[];
}

interface FamilyGroup {
  prefix: string;
  officialName: string;
  messageIds: string[];
  versionsByMessageId: Record<string, string[]>;
  fullTypeByVersion: Record<string, string>;
}

function buildFamilyGroups(messageTypes: string[]): FamilyGroup[] {
  const map = new Map<string, FamilyGroup>();
  for (const mt of messageTypes) {
    const prefix = extractPrefix(mt);
    const familyId = extractFamilyId(mt);
    const version = extractVersion(mt);
    const family = getFamilyByPrefix(prefix);

    if (!map.has(prefix)) {
      map.set(prefix, {
        prefix,
        officialName: family?.officialName ?? prefix,
        messageIds: [],
        versionsByMessageId: {},
        fullTypeByVersion: {},
      });
    }
    const g = map.get(prefix)!;
    if (!g.versionsByMessageId[familyId]) {
      g.versionsByMessageId[familyId] = [];
      g.messageIds.push(familyId);
    }
    g.versionsByMessageId[familyId].push(version);
    g.fullTypeByVersion[`${familyId}|${version}`] = mt;
  }
  for (const g of map.values()) {
    g.messageIds.sort();
    for (const k of Object.keys(g.versionsByMessageId)) g.versionsByMessageId[k].sort();
  }
  return ISO20022_FAMILIES.filter((f) => map.has(f.prefix)).map((f) => map.get(f.prefix)!);
}

/**
 * Inline comparator: picks two versions of the same family and renders the
 * delta. The "from" side may be locked when the caller already knows the
 * starting point (parser → "compare against").
 */
export function VersionComparatorView({
  messageTypes,
  lockedFromVersion,
  currentXPaths,
}: Props) {
  const lockedMode = !!currentXPaths;
  const groups = useMemo(() => buildFamilyGroups(messageTypes), [messageTypes]);

  // Seed the selectors from the locked value (if any) or the first family.
  const seedFamily = lockedFromVersion ? extractPrefix(lockedFromVersion) : groups[0]?.prefix ?? "";
  const seedFamilyId = lockedFromVersion
    ? extractFamilyId(lockedFromVersion)
    : groups[0]?.messageIds[0] ?? "";

  const [family, setFamily] = useState(seedFamily);
  const [familyId, setFamilyId] = useState(seedFamilyId);

  const currentGroup = groups.find((g) => g.prefix === family);
  const versions = currentGroup?.versionsByMessageId[familyId] ?? [];

  // From / To versions within the chosen family+id. Default both ends to the
  // newest available — caller swaps them via the dropdowns.
  const [fromVersion, setFromVersion] = useState(
    lockedFromVersion ? extractVersion(lockedFromVersion) : versions[0] ?? "",
  );
  const [toVersion, setToVersion] = useState(versions[versions.length - 1] ?? "");

  // When the family / message id changes, reseed both ends so the dropdowns
  // never reference a non-existent version.
  useEffect(() => {
    if (lockedFromVersion) return;
    setFromVersion(versions[0] ?? "");
    setToVersion(versions[versions.length - 1] ?? "");
  }, [family, familyId, versions.join("|"), lockedFromVersion]);

  const [result, setResult] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Locked-mode filter: narrow the full diff to what actually impacts the
  // user's XML. Mandatory adds always impact (must be filled in); every
  // remove impacts (was there, now gone); changes impact only on paths the
  // user is actually using. Standalone mode passes through unchanged.
  const displayedResult = useMemo<CompareResponse | null>(() => {
    if (!result) return null;
    if (!currentXPaths) return result;

    const xpathSet = new Set(currentXPaths);
    const filteredAdded = result.added.filter((f) => f.isMandatory);
    const filteredChanged = result.changed.filter((f) => xpathSet.has(f.xpath));

    return {
      ...result,
      added: filteredAdded,
      removed: result.removed,
      changed: filteredChanged,
      addedCount: filteredAdded.length,
      removedCount: result.removed.length,
      changedCount: filteredChanged.length,
    };
  }, [result, currentXPaths]);

  async function runCompare() {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const fullFrom = currentGroup?.fullTypeByVersion[`${familyId}|${fromVersion}`];
      const fullTo = currentGroup?.fullTypeByVersion[`${familyId}|${toVersion}`];
      if (!fullFrom || !fullTo) {
        setError("Selecione duas versões válidas.");
        return;
      }
      setResult(await compareIso20022Versions(fullFrom, fullTo));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const selectClass =
    "bg-bg-input border border-[var(--border)] rounded-md px-3 py-1.5 text-sm font-mono " +
    "focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent";

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap" data-testid="comparator-controls">
        <select
          value={family}
          onChange={(e) => {
            setFamily(e.target.value);
            const g = groups.find((g) => g.prefix === e.target.value);
            if (g) setFamilyId(g.messageIds[0] ?? "");
          }}
          className={selectClass}
          aria-label="Família"
          disabled={!!lockedFromVersion}
          data-testid="comparator-family"
        >
          {groups.map((g) => (
            <option key={g.prefix} value={g.prefix}>
              {g.officialName} ({g.prefix})
            </option>
          ))}
        </select>

        <select
          value={familyId}
          onChange={(e) => setFamilyId(e.target.value)}
          className={selectClass}
          aria-label="Tipo"
          disabled={!!lockedFromVersion}
          data-testid="comparator-id"
        >
          {currentGroup?.messageIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>

        <span className="text-xs text-text-tertiary">de</span>
        <select
          value={fromVersion}
          onChange={(e) => setFromVersion(e.target.value)}
          className={selectClass}
          aria-label="Versão de origem"
          disabled={!!lockedFromVersion}
          data-testid="comparator-from"
        >
          {versions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        <span className="text-xs text-text-tertiary">para</span>
        <select
          value={toVersion}
          onChange={(e) => setToVersion(e.target.value)}
          className={selectClass}
          aria-label="Versão de destino"
          data-testid="comparator-to"
        >
          {versions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        <Button
          onClick={runCompare}
          disabled={loading || !fromVersion || !toVersion}
          data-testid="comparator-run"
        >
          {loading ? "Comparando..." : "Comparar"}
        </Button>
      </div>

      {error && <ErrorBanner message={error} />}

      {displayedResult && <CompareDelta result={displayedResult} lockedMode={lockedMode} />}
    </div>
  );
}

function CompareDelta({
  result,
  lockedMode,
}: {
  result: CompareResponse;
  lockedMode: boolean;
}) {
  const totalDiffs = result.addedCount + result.removedCount + result.changedCount;
  if (totalDiffs === 0) {
    return (
      <p className="text-text-secondary text-sm" data-testid="comparator-no-diff">
        {lockedMode
          ? `Sua mensagem é compatível com ${result.toVersion}. Nenhuma alteração necessária.`
          : `Nenhuma diferença encontrada entre ${result.fromVersion} e ${result.toVersion}.`}
      </p>
    );
  }

  return (
    <Fragment>
      <div className="space-y-3" data-testid="comparator-result">
        <p className="text-xs text-text-tertiary">
          {result.fromVersion} → {result.toVersion} · {totalDiffs} diferença(s)
        </p>

        {result.added.length > 0 && (
          <Section
            tone="success"
            icon={<Plus size={14} />}
            title={lockedMode ? "Campos obrigatórios novos" : `Adicionados em ${result.toVersion}`}
            count={result.addedCount}
            testid="comparator-section-added"
          >
          <ul className="divide-y divide-[var(--border)]">
            {result.added.map((f) => (
              <li key={f.xpath} className="px-3 py-1.5 text-xs flex items-center justify-between gap-3">
                <span className="font-mono text-text-primary truncate">{f.xpath}</span>
                <span className="text-text-tertiary shrink-0">
                  <span className="font-mono">{f.typeName}</span> · {f.cardinality}
                  {f.isMandatory && <span className="ml-1 text-accent-text">(mandatório)</span>}
                </span>
              </li>
            ))}
          </ul>
        </Section>
        )}

        {result.removed.length > 0 && (
          <Section
            tone="danger"
            icon={<Minus size={14} />}
            title={lockedMode ? "Campos removidos" : `Removidos em ${result.toVersion}`}
            count={result.removedCount}
            testid="comparator-section-removed"
          >
          <ul className="divide-y divide-[var(--border)]">
            {result.removed.map((f) => (
              <li key={f.xpath} className="px-3 py-1.5 text-xs flex items-center justify-between gap-3">
                <span className="font-mono text-text-primary truncate">{f.xpath}</span>
                <span className="text-text-tertiary shrink-0">
                  <span className="font-mono">{f.typeName}</span> · {f.cardinality}
                </span>
              </li>
            ))}
          </ul>
        </Section>
        )}

        {result.changed.length > 0 && (
          <Section
            tone="warning"
            icon={<Pencil size={14} />}
            title={lockedMode ? "Campos alterados na sua mensagem" : "Alterados"}
            count={result.changedCount}
            testid="comparator-section-changed"
          >
          <ul className="divide-y divide-[var(--border)]">
            {result.changed.map((f) => (
              <li key={f.xpath} className="px-3 py-2 text-xs">
                <div className="font-mono text-text-primary truncate mb-1">{f.xpath}</div>
                <ul className="text-text-tertiary space-y-0.5 pl-2">
                  {f.changes.map((c) => (
                    <li key={c.propertyName}>
                      <span className="text-text-secondary">{c.propertyName}:</span>{" "}
                      <span className="font-mono">{c.oldValue}</span> →{" "}
                      <span className="font-mono text-text-primary">{c.newValue}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Section>
        )}
      </div>
    </Fragment>
  );
}

function Section({
  tone,
  icon,
  title,
  count,
  testid,
  children,
}: {
  tone: "success" | "danger" | "warning";
  icon: React.ReactNode;
  title: string;
  count: number;
  testid: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const headerCls = clsx(
    "flex items-center justify-between gap-3 w-full px-3 py-2 text-left text-sm font-semibold",
    tone === "success" && "bg-success-bg text-success-text border-success/30",
    tone === "danger" && "bg-danger-bg text-danger-text border-danger/30",
    tone === "warning" && "bg-warning-bg text-warning-text border-warning/30",
  );
  return (
    <div className="rounded-md border border-[var(--border)] overflow-hidden" data-testid={testid}>
      <button type="button" onClick={() => setOpen((v) => !v)} className={headerCls}>
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        <span className="text-xs font-mono">{count}</span>
      </button>
      {open && <div className="bg-bg-primary">{children}</div>}
    </div>
  );
}
