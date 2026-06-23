import { useState, useEffect } from "react";
import {
  ISO20022_FAMILIES,
  extractFamilyId,
  extractPrefix,
  extractVersion,
  getFamilyByPrefix,
} from "@/config/iso20022Families";

interface Props {
  messageTypes: string[];
  selectedType: string;
  onSelect: (messageType: string) => void;
}

interface FamilyGroup {
  prefix: string;
  officialName: string;
  messageIds: string[];
  versionsByMessageId: Record<string, string[]>;
  /** Composite key `${familyId}|${version}` → full messageType. */
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

    const group = map.get(prefix)!;
    if (!group.versionsByMessageId[familyId]) {
      group.versionsByMessageId[familyId] = [];
      group.messageIds.push(familyId);
    }
    group.versionsByMessageId[familyId].push(version);
    group.fullTypeByVersion[`${familyId}|${version}`] = mt;
  }

  for (const group of map.values()) {
    group.messageIds.sort();
    for (const key of Object.keys(group.versionsByMessageId))
      group.versionsByMessageId[key].sort();
  }

  return ISO20022_FAMILIES.filter((f) => map.has(f.prefix)).map((f) => map.get(f.prefix)!);
}

/**
 * Three chained selects: Family → Type → Version. Picking a family resets the
 * type to the first available; picking a type resets the version. The final
 * leg (Version) is the one that calls `onSelect` with the full messageType.
 * Component state mirrors `selectedType` and re-syncs whenever it changes
 * externally (e.g. search→browse navigation seeding the dropdown).
 */
export function MessageTypeSelector({ messageTypes, selectedType, onSelect }: Props) {
  const groups = buildFamilyGroups(messageTypes);

  const selectedPrefix = extractPrefix(selectedType);
  const selectedFamilyId = extractFamilyId(selectedType);
  const selectedVersion = extractVersion(selectedType);

  const [family, setFamily] = useState(selectedPrefix);
  const [familyId, setFamilyId] = useState(selectedFamilyId);
  const [version, setVersion] = useState(selectedVersion);

  // Re-hydrate the three selects whenever the parent swaps the canonical
  // selection (search→browse jump, external state restore, etc.).
  useEffect(() => {
    setFamily(extractPrefix(selectedType));
    setFamilyId(extractFamilyId(selectedType));
    setVersion(extractVersion(selectedType));
  }, [selectedType]);

  const currentGroup = groups.find((g) => g.prefix === family);
  const currentMessageIds = currentGroup?.messageIds ?? [];
  const currentVersions = currentGroup?.versionsByMessageId[familyId] ?? [];

  function handleFamilyChange(prefix: string) {
    setFamily(prefix);
    const group = groups.find((g) => g.prefix === prefix);
    if (!group) return;
    const firstId = group.messageIds[0];
    setFamilyId(firstId);
    const firstVersion = group.versionsByMessageId[firstId]?.[0];
    if (firstVersion) {
      setVersion(firstVersion);
      onSelect(group.fullTypeByVersion[`${firstId}|${firstVersion}`]);
    }
  }

  function handleFamilyIdChange(id: string) {
    setFamilyId(id);
    const group = groups.find((g) => g.prefix === family);
    if (!group) return;
    const firstVersion = group.versionsByMessageId[id]?.[0];
    if (firstVersion) {
      setVersion(firstVersion);
      onSelect(group.fullTypeByVersion[`${id}|${firstVersion}`]);
    }
  }

  function handleVersionChange(v: string) {
    setVersion(v);
    const group = groups.find((g) => g.prefix === family);
    if (!group) return;
    onSelect(group.fullTypeByVersion[`${familyId}|${v}`]);
  }

  const selectClass =
    "bg-bg-input border border-[var(--border)] rounded-md px-3 py-1.5 " +
    "text-sm text-text-primary font-mono cursor-pointer " +
    "focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent";

  return (
    <div
      className="flex items-center gap-2 flex-wrap"
      data-testid="message-type-selector"
    >
      <select
        value={family}
        onChange={(e) => handleFamilyChange(e.target.value)}
        className={selectClass}
        aria-label="Família"
        data-testid="message-type-select-family"
      >
        {groups.map((g) => (
          <option key={g.prefix} value={g.prefix}>
            {g.officialName} ({g.prefix})
          </option>
        ))}
      </select>

      <select
        value={familyId}
        onChange={(e) => handleFamilyIdChange(e.target.value)}
        className={selectClass}
        aria-label="Tipo"
        data-testid="message-type-select-id"
      >
        {currentMessageIds.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>

      <select
        value={version}
        onChange={(e) => handleVersionChange(e.target.value)}
        className={selectClass}
        aria-label="Versão"
        data-testid="message-type-select-version"
      >
        {currentVersions.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    </div>
  );
}
