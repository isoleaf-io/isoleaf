import type { FieldOccurrenceDto } from "@/api/iso20022Reference";
import {
  extractFamilyId,
  extractPrefix,
  extractVersion,
  getFamilyByPrefix,
} from "@/config/iso20022Families";

/**
 * Group of ISO 20022 messages where the field is identical to the user's
 * reference — same XSD typeName, same cardinality, same mandatoriness. The
 * field renders these under "✓ Reutilize sua implementação".
 */
export interface CompatibleFamily {
  prefix: string;
  officialName: string;
  /** Stable-sorted list of family+subId pairs (e.g. <c>pacs.008</c>). */
  messageIds: string[];
  /** Per-messageId list of variant+version tails (e.g. <c>001.09</c>). */
  versionsByMessageId: Record<string, string[]>;
}

/**
 * One message that defines the field with different shape from the reference.
 * The Differences strings are pre-formatted in Portuguese so the UI just
 * renders them verbatim — no further translation/derivation needed.
 */
export interface IncompatibleOccurrence {
  messageType: string;
  familyOfficialName: string;
  xpath: string;
  cardinality: string;
  typeName: string;
  isMandatory: boolean;
  differences: string[];
}

export interface CompatibilityAnalysis {
  currentTypeName: string;
  currentCardinality: string;
  compatibleFamilies: CompatibleFamily[];
  incompatibleOccurrences: IncompatibleOccurrence[];
  totalCompatible: number;
  totalIncompatible: number;
}

/**
 * Splits the cross-message-type occurrence list into "can reuse" (identical
 * to the reference shape) and "must adapt" buckets, then rolls each up into
 * the family→messageId→versions tree the UI renders. Reference is the
 * occurrence in <paramref>currentMessageType</paramref>; falls back to the
 * first occurrence when the current type isn't in the list.
 */
export function analyzeCompatibility(
  currentMessageType: string,
  occurrences: FieldOccurrenceDto[],
): CompatibilityAnalysis {
  const currentOcc =
    occurrences.find((o) => o.messageType === currentMessageType) ?? occurrences[0];

  const refTypeName = currentOcc?.typeName ?? "";
  const refCardinality = currentOcc?.cardinality ?? "";
  const refMandatory = currentOcc?.isMandatory ?? false;

  const compatible: FieldOccurrenceDto[] = [];
  const incompatible: FieldOccurrenceDto[] = [];

  for (const occ of occurrences) {
    const sameType = occ.typeName === refTypeName;
    const sameCardinality = occ.cardinality === refCardinality;
    if (sameType && sameCardinality) compatible.push(occ);
    else incompatible.push(occ);
  }

  // Family rollup. Each compatible occurrence contributes one (prefix,
  // familyId, version) tuple — the map dedupes families/messageIds and
  // collects versions in order of insertion.
  const familyMap = new Map<string, CompatibleFamily>();
  for (const occ of compatible) {
    const prefix = extractPrefix(occ.messageType);
    const familyId = extractFamilyId(occ.messageType);
    const version = extractVersion(occ.messageType);
    const family = getFamilyByPrefix(prefix);

    if (!familyMap.has(prefix)) {
      familyMap.set(prefix, {
        prefix,
        officialName: family?.officialName ?? prefix,
        messageIds: [],
        versionsByMessageId: {},
      });
    }

    const entry = familyMap.get(prefix)!;
    if (!entry.versionsByMessageId[familyId]) {
      entry.versionsByMessageId[familyId] = [];
      entry.messageIds.push(familyId);
    }
    entry.versionsByMessageId[familyId].push(version);
  }

  for (const fam of familyMap.values()) {
    fam.messageIds.sort();
    for (const key of Object.keys(fam.versionsByMessageId))
      fam.versionsByMessageId[key].sort();
  }

  const incompatibleOccs: IncompatibleOccurrence[] = incompatible.map((occ) => {
    const diffs: string[] = [];

    if (occ.typeName !== refTypeName)
      diffs.push(`tipo ${occ.typeName} (referência: ${refTypeName})`);

    if (occ.cardinality !== refCardinality) {
      const wasOpt = !refMandatory;
      const isOpt = !occ.isMandatory;
      if (wasOpt && !isOpt) diffs.push("obrigatório aqui (referência: opcional)");
      else if (!wasOpt && isOpt) diffs.push("opcional aqui (referência: obrigatório)");
      else diffs.push(`cardinalidade ${occ.cardinality} (referência: ${refCardinality})`);
    }

    const prefix = extractPrefix(occ.messageType);
    const family = getFamilyByPrefix(prefix);

    return {
      messageType: occ.messageType,
      familyOfficialName: family?.officialName ?? prefix,
      xpath: occ.xpath,
      cardinality: occ.cardinality,
      typeName: occ.typeName,
      isMandatory: occ.isMandatory,
      differences: diffs,
    };
  });

  // Current family first, then alphabetical by prefix.
  const currentPrefix = extractPrefix(currentMessageType);
  const sortedFamilies = Array.from(familyMap.values()).sort((a, b) => {
    if (a.prefix === currentPrefix) return -1;
    if (b.prefix === currentPrefix) return 1;
    return a.prefix.localeCompare(b.prefix);
  });

  return {
    currentTypeName: refTypeName,
    currentCardinality: refCardinality,
    compatibleFamilies: sortedFamilies,
    incompatibleOccurrences: incompatibleOccs,
    totalCompatible: compatible.length,
    totalIncompatible: incompatible.length,
  };
}
